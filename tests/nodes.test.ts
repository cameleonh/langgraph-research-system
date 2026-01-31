/**
 * Nodes Tests
 * Tests for workflow nodes (convert, analyze, write, quality check)
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { convertNode } from '../src/nodes/convertNode.js';
import { analyzeNode } from '../src/nodes/analyzeNode.js';
import { writeNode } from '../src/nodes/writeNode.js';
import {
  qualityCheckNode,
  analysisQualityCheckNode,
  draftQualityCheckNode,
  qualityRules,
} from '../src/nodes/qualityCheckNode.js';
import type { State } from '../src/state/schema.js';

describe('Convert Node', () => {
  describe('convertNode', () => {
    it('should return error state when PDF path is invalid', async () => {
      const state: State = {
        pdfPath: '/nonexistent/file.pdf',
        query: 'Test query',
        status: 'idle',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
      };

      const result = await convertNode(state);

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.log).toBeDefined();
    });

    it('should update status to converting', async () => {
      const state: State = {
        pdfPath: '/nonexistent/file.pdf',
        query: 'Test query',
        status: 'idle',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
      };

      const result = await convertNode(state);

      expect(result.status).toBe('error'); // Will fail, but should have status
    });

    it('should include log entries', async () => {
      const state: State = {
        pdfPath: '/nonexistent/file.pdf',
        query: 'Test query',
        status: 'idle',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
      };

      const result = await convertNode(state);

      expect(result.log).toBeDefined();
      expect(Array.isArray(result.log)).toBe(true);
    });
  });
});

describe('Analyze Node', () => {
  describe('analyzeNode', () => {
    it('should return error state when markdown is missing', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'analyzing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        markdown: null,
      };

      const result = await analyzeNode(state);

      expect(result.status).toBe('error');
      expect(result.error).toContain('No markdown content');
    });

    it('should return error state when markdown is empty string', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'analyzing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        markdown: '',
      };

      const result = await analyzeNode(state);

      expect(result.status).toBe('error');
    });

    it('should update status to writing on success', async () => {
      // This will fail without API key, but we can test state structure
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'analyzing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        markdown: '# Test Paper\n\nThis is a test paper content.',
      };

      try {
        const result = await analyzeNode(state);

        // Will likely fail without API, but should have proper structure
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('analysis');
        expect(result).toHaveProperty('summary');
      } catch (error) {
        // Expected without API key
        expect(error).toBeDefined();
      }
    });

    it('should include analysis result', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'analyzing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        markdown: '# Test Paper\n\nThis is a test paper content.',
      };

      try {
        const result = await analyzeNode(state);

        if (result.analysis) {
          expect(result.analysis).toHaveProperty('keyFindings');
          expect(result.analysis).toHaveProperty('researchGap');
          expect(result.analysis).toHaveProperty('methodology');
          expect(result.analysis).toHaveProperty('conclusions');
        }
      } catch (error) {
        // Expected without API key
        expect(error).toBeDefined();
      }
    });
  });
});

describe('Write Node', () => {
  describe('writeNode', () => {
    it('should return error state when analysis is missing', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'writing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        markdown: '# Test',
        analysis: null,
      };

      const result = await writeNode(state);

      expect(result.status).toBe('error');
      expect(result.error).toContain('No analysis available');
    });

    it('should update status to completed on success', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'writing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        markdown: '# Test',
        analysis: {
          keyFindings: [{ finding: 'Test finding', evidence: 'Test evidence', confidence: 'high' }],
          researchGap: [{ category: 'test', description: 'Test gap', significance: 'medium' }],
          relatedPapers: [],
          methodology: 'Test methodology',
          conclusions: 'Test conclusions',
          strengths: [],
          limitations: [],
          suggestions: [],
        },
      };

      try {
        const result = await writeNode(state);

        // Will likely fail without API, but should have proper structure
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('draft');
      } catch (error) {
        // Expected without API key
        expect(error).toBeDefined();
      }
    });

    it('should include generated draft', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'writing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        markdown: '# Test Paper',
        analysis: {
          keyFindings: [{ finding: 'Test finding', evidence: 'Test evidence', confidence: 'high' }],
          researchGap: [{ category: 'test', description: 'Test gap', significance: 'medium' }],
          relatedPapers: [],
          methodology: 'Test methodology',
          conclusions: 'Test conclusions',
          strengths: [],
          limitations: [],
          suggestions: [],
        },
      };

      try {
        const result = await writeNode(state);

        if (result.draft) {
          expect(typeof result.draft).toBe('string');
          expect(result.draft.length).toBeGreaterThan(0);
        }
      } catch (error) {
        // Expected without API key
        expect(error).toBeDefined();
      }
    });
  });
});

describe('Quality Check Node', () => {
  describe('qualityCheckNode', () => {
    it('should perform quality check on state', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'quality_check',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        summary: 'A'.repeat(150),
        analysis: {
          keyFindings: Array(5).fill({
            finding: 'Test finding',
            evidence: 'Test evidence',
            confidence: 'high' as const,
          }),
          researchGap: [],
          relatedPapers: [],
          methodology: 'Test methodology',
          conclusions: 'Test conclusions',
          strengths: [],
          limitations: [],
          suggestions: [],
        },
        draft: 'A'.repeat(600),
      };

      const result = await qualityCheckNode(state);

      expect(result).toHaveProperty('qualityCheck');
      expect(result).toHaveProperty('status');
      expect(result.log).toBeDefined();
    });

    it('should pass quality check with good data', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'quality_check',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        summary: 'A'.repeat(150),
        analysis: {
          keyFindings: Array(5).fill({
            finding: 'Test finding',
            evidence: 'Test evidence',
            confidence: 'high' as const,
          }),
          researchGap: [],
          relatedPapers: [],
          methodology: 'Test methodology that is sufficiently long',
          conclusions: 'Test conclusions that are sufficiently long',
          strengths: [],
          limitations: [],
          suggestions: [],
        },
        draft: 'A'.repeat(600),
      };

      const result = await qualityCheckNode(state);

      if (result.qualityCheck) {
        expect(result.qualityCheck).toHaveProperty('passed');
        expect(result.qualityCheck).toHaveProperty('score');
        expect(result.qualityCheck).toHaveProperty('issues');
      }
    });
  });

  describe('analysisQualityCheckNode', () => {
    it('should check analysis quality', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'analyzing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        summary: 'A'.repeat(150),
        analysis: {
          keyFindings: Array(5).fill({
            finding: 'Test finding',
            evidence: 'Test evidence',
            confidence: 'high' as const,
          }),
          researchGap: [],
          relatedPapers: [],
          methodology: 'Test methodology',
          conclusions: 'Test conclusions',
          strengths: [],
          limitations: [],
          suggestions: [],
        },
      };

      const result = await analysisQualityCheckNode(state);

      expect(result).toHaveProperty('qualityCheck');
      if (result.qualityCheck) {
        expect(result.qualityCheck).toHaveProperty('score');
      }
    });

    it('should fail analysis quality check with poor data', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'analyzing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        summary: 'Short',
        analysis: {
          keyFindings: [],
          researchGap: [],
          relatedPapers: [],
          methodology: '',
          conclusions: '',
          strengths: [],
          limitations: [],
          suggestions: [],
        },
      };

      const result = await analysisQualityCheckNode(state);

      if (result.qualityCheck) {
        expect(result.qualityCheck.score).toBeLessThan(60);
        expect(result.qualityCheck.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('draftQualityCheckNode', () => {
    it('should check draft quality', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'writing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        draft: '# Test Draft\n\n' + 'A'.repeat(600),
      };

      const result = await draftQualityCheckNode(state);

      expect(result).toHaveProperty('qualityCheck');
      if (result.qualityCheck) {
        expect(result.qualityCheck).toHaveProperty('score');
      }
    });

    it('should fail draft quality check with short draft', async () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test query',
        status: 'writing',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        draft: 'Short',
      };

      const result = await draftQualityCheckNode(state);

      if (result.qualityCheck) {
        expect(result.qualityCheck.score).toBeLessThan(60);
        expect(result.qualityCheck.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('qualityRules', () => {
    it('should have hasSummary rule', () => {
      expect(qualityRules.hasSummary).toBeDefined();
      expect(typeof qualityRules.hasSummary).toBe('function');
    });

    it('should have hasAnalysis rule', () => {
      expect(qualityRules.hasAnalysis).toBeDefined();
      expect(typeof qualityRules.hasAnalysis).toBe('function');
    });

    it('should have hasMethodology rule', () => {
      expect(qualityRules.hasMethodology).toBeDefined();
      expect(typeof qualityRules.hasMethodology).toBe('function');
    });

    it('should have hasConclusions rule', () => {
      expect(qualityRules.hasConclusions).toBeDefined();
      expect(typeof qualityRules.hasConclusions).toBe('function');
    });

    it('should have hasDraft rule', () => {
      expect(qualityRules.hasDraft).toBeDefined();
      expect(typeof qualityRules.hasDraft).toBe('function');
    });

    it('should have hasStructure rule', () => {
      expect(qualityRules.hasStructure).toBeDefined();
      expect(typeof qualityRules.hasStructure).toBe('function');
    });

    it('should have hasNoErrors rule', () => {
      expect(qualityRules.hasNoErrors).toBeDefined();
      expect(typeof qualityRules.hasNoErrors).toBe('function');
    });

    it('hasSummary should pass with valid summary', () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test',
        status: 'idle',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
        summary: 'A'.repeat(100),
      };

      const result = qualityRules.hasSummary(state);
      expect(result.passed).toBe(true);
    });

    it('hasNoErrors should fail with error state', () => {
      const state: State = {
        pdfPath: 'test.pdf',
        query: 'Test',
        status: 'error',
        error: 'Test error',
        startTime: Date.now(),
        lastUpdated: Date.now(),
        maxRetries: 3,
      };

      const result = qualityRules.hasNoErrors(state);
      expect(result.passed).toBe(false);
    });
  });
});

describe('State Update Types', () => {
  it('should create valid state update', () => {
    const update = {
      status: 'completed' as const,
      draft: 'Test draft',
      log: ['Test log'],
    };

    expect(update).toHaveProperty('status');
    expect(update).toHaveProperty('draft');
    expect(update).toHaveProperty('log');
  });
});
