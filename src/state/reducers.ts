/**
 * State Reducers for LangGraph Research System
 * Custom reducers for complex state updates
 */

import type { State, PaperAnalysis, QualityCheck, RetryInfo } from './schema';

/**
 * Reducer for analysis results
 * Merges new analysis with existing analysis
 */
export function analysisReducer(
  prev: PaperAnalysis | null,
  next: PaperAnalysis | null
): PaperAnalysis | null {
  if (!next) return prev;
  if (!prev) return next;

  return {
    researchGap: [...(prev.researchGap || []), ...(next.researchGap || [])],
    relatedPapers: [...(prev.relatedPapers || []), ...(next.relatedPapers || [])],
    keyFindings: [...(prev.keyFindings || []), ...(next.keyFindings || [])],
    methodology: next.methodology || prev.methodology,
    conclusions: next.conclusions || prev.conclusions,
    strengths: [...(prev.strengths || []), ...(next.strengths || [])],
    limitations: [...(prev.limitations || []), ...(next.limitations || [])],
    suggestions: [...(prev.suggestions || []), ...(next.suggestions || [])],
  };
}

/**
 * Reducer for quality check results
 * Keeps the most recent quality check
 */
export function qualityCheckReducer(
  prev: QualityCheck | null,
  next: QualityCheck | null
): QualityCheck | null {
  return next ?? prev;
}

/**
 * Reducer for retry information
 * Updates retry info while preserving history
 */
export function retryInfoReducer(
  prev: RetryInfo | null,
  next: RetryInfo | null
): RetryInfo | null {
  if (!next) return prev;
  return {
    ...next,
    lastError: prev?.lastError,
  };
}

/**
 * Reducer for log entries
 * Appends new logs to existing logs
 */
export function logReducer(prev: string[] | null, next: string[] | null): string[] {
  if (!next) return prev || [];
  if (!prev) return next;
  return [...prev, ...next];
}

/**
 * Reducer for aggregated results in multi-paper workflows
 */
export function aggregatedResultsReducer<T>(
  prev: T[] | null,
  next: T[] | null
): T[] {
  if (!next) return prev || [];
  if (!prev) return next;
  return [...prev, ...next];
}

/**
 * Reducer for status updates
 * Prevents status regression (e.g., from 'completed' back to 'processing')
 */
export function statusReducer(
  prev: string | null,
  next: string | null
): string | null {
  if (!next) return prev;
  if (!prev) return next;

  // Define status progression order
  const statusOrder: Record<string, number> = {
    'idle': 0,
    'converting': 1,
    'analyzing': 2,
    'writing': 3,
    'quality_check': 4,
    'retry': 5, // retry can happen at any point
    'error': 6,
    'completed': 7,
  };

  const prevLevel = statusOrder[prev] ?? 0;
  const nextLevel = statusOrder[next] ?? 0;

  // Allow retry to override any status
  // Allow error to override any status except completed
  // Allow normal progression
  if (next === 'retry') {
    return next;
  }
  if (next === 'error' && prev !== 'completed') {
    return next;
  }
  if (nextLevel >= prevLevel) {
    return next;
  }

  return prev;
}

/**
 * Merge reducer for partial state updates
 * Combines multiple state updates intelligently
 */
export function mergeStateReducer(
  state: State,
  update: Partial<State>
): State {
  const result: State = { ...state };

  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) continue;

    // Apply custom reducers for specific fields
    switch (key as keyof State) {
      case 'analysis':
        result.analysis = analysisReducer(state.analysis, value as PaperAnalysis | null);
        break;
      case 'qualityCheck':
        result.qualityCheck = qualityCheckReducer(state.qualityCheck, value as QualityCheck | null);
        break;
      case 'retryInfo':
        result.retryInfo = retryInfoReducer(state.retryInfo, value as RetryInfo | null);
        break;
      case 'log':
        result.log = logReducer(state.log, value as string[] | null);
        break;
      case 'aggregatedResults':
        result.aggregatedResults = aggregatedResultsReducer(
          state.aggregatedResults,
          value as Record<string, unknown>[] | null
        );
        break;
      case 'status':
        result.status = statusReducer(state.status, value as string | null) as any;
        break;
      default:
        // Default: use new value if provided
        (result as any)[key] = value;
    }
  }

  return result;
}

/**
 * Batch reducer for multiple state updates
 * Useful for processing multiple papers in parallel
 */
export function batchStateReducer(
  state: State,
  updates: Partial<State>[]
): State {
  return updates.reduce((acc, update) => mergeStateReducer(acc, update), state);
}

/**
 * Selectors for extracting specific state slices
 */
export const selectors = {
  /**
   * Get the current workflow phase
   */
  getPhase: (state: State): string => {
    return state.status || 'idle';
  },

  /**
   * Check if workflow is in a terminal state
   */
  isTerminal: (state: State): boolean => {
    return ['completed', 'error'].includes(state.status || '');
  },

  /**
   * Check if workflow is processing
   */
  isProcessing: (state: State): boolean => {
    return ['converting', 'analyzing', 'writing', 'quality_check'].includes(state.status || '');
  },

  /**
   * Get progress percentage for multi-paper workflows
   */
  getProgress: (state: State): number => {
    if (state.totalPapers <= 1) return 0;
    return Math.round((state.currentPaperIndex / state.totalPapers) * 100);
  },

  /**
   * Get all errors from state
   */
  getErrors: (state: State): string[] => {
    const errors: string[] = [];
    if (state.error) errors.push(state.error);
    if (state.retryInfo?.lastError) errors.push(state.retryInfo.lastError);
    return errors;
  },

  /**
   * Get quality metrics
   */
  getQualityMetrics: (state: State): { score: number; issues: number; passed: boolean } | null => {
    if (!state.qualityCheck) return null;
    return {
      score: state.qualityCheck.score,
      issues: state.qualityCheck.issues.length,
      passed: state.qualityCheck.passed,
    };
  },
};

/**
 * Validators for state integrity
 */
export const validators = {
  /**
   * Validate that required fields are present
   */
  hasRequiredFields: (state: State): boolean => {
    return !!(state.pdfPath || state.pdfPaths?.length);
  },

  /**
   * Validate that conversion succeeded
   */
  hasConversionResult: (state: State): boolean => {
    return !!state.markdown;
  },

  /**
   * Validate that analysis succeeded
   */
  hasAnalysisResult: (state: State): boolean => {
    return !!state.analysis && state.analysis.keyFindings.length > 0;
  },

  /**
   * Validate that draft was generated
   */
  hasDraftResult: (state: State): boolean => {
    return !!state.draft && state.draft.length > 0;
  },

  /**
   * Validate complete workflow result
   */
  isCompleteResult: (state: State): boolean => {
    return validators.hasConversionResult(state) &&
           validators.hasAnalysisResult(state) &&
           validators.hasDraftResult(state);
  },
};

export default {
  analysisReducer,
  qualityCheckReducer,
  retryInfoReducer,
  logReducer,
  aggregatedResultsReducer,
  statusReducer,
  mergeStateReducer,
  batchStateReducer,
  selectors,
  validators,
};
