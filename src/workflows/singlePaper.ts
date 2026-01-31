/**
 * Single Paper Workflow
 * Linear workflow: convert → analyze → write
 */

import { StateGraph } from '@langchain/langgraph';
import { END } from '@langchain/langgraph';
import type { State } from '../state/schema.js';
import { StateAnnotation } from '../state/schema.js';
import { createLogger } from '../utils/logger.js';
import { convertNode } from '../nodes/convertNode.js';
import { analyzeNode } from '../nodes/analyzeNode.js';
import { writeNode } from '../nodes/writeNode.js';
import { formatDuration } from '../state/schema.js';

const logger = createLogger('SinglePaperWorkflow');

/**
 * Create the single paper workflow
 * Linear flow: convert → analyze → write → END
 */
export function createSinglePaperWorkflow() {
  logger.info('Creating single paper workflow');

  const workflow = new StateGraph(StateAnnotation)
    .addNode('convert', convertNode)
    .addNode('analyze', analyzeNode)
    .addNode('write', writeNode)
    .addEdge('convert', 'analyze')
    .addEdge('analyze', 'write')
    .addEdge('write', END)
    .setEntryPoint('convert');

  return workflow.compile();
}

/**
 * Run the single paper workflow
 * @param pdfPath Path to the PDF file
 * @param query Research query/prompt
 * @returns Final state after workflow completion
 */
export async function runSinglePaperWorkflow(
  pdfPath: string,
  query: string
): Promise<State> {
  logger.info(`Running single paper workflow: ${pdfPath}`);

  const startTime = Date.now();
  const workflow = createSinglePaperWorkflow();

  // Initial state
  const initialState: State = {
    pdfPath,
    query,
    status: 'idle',
    startTime,
    lastUpdated: startTime,
    maxRetries: 3,
    log: [`Starting single paper workflow: ${pdfPath}`],
  };

  try {
    // Run the workflow
    const result = await workflow.invoke(initialState);

    const duration = Date.now() - startTime;
    logger.info(`Workflow completed in ${formatDuration(duration)}`);
    logger.info(`Final status: ${result.status}`);

    // Log the workflow summary
    if (result.status === 'completed') {
      logger.info('✓ Single paper workflow completed successfully');

      if (result.summary) {
        logger.debug(`Summary: ${result.summary.substring(0, 100)}...`);
      }

      if (result.analysis) {
        logger.info(`Extracted ${result.analysis.keyFindings.length} key findings`);
        logger.info(`Identified ${result.analysis.researchGap.length} research gaps`);
      }

      if (result.draft) {
        logger.info(`Draft generated: ${result.draft.length} characters`);
      }
    } else if (result.status === 'error') {
      logger.error(`✗ Workflow failed: ${result.error}`);
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Workflow execution failed', error);

    return {
      ...initialState,
      status: 'error',
      error: errorMessage,
      lastUpdated: Date.now(),
      log: [...(initialState.log || []), `Workflow error: ${errorMessage}`],
    };
  }
}

/**
 * Run the single paper workflow with progress callback
 * @param pdfPath Path to the PDF file
 * @param query Research query/prompt
 * @param onProgress Callback for progress updates
 * @returns Final state after workflow completion
 */
export async function runSinglePaperWorkflowWithProgress(
  pdfPath: string,
  query: string,
  onProgress?: (status: string, message: string) => void
): Promise<State> {
  logger.info(`Running single paper workflow with progress: ${pdfPath}`);

  const startTime = Date.now();
  const workflow = createSinglePaperWorkflow();

  // Initial state
  const initialState: State = {
    pdfPath,
    query,
    status: 'idle',
    startTime,
    lastUpdated: startTime,
    maxRetries: 3,
    log: [`Starting single paper workflow: ${pdfPath}`],
  };

  try {
    // Create a wrapped workflow that calls the progress callback
    let lastStatus = 'idle';

    const result = await workflow.invoke(initialState, {
      callbacks: [
        {
          handleGraphStart: () => {
            onProgress?.('started', 'Initializing workflow...');
          },
          handleNodeStart: (node: string) => {
            if (node !== lastStatus) {
              lastStatus = node;
              const messages: Record<string, string> = {
                convert: 'Converting PDF to Markdown...',
                analyze: 'Analyzing paper content with LLM...',
                write: 'Generating draft report...',
              };
              onProgress?.(node, messages[node] || `Processing ${node}...`);
            }
          },
          handleNodeEnd: (node: string) => {
            const messages: Record<string, string> = {
              convert: 'PDF conversion completed',
              analyze: 'Analysis completed',
              write: 'Draft generated',
            };
            onProgress?.(node, messages[node] || `${node} completed`);
          },
          handleGraphEnd: () => {
            onProgress?.('completed', 'Workflow finished');
          },
        },
      ],
    });

    const duration = Date.now() - startTime;
    logger.info(`Workflow completed in ${formatDuration(duration)}`);

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Workflow execution failed', error);

    onProgress?.('error', errorMessage);

    return {
      ...initialState,
      status: 'error',
      error: errorMessage,
      lastUpdated: Date.now(),
      log: [...(initialState.log || []), `Workflow error: ${errorMessage}`],
    };
  }
}

/**
 * Validate inputs for single paper workflow
 */
export function validateSinglePaperInputs(
  pdfPath: string,
  query: string
): { valid: boolean; error?: string } {
  if (!pdfPath) {
    return { valid: false, error: 'PDF path is required' };
  }

  if (!pdfPath.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Input file must be a PDF' };
  }

  if (!query || query.trim().length === 0) {
    return { valid: false, error: 'Query is required' };
  }

  return { valid: true };
}

export default createSinglePaperWorkflow;
