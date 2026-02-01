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
  private condaPath = 'C:\\ProgramData\\Anaconda3\\Scripts\\conda.exe';
  private condaEnv = 'LangGraph';
  private useConda = true;

  constructor(markerPath?: string) {
    // If markerPath is provided, use it directly (legacy mode)
    if (markerPath) {
      this.markerPath = markerPath;
      this.useConda = false;
    }
  }

  private markerPath?: string;

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

      // Prepare output path - Marker saves to ./output/{basename} by default
      const baseName = path.basename(pdfPath, '.pdf').replace('.pdf', '');
      const markerOutputPath = path.join(process.cwd(), 'output', baseName, baseName + '.md');

      // Build Marker command arguments
      const args = this.buildArgs(pdfPath, markerOutputPath, opts);

      // Run Marker conversion
      const result = await this.runCommand(args);

      if (!result.success) {
      return {
        success: false,
        data: undefined,
        error: result.error || 'Marker conversion failed',
        metadata: undefined,
      };
      }

      // Read the generated Markdown
      const markdown = await fs.readFile(markerOutputPath, 'utf-8');

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
          outputPath: markerOutputPath,
          wordCount: this.countWords(markdown),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('PDF conversion failed', error);

      return {
        success: false,
        data: undefined,
        error: errorMessage,
        metadata: undefined,
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

    if (pdfPaths.length === 0) {
      return {
        success: false,
        data: undefined,
        error: 'No PDF paths provided',
        metadata: undefined,
      };
    }

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

    logger.info(`Batch conversion completed: ${results.length}/${pdfPaths.length} successful in ${processingTime}ms`);

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
   * Note: Marker has limited options, only using supported ones
   */
  private buildArgs(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions
  ): string[] {
    const args: string[] = [];

    // Input file (Marker will save to its default output directory)
    args.push(inputPath);

    // GPU settings
    if (!options.gpuEnabled) {
      args.push('--cpu-only');
      logger.info('GPU disabled: Using CPU-only mode');
    } else {
      logger.info('GPU enabled: Marker will use GPU acceleration if available');
    }

    // Image extraction (disable by default for speed)
    if (!options.extractImages) {
      args.push('--disable_image_extraction');
    }

    // Note: --preserve-layout is not supported in current marker-pdf
    // Note: -o output option is not supported, Marker uses fixed output path

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
      let command: string;
      let commandArgs: string[];

      if (this.useConda) {
        // Use conda run to execute marker in the conda environment
        command = this.condaPath;
        // Quote paths with spaces or special characters
        commandArgs = ['run', '-n', this.condaEnv, 'marker_single', ...args.map(a => a.includes(' ') ? `"${a}"` : a)];
        logger.debug(`Using conda env: ${this.condaEnv}`);
      } else {
        // Legacy mode: use marker_single directly
        command = this.markerPath!;
        commandArgs = args;
      }

      const proc = spawn(command, commandArgs, {
        stdio: quiet ? 'pipe' : 'inherit',
        shell: true,
        env: {
          ...process.env,
          KMP_DUPLICATE_LIB_OK: 'TRUE',
        },
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
