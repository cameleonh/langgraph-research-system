/**
 * Type exports for the LangGraph Research System
 * Centralized type definitions used across the application
 */

// Re-export state types
export type {
  WorkflowStatus,
  ResearchGap,
  RelatedPaper,
  KeyFinding,
  PaperAnalysis,
  QualityCheck,
  PaperMetadata,
  RetryInfo,
  State,
  StateUpdate,
} from '../state/schema';

// Re-export type utilities
export type {
  LoggerOptions,
  LogLevel,
} from '../utils/logger';

// Re-export config types
export type { Config } from '../config';

/**
 * Tool execution result
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * PDF conversion options
 */
export interface ConversionOptions {
  outputFormat?: 'markdown' | 'text';
  gpuEnabled?: boolean;
  batchSize?: number;
  extractImages?: boolean;
  preserveLayout?: boolean;
}

/**
 * Conversion result from PDF to Markdown
 */
export interface ConversionResult {
  markdown: string;
  metadata: {
    title?: string;
    authors?: string[];
    pageCount?: number;
    wordCount?: number;
    processingTime: number;
  };
  images?: string[];
}

/**
 * Web search options
 */
export interface WebSearchOptions {
  maxResults?: number;
  timeout?: number;
  includeSnippets?: boolean;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

/**
 * Web search result
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
  authors?: string[];
  year?: number;
  publishedDate?: string;
  relevanceScore?: number;
}

/**
 * Vector store options
 */
export interface VectorStoreOptions {
  collectionName?: string;
  embeddingModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

/**
 * LLM analysis options
 */
export interface AnalysisOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
  includeReasoning?: boolean;
}

/**
 * Draft generation options
 */
export interface DraftOptions {
  format?: 'markdown' | 'html' | 'plain';
  template?: string;
  includeCitations?: boolean;
  style?: 'academic' | 'blog' | 'technical' | 'summary';
}

/**
 * Quality check options
 */
export interface QualityCheckOptions {
  minSummaryLength?: number;
  minAnalysisItems?: number;
  minDraftLength?: number;
  requireCitations?: boolean;
  customRules?: Array<(state: unknown) => { passed: boolean; message?: string }>;
}

/**
 * Workflow execution options
 */
export interface WorkflowOptions {
  maxRetries?: number;
  timeout?: number;
  verbose?: boolean;
  onProgress?: (progress: { status: string; message: string }) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: unknown) => void;
}

/**
 * CLI command options
 */
export interface CommandOptions {
  query?: string;
  output?: string;
  retries?: number;
  format?: string;
  verbose?: boolean;
  parallel?: boolean;
  batchSize?: number;
}

/**
 * API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

/**
 * Job status for async operations
 */
export interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Batch processing result
 */
export interface BatchResult<T = unknown> {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    index: number;
    input: unknown;
    output?: T;
    error?: string;
  }>;
  duration: number;
}

/**
 * Comparison result for multi-paper analysis
 */
export interface ComparisonResult {
  similarities: string[];
  differences: string[];
  contradictions: string[];
  methodologicalComparison: string;
  overallSynthesis: string;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Paper citation information
 */
export interface Citation {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue?: string;
  doi?: string;
  url?: string;
  context: string;
}

/**
 * Research methodology extracted from paper
 */
export interface ResearchMethodology {
  approach: string;
  participants?: number;
  dataCollection: string[];
  analysisMethods: string[];
  limitations: string[];
  ethicalConsiderations?: string[];
}

/**
 * Statistical information from paper
 */
export interface StatisticalInfo {
  sampleSize?: number;
  significanceLevel?: number;
  confidenceInterval?: string;
  effectSize?: string;
  tests: Array<{
    name: string;
    value: number;
    pValue?: number;
  }>;
}

/**
 * Research proposal for evaluation
 */
export interface ResearchProposal {
  title: string;
  topic: string;
  researchQuestions: string[];
  hypotheses?: string[];
  methodology: string;
  data: string;
  variables?: string;
  expectedResults: string;
  policyImplications: string;
  fullText?: string;
}

/**
 * Research proposal evaluation result
 */
export interface ProposalEvaluation {
  overallScore: number;
  academicRigor: number;
  methodology: number;
  dataQuality: number;
  policyRelevance: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  summary: string;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}
