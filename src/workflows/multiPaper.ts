/**
 * Multi-Paper Workflow
 * Processes multiple papers in sequence or parallel and generates comparative analysis
 */

import { StateGraph } from '@langchain/langgraph';
import { END } from '@langchain/langgraph';
import type { State } from '../state/schema.js';
import { StateAnnotation } from '../state/schema.js';
import { createLogger } from '../utils/logger.js';
import { convertNode } from '../nodes/convertNode.js';
import { analyzeNode } from '../nodes/analyzeNode.js';
import { writeComparativeAnalysisNode } from '../nodes/writeNode.js';
import { formatDuration } from '../state/schema.js';

const logger = createLogger('MultiPaperWorkflow');

/**
 * Route function for multi-paper processing
 * Determines if there are more papers to process
 */
function multiPaperRoute(state: State): 'convert' | 'write_comparison' | 'completed' {
  // If we've processed all papers, move to write comparison
  if (state.currentPaperIndex >= state.totalPapers - 1) {
    // Only write comparison if we have multiple papers with results
    if (state.totalPapers > 1 && state.aggregatedResults && state.aggregatedResults.length > 1) {
      return 'write_comparison';
    }
    return 'completed';
  }

  // Process next paper
  return 'convert';
}

/**
 * Update state for next paper in sequence
 */
function prepareNextPaper(state: State): Partial<State> {
  const nextIndex = state.currentPaperIndex + 1;
  const nextPdfPath = state.pdfPaths[nextIndex];

  logger.info(`Preparing next paper (${nextIndex + 1}/${state.totalPapers}): ${nextPdfPath}`);

  return {
    pdfPath: nextPdfPath,
    currentPaperIndex: nextIndex,
    status: 'converting',
    log: [`Processing paper ${nextIndex + 1}/${state.totalPapers}: ${nextPdfPath}`],
  };
}

/**
 * Create the multi-paper workflow
 * Flow: For each paper: convert → analyze → store results
 *       After all papers: write_comparative_analysis → completed
 */
export function createMultiPaperWorkflow() {
  logger.info('Creating multi-paper workflow');

  const workflow = new StateGraph(StateAnnotation)
    .addNode('convert', convertNode)
    .addNode('analyze', analyzeNode)
    .addNode('write_comparison', writeComparativeAnalysisNode)
    .addEdge('convert', 'analyze')
    .addConditionalEdges(
      'analyze',
      multiPaperRoute,
      {
        convert: 'convert',  // Process next paper (but we need to update state first)
        write_comparison: 'write_comparison',
        completed: END,
      }
    )
    .addEdge('write_comparison', END)
    .setEntryPoint('convert');

  return workflow.compile();
}

/**
 * Run the multi-paper workflow
 * @param pdfPaths Array of paths to PDF files
 * @param query Research query/prompt
 * @returns Final state after workflow completion
 */
export async function runMultiPaperWorkflow(
  pdfPaths: string[],
  query: string
): Promise<State> {
  logger.info(`Running multi-paper workflow: ${pdfPaths.length} papers`);

  const startTime = Date.now();

  // Process papers sequentially
  const aggregatedResults: Array<{
    index: number;
    pdfPath: string;
    markdown?: string | null;
    summary?: string | null;
    analysis?: object | null;
    metadata?: object | null;
  }> = [];

  for (let i = 0; i < pdfPaths.length; i++) {
    const pdfPath = pdfPaths[i];
    logger.info(`Processing paper ${i + 1}/${pdfPaths.length}: ${pdfPath}`);

    // Run single paper workflow for this paper
    const { runSinglePaperWorkflow } = await import('./singlePaper.js');
    const result = await runSinglePaperWorkflow(pdfPath, query);

    // Store result
    aggregatedResults.push({
      index: i,
      pdfPath,
      markdown: result.markdown,
      summary: result.summary,
      analysis: result.analysis,
      metadata: result.metadata,
    });

    // Log progress
    const progress = Math.round(((i + 1) / pdfPaths.length) * 100);
    logger.info(`Progress: ${progress}%`);
  }

  // Generate comparative analysis if we have multiple papers
  let draft: string | null = null;
  let finalStatus: 'completed' | 'error' = 'completed';

  if (aggregatedResults.length > 1) {
    logger.info('Generating comparative analysis...');

    const workflow = createMultiPaperWorkflow();

    // Create state for comparative analysis
    const comparisonState: State = {
      pdfPath: pdfPaths[0],
      pdfPaths,
      query,
      status: 'writing',
      currentPaperIndex: 0,
      totalPapers: pdfPaths.length,
      aggregatedResults,
      startTime,
      lastUpdated: Date.now(),
      maxRetries: 3,
      log: [`Generating comparative analysis for ${pdfPaths.length} papers`],
    };

    try {
      const result = await workflow.invoke(comparisonState);

      if (result.status === 'completed' && result.draft) {
        draft = result.draft;
        logger.info('Comparative analysis generated successfully');
      } else {
        logger.warn('Comparative analysis generation had issues, using aggregated results');
        finalStatus = result.status === 'error' ? 'error' : 'completed';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Comparative analysis generation failed', error);
      finalStatus = 'error';
    }
  }

  const duration = Date.now() - startTime;
  logger.info(`Multi-paper workflow completed in ${formatDuration(duration)}`);

  // Return final state
  return {
    pdfPath: pdfPaths[0],
    pdfPaths,
    query,
    status: finalStatus,
    currentPaperIndex: pdfPaths.length - 1,
    totalPapers: pdfPaths.length,
    aggregatedResults,
    draft,
    startTime,
    lastUpdated: Date.now(),
    maxRetries: 3,
    log: [
      `Processed ${pdfPaths.length} papers`,
      `Duration: ${formatDuration(duration)}`,
      draft ? 'Comparative analysis generated' : 'No comparative analysis',
    ],
  };
}

/**
 * Run the multi-paper workflow with parallel processing
 * @param pdfPaths Array of paths to PDF files
 * @param query Research query/prompt
 * @param concurrency Number of papers to process in parallel
 * @returns Final state after workflow completion
 */
export async function runMultiPaperWorkflowParallel(
  pdfPaths: string[],
  query: string,
  concurrency: number = 3
): Promise<State> {
  logger.info(`Running multi-paper workflow (parallel, concurrency: ${concurrency}): ${pdfPaths.length} papers`);

  const startTime = Date.now();

  // Process papers in batches
  const aggregatedResults: Array<{
    index: number;
    pdfPath: string;
    markdown?: string | null;
    summary?: string | null;
    analysis?: object | null;
    metadata?: object | null;
    error?: string;
  }> = [];

  for (let i = 0; i < pdfPaths.length; i += concurrency) {
    const batch = pdfPaths.slice(i, Math.min(i + concurrency, pdfPaths.length));
    logger.info(`Processing batch ${Math.floor(i / concurrency) + 1}: ${batch.length} papers`);

    // Process batch in parallel
    const batchPromises = batch.map(async (pdfPath, batchIndex) => {
      const globalIndex = i + batchIndex;
      logger.info(`Processing paper ${globalIndex + 1}/${pdfPaths.length}: ${pdfPath}`);

      try {
        const { runSinglePaperWorkflow } = await import('./singlePaper.js');
        const result = await runSinglePaperWorkflow(pdfPath, query);

        return {
          index: globalIndex,
          pdfPath,
          markdown: result.markdown,
          summary: result.summary,
          analysis: result.analysis,
          metadata: result.metadata,
          error: result.status === 'error' ? result.error : undefined,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to process ${pdfPath}:`, error);

        return {
          index: globalIndex,
          pdfPath,
          error: errorMessage,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    aggregatedResults.push(...batchResults);

    // Log progress
    const completedCount = i + batch.length;
    const progress = Math.round((completedCount / pdfPaths.length) * 100);
    logger.info(`Progress: ${progress}% (${completedCount}/${pdfPaths.length} papers)`);
  }

  // Generate comparative analysis if we have multiple successful results
  const successfulResults = aggregatedResults.filter((r) => !r.error);

  let draft: string | null = null;
  let finalStatus: 'completed' | 'error' = 'completed';

  if (successfulResults.length > 1) {
    logger.info('Generating comparative analysis...');

    try {
      // Use the writeComparativeAnalysisNode directly
      const { writeComparativeAnalysisNode } = await import('../nodes/writeNode.js');

      const tempState: State = {
        pdfPath: pdfPaths[0],
        pdfPaths,
        query,
        status: 'writing',
        currentPaperIndex: 0,
        totalPapers: pdfPaths.length,
        aggregatedResults: successfulResults,
        startTime,
        lastUpdated: Date.now(),
        maxRetries: 3,
        log: [],
      };

      const result = await writeComparativeAnalysisNode(tempState);

      if (result.status === 'completed' && result.draft) {
        draft = result.draft;
        logger.info('Comparative analysis generated successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Comparative analysis generation failed', error);
      // Don't fail the entire workflow if comparison fails
    }
  }

  const duration = Date.now() - startTime;
  logger.info(`Multi-paper workflow completed in ${formatDuration(duration)}`);
  logger.info(`Successful: ${successfulResults.length}/${pdfPaths.length} papers`);

  return {
    pdfPath: pdfPaths[0],
    pdfPaths,
    query,
    status: finalStatus,
    currentPaperIndex: pdfPaths.length - 1,
    totalPapers: pdfPaths.length,
    aggregatedResults,
    draft,
    startTime,
    lastUpdated: Date.now(),
    maxRetries: 3,
    log: [
      `Processed ${pdfPaths.length} papers (${successfulResults.length} successful)`,
      `Duration: ${formatDuration(duration)}`,
      draft ? 'Comparative analysis generated' : 'No comparative analysis',
    ],
  };
}

/**
 * Run the multi-paper workflow with progress reporting
 * @param pdfPaths Array of paths to PDF files
 * @param query Research query/prompt
 * @param onProgress Callback for progress updates
 * @returns Final state after workflow completion
 */
export async function runMultiPaperWorkflowWithProgress(
  pdfPaths: string[],
  query: string,
  onProgress?: (phase: string, progress: number, message: string) => void
): Promise<State> {
  onProgress?.('start', 0, `Starting multi-paper workflow: ${pdfPaths.length} papers`);

  const result = await runMultiPaperWorkflowParallel(pdfPaths, query, 3);

  // Report progress during execution
  for (let i = 0; i < pdfPaths.length; i++) {
    const progress = Math.round(((i + 1) / pdfPaths.length) * 100);
    onProgress?.('processing', progress, `Processing paper ${i + 1}/${pdfPaths.length}`);
  }

  onProgress?.('complete', 100, 'Multi-paper workflow completed');

  return result;
}

/**
 * Validate inputs for multi-paper workflow
 */
export function validateMultiPaperInputs(
  pdfPaths: string[],
  query: string
): { valid: boolean; error?: string } {
  if (!pdfPaths || pdfPaths.length === 0) {
    return { valid: false, error: 'At least one PDF path is required' };
  }

  if (pdfPaths.length > 20) {
    return { valid: false, error: 'Maximum 20 PDFs can be processed at once' };
  }

  for (const pdfPath of pdfPaths) {
    if (!pdfPath.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: `Invalid PDF file: ${pdfPath}` };
    }
  }

  if (!query || query.trim().length === 0) {
    return { valid: false, error: 'Query is required' };
  }

  return { valid: true };
}

/**
 * Get a summary of the multi-paper workflow results
 */
export function getMultiPaperSummary(state: State): {
  totalPapers: number;
  successfulPapers: number;
  failedPapers: number;
  hasComparativeAnalysis: boolean;
  duration: string;
} {
  const totalPapers = state.totalPapers || state.pdfPaths?.length || 0;
  const successfulPapers = state.aggregatedResults?.filter((r: any) => !r.error).length || 0;
  const failedPapers = totalPapers - successfulPapers;

  return {
    totalPapers,
    successfulPapers,
    failedPapers,
    hasComparativeAnalysis: !!state.draft,
    duration: formatDuration(state.lastUpdated - state.startTime),
  };
}

export default createMultiPaperWorkflow;
