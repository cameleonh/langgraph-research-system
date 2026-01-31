/**
 * Workflows Tests
 * Tests for workflow creation and execution
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createSinglePaperWorkflow,
  validateSinglePaperInputs,
} from '../src/workflows/singlePaper.js';
import {
  createLiteratureReviewWorkflow,
  validateLiteratureReviewInputs,
  getLiteratureReviewSummary,
} from '../src/workflows/literatureReview.js';
import {
  createMultiPaperWorkflow,
  validateMultiPaperInputs,
  getMultiPaperSummary,
} from '../src/workflows/multiPaper.js';
import type { State } from '../src/state/schema.js';

describe('Single Paper Workflow', () => {
  describe('createSinglePaperWorkflow', () => {
    it('should create a compiled workflow', () => {
      const workflow = createSinglePaperWorkflow();

      expect(workflow).toBeDefined();
      expect(workflow).toHaveProperty('invoke');
    });

    it('should have invoke method', () => {
      const workflow = createSinglePaperWorkflow();

      expect(typeof workflow.invoke).toBe('function');
    });
  });

  describe('validateSinglePaperInputs', () => {
    it('should pass valid inputs', () => {
      const result = validateSinglePaperInputs('test.pdf', 'Test query');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail with missing PDF path', () => {
      const result = validateSinglePaperInputs('', 'Test query');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('PDF path is required');
    });

    it('should fail with non-PDF file', () => {
      const result = validateSinglePaperInputs('test.txt', 'Test query');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a PDF');
    });

    it('should fail with missing query', () => {
      const result = validateSinglePaperInputs('test.pdf', '');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Query is required');
    });

    it('should fail with whitespace-only query', () => {
      const result = validateSinglePaperInputs('test.pdf', '   ');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Query is required');
    });
  });
});

describe('Literature Review Workflow', () => {
  describe('createLiteratureReviewWorkflow', () => {
    it('should create a compiled workflow', () => {
      const workflow = createLiteratureReviewWorkflow();

      expect(workflow).toBeDefined();
      expect(workflow).toHaveProperty('invoke');
    });

    it('should have invoke method', () => {
      const workflow = createLiteratureReviewWorkflow();

      expect(typeof workflow.invoke).toBe('function');
    });
  });

  describe('validateLiteratureReviewInputs', () => {
    it('should pass valid inputs', () => {
      const result = validateLiteratureReviewInputs('test.pdf', 'Test query', 3);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail with missing PDF path', () => {
      const result = validateLiteratureReviewInputs('', 'Test query', 3);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('PDF path is required');
    });

    it('should fail with non-PDF file', () => {
      const result = validateLiteratureReviewInputs('test.txt', 'Test query', 3);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a PDF');
    });

    it('should fail with missing query', () => {
      const result = validateLiteratureReviewInputs('test.pdf', '', 3);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Query is required');
    });

    it('should fail with negative retries', () => {
      const result = validateLiteratureReviewInputs('test.pdf', 'Test query', -1);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('between 0 and 10');
    });

    it('should fail with too many retries', () => {
      const result = validateLiteratureReviewInputs('test.pdf', 'Test query', 11);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('between 0 and 10');
    });

    it('should accept zero retries', () => {
      const result = validateLiteratureReviewInputs('test.pdf', 'Test query', 0);

      expect(result.valid).toBe(true);
    });

    it('should accept maximum retries', () => {
      const result = validateLiteratureReviewInputs('test.pdf', 'Test query', 10);

      expect(result.valid).toBe(true);
    });
  });

  describe('getLiteratureReviewSummary', () => {
    it('should return summary for completed state', () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'completed',
        startTime: Date.now() - 10000,
        lastUpdated: Date.now(),
        maxRetries: 3,
        qualityCheck: {
          passed: true,
          score: 85,
          issues: [],
          suggestions: [],
        },
        retryInfo: {
          attempt: 1,
          maxAttempts: 3,
        },
        analysis: {
          keyFindings: Array(5).fill({
            finding: 'Test',
            evidence: 'Test',
            confidence: 'high' as const,
          }),
          researchGap: [],
          relatedPapers: [],
          methodology: 'Test',
          conclusions: 'Test',
          strengths: [],
          limitations: [],
          suggestions: [],
        },
        draft: 'Test draft content',
      };

      const summary = getLiteratureReviewSummary(state);

      expect(summary.status).toBe('completed');
      expect(summary.qualityScore).toBe(85);
      expect(summary.retries).toBe(1);
      expect(summary.findings).toBe(5);
      expect(summary.relatedPapers).toBe(0);
      expect(summary.draftLength).toBe(18);
      expect(summary.duration).toBeDefined();
    });

    it('should handle missing optional fields', () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'completed',
        startTime: Date.now() - 10000,
        lastUpdated: Date.now(),
        maxRetries: 3,
      };

      const summary = getLiteratureReviewSummary(state);

      expect(summary.status).toBe('completed');
      expect(summary.qualityScore).toBeUndefined();
      expect(summary.retries).toBeUndefined();
      expect(summary.findings).toBeUndefined();
    });
  });
});

describe('Multi-Paper Workflow', () => {
  describe('createMultiPaperWorkflow', () => {
    it('should create a compiled workflow', () => {
      const workflow = createMultiPaperWorkflow();

      expect(workflow).toBeDefined();
      expect(workflow).toHaveProperty('invoke');
    });

    it('should have invoke method', () => {
      const workflow = createMultiPaperWorkflow();

      expect(typeof workflow.invoke).toBe('function');
    });
  });

  describe('validateMultiPaperInputs', () => {
    it('should pass valid single input', () => {
      const result = validateMultiPaperInputs(['test.pdf'], 'Test query');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should pass valid multiple inputs', () => {
      const result = validateMultiPaperInputs(
        ['test1.pdf', 'test2.pdf', 'test3.pdf'],
        'Test query'
      );

      expect(result.valid).toBe(true);
    });

    it('should fail with empty array', () => {
      const result = validateMultiPaperInputs([], 'Test query');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one PDF path');
    });

    it('should fail with too many PDFs', () => {
      const pdfs = Array.from({ length: 21 }, (_, i) => `test${i}.pdf`);
      const result = validateMultiPaperInputs(pdfs, 'Test query');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Maximum 20 PDFs');
    });

    it('should fail with non-PDF file', () => {
      const result = validateMultiPaperInputs(['test.pdf', 'test.txt'], 'Test query');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid PDF file');
    });

    it('should fail with missing query', () => {
      const result = validateMultiPaperInputs(['test.pdf'], '');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Query is required');
    });
  });

  describe('getMultiPaperSummary', () => {
    it('should return summary for completed state', () => {
      const state: State = {
        pdfPath: 'test1.pdf',
        pdfPaths: ['test1.pdf', 'test2.pdf', 'test3.pdf'],
        query: 'Test query',
        status: 'completed',
        currentPaperIndex: 2,
        totalPapers: 3,
        startTime: Date.now() - 30000,
        lastUpdated: Date.now(),
        maxRetries: 3,
        aggregatedResults: [
          { pdfPath: 'test1.pdf', markdown: 'Content 1' },
          { pdfPath: 'test2.pdf', markdown: 'Content 2' },
          { pdfPath: 'test3.pdf', markdown: 'Content 3' },
        ],
        draft: 'Comparative analysis',
      };

      const summary = getMultiPaperSummary(state);

      expect(summary.totalPapers).toBe(3);
      expect(summary.successfulPapers).toBe(3);
      expect(summary.failedPapers).toBe(0);
      expect(summary.hasComparativeAnalysis).toBe(true);
      expect(summary.duration).toBeDefined();
    });

    it('should handle partial failures', () => {
      const state: State = {
        pdfPath: 'test1.pdf',
        pdfPaths: ['test1.pdf', 'test2.pdf', 'test3.pdf'],
        query: 'Test query',
        status: 'completed',
        currentPaperIndex: 2,
        totalPapers: 3,
        startTime: Date.now() - 30000,
        lastUpdated: Date.now(),
        maxRetries: 3,
        aggregatedResults: [
          { pdfPath: 'test1.pdf', markdown: 'Content 1' },
          { pdfPath: 'test2.pdf', error: 'Conversion failed' },
          { pdfPath: 'test3.pdf', markdown: 'Content 3' },
        ],
        draft: null,
      };

      const summary = getMultiPaperSummary(state);

      expect(summary.totalPapers).toBe(3);
      expect(summary.successfulPapers).toBe(2);
      expect(summary.failedPapers).toBe(1);
      expect(summary.hasComparativeAnalysis).toBe(false);
    });

    it('should handle missing pdfPaths', () => {
      const state: State = {
        pdfPath: 'test1.pdf',
        query: 'Test query',
        status: 'completed',
        currentPaperIndex: 0,
        totalPapers: 1,
        startTime: Date.now() - 5000,
        lastUpdated: Date.now(),
        maxRetries: 3,
      };

      const summary = getMultiPaperSummary(state);

      expect(summary.totalPapers).toBe(1);
    });
  });
});

describe('Workflow State Management', () => {
  it('should create valid initial state', () => {
    const state: State = {
      pdfPath: 'test.pdf',
      query: 'Test query',
      status: 'idle',
      startTime: Date.now(),
      lastUpdated: Date.now(),
      maxRetries: 3,
    };

    expect(state.pdfPath).toBe('test.pdf');
    expect(state.query).toBe('Test query');
    expect(state.status).toBe('idle');
  });

  it('should handle state updates', () => {
    const state: State = {
      pdfPath: 'test.pdf',
      query: 'Test query',
      status: 'idle',
      startTime: Date.now(),
      lastUpdated: Date.now(),
      maxRetries: 3,
    };

    const update: Partial<State> = {
      status: 'converting',
      markdown: '# Test',
    };

    const newState = { ...state, ...update };

    expect(newState.status).toBe('converting');
    expect(newState.markdown).toBe('# Test');
  });

  it('should track retry information', () => {
    const state: State = {
      pdfPath: 'test.pdf',
      query: 'Test query',
      status: 'retry',
      startTime: Date.now(),
      lastUpdated: Date.now(),
      maxRetries: 3,
      retryInfo: {
        attempt: 1,
        maxAttempts: 3,
        reason: 'Test retry',
      },
    };

    expect(state.retryInfo?.attempt).toBe(1);
    expect(state.retryInfo?.maxAttempts).toBe(3);
    expect(state.retryInfo?.reason).toBe('Test retry');
  });
});
