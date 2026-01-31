/**
 * Convert Node - PDF to Markdown Conversion
 * First node in the workflow that converts PDF papers to Markdown
 */

import type { State } from '../state/schema.js';
import { createLogger } from '../utils/logger.js';
import { convertPDF } from '../tools/MarkerConverter.js';
import { promises as fs } from 'fs';
import path from 'path';
import type { StateUpdate } from '../state/schema.js';

const logger = createLogger('ConvertNode');

/**
 * Convert node - Converts PDF to Markdown
 * @param state Current workflow state
 * @returns State update with markdown content
 */
export async function convertNode(state: State): Promise<StateUpdate> {
  try {
    logger.info(`Starting PDF conversion: ${state.pdfPath}`);

    // Update status to converting
    const update: StateUpdate = {
      status: 'converting',
      log: [`Starting conversion: ${state.pdfPath}`],
    };

    // Check if PDF exists
    try {
      await fs.access(state.pdfPath);
    } catch {
      logger.error(`PDF not found: ${state.pdfPath}`);
      return {
        ...update,
        status: 'error',
        error: `PDF file not found: ${state.pdfPath}`,
      };
    }

    // Get file stats for metadata
    const stats = await fs.stat(state.pdfPath);

    // Extract basic metadata from filename
    const filename = path.basename(state.pdfPath);
    const metadata = {
      filename,
      filepath: state.pdfPath,
      filesize: stats.size,
    };

    // Perform conversion
    const result = await convertPDF(state.pdfPath);

    if (!result.success || !result.data) {
      logger.error('PDF conversion failed', result.error);
      return {
        ...update,
        status: 'error',
        error: result.error || 'Conversion failed',
      };
    }

    // Update state with conversion results
    logger.info(`Conversion completed: ${result.data.metadata.wordCount} words`);

    return {
      ...update,
      status: 'analyzing',
      markdown: result.data.markdown,
      metadata: {
        ...metadata,
        ...result.data.metadata,
        pageCount: result.data.metadata.pageCount,
        title: result.data.metadata.title,
        authors: result.data.metadata.authors,
      },
      log: [
        `Conversion completed: ${result.data.metadata.wordCount} words`,
        `Markdown generated: ${filename}.md`,
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Convert node failed', error);

    return {
      status: 'error',
      error: errorMessage,
      log: [`Conversion error: ${errorMessage}`],
    };
  }
}

/**
 * Convert node with retry logic
 * @param state Current workflow state
 * @returns State update with markdown content or retry status
 */
export async function convertNodeWithRetry(state: State): Promise<StateUpdate> {
  const maxRetries = state.maxRetries || 3;
  const currentAttempt = state.retryInfo?.attempt || 0;

  try {
    const result = await convertNode(state);

    // If conversion succeeded, return the result
    if (result.status !== 'error') {
      return result;
    }

    // Check if we should retry
    if (currentAttempt < maxRetries) {
      logger.warn(`Conversion failed, retrying (attempt ${currentAttempt + 1}/${maxRetries})`);

      return {
        status: 'retry',
        retryInfo: {
          attempt: currentAttempt + 1,
          maxAttempts: maxRetries,
          reason: 'PDF conversion failed',
          lastError: result.error,
        },
        log: [`Retry attempt ${currentAttempt + 1}/${maxRetries}`],
      };
    }

    // Max retries exceeded
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Convert node with retry failed', error);

    return {
      status: 'error',
      error: errorMessage,
      retryInfo: {
        attempt: currentAttempt + 1,
        maxAttempts: maxRetries,
        reason: 'Unexpected error during conversion',
        lastError: errorMessage,
      },
    };
  }
}

/**
 * Batch convert node for multiple papers
 * @param state Current workflow state
 * @returns State update with batch conversion results
 */
export async function batchConvertNode(state: State): Promise<StateUpdate> {
  try {
    const pdfPaths = state.pdfPaths || [state.pdfPath];

    if (pdfPaths.length === 0) {
      return {
        status: 'error',
        error: 'No PDF paths provided',
      };
    }

    logger.info(`Batch converting ${pdfPaths.length} PDFs`);

    const results = [];
    const errors: Array<{ path: string; error: string }> = [];

    for (let i = 0; i < pdfPaths.length; i++) {
      const pdfPath = pdfPaths[i];
      logger.info(`Converting PDF ${i + 1}/${pdfPaths.length}: ${pdfPath}`);

      const singlePaperState: State = {
        ...state,
        pdfPath,
        currentPaperIndex: i,
      };

      const result = await convertNode(singlePaperState);

      if (result.status === 'error') {
        errors.push({ path: pdfPath, error: result.error || 'Unknown error' });
      } else {
        results.push({
          index: i,
          pdfPath,
          markdown: result.markdown,
          metadata: result.metadata,
        });
      }

      // Update progress
      const progress = Math.round(((i + 1) / pdfPaths.length) * 100);
      logger.info(`Batch conversion progress: ${progress}%`);
    }

    logger.info(`Batch conversion completed: ${results.length}/${pdfPaths.length} successful`);

    return {
      status: errors.length === 0 ? 'analyzing' : 'error',
      aggregatedResults: results,
      error: errors.length > 0 ? `${errors.length} conversions failed` : undefined,
      log: [
        `Batch conversion: ${results.length}/${pdfPaths.length} successful`,
        ...(errors.map((e) => `Error: ${e.path} - ${e.error}`)),
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Batch convert node failed', error);

    return {
      status: 'error',
      error: errorMessage,
    };
  }
}

export default convertNode;
