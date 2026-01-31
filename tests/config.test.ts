/**
 * Config Tests
 * Tests for configuration loading and validation
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { loadConfig, getConfig, resetConfig } from '../src/config.js';

describe('Config', () => {
  beforeEach(() => {
    resetConfig();
    // Set test environment variables
    process.env.ANTHROPIC_API_KEY = 'test-key-12345';
    process.env.ANTHROPIC_MODEL = 'claude-3-test';
    process.env.MARKER_GPU_ENABLED = 'true';
    process.env.LOG_LEVEL = 'debug';
  });

  describe('loadConfig', () => {
    it('should load configuration from environment variables', () => {
      const config = loadConfig();

      expect(config.anthropic.apiKey).toBe('test-key-12345');
      expect(config.anthropic.model).toBe('claude-3-test');
      expect(config.anthropic.maxTokens).toBe(8192);
      expect(config.anthropic.temperature).toBeCloseTo(0.7, 1);
    });

    it('should use default values when environment variables are not set', () => {
      delete process.env.ANTHROPIC_MODEL;
      delete process.env.LOG_LEVEL;

      const config = loadConfig();

      expect(config.anthropic.model).toBe('claude-3-5-sonnet-20241022');
      expect(config.app.logLevel).toBe('info');
    });

    it('should parse boolean values correctly', () => {
      process.env.MARKER_GPU_ENABLED = 'false';
      const config = loadConfig();

      expect(config.marker.gpuEnabled).toBe(false);
    });

    it('should parse number values correctly', () => {
      process.env.ANTHROPIC_MAX_TOKENS = '4096';
      process.env.MAX_CONVERSION_RETRIES = '5';

      const config = loadConfig();

      expect(config.anthropic.maxTokens).toBe(4096);
      expect(config.app.maxConversionRetries).toBe(5);
    });

    it('should throw error when ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => loadConfig()).toThrow('ANTHROPIC_API_KEY is required');
    });

    it('should load ChromaDB configuration', () => {
      const config = loadConfig();

      expect(config.chroma.host).toBe('localhost');
      expect(config.chroma.port).toBe(8000);
      expect(config.chroma.collectionName).toBe('papers');
    });

    it('should load quality check thresholds', () => {
      const config = loadConfig();

      expect(config.quality.minSummaryLength).toBe(100);
      expect(config.quality.minAnalysisItems).toBe(3);
      expect(config.quality.minDraftLength).toBe(500);
    });

    it('should load output directories', () => {
      const config = loadConfig();

      expect(config.output.dir).toBe('./output');
      expect(config.output.markdownDir).toBe('./output/markdown');
      expect(config.output.analysisDir).toBe('./output/analysis');
    });
  });

  describe('getConfig', () => {
    it('should cache configuration after first call', () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });

    it('should reset configuration when resetConfig is called', () => {
      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();

      expect(config1).not.toBe(config2);
    });
  });

  describe('Config Validation', () => {
    it('should validate numeric ranges', () => {
      process.env.ANTHROPIC_TEMPERATURE = '0.9';
      const config = loadConfig();

      expect(config.anthropic.temperature).toBeCloseTo(0.9);
    });

    it('should handle invalid number values gracefully', () => {
      process.env.MAX_CONVERSION_RETRIES = 'invalid';
      const config = loadConfig();

      expect(config.app.maxConversionRetries).toBe(3); // Default value
    });
  });
});
