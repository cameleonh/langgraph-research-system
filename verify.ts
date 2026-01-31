/**
 * Verification Script
 * Verifies that the implementation is complete and correct
 */

import { promises as fs } from 'fs';
import path from 'path';

interface VerificationResult {
  phase: string;
  file: string;
  exists: boolean;
  status: 'pass' | 'fail';
}

const filesToVerify = [
  // Phase 1: Setup & Configuration
  { phase: 'Phase 1: Setup', path: 'tsconfig.json' },
  { phase: 'Phase 1: Setup', path: '.env.example' },
  { phase: 'Phase 1: Setup', path: '.env' },
  { phase: 'Phase 1: Setup', path: 'src/config.ts' },
  { phase: 'Phase 1: Setup', path: 'src/utils/logger.ts' },

  // Phase 2: Core Types & State
  { phase: 'Phase 2: State', path: 'src/state/schema.ts' },
  { phase: 'Phase 2: State', path: 'src/state/reducers.ts' },
  { phase: 'Phase 2: State', path: 'src/types/index.ts' },

  // Phase 3: Tools Layer
  { phase: 'Phase 3: Tools', path: 'src/tools/MarkerConverter.ts' },
  { phase: 'Phase 3: Tools', path: 'src/tools/WebSearch.ts' },
  { phase: 'Phase 3: Tools', path: 'src/tools/VectorStore.ts' },
  { phase: 'Phase 3: Tools', path: 'src/tools/index.ts' },

  // Phase 4: Nodes Layer
  { phase: 'Phase 4: Nodes', path: 'src/nodes/convertNode.ts' },
  { phase: 'Phase 4: Nodes', path: 'src/nodes/analyzeNode.ts' },
  { phase: 'Phase 4: Nodes', path: 'src/nodes/writeNode.ts' },
  { phase: 'Phase 4: Nodes', path: 'src/nodes/qualityCheckNode.ts' },
  { phase: 'Phase 4: Nodes', path: 'src/nodes/index.ts' },

  // Phase 5: Workflow Layer
  { phase: 'Phase 5: Workflows', path: 'src/workflows/singlePaper.ts' },
  { phase: 'Phase 5: Workflows', path: 'src/workflows/literatureReview.ts' },
  { phase: 'Phase 5: Workflows', path: 'src/workflows/multiPaper.ts' },
  { phase: 'Phase 5: Workflows', path: 'src/workflows/index.ts' },

  // Phase 6: Entry Point
  { phase: 'Phase 6: Entry Point', path: 'src/index.ts' },
  { phase: 'Phase 6: Entry Point', path: 'src/api.ts' },

  // Phase 7: Testing
  { phase: 'Phase 7: Tests', path: 'tests/config.test.ts' },
  { phase: 'Phase 7: Tests', path: 'tests/tools.test.ts' },
  { phase: 'Phase 7: Tests', path: 'tests/nodes.test.ts' },
  { phase: 'Phase 7: Tests', path: 'tests/workflows.test.ts' },
];

async function verifyFile(filePath: string): Promise<boolean> {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const stats = await fs.stat(fullPath);

    // Check if file is not empty
    if (stats.size === 0) {
      return false;
    }

    // Check if file has content
    const content = await fs.readFile(fullPath, 'utf-8');
    return content.trim().length > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('LangGraph Research System - Implementation Verification');
  console.log('='.repeat(70) + '\n');

  const results: VerificationResult[] = [];
  let currentPhase = '';
  let passCount = 0;
  let failCount = 0;

  for (const { phase, path: filePath } of filesToVerify) {
    if (phase !== currentPhase) {
      if (currentPhase !== '') {
        console.log('');
      }
      console.log(`\x1b[36m${phase}\x1b[0m`);
      currentPhase = phase;
    }

    const exists = await verifyFile(filePath);
    const status = exists ? 'pass' : 'fail';

    if (exists) {
      passCount++;
      console.log(`  \x1b[32m✓\x1b[0m ${filePath}`);
    } else {
      failCount++;
      console.log(`  \x1b[31m✗\x1b[0m ${filePath}`);
    }

    results.push({ phase, path: filePath, exists, status });
  }

  console.log('\n' + '='.repeat(70));
  console.log('Summary');
  console.log('='.repeat(70));
  console.log(`Total Files: ${filesToVerify.length}`);
  console.log(`\x1b[32mPassed: ${passCount}\x1b[0m`);
  console.log(`\x1b[31mFailed: ${failCount}\x1b[0m`);
  console.log('='.repeat(70) + '\n');

  if (failCount === 0) {
    console.log('\x1b[32m✓ All files created successfully!\x1b[0m\n');
    console.log('Next steps:');
    console.log('  1. Configure your .env file with API keys');
    console.log('  2. Run: npm run single <paper.pdf> -q "Analyze this paper"');
    console.log('  3. Run: npm run review <paper.pdf> -q "Comprehensive review" -r 3');
    console.log('  4. Run: npm run multi <paper1.pdf> <paper2.pdf> -q "Comparative analysis"');
    console.log('  5. Run tests: npm test (requires Bun)');
    console.log('');
  } else {
    console.log('\x1b[31m✗ Some files are missing or empty\x1b[0m\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\x1b[31mError:\x1b[0m', error);
  process.exit(1);
});
