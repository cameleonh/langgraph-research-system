/**
 * MarkerConverter - PDF to Markdown Conversion Tool
 * Uses Marker (GPU-accelerated) for high-quality PDF to Markdown conversion
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config.js';
import type { ToolResult, ConversionResult, ConversionOptions } from '../types/index.js';

const logger = createLogger('MarkerConverter');

/**
 * Default options for PDF conversion
 */
const DEFAULT_OPTIONS: ConversionOptions = {
  outputFormat: 'markdown',
  gpuEnabled: true,
  batchSize: 10,
  extractImages: false,
  preserveLayout: true,
};

/**
 * MarkerConverter class for PDF to Markdown conversion
 */
export class MarkerConverter {
  private config = getConfig();
  private markerPath?: string;

  constructor(markerPath?: string) {
    this.markerPath = markerPath;
  }

  /**
   * Check if Marker is installed and available
   */
  async checkMarkerAvailable(): Promise<boolean> {
    try {
      const result = await this.runCommand(['--version'], true);
      return result.success;
    } catch {
      logger.warn('Marker not found in PATH. PDF conversion may not work.');
      return false;
    }
  }

  /**
   * Convert a PDF file to Markdown
   */
  async convert(
    pdfPath: string,
    options: Partial<ConversionOptions> = {}
  ): Promise<ToolResult<ConversionResult>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    try {
      // Validate input file exists
      await fs.access(pdfPath);

      // Prepare output path
      const outputDir = path.dirname(pdfPath);
      const baseName = path.basename(pdfPath, '.pdf');
      const outputPath = path.join(outputDir, `${baseName}.md`);

      logger.info(`Converting PDF: ${pdfPath}`);

      // Build Marker command arguments
      const args = this.buildArgs(pdfPath, outputPath, opts);

      // Run Marker conversion
      const result = await this.runCommand(args);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Marker conversion failed',
        };
      }

      // Read the generated Markdown
      const markdown = await fs.readFile(outputPath, 'utf-8');

      // Extract metadata from the Markdown
      const metadata = this.extractMetadata(markdown);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      logger.info(`Conversion completed in ${processingTime}ms`);

      return {
        success: true,
        data: {
          markdown,
          metadata: {
            ...metadata,
            processingTime,
          },
        },
        metadata: {
          pdfPath,
          outputPath,
          wordCount: this.countWords(markdown),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('PDF conversion failed', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Convert multiple PDFs in batch
   */
  async convertBatch(
    pdfPaths: string[],
    options: Partial<ConversionOptions> = {}
  ): Promise<ToolResult<ConversionResult[]>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    logger.info(`Batch converting ${pdfPaths.length} PDFs`);

    const results: ConversionResult[] = [];
    const errors: Array<{ path: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < pdfPaths.length; i += opts.batchSize!) {
      const batch = pdfPaths.slice(i, i + opts.batchSize!);
      const batchPromises = batch.map(async (pdfPath) => {
        const result = await this.convert(pdfPath, options);
        if (result.success && result.data) {
          return { success: true, data: result.data, path: pdfPath };
        }
        return { success: false, error: result.error, path: pdfPath };
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push({ path: result.path, error: result.error || 'Unknown error' });
        }
      }

      logger.info(`Batch ${Math.floor(i / opts.batchSize!) + 1} completed`);
    }

    const processingTime = Date.now() - startTime;

    logger.info(`Batch conversion completed: ${results.successful}/${pdfPaths.length} successful in ${processingTime}ms`);

    return {
      success: errors.length === 0,
      data: results,
      error: errors.length > 0 ? `${errors.length} conversions failed` : undefined,
      metadata: {
        total: pdfPaths.length,
        successful: results.length,
        failed: errors.length,
        errors,
        processingTime,
      },
    };
  }

  /**
   * Build command arguments for Marker
   */
  private buildArgs(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions
  ): string[] {
    const args: string[] = [];

    // Input file
    args.push(inputPath);

    // Output file
    args.push('-o', outputPath);

    // Output format
    if (options.outputFormat === 'text') {
      args.push('--fmt', 'txt');
    }

    // GPU settings
    if (!options.gpuEnabled) {
      args.push('--cpu-only');
    }

    // Image extraction
    if (options.extractImages) {
      args.push('--extract-images');
    }

    // Layout preservation
    if (options.preserveLayout) {
      args.push('--preserve-layout');
    }

    return args;
  }

  /**
   * Run Marker command
   */
  private async runCommand(
    args: string[],
    quiet = false
  ): Promise<ToolResult<string>> {
    return new Promise((resolve) => {
      const markerCmd = this.markerPath || 'marker';

      const proc = spawn(markerCmd, args, {
        stdio: quiet ? 'pipe' : 'inherit',
      });

      let stdout = '';
      let stderr = '';

      if (quiet) {
        proc.stdout?.on('data', (data) => {
          stdout += data.toString();
        });
        proc.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, data: stdout });
        } else {
          resolve({
            success: false,
            error: stderr || `Marker exited with code ${code}`,
          });
        }
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to spawn Marker: ${error.message}`,
        });
      });
    });
  }

  /**
   * Extract metadata from Markdown content
   */
  private extractMetadata(markdown: string): Partial<ConversionResult['metadata']> {
    const metadata: Partial<ConversionResult['metadata']> = {};

    // Try to extract title from first heading
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    // Try to extract authors from common patterns
    const authorMatch = markdown.match(/(?:authors?|by):\s*(.+)$/im);
    if (authorMatch) {
      metadata.authors = authorMatch[1]
        .split(/,|&|and/)
        .map((a) => a.trim())
        .filter(Boolean);
    }

    // Count pages from common patterns
    const pageMatch = markdown.match(/(\d+)\s+pages?/i);
    if (pageMatch) {
      metadata.pageCount = parseInt(pageMatch[1], 10);
    }

    return metadata;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

  /**
   * Clean up temporary files
   */
  async cleanup(outputPath: string): Promise<void> {
    try {
      await fs.unlink(outputPath);
      logger.debug(`Cleaned up: ${outputPath}`);
    } catch (error) {
      logger.warn(`Failed to clean up ${outputPath}:`, error);
    }
  }
}

/**
 * Singleton instance
 */
let converterInstance: MarkerConverter | null = null;

/**
 * Get the MarkerConverter singleton instance
 */
export function getConverter(): MarkerConverter {
  if (!converterInstance) {
    converterInstance = new MarkerConverter();
  }
  return converterInstance;
}

/**
 * Convenience function to convert a single PDF
 */
export async function convertPDF(
  pdfPath: string,
  options?: Partial<ConversionOptions>
): Promise<ToolResult<ConversionResult>> {
  const converter = getConverter();
  return converter.convert(pdfPath, options);
}

/**
 * Convenience function to convert multiple PDFs
 */
export async function convertPDFs(
  pdfPaths: string[],
  options?: Partial<ConversionOptions>
): Promise<ToolResult<ConversionResult[]>> {
  const converter = getConverter();
  return converter.convertBatch(pdfPaths, options);
}

export default MarkerConverter;
