/**
 * CLI Entry Point for the Orchestrator
 *
 * 사용법:
 *   bun run orchestrator --pdf ./papers/*.pdf --topic "외국인과 공공주택"
 *   bun run orchestrator --evaluate ./proposal.md
 */

import { getOrchestrator } from './src/orchestrator.js';
import { createLogger } from './src/utils/logger.js';
import { readFileSync } from 'fs';
import type { ResearchProposal } from './src/types/index.js';

const logger = createLogger('CLI');

/**
 * 파일에서 연구계획서 읽기
 */
function loadProposal(filePath: string): ResearchProposal {
  const content = readFileSync(filePath, 'utf-8');

  return {
    title: extractTitle(content),
    topic: extractTopic(content),
    researchQuestions: extractQuestions(content),
    methodology: extractSection(content, ['방법', 'methodology', '연구 방법']),
    data: extractSection(content, ['데이터', 'data', '자료']),
    expectedResults: extractSection(content, ['예상 결과', 'expected results', '기대 효과']),
    policyImplications: extractSection(content, ['정책적 함의', 'policy implications', '정책 제언']),
    fullText: content,
  };
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

function extractTopic(content: string): string {
  const match = content.match(/주제[:\s]+([^\n]+)/i);
  return match ? match[1].trim() : '';
}

function extractQuestions(content: string): string[] {
  const questions: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.match(/RQ\d+|연구질문\s*\d+|질문\s*\d+/i)) {
      questions.push(line.trim());
    }
  }

  return questions;
}

function extractSection(content: string, keywords: string[]): string {
  const lines = content.split('\n');
  let capturing = false;
  let result = '';

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    if (keywords.some(k => lowerLine.includes(k.toLowerCase()))) {
      capturing = true;
      continue;
    }

    if (capturing) {
      if (line.match(/^#{1,2}\s/)) break; // 다른 섹션 시작
      result += line + '\n';
    }
  }

  return result.trim();
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);
  const orchestrator = getOrchestrator();

  logger.info('='.repeat(50));
  logger.info('🎓 연구 랩 Orchestrator');
  logger.info('='.repeat(50));

  // 연구계획서 평가 모드
  if (args.includes('--evaluate') || args.includes('-e')) {
    const evalIndex = args.findIndex(a => a === '--evaluate' || a === '-e');
    const proposalPath = args[evalIndex + 1];

    if (!proposalPath) {
      logger.error('평가할 연구계획서 파일을 지정해주세요 (--evaluate ./proposal.md)');
      process.exit(1);
    }

    logger.info(`연구계획서 평가: ${proposalPath}`);

    try {
      const proposal = loadProposal(proposalPath);
      const result = await orchestrator.evaluateProposal(proposal);

      console.log('\n' + '='.repeat(60));
      console.log('📊 평가 결과');
      console.log('='.repeat(60));
      console.log(`\n등급: ${result.rating.toUpperCase()} (${result.overallScore}/100)\n`);
      console.log(result.summary);

      // 개선 제언이 있으면 별도 표시
      if (result.suggestions.length > 0) {
        console.log('\n' + '-'.repeat(60));
        console.log('💡 개선 제언');
        console.log('-'.repeat(60));
        result.suggestions.forEach((s, i) => {
          console.log(`${i + 1}. ${s}`);
        });
      }

      console.log('\n' + '='.repeat(60));

    } catch (error) {
      logger.error('평가 실패:', error);
      process.exit(1);
    }

    return;
  }

  // 워크플로우 모드
  if (args.includes('--pdf')) {
    const pdfIndex = args.findIndex(a => a === '--pdf');
    const pdfPaths: string[] = [];

    // PDF 파일들 수집
    for (let i = pdfIndex + 1; i < args.length && !args[i].startsWith('--'); i++) {
      pdfPaths.push(args[i]);
    }

    const topicIndex = args.findIndex(a => a === '--topic');
    const topic = topicIndex >= 0 ? args[topicIndex + 1] : '연구';

    logger.info(`PDF 파일 ${pdfPaths.length}개 분석 시작`);
    logger.info(`주제: ${topic}`);

    try {
      const result = await orchestrator.coordinateResearchWorkflow(pdfPaths, topic);
      logger.info('워크플로우 완료!');
    } catch (error) {
      logger.error('워크플로우 실패:', error);
      process.exit(1);
    }

    return;
  }

  // 상태 확인
  if (args.includes('--status') || args.includes('-s')) {
    const status = orchestrator.getStatus();
    console.log('\n[Orchestrator 상태]');
    console.log(`  작업 중: ${status.isWorking}`);
    console.log(`  현재 작업: ${status.currentTask || '없음'}`);
    console.log(`  완료된 작업: ${status.tasksCompleted}`);
    console.log(`  대기열 크기: ${status.queueSize}`);
    return;
  }

  // 도움말
  console.log(`
사용법:
  bun run orchestrator --pdf ./papers/*.pdf --topic "외국인과 공공주택"
  bun run orchestrator --evaluate ./proposal.md
  bun run orchestrator --status
  `);
}

// 직접 실행 시
main().catch(console.error);
