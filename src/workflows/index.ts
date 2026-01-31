/**
 * Workflows module exports
 * Exports all workflows for the LangGraph Research System
 */

export {
  createSinglePaperWorkflow,
  runSinglePaperWorkflow,
  runSinglePaperWorkflowWithProgress,
  validateSinglePaperInputs,
} from './singlePaper.js';

export {
  createLiteratureReviewWorkflow,
  runLiteratureReviewWorkflow,
  runLiteratureReviewWorkflowWithProgress,
  validateLiteratureReviewInputs,
  getLiteratureReviewSummary,
} from './literatureReview.js';

export {
  createMultiPaperWorkflow,
  runMultiPaperWorkflow,
  runMultiPaperWorkflowParallel,
  runMultiPaperWorkflowWithProgress,
  validateMultiPaperInputs,
  getMultiPaperSummary,
} from './multiPaper.js';

export type { State } from '../state/schema.js';
