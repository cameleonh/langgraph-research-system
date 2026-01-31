/**
 * State Schema for LangGraph Research System
 * Uses LangGraph's Annotation.Root() for state management
 */

import { Annotation } from '@langchain/langgraph';

/**
 * Status of the research workflow
 */
export type WorkflowStatus =
  | 'idle'
  | 'converting'
  | 'analyzing'
  | 'writing'
  | 'quality_check'
  | 'completed'
  | 'error'
  | 'retry';

/**
 * Research gap identified in a paper
 */
export interface ResearchGap {
  category: string;
  description: string;
  significance: 'low' | 'medium' | 'high';
}

/**
 * Related paper information
 */
export interface RelatedPaper {
  title: string;
  authors: string[];
  year?: number;
  url?: string;
  relevanceScore: number;
  relationship: 'builds_on' | 'contradicts' | 'extends' | 'similar';
}

/**
 * Key finding from a paper
 */
export interface KeyFinding {
  finding: string;
  evidence: string;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Analysis result from the LLM
 */
export interface PaperAnalysis {
  researchGap: ResearchGap[];
  relatedPapers: RelatedPaper[];
  keyFindings: KeyFinding[];
  methodology: string;
  conclusions: string;
  strengths: string[];
  limitations: string[];
  suggestions: string[];
}

/**
 * Quality check result
 */
export interface QualityCheck {
  passed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

/**
 * Metadata about the paper being processed
 */
export interface PaperMetadata {
  title?: string;
  authors?: string[];
  year?: number;
  pageCount?: number;
  filename: string;
  filepath: string;
  filesize: number;
}

/**
 * Retry information for workflow resilience
 */
export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  reason?: string;
  lastError?: string;
}

/**
 * Main State Annotation for LangGraph
 * Using Annotation.Root() as per LangGraph best practices
 */
export const StateAnnotation = Annotation.Root({
  // ===== INPUT =====
  /**
   * Path to the input PDF file
   */
  pdfPath: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  /**
   * Research query/prompt from the user
   */
  query: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  /**
   * Maximum number of retries for the workflow
   */
  maxRetries: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 3,
  }),

  // ===== INTERMEDIATE STATE =====
  /**
   * Extracted metadata from the PDF
   */
  metadata: Annotation<PaperMetadata | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Markdown content converted from PDF
   */
  markdown: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Summary of the paper
   */
  summary: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Detailed analysis from the LLM
   */
  analysis: Annotation<PaperAnalysis | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Generated draft content
   */
  draft: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Quality check result
   */
  qualityCheck: Annotation<QualityCheck | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // ===== WORKFLOW STATE =====
  /**
   * Current status of the workflow
   */
  status: Annotation<WorkflowStatus>({
    reducer: (prev, next) => next ?? prev,
    default: () => 'idle' as WorkflowStatus,
  }),

  /**
   * Retry information
   */
  retryInfo: Annotation<RetryInfo | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Error message if status is 'error'
   */
  error: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // ===== METADATA =====
  /**
   * Timestamp when workflow started
   */
  startTime: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => Date.now(),
  }),

  /**
   * Timestamp of last state update
   */
  lastUpdated: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => Date.now(),
  }),

  /**
   * Execution log for debugging
   */
  log: Annotation<string[]>({
    reducer: (prev, next) => {
      if (!next) return prev;
      return [...(prev || []), ...next];
    },
    default: () => [],
  }),

  // ===== MULTIPLE PAPERS SUPPORT =====
  /**
   * For multi-paper workflows, track the current paper index
   */
  currentPaperIndex: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 0,
  }),

  /**
   * Total number of papers in multi-paper workflow
   */
  totalPapers: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 1,
  }),

  /**
   * Array of PDF paths for multi-paper workflow
   */
  pdfPaths: Annotation<string[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),

  /**
   * Aggregated results from multiple papers
   */
  aggregatedResults: Annotation<Record<string, unknown>[]>({
    reducer: (prev, next) => {
      if (!next) return prev;
      return [...(prev || []), ...next];
    },
    default: () => [],
  }),
});

/**
 * Type inference from StateAnnotation
 * This is the main State type used throughout the application
 */
export type State = typeof StateAnnotation.State;

/**
 * Partial state update type for nodes
 * Nodes should return Partial<State> to update specific fields
 */
export type StateUpdate = Partial<State>;

/**
 * Helper function to create a state update with logging
 */
export function createStateUpdate(
  update: StateUpdate,
  logMessage?: string
): StateUpdate {
  const result: StateUpdate = {
    ...update,
    lastUpdated: Date.now(),
  };

  if (logMessage) {
    result.log = [logMessage];
  }

  return result;
}

/**
 * Helper function to create an error state
 */
export function createErrorState(
  error: string,
  previousStatus: WorkflowStatus
): StateUpdate {
  return createStateUpdate(
    {
      status: 'error',
      error,
    },
    `Error in ${previousStatus}: ${error}`
  );
}

/**
 * Helper function to create a retry state
 */
export function createRetryState(
  currentAttempt: number,
  maxAttempts: number,
  reason: string
): StateUpdate {
  return createStateUpdate({
    status: 'retry',
    retryInfo: {
      attempt: currentAttempt + 1,
      maxAttempts,
      reason,
    },
  });
}

/**
 * Helper function to check if workflow should retry
 */
export function shouldRetry(state: State): boolean {
  if (!state.retryInfo) return false;
  return state.retryInfo.attempt < state.retryInfo.maxAttempts;
}

/**
 * Helper function to get workflow duration
 */
export function getWorkflowDuration(state: State): number {
  return state.lastUpdated - state.startTime;
}

/**
 * Helper function to format workflow duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
