/**
 * Configuration loader for the LangGraph Research System
 * Loads environment variables and provides typed access to configuration
 */

export interface Config {
  // Anthropic Claude API Configuration
  anthropic: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };

  // PDF to Markdown Conversion (Marker)
  marker: {
    gpuEnabled: boolean;
    batchSize: number;
    outputFormat: 'markdown' | 'text';
  };

  // Vector Store Configuration (ChromaDB)
  chroma: {
    host: string;
    port: number;
    collectionName: string;
    persistDirectory: string;
  };

  // Web Search Configuration
  webSearch: {
    serperApiKey: string;
    maxResults: number;
  };

  // Application Configuration
  app: {
    nodeEnv: 'development' | 'production' | 'test';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    maxConversionRetries: number;
    maxAnalysisRetries: number;
  };

  // Quality Check Thresholds
  quality: {
    minSummaryLength: number;
    minAnalysisItems: number;
    minDraftLength: number;
  };

  // Output Configuration
  output: {
    dir: string;
    markdownDir: string;
    analysisDir: string;
  };
}

function parseBoolean(value: string): boolean {
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string, defaultValue: number): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const config: Config = {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: parseNumber(process.env.ANTHROPIC_MAX_TOKENS || '8192', 8192),
      temperature: parseNumber(process.env.ANTHROPIC_TEMPERATURE || '0.7', 0.7),
    },
    marker: {
      gpuEnabled: parseBoolean(process.env.MARKER_GPU_ENABLED || 'true'),
      batchSize: parseNumber(process.env.MARKER_BATCH_SIZE || '10', 10),
      outputFormat: (process.env.MARKER_OUTPUT_FORMAT as 'markdown' | 'text') || 'markdown',
    },
    chroma: {
      host: process.env.CHROMA_HOST || 'localhost',
      port: parseNumber(process.env.CHROMA_PORT || '8000', 8000),
      collectionName: process.env.CHROMA_COLLECTION_NAME || 'papers',
      persistDirectory: process.env.CHROMA_PERSIST_DIRECTORY || './data/chroma',
    },
    webSearch: {
      serperApiKey: process.env.SERPER_API_KEY || '',
      maxResults: parseNumber(process.env.WEB_SEARCH_MAX_RESULTS || '10', 10),
    },
    app: {
      nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      maxConversionRetries: parseNumber(process.env.MAX_CONVERSION_RETRIES || '3', 3),
      maxAnalysisRetries: parseNumber(process.env.MAX_ANALYSIS_RETRIES || '3', 3),
    },
    quality: {
      minSummaryLength: parseNumber(process.env.QUALITY_MIN_SUMMARY_LENGTH || '100', 100),
      minAnalysisItems: parseNumber(process.env.QUALITY_MIN_ANALYSIS_ITEMS || '3', 3),
      minDraftLength: parseNumber(process.env.QUALITY_MIN_DRAFT_LENGTH || '500', 500),
    },
    output: {
      dir: process.env.OUTPUT_DIR || './output',
      markdownDir: process.env.MARKDOWN_OUTPUT_DIR || './output/markdown',
      analysisDir: process.env.ANALYSIS_OUTPUT_DIR || './output/analysis',
    },
  };

  // Validate critical configuration
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required but not set');
  }

  return config;
}

/**
 * Global configuration instance
 */
let _config: Config | null = null;

/**
 * Get the configuration instance (lazy loaded)
 */
export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Reset the configuration (useful for testing)
 */
export function resetConfig(): void {
  _config = null;
}
