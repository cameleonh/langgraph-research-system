/**
 * Quality Check Node - Validates Output Quality
 * Performs quality checks on analysis and draft results
 */

import type { State, QualityCheck } from '../state/schema.js';
import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config.js';
import { selectors } from '../state/reducers.js';
import type { StateUpdate } from '../state/schema.js';

const logger = createLogger('QualityCheckNode');

/**
 * Quality check thresholds
 */
interface QualityThresholds {
  minSummaryLength: number;
  minAnalysisItems: number;
  minDraftLength: number;
  requireCitations: boolean;
}

/**
 * Quality check result with routing decision
 */
interface QualityCheckResult {
  passed: boolean;
  qualityCheck: QualityCheck;
  nextNode: 'analyze' | 'write' | 'completed';
}

/**
 * Quality check node - Validates output quality
 * @param state Current workflow state
 * @returns State update with quality check results
 */
export async function qualityCheckNode(state: State): Promise<StateUpdate> {
  const config = getConfig();
  const thresholds: QualityThresholds = {
    minSummaryLength: config.quality.minSummaryLength,
    minAnalysisItems: config.quality.minAnalysisItems,
    minDraftLength: config.quality.minDraftLength,
    requireCitations: false,
  };

  try {
    logger.info('Starting quality check');

    // Perform quality checks
    const result = performQualityCheck(state, thresholds);

    // Determine next action based on quality check
    const nextNode = determineNextNode(state, result);

    logger.info(`Quality check ${result.passed ? 'PASSED' : 'FAILED'}`);
    logger.info(`Next node: ${nextNode}`);

    return {
      status: result.passed ? 'completed' : nextNode === 'analyze' ? 'analyzing' : 'writing',
      qualityCheck: result.qualityCheck,
      log: [
        `Quality check: ${result.passed ? 'PASSED' : 'FAILED'}`,
        `Score: ${result.qualityCheck.score}/100`,
        `Issues: ${result.qualityCheck.issues.length}`,
        result.passed ? 'Proceeding to completion' : `Retrying from: ${nextNode}`,
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Quality check node failed', error);

    return {
      status: 'error',
      error: errorMessage,
      log: [`Quality check error: ${errorMessage}`],
    };
  }
}

/**
 * Quality check node for analysis only
 */
export async function analysisQualityCheckNode(state: State): Promise<StateUpdate> {
  const config = getConfig();

  try {
    logger.info('Starting analysis quality check');

    const qualityCheck: QualityCheck = {
      passed: true,
      score: 0,
      issues: [],
      suggestions: [],
    };

    let score = 100;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check summary
    if (!state.summary) {
      issues.push('No summary generated');
      score -= 30;
    } else if (state.summary.length < config.quality.minSummaryLength) {
      issues.push(`Summary too short (${state.summary.length} < ${config.quality.minSummaryLength})`);
      score -= 15;
      suggestions.push('Consider expanding the summary with more context');
    }

    // Check analysis
    if (!state.analysis) {
      issues.push('No analysis generated');
      score -= 40;
    } else {
      // Check key findings
      if (state.analysis.keyFindings.length < config.quality.minAnalysisItems) {
        issues.push(`Insufficient key findings (${state.analysis.keyFindings.length} < ${config.quality.minAnalysisItems})`);
        score -= 20;
        suggestions.push('Extract more key findings from the paper');
      }

      // Check methodology
      if (!state.analysis.methodology || state.analysis.methodology.length < 50) {
        issues.push('Methodology description missing or too brief');
        score -= 10;
        suggestions.push('Provide a more detailed methodology description');
      }

      // Check conclusions
      if (!state.analysis.conclusions || state.analysis.conclusions.length < 50) {
        issues.push('Conclusions missing or too brief');
        score -= 10;
        suggestions.push('Expand the conclusions with more detail');
      }

      // Check research gaps
      if (state.analysis.researchGap.length === 0) {
        issues.push('No research gaps identified');
        score -= 10;
        suggestions.push('Identify research gaps addressed by this paper');
      }
    }

    qualityCheck.score = Math.max(0, score);
    qualityCheck.issues = issues;
    qualityCheck.suggestions = suggestions;
    qualityCheck.passed = qualityCheck.score >= 60;

    logger.info(`Analysis quality check: ${qualityCheck.passed ? 'PASSED' : 'FAILED'} (${qualityCheck.score}/100)`);

    return {
      status: qualityCheck.passed ? 'writing' : 'analyzing',
      qualityCheck,
      log: [
        `Analysis quality check: ${qualityCheck.passed ? 'PASSED' : 'FAILED'}`,
        `Score: ${qualityCheck.score}/100`,
        ...(qualityCheck.passed ? [] : suggestions.map((s) => `Suggestion: ${s}`)),
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Analysis quality check failed', error);

    return {
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Quality check node for draft only
 */
export async function draftQualityCheckNode(state: State): Promise<StateUpdate> {
  const config = getConfig();

  try {
    logger.info('Starting draft quality check');

    const qualityCheck: QualityCheck = {
      passed: true,
      score: 0,
      issues: [],
      suggestions: [],
    };

    let score = 100;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check draft
    if (!state.draft) {
      issues.push('No draft generated');
      score -= 50;
    } else if (state.draft.length < config.quality.minDraftLength) {
      issues.push(`Draft too short (${state.draft.length} < ${config.quality.minDraftLength})`);
      score -= 30;
      suggestions.push('Expand the draft with more detail and analysis');
    }

    // Check for structure
    if (state.draft) {
      const hasHeadings = /^#{1,6}\s/m.test(state.draft);
      if (!hasHeadings) {
        issues.push('Draft lacks proper structure (no headings)');
        score -= 10;
        suggestions.push('Add headings to organize the draft');
      }

      const hasConclusion = /conclusion/i.test(state.draft);
      if (!hasConclusion) {
        issues.push('Draft missing conclusion section');
        score -= 10;
        suggestions.push('Add a conclusion section');
      }
    }

    qualityCheck.score = Math.max(0, score);
    qualityCheck.issues = issues;
    qualityCheck.suggestions = suggestions;
    qualityCheck.passed = qualityCheck.score >= 60;

    logger.info(`Draft quality check: ${qualityCheck.passed ? 'PASSED' : 'FAILED'} (${qualityCheck.score}/100)`);

    return {
      status: qualityCheck.passed ? 'completed' : 'writing',
      qualityCheck,
      log: [
        `Draft quality check: ${qualityCheck.passed ? 'PASSED' : 'FAILED'}`,
        `Score: ${qualityCheck.score}/100`,
        ...(qualityCheck.passed ? [] : suggestions.map((s) => `Suggestion: ${s}`)),
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Draft quality check failed', error);

    return {
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Perform comprehensive quality check
 */
function performQualityCheck(state: State, thresholds: QualityThresholds): QualityCheckResult {
  const qualityCheck: QualityCheck = {
    passed: true,
    score: 0,
    issues: [],
    suggestions: [],
  };

  let score = 100;
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check summary
  if (!state.summary) {
    issues.push('No summary generated');
    score -= 20;
  } else if (state.summary.length < thresholds.minSummaryLength) {
    issues.push(`Summary too short (${state.summary.length} < ${thresholds.minSummaryLength})`);
    score -= 10;
  }

  // Check analysis
  if (!state.analysis) {
    issues.push('No analysis generated');
    score -= 30;
  } else {
    if (state.analysis.keyFindings.length < thresholds.minAnalysisItems) {
      issues.push(`Insufficient key findings (${state.analysis.keyFindings.length} < ${thresholds.minAnalysisItems})`);
      score -= 15;
    }

    if (!state.analysis.methodology) {
      issues.push('No methodology description');
      score -= 10;
    }

    if (!state.analysis.conclusions) {
      issues.push('No conclusions');
      score -= 10;
    }
  }

  // Check draft
  if (!state.draft) {
    issues.push('No draft generated');
    score -= 30;
  } else if (state.draft.length < thresholds.minDraftLength) {
    issues.push(`Draft too short (${state.draft.length} < ${thresholds.minDraftLength})`);
    score -= 15;
  }

  qualityCheck.score = Math.max(0, score);
  qualityCheck.issues = issues;
  qualityCheck.suggestions = suggestions;
  qualityCheck.passed = qualityCheck.score >= 60;

  // Determine what needs to be redone based on issues
  let nextNode: 'analyze' | 'write' | 'completed' = 'completed';

  if (!qualityCheck.passed) {
    // Check if analysis is the problem
    if (!state.analysis || state.analysis.keyFindings.length < thresholds.minAnalysisItems) {
      nextNode = 'analyze';
    }
    // Check if draft is the problem
    else if (!state.draft || state.draft.length < thresholds.minDraftLength) {
      nextNode = 'write';
    }
  }

  return { passed: qualityCheck.passed, qualityCheck, nextNode };
}

/**
 * Determine next node based on quality check and retry state
 */
function determineNextNode(state: State, result: QualityCheckResult): 'analyze' | 'write' | 'completed' {
  // If quality check passed, we're done
  if (result.passed) {
    return 'completed';
  }

  // Check if we've exceeded max retries
  const currentAttempt = state.retryInfo?.attempt || 0;
  const maxRetries = state.maxRetries || 3;

  if (currentAttempt >= maxRetries) {
    logger.warn('Max retries exceeded, accepting current quality');
    return 'completed';
  }

  // Return the node that needs to be redone
  return result.nextNode;
}

/**
 * Quality check with custom rules
 */
export async function qualityCheckWithCustomRules(
  state: State,
  rules: Array<(state: State) => { passed: boolean; message?: string }>
): Promise<StateUpdate> {
  try {
    logger.info('Starting quality check with custom rules');

    const qualityCheck: QualityCheck = {
      passed: true,
      score: 100,
      issues: [],
      suggestions: [],
    };

    for (const rule of rules) {
      const result = rule(state);
      if (!result.passed) {
        qualityCheck.passed = false;
        qualityCheck.score -= 10;
        qualityCheck.issues.push(result.message || 'Custom rule failed');
      }
    }

    qualityCheck.score = Math.max(0, qualityCheck.score);

    logger.info(`Custom quality check: ${qualityCheck.passed ? 'PASSED' : 'FAILED'}`);

    return {
      status: qualityCheck.passed ? 'completed' : 'retry',
      qualityCheck,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Custom quality check failed', error);

    return {
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Pre-built quality check rules
 */
export const qualityRules = {
  hasSummary: (state: State) => ({
    passed: !!state.summary && state.summary.length > 50,
    message: 'Summary is missing or too short',
  }),

  hasAnalysis: (state: State) => ({
    passed: !!state.analysis && state.analysis.keyFindings.length > 2,
    message: 'Analysis is missing or has insufficient findings',
  }),

  hasMethodology: (state: State) => ({
    passed: !!state.analysis && state.analysis.methodology.length > 30,
    message: 'Methodology description is missing or too brief',
  }),

  hasConclusions: (state: State) => ({
    passed: !!state.analysis && state.analysis.conclusions.length > 30,
    message: 'Conclusions are missing or too brief',
  }),

  hasDraft: (state: State) => ({
    passed: !!state.draft && state.draft.length > 300,
    message: 'Draft is missing or too short',
  }),

  hasStructure: (state: State) => ({
    passed: !!state.draft && /^#{1,6}\s/m.test(state.draft),
    message: 'Draft lacks proper structure (no headings)',
  }),

  hasNoErrors: (state: State) => ({
    passed: !state.error,
    message: `Workflow has errors: ${state.error}`,
  }),
};

export default qualityCheckNode;
