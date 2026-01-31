/**
 * Literature Review Workflow
 * Advanced workflow with quality checks and retry logic:
 * convert → analyze → quality_check → [retry|write] → quality_check → [retry|completed]
 */

import { StateGraph } from '@langchain/langgraph';
import { END } from '@langchain/langgraph';
import type { State } from '../state/schema.js';
import { StateAnnotation } from '../state/schema.js';
import { createLogger } from '../utils/logger.js';
import { convertNode } from '../nodes/convertNode.js';
import { analyzeNode } from '../nodes/analyzeNode.js';
import { writeLiteratureReviewNode } from '../nodes/writeNode.js';
import { analysisQualityCheckNode, draftQualityCheckNode } from '../nodes/qualityCheckNode.js';
import { shouldRetry, formatDuration } from '../state/schema.js';

const logger = createLogger('LiteratureReviewWorkflow');

/**
 * Route function for quality check results
 * Determines next node based on quality check results
 */
function qualityCheckRoute(state: State): 'analyze' | 'write' | 'completed' {
  if (!state.qualityCheck) {
    return 'completed';
  }

  // If quality check passed, continue to next phase or complete
  if (state.qualityCheck.passed) {
    // If we don't have a draft yet, go to write
    if (!state.draft) {
      return 'write';
    }
    // Otherwise we're done
    return 'completed';
  }

  // Quality check failed - check if we should retry
  if (!shouldRetry(state)) {
    logger.warn('Max retries exceeded, accepting current quality');
    return 'completed';
  }

  // Determine what needs to be redone
  if (!state.draft) {
    // Analysis failed quality check
    return 'analyze';
  }

  // Draft failed quality check
  return 'write';
}

/**
 * Create the literature review workflow
 * Flow: convert → analyze → quality_check → [retry|write] → quality_check → [retry|completed]
 */
export function createLiteratureReviewWorkflow() {
  logger.info('Creating literature review workflow');

  const workflow = new StateGraph(StateAnnotation)
    .addNode('convert', convertNode)
    .addNode('analyze', analyzeNode)
    .addNode('analysis_quality_check', analysisQualityCheckNode)
    .addNode('write', writeLiteratureReviewNode)
    .addNode('draft_quality_check', draftQualityCheckNode)
    .addEdge('convert', 'analyze')
    .addEdge('analyze', 'analysis_quality_check')
    .addConditionalEdges(
      'analysis_quality_check',
      qualityCheckRoute,
      {
        analyze: 'analyze',
        write: 'write',
        completed: END,
      }
    )
    .addEdge('write', 'draft_quality_check')
    .addConditionalEdges(
      'draft_quality_check',
      qualityCheckRoute,
      {
        analyze: 'analyze',
        write: 'write',
        completed: END,
      }
    )
    .setEntryPoint('convert');

  return workflow.compile();
}

/**
 * Run the literature review workflow
 * @param pdfPath Path to the PDF file
 * @param query Research query/prompt
 * @param maxRetries Maximum number of retries for quality checks
 * @returns Final state after workflow completion
 */
export async function runLiteratureReviewWorkflow(
  pdfPath: string,
  query: string,
  maxRetries: number = 3
): Promise<State> {
  logger.info(`Running literature review workflow: ${pdfPath} (max retries: ${maxRetries})`);

  const startTime = Date.now();
  const workflow = createLiteratureReviewWorkflow();

  // Initial state
  const initialState: State = {
    pdfPath,
    query,
    status: 'idle',
    startTime,
    lastUpdated: startTime,
    maxRetries,
    retryInfo: null,
    log: [`Starting literature review workflow: ${pdfPath}`],
  };

  try {
    // Run the workflow
    const result = await workflow.invoke(initialState);

    const duration = Date.now() - startTime;
    logger.info(`Literature review workflow completed in ${formatDuration(duration)}`);
    logger.info(`Final status: ${result.status}`);

    // Log the workflow summary
    if (result.status === 'completed') {
      logger.info('✓ Literature review workflow completed successfully');

      if (result.qualityCheck) {
        logger.info(`Final quality score: ${result.qualityCheck.score}/100`);
      }

      if (result.retryInfo) {
        logger.info(`Retries performed: ${result.retryInfo.attempt}`);
      }

      if (result.summary) {
        logger.debug(`Summary: ${result.summary.substring(0, 100)}...`);
      }

      if (result.analysis) {
        logger.info(`Extracted ${result.analysis.keyFindings.length} key findings`);
        logger.info(`Identified ${result.analysis.researchGap.length} research gaps`);
        logger.info(`Found ${result.analysis.relatedPapers.length} related papers`);
      }

      if (result.draft) {
        logger.info(`Literature review generated: ${result.draft.length} characters`);
      }
    } else if (result.status === 'error') {
      logger.error(`✗ Literature review workflow failed: ${result.error}`);
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Literature review workflow execution failed', error);

    return {
      ...initialState,
      status: 'error',
      error: errorMessage,
      lastUpdated: Date.now(),
      log: [...(initialState.log || []), `Literature review workflow error: ${errorMessage}`],
    };
  }
}

/**
 * Run the literature review workflow with detailed progress reporting
 * @param pdfPath Path to the PDF file
 * @param query Research query/prompt
 * @param maxRetries Maximum number of retries for quality checks
 * @param onProgress Callback for detailed progress updates
 * @returns Final state after workflow completion
 */
export async function runLiteratureReviewWorkflowWithProgress(
  pdfPath: string,
  query: string,
  maxRetries: number = 3,
  onProgress?: (phase: string, status: string, details?: Record<string, unknown>) => void
): Promise<State> {
  logger.info(`Running literature review workflow with progress: ${pdfPath}`);

  const startTime = Date.now();
  const workflow = createLiteratureReviewWorkflow();

  // Initial state
  const initialState: State = {
    pdfPath,
    query,
    status: 'idle',
    startTime,
    lastUpdated: startTime,
    maxRetries,
    retryInfo: null,
    log: [`Starting literature review workflow: ${pdfPath}`],
  };

  try {
    // Create a wrapped workflow that calls the progress callback
    const result = await workflow.invoke(initialState, {
      callbacks: [
        {
          handleGraphStart: () => {
            onProgress?.('workflow', 'started', { message: 'Initializing literature review workflow...' });
          },
          handleNodeStart: (node: string) => {
            const messages: Record<string, string> = {
              convert: 'Converting PDF to Markdown...',
              analyze: 'Analyzing paper with LLM...',
              analysis_quality_check: 'Checking analysis quality...',
              write: 'Generating literature review...',
              draft_quality_check: 'Checking draft quality...',
            };
            onProgress?.(node, 'processing', { message: messages[node] || `Processing ${node}...` });
          },
          handleNodeEnd: (node: string, output: unknown) => {
            const outputState = output as State;
            const details: Record<string, unknown> = { node };

            if (node === 'analysis_quality_check' && outputState.qualityCheck) {
              details.qualityScore = outputState.qualityCheck.score;
              details.passed = outputState.qualityCheck.passed;
              details.issues = outputState.qualityCheck.issues.length;
            }

            if (node === 'draft_quality_check' && outputState.qualityCheck) {
              details.qualityScore = outputState.qualityCheck.score;
              details.passed = outputState.qualityCheck.passed;
              details.issues = outputState.qualityCheck.issues.length;
            }

            if (node === 'analyze' && outputState.analysis) {
              details.findings = outputState.analysis.keyFindings.length;
              details.gaps = outputState.analysis.researchGap.length;
            }

            onProgress?.(node, 'completed', details);
          },
          handleGraphEnd: () => {
            onProgress?.('workflow', 'completed', { message: 'Literature review workflow finished' });
          },
        },
      ],
    });

    const duration = Date.now() - startTime;
    logger.info(`Literature review workflow completed in ${formatDuration(duration)}`);

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Literature review workflow execution failed', error);

    onProgress?.('workflow', 'error', { message: errorMessage });

    return {
      ...initialState,
      status: 'error',
      error: errorMessage,
      lastUpdated: Date.now(),
      log: [...(initialState.log || []), `Literature review workflow error: ${errorMessage}`],
    };
  }
}

/**
 * Validate inputs for literature review workflow
 */
export function validateLiteratureReviewInputs(
  pdfPath: string,
  query: string,
  maxRetries: number
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

  if (maxRetries < 0 || maxRetries > 10) {
    return { valid: false, error: 'Max retries must be between 0 and 10' };
  }

  return { valid: true };
}

/**
 * Get a summary of the literature review workflow results
 */
export function getLiteratureReviewSummary(state: State): {
  status: string;
  qualityScore?: number;
  retries?: number;
  findings?: number;
  relatedPapers?: number;
  draftLength?: number;
  duration: string;
} {
  return {
    status: state.status || 'unknown',
    qualityScore: state.qualityCheck?.score,
    retries: state.retryInfo?.attempt,
    findings: state.analysis?.keyFindings.length,
    relatedPapers: state.analysis?.relatedPapers.length,
    draftLength: state.draft?.length,
    duration: formatDuration(state.lastUpdated - state.startTime),
  };
}

export default createLiteratureReviewWorkflow;
