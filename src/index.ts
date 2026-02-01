/**
 * LangGraph Research System - CLI Entry Point
 * Main command-line interface for running paper research workflows
 */

import { Command } from 'commander';
import { createLogger } from './utils/logger.js';
import { getConfig } from './config.js';
import {
  runSinglePaperWorkflow,
  runSinglePaperWorkflowWithProgress,
  validateSinglePaperInputs,
} from './workflows/singlePaper.js';
import {
  runLiteratureReviewWorkflow,
  runLiteratureReviewWorkflowWithProgress,
  validateLiteratureReviewInputs,
  getLiteratureReviewSummary,
} from './workflows/literatureReview.js';
import {
  runMultiPaperWorkflow,
  runMultiPaperWorkflowParallel,
  runMultiPaperWorkflowWithProgress,
  validateMultiPaperInputs,
  getMultiPaperSummary,
} from './workflows/multiPaper.js';
import { promises as fs } from 'fs';
import path from 'path';

const logger = createLogger('CLI');

/**
 * Main CLI application
 */
async function main() {
  const program = new Command();

  program
    .name('langgraph-research')
    .description('LangGraph-based state machine paper research system')
    .version('0.1.0');

  /**
   * Single paper command
   */
  program
    .command('single')
    .description('Analyze a single research paper')
    .argument('<pdf>', 'Path to the PDF file')
    .option('-q, --query <query>', 'Research query or prompt')
    .option('-o, --output <path>', 'Output directory for results')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--progress', 'Show progress updates')
    .action(async (pdf: string, options) => {
      try {
        // Validate inputs
        const query = options.query || 'Analyze this research paper';
        const validation = validateSinglePaperInputs(pdf, query);

        if (!validation.valid) {
          console.error(`Error: ${validation.error}`);
          process.exit(1);
        }

        // Configure logging
        if (options.verbose) {
          logger.setLevelFromString('debug');
        }

        console.log(`\n📄 Analyzing paper: ${pdf}`);
        console.log(`📝 Query: ${query}\n`);

        // Run workflow
        const result = options.progress
          ? await runSinglePaperWorkflowWithProgress(pdf, query, (status, message) => {
              console.log(`  [${status}] ${message}`);
            })
          : await runSinglePaperWorkflow(pdf, query);

        // Display results
        displaySinglePaperResult(result, options);

        // Save output if requested
        if (options.output && result.status === 'completed') {
          await saveOutput(result, options.output);
        }

        // Exit with appropriate code
        process.exit(result.status === 'completed' ? 0 : 1);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Single paper command failed', error);
        console.error(`\n❌ Error: ${errorMessage}\n`);
        process.exit(1);
      }
    });

  /**
   * Literature review command
   */
  program
    .command('review')
    .description('Generate a comprehensive literature review with quality checks')
    .argument('<pdf>', 'Path to the PDF file')
    .option('-q, --query <query>', 'Research query or prompt')
    .option('-r, --retries <number>', 'Maximum number of retries', '3')
    .option('-o, --output <path>', 'Output directory for results')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--progress', 'Show detailed progress updates')
    .action(async (pdf: string, options) => {
      try {
        // Validate inputs
        const query = options.query || 'Generate a comprehensive literature review';
        const maxRetries = parseInt(options.retries, 10);
        const validation = validateLiteratureReviewInputs(pdf, query, maxRetries);

        if (!validation.valid) {
          console.error(`Error: ${validation.error}`);
          process.exit(1);
        }

        // Configure logging
        if (options.verbose) {
          logger.setLevelFromString('debug');
        }

        console.log(`\n📚 Generating literature review: ${pdf}`);
        console.log(`📝 Query: ${query}`);
        console.log(`🔄 Max retries: ${maxRetries}\n`);

        // Run workflow
        const result = options.progress
          ? await runLiteratureReviewWorkflowWithProgress(pdf, query, maxRetries, (phase, status, details) => {
              const statusIcon = status === 'completed' ? '✓' : status === 'processing' ? '⟳' : '✗';
              console.log(`  ${statusIcon} [${phase}] ${status}`);
              if (details && Object.keys(details).length > 0) {
                console.log(`     ${JSON.stringify(details, null, 2).split('\n').join('\n     ')}`);
              }
            })
          : await runLiteratureReviewWorkflow(pdf, query, maxRetries);

        // Display results
        displayLiteratureReviewResult(result, options);

        // Save output if requested
        if (options.output && result.status === 'completed') {
          await saveOutput(result, options.output);
        }

        // Exit with appropriate code
        process.exit(result.status === 'completed' ? 0 : 1);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Literature review command failed', error);
        console.error(`\n❌ Error: ${errorMessage}\n`);
        process.exit(1);
      }
    });

  /**
   * Multi-paper command
   */
  program
    .command('multi')
    .description('Analyze multiple research papers and generate comparative analysis')
    .argument('<pdfs...>', 'Paths to PDF files (space-separated)')
    .option('-q, --query <query>', 'Research query or prompt')
    .option('-p, --parallel', 'Process papers in parallel')
    .option('-c, --concurrency <number>', 'Number of papers to process in parallel', '3')
    .option('-o, --output <path>', 'Output directory for results')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--progress', 'Show progress updates')
    .action(async (pdfs: string[], options) => {
      try {
        // Validate inputs
        const query = options.query || 'Comparative analysis of research papers';
        const validation = validateMultiPaperInputs(pdfs, query);

        if (!validation.valid) {
          console.error(`Error: ${validation.error}`);
          process.exit(1);
        }

        // Configure logging
        if (options.verbose) {
          logger.setLevelFromString('debug');
        }

        console.log(`\n📄📄 Analyzing ${pdfs.length} papers`);
        console.log(`📝 Query: ${query}`);
        console.log(`🔄 Mode: ${options.parallel ? 'Parallel' : 'Sequential'}\n`);

        // Run workflow
        const concurrency = parseInt(options.concurrency, 10);
        const result = options.progress
          ? await runMultiPaperWorkflowWithProgress(pdfs, query, (phase, progress, message) => {
              console.log(`  [${progress}%] ${message}`);
            })
          : options.parallel
          ? await runMultiPaperWorkflowParallel(pdfs, query, concurrency)
          : await runMultiPaperWorkflow(pdfs, query);

        // Display results
        displayMultiPaperResult(result, options);

        // Save output if requested
        if (options.output && result.status === 'completed') {
          await saveOutput(result, options.output);
        }

        // Exit with appropriate code
        process.exit(result.status === 'completed' ? 0 : 1);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Multi-paper command failed', error);
        console.error(`\n❌ Error: ${errorMessage}\n`);
        process.exit(1);
      }
    });

  /**
   * Config command
   */
  program
    .command('config')
    .description('Display current configuration')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = getConfig();

        if (options.json) {
          console.log(JSON.stringify(config, null, 2));
        } else {
          console.log('\n📋 Current Configuration:\n');
          console.log('LLM:');
          console.log(`  Provider: ${config.llm.provider.toUpperCase()}`);
          console.log(`  Model: ${config.llm.model}`);
          console.log(`  Base URL: ${config.llm.baseURL}`);
          console.log(`  Max Tokens: ${config.llm.maxTokens}`);
          console.log(`  Temperature: ${config.llm.temperature}`);
          console.log('\nMarker:');
          console.log(`  GPU Enabled: ${config.marker.gpuEnabled}`);
          console.log(`  Batch Size: ${config.marker.batchSize}`);
          console.log('\nChromaDB:');
          console.log(`  Host: ${config.chroma.host}`);
          console.log(`  Port: ${config.chroma.port}`);
          console.log(`  Collection: ${config.chroma.collectionName}`);
          console.log('\nQuality:');
          console.log(`  Min Summary Length: ${config.quality.minSummaryLength}`);
          console.log(`  Min Analysis Items: ${config.quality.minAnalysisItems}`);
          console.log(`  Min Draft Length: ${config.quality.minDraftLength}`);
          console.log('\nOutput:');
          console.log(`  Directory: ${config.output.dir}`);
          console.log('');
        }

        process.exit(0);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`\n❌ Error: ${errorMessage}\n`);
        process.exit(1);
      }
    });

   /**
    * Test command
    */
  program
    .command('test')
    .description('Test the system configuration')
    .action(async () => {
      try {
        console.log('\n🧪 Testing LangGraph Research System\n');

        // Test config
        console.log('Testing configuration...');
        const config = getConfig();
        console.log('  ✓ Configuration loaded');

        // Test API key
        console.log(`\nLLM Provider: ${config.llm.provider.toUpperCase()}`);
        if (config.llm.apiKey) {
          console.log('  ✓ LLM API key is set');
        } else {
          console.log('  ✗ LLM API key is missing');
        }

        // Test output directory
        console.log(`\nOutput directory: ${config.output.dir}`);
        try {
          await fs.mkdir(config.output.dir, { recursive: true });
          console.log('  ✓ Output directory is writable');
        } catch {
          console.log('  ✗ Cannot write to output directory');
        }


        console.log('\n✅ System test complete\n');
        process.exit(0);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`\n❌ Error: ${errorMessage}\n`);
        process.exit(1);
      }
    });

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

/**
 * Display single paper workflow results
 */
function displaySinglePaperResult(result: any, options: any): void {
  console.log('\n' + '='.repeat(60));
  console.log('RESULT');
  console.log('='.repeat(60));

  if (result.status === 'completed') {
    console.log(`\n✓ Status: Completed successfully`);
    console.log(`⏱️  Duration: ${formatDuration(result.lastUpdated - result.startTime)}`);

    if (result.summary) {
      console.log('\n📝 Summary:');
      console.log(`  ${result.summary.substring(0, 200)}...`);
    }

    if (result.analysis) {
      console.log('\n🔍 Analysis:');
      console.log(`  Key Findings: ${result.analysis.keyFindings.length}`);
      console.log(`  Research Gaps: ${result.analysis.researchGap.length}`);
      console.log(`  Related Papers: ${result.analysis.relatedPapers.length}`);
    }

    if (result.draft) {
      console.log('\n📄 Draft:');
      console.log(`  ${result.draft.length} characters`);
    }

  } else if (result.status === 'error') {
    console.log(`\n✗ Status: Failed`);
    console.log(`❌ Error: ${result.error}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Display literature review workflow results
 */
function displayLiteratureReviewResult(result: any, options: any): void {
  console.log('\n' + '='.repeat(60));
  console.log('LITERATURE REVIEW RESULT');
  console.log('='.repeat(60));

  const summary = getLiteratureReviewSummary(result);

  if (result.status === 'completed') {
    console.log(`\n✓ Status: Completed successfully`);
    console.log(`⏱️  Duration: ${summary.duration}`);

    if (summary.qualityScore !== undefined) {
      console.log(`📊 Quality Score: ${summary.qualityScore}/100`);
    }

    if (summary.retries !== undefined) {
      console.log(`🔄 Retries: ${summary.retries}`);
    }

    if (summary.findings !== undefined) {
      console.log(`🔍 Key Findings: ${summary.findings}`);
    }

    if (summary.relatedPapers !== undefined) {
      console.log(`📚 Related Papers: ${summary.relatedPapers}`);
    }

    if (summary.draftLength !== undefined) {
      console.log(`📄 Draft: ${summary.draftLength} characters`);
    }

    if (result.qualityCheck && result.qualityCheck.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      result.qualityCheck.suggestions.forEach((s: string, i: number) => {
        console.log(`  ${i + 1}. ${s}`);
      });
    }

  } else if (result.status === 'error') {
    console.log(`\n✗ Status: Failed`);
    console.log(`❌ Error: ${result.error}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Display multi-paper workflow results
 */
function displayMultiPaperResult(result: any, options: any): void {
  console.log('\n' + '='.repeat(60));
  console.log('MULTI-PAPER ANALYSIS RESULT');
  console.log('='.repeat(60));

  const summary = getMultiPaperSummary(result);

  console.log(`\n📊 Total Papers: ${summary.totalPapers}`);
  console.log(`✓ Successful: ${summary.successfulPapers}`);
  console.log(`✗ Failed: ${summary.failedPapers}`);
  console.log(`⏱️  Duration: ${summary.duration}`);

  if (summary.hasComparativeAnalysis) {
    console.log(`📄 Comparative Analysis: Generated`);
  }

  // Show individual paper results
  if (result.aggregatedResults && result.aggregatedResults.length > 0) {
    console.log('\nIndividual Results:');
    result.aggregatedResults.forEach((r: any, i: number) => {
      const status = r.error ? '✗' : '✓';
      const pdfName = path.basename(r.pdfPath);
      console.log(`  ${status} ${i + 1}. ${pdfName}`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Save output to file
 */
async function saveOutput(result: any, outputPath: string): Promise<void> {
  try {
    await fs.mkdir(outputPath, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

    // Save draft if available
    if (result.draft) {
      const draftPath = path.join(outputPath, `draft_${timestamp}.md`);
      await fs.writeFile(draftPath, result.draft, 'utf-8');
      console.log(`📄 Draft saved to: ${draftPath}`);
    }

    // Save analysis as JSON
    if (result.analysis) {
      const analysisPath = path.join(outputPath, `analysis_${timestamp}.json`);
      await fs.writeFile(analysisPath, JSON.stringify(result.analysis, null, 2), 'utf-8');
      console.log(`🔍 Analysis saved to: ${analysisPath}`);
    }

    console.log('');

  } catch (error) {
    logger.warn('Failed to save output', error);
  }
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
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

/**
 * Run the CLI application
 */
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export default main;
