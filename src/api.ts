/**
 * Optional REST API for the LangGraph Research System
 * Provides HTTP endpoints for running workflows asynchronously
 */

import express, { Request, Response, NextFunction } from 'express';
import { createLogger } from './utils/logger.js';
import { getConfig } from './config.js';
import { runSinglePaperWorkflow } from './workflows/singlePaper.js';
import { runLiteratureReviewWorkflow } from './workflows/literatureReview.js';
import { runMultiPaperWorkflowParallel } from './workflows/multiPaper.js';
import type { State } from './state/schema.js';

const logger = createLogger('API');

/**
 * Job store for tracking async operations
 */
interface Job {
  id: string;
  type: 'single' | 'review' | 'multi';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: State;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

const jobs = new Map<string, Job>();

/**
 * Create the API application
 */
export function createApi() {
  const app = express();
  const config = getConfig();

  // Middleware
  app.use(express.json());
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  });

  // Configuration endpoint
  app.get('/config', (req: Request, res: Response) => {
    // Return sanitized config (without API keys)
    const sanitizedConfig = {
      anthropic: {
        model: config.anthropic.model,
        maxTokens: config.anthropic.maxTokens,
        temperature: config.anthropic.temperature,
      },
      marker: {
        gpuEnabled: config.marker.gpuEnabled,
        batchSize: config.marker.batchSize,
      },
      chroma: {
        host: config.chroma.host,
        port: config.chroma.port,
        collectionName: config.chroma.collectionName,
      },
      quality: config.quality,
      output: config.output,
    };

    res.json(sanitizedConfig);
  });

  // Single paper analysis endpoint
  app.post('/api/single', async (req: Request, res: Response) => {
    try {
      const { pdfPath, query } = req.body;

      if (!pdfPath || !query) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: pdfPath, query',
        });
      }

      // Create job
      const jobId = generateJobId();
      const job: Job = {
        id: jobId,
        type: 'single',
        status: 'running',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      jobs.set(jobId, job);

      // Run workflow asynchronously
      runSinglePaperWorkflow(pdfPath, query)
        .then((result) => {
          job.status = result.status === 'completed' ? 'completed' : 'failed';
          job.progress = 100;
          job.result = result;
          job.error = result.error || undefined;
          job.updatedAt = Date.now();

          if (result.status === 'error') {
            logger.error(`Job ${jobId} failed: ${result.error}`);
          }
        })
        .catch((error) => {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : String(error);
          job.updatedAt = Date.now();
          logger.error(`Job ${jobId} failed:`, error);
        });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'running',
          message: 'Job started',
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('POST /api/single failed', error);

      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Literature review endpoint
  app.post('/api/review', async (req: Request, res: Response) => {
    try {
      const { pdfPath, query, maxRetries = 3 } = req.body;

      if (!pdfPath || !query) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: pdfPath, query',
        });
      }

      // Create job
      const jobId = generateJobId();
      const job: Job = {
        id: jobId,
        type: 'review',
        status: 'running',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      jobs.set(jobId, job);

      // Run workflow asynchronously
      runLiteratureReviewWorkflow(pdfPath, query, maxRetries)
        .then((result) => {
          job.status = result.status === 'completed' ? 'completed' : 'failed';
          job.progress = 100;
          job.result = result;
          job.error = result.error || undefined;
          job.updatedAt = Date.now();

          if (result.status === 'error') {
            logger.error(`Job ${jobId} failed: ${result.error}`);
          }
        })
        .catch((error) => {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : String(error);
          job.updatedAt = Date.now();
          logger.error(`Job ${jobId} failed:`, error);
        });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'running',
          message: 'Literature review job started',
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('POST /api/review failed', error);

      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Multi-paper analysis endpoint
  app.post('/api/multi', async (req: Request, res: Response) => {
    try {
      const { pdfPaths, query, concurrency = 3 } = req.body;

      if (!pdfPaths || !Array.isArray(pdfPaths) || pdfPaths.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: pdfPaths (must be non-empty array)',
        });
      }

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: query',
        });
      }

      // Create job
      const jobId = generateJobId();
      const job: Job = {
        id: jobId,
        type: 'multi',
        status: 'running',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      jobs.set(jobId, job);

      // Run workflow asynchronously
      runMultiPaperWorkflowParallel(pdfPaths, query, concurrency)
        .then((result) => {
          job.status = result.status === 'completed' ? 'completed' : 'failed';
          job.progress = 100;
          job.result = result;
          job.error = result.error || undefined;
          job.updatedAt = Date.now();

          if (result.status === 'error') {
            logger.error(`Job ${jobId} failed: ${result.error}`);
          }
        })
        .catch((error) => {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : String(error);
          job.updatedAt = Date.now();
          logger.error(`Job ${jobId} failed:`, error);
        });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'running',
          message: `Multi-paper job started for ${pdfPaths.length} papers`,
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('POST /api/multi failed', error);

      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Job status endpoint
  app.get('/api/jobs/:jobId', (req: Request, res: Response) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        createdAt: new Date(job.createdAt).toISOString(),
        updatedAt: new Date(job.updatedAt).toISOString(),
      },
    });
  });

  // List jobs endpoint
  app.get('/api/jobs', (req: Request, res: Response) => {
    const { limit = 50, offset = 0 } = req.query;

    const jobList = Array.from(jobs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      success: true,
      data: {
        jobs: jobList,
        total: jobs.size,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  });

  // Delete job endpoint
  app.delete('/api/jobs/:jobId', (req: Request, res: Response) => {
    const { jobId } = req.params;
    const deleted = jobs.delete(jobId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Job deleted',
      },
    });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  });

  return app;
}

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Start the API server
 */
export async function startApi(port?: number): Promise<void> {
  const config = getConfig();
  const apiPort = port || 3000;

  const app = createApi();

  return new Promise((resolve) => {
    app.listen(apiPort, () => {
      logger.info(`API server listening on port ${apiPort}`);
      logger.info(`Health check: http://localhost:${apiPort}/health`);
      logger.info(`API docs: See README for endpoint documentation`);
      resolve();
    });
  });
}

/**
 * Main entry point for running the API server
 */
export async function main() {
  try {
    await startApi();
  } catch (error) {
    logger.error('Failed to start API server', error);
    process.exit(1);
  }
}

// Run API server if this file is executed directly
main();

export default createApi;
