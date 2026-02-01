/**
 * Orchestrator - The Research Lab Leader (랩장)
 *
 * Orchestrator는 전체 연구 워크플로우를 조율하고,
 * 유휴 시간(idle)에 연구계획서 평가 같은 추가 작업을 수행합니다.
 */

import { createLogger } from './utils/logger.js';
import { getConfig } from './config.js';
import type { State, ResearchProposal, ProposalEvaluation } from './types/index.js';

const logger = createLogger('Orchestrator');

/**
 * Orchestrator 상태
 */
interface OrchestratorState {
  isWorking: boolean;
  currentTask: string | null;
  tasksCompleted: number;
  lastActivity: number;
}

/**
 * 연구계획서 평가 결과
 */
export interface ProposalEvaluationResult {
  overallScore: number;           // 전체 점수 (0-100)
  academicRigor: number;          // 학술적 엄밀성 (0-100)
  methodology: number;            // 방법론 적절성 (0-100)
  dataQuality: number;            // 데이터 및 변수 구성 (0-100)
  policyRelevance: number;        // 정책적 함의 실현가능성 (0-100)

  strengths: string[];            // 강점
  weaknesses: string[];           // 약점
  suggestions: string[];          // 개선 제언

  summary: string;                // 종합 평가 요약
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Orchestrator 클래스 - 랩장 역할
 */
export class Orchestrator {
  private state: OrchestratorState;
  private evaluationQueue: Array<{
    proposal: ResearchProposal;
    callback?: (result: ProposalEvaluationResult) => void;
  }> = [];

  constructor() {
    this.state = {
      isWorking: false,
      currentTask: null,
      tasksCompleted: 0,
      lastActivity: Date.now(),
    };
  }

  /**
   * 메인 워크플로우 조율 - 논문 분석부터 계획서 작성까지
   */
  async coordinateResearchWorkflow(papers: string[], topic: string): Promise<State> {
    this.state.isWorking = true;
    this.state.currentTask = 'research_workflow';

    logger.info(`[랩장] 연구 워크플로우 시작: ${papers.length}개 논문, 주제: ${topic}`);

    try {
      // 1단계: PDF 변환 (Mark을 통해)
      logger.info('[랩장] 1단계: PDF → Markdown 변환 지시');
      // convertNode 실행...

      // 2단계: 논문 분석 (Analyzer에게)
      logger.info('[랩장] 2단계: 논문 내용 분석 지시');
      // analyzeNode 실행...

      // 3단계: 연구계획서 작성 (Writer에게)
      logger.info('[랩장] 3단계: 연구계획서 작성 지시');
      // writeNode 실행...

      // 4단계: 품질 검사 (QualityChecker에게)
      logger.info('[랩장] 4단계: 품질 검사 지시');
      // qualityCheckNode 실행...

      this.state.tasksCompleted++;
      logger.info(`[랩장] 연구 워크플로우 완료! (총 ${this.state.tasksCompleted}개 작업 완료)`);

      // 결과 반환 (실제로는 각 노드의 결과를 종합)
      return {
        status: 'completed',
        log: ['연구 워크플로우 완료'],
      } as State;

    } finally {
      this.state.isWorking = false;
      this.state.currentTask = null;
      this.state.lastActivity = Date.now();
    }
  }

  /**
   * 유휴 시간에 수행하는 연구계획서 평가 (랩장의 "쉴 때" 작업)
   */
  async evaluateProposal(proposal: ResearchProposal): Promise<ProposalEvaluationResult> {
    logger.info('[랩장 쉴 때] 연구계획서 평가 시작...');

    const result = this.performEvaluation(proposal);

    logger.info(`[랩장 쉴 때] 평가 완료: ${result.rating} (${result.overallScore}/100)`);

    return result;
  }

  /**
   * 평가 대기열에 추가 (Orchestrator가 유휴일 때 처리)
   */
  queueEvaluation(proposal: ResearchProposal): Promise<ProposalEvaluationResult> {
    return new Promise((resolve) => {
      this.evaluationQueue.push({ proposal, callback: resolve });
      logger.info(`[랩장] 평가 대기열에 추가 (현재 ${this.evaluationQueue.length}개 대기 중)`);

      // 유휴 시간에 처리 시작
      this.processQueueWhenIdle();
    });
  }

  /**
   * Orchestrator 상태 확인
   */
  getStatus(): OrchestratorState & { queueSize: number } {
    return {
      ...this.state,
      queueSize: this.evaluationQueue.length,
    };
  }

  /**
   * 연구계획서 평가 수행 (핵심 로직)
   */
  private performEvaluation(proposal: ResearchProposal): ProposalEvaluationResult {
    const evaluation: ProposalEvaluationResult = {
      overallScore: 0,
      academicRigor: 0,
      methodology: 0,
      dataQuality: 0,
      policyRelevance: 0,
      strengths: [],
      weaknesses: [],
      suggestions: [],
      summary: '',
      rating: 'fair',
    };

    // 1. 학술적 엄밀성 평가 (25점 만점)
    evaluation.academicRigor = this.evaluateAcademicRigor(proposal);

    // 2. 방법론 적절성 평가 (25점 만점)
    evaluation.methodology = this.evaluateMethodology(proposal);

    // 3. 데이터 및 변수 구성 평가 (25점 만점)
    evaluation.dataQuality = this.evaluateDataQuality(proposal);

    // 4. 정책적 함의 실현가능성 평가 (25점 만점)
    evaluation.policyRelevance = this.evaluatePolicyRelevance(proposal);

    // 전체 점수 계산
    evaluation.overallScore = Math.round(
      (evaluation.academicRigor + evaluation.methodology +
       evaluation.dataQuality + evaluation.policyRelevance) / 4
    );

    // 강점, 약점, 제언 추출
    this.extractFeedback(proposal, evaluation);

    // 등급 결정
    evaluation.rating = this.determineRating(evaluation.overallScore);

    // 종합 평가 요약
    evaluation.summary = this.generateSummary(evaluation);

    return evaluation;
  }

  /**
   * 학술적 엄밀성 평가
   */
  private evaluateAcademicRigor(proposal: ResearchProposal): number {
    let score = 0;
    const maxScore = 100;

    const content = JSON.stringify(proposal).toLowerCase();

    // 연구질문 명확성 (20점)
    if (content.includes('연구질문') || content.includes('research question')) {
      score += 20;
    }
    if (content.includes('rq1') || content.includes('rq2') || content.includes('rq3')) {
      score += 10; // 명시적 번호 부여
    }

    // 가설 명시 (15점)
    if (content.includes('가설') || content.includes('hypothesis')) {
      score += 15;
    }

    // 선행연구 검토 (20점)
    if (content.includes('선행연구') || content.includes('literature review')) {
      score += 20;
    }
    if (content.includes('research gap') || content.includes('연구 공백')) {
      score += 10;
    }

    // 기여점 명시 (15점)
    if (content.includes('기여') || content.includes('contribution')) {
      score += 15;
    }

    // 학술적 용어 사용 (10점)
    const academicTerms = ['인과관계', '상관관계', '통계적 유의성', '신뢰구간', '효과크기'];
    const termCount = academicTerms.filter(term => content.includes(term)).length;
    score += Math.min(10, termCount * 2);

    // 인용/참고문헌 (10점)
    if (content.includes('참고문헌') || content.includes('references') || content.includes('인용')) {
      score += 10;
    }

    return Math.min(maxScore, score);
  }

  /**
   * 방법론 적절성 평가
   */
  private evaluateMethodology(proposal: ResearchProposal): number {
    let score = 0;
    const maxScore = 100;

    const content = JSON.stringify(proposal).toLowerCase();

    // 식별전략 명시 (40점) - 핵심!
    const identificationStrategies = [
      'did', 'difference-in-differences', '차분차분',
      'panel fe', '패널 고정효과', 'fixed effect',
      'iv', '도구변수', 'instrumental variable',
      'rct', '무작위 배정',
      'rd', '회귀불연속 설계'
    ];

    const strategyCount = identificationStrategies.filter(s => content.includes(s)).length;
    if (strategyCount > 0) {
      score += 40;
      // 여러 전략 제안 시 추가 점수
      score += Math.min(10, (strategyCount - 1) * 5);
    }

    // 데이터 출처 구체성 (15점)
    if (content.includes('klips') || content.includes('한국노동패널')) {
      score += 10;
    }
    if (content.includes('주거실태조사') || content.includes('외국인노동자조사')) {
      score += 5;
    }

    // 변수 구성 (15점)
    if (content.includes('종속변수') || content.includes('설명변수')) {
      score += 10;
    }
    if (content.includes('통제변수') || content.includes('control variable')) {
      score += 5;
    }

    // 회귀식 제시 (20점)
    if (content.includes('회귀식') || content.includes('regression') || content.includes('=')) {
      score += 10;
    }
    // Stata/R 형식 회귀식
    if (content.includes('y_it') || content.includes('β') || content.includes('coef')) {
      score += 10;
    }

    // 표본 크기 고려 (10점)
    if (content.includes('표본') || content.includes('sample')) {
      score += 10;
    }

    return Math.min(maxScore, score);
  }

  /**
   * 데이터 및 변수 구성 평가
   */
  private evaluateDataQuality(proposal: ResearchProposal): number {
    let score = 0;
    const maxScore = 100;

    const content = JSON.stringify(proposal).toLowerCase();

    // 패널 데이터 사용 (30점)
    if (content.includes('패널') || content.includes('panel')) {
      score += 30;
    }

    // 공공데이터 활용 (20점)
    const publicData = ['klips', 'kosis', '통계청', '주거실태조사'];
    if (publicData.some(d => content.includes(d))) {
      score += 20;
    }

    // 변수 구체성 (20점)
    const hasVariables =
      content.includes('소득') ||
      content.includes('가구원') ||
      content.includes('체류자격');
    if (hasVariables) {
      score += 10;
    }

    // 시간 범위 명시 (10점)
    if (content.includes('연도') || content.includes('기간') || /\d{4}/.test(content)) {
      score += 10;
    }

    // 데이터 제한 인지 (20점)
    if (content.includes('한계') || content.includes('limitation') || content.includes('제약')) {
      score += 20;
    }

    return Math.min(maxScore, score);
  }

  /**
   * 정책적 함의 실현가능성 평가
   */
  private evaluatePolicyRelevance(proposal: ResearchProposal): number {
    let score = 0;
    const maxScore = 100;

    const content = JSON.stringify(proposal).toLowerCase();

    // 구체적 정책 제언 (30점)
    if (content.includes('정책') || content.includes('policy')) {
      score += 15;
    }
    if (content.includes('제언') || content.includes('recommendation')) {
      score += 15;
    }

    // 현실성 고려 (20점)
    const practicalTerms = ['예산', '행정', '시행', '법 개정', '제도 개선'];
    const practicalCount = practicalTerms.filter(t => content.includes(t)).length;
    score += Math.min(20, practicalCount * 5);

    // 이해관계자 고려 (15점)
    if (content.includes('정부') || content.includes('지자체') || content.includes('주민')) {
      score += 15;
    }

    // 기대 효과 (20점)
    if (content.includes('기대효과') || content.includes('예상 결과') || content.includes('효과')) {
      score += 10;
    }
    if (content.includes('사회통합') || content.includes('주거 안정') || content.includes('복지')) {
      score += 10;
    }

    // 우선순위 제시 (15점)
    if (content.includes('우선순위') || content.includes('단계적') || content.includes('short-term')) {
      score += 15;
    }

    return Math.min(maxScore, score);
  }

  /**
   * 강점, 약점, 제언 추출
   */
  private extractFeedback(proposal: ResearchProposal, evaluation: ProposalEvaluationResult): void {
    const content = JSON.stringify(proposal);

    // 강점 추출
    if (content.includes('DID') || content.includes('패널 FE')) {
      evaluation.strengths.push('명확한 식별전략(DID/패널 FE) 제시');
    }
    if (content.includes('KLIPS') || content.includes('패널')) {
      evaluation.strengths.push('패널 데이터 활용으로 인과관계 식별 가능');
    }
    if (content.includes('외국인') && content.includes('공공주택')) {
      evaluation.strengths.push('외국인과 공공주택의 연결 고리 발견');
    }

    // 약점 추출
    if (!content.includes('DID') && !content.includes('FE')) {
      evaluation.weaknesses.push('식별전략이 불명확함 (내생성 문제 우려)');
    }
    if (!content.includes('표본') || !content.includes('sample')) {
      evaluation.weaknesses.push('표본 크기나 데이터 기간에 대한 언급 부족');
    }
    if (content.includes('제안') && !content.includes('구체')) {
      evaluation.weaknesses.push('정책 제언이 추상적임');
    }

    // 개선 제언
    if (evaluation.methodology < 60) {
      evaluation.suggestions.push('구체적인 식별전략(DID/FE/IV 중 하나)을 명시하세요');
    }
    if (evaluation.dataQuality < 60) {
      evaluation.suggestions.push('사용할 데이터의 시기와 변수 구성을 구체화하세요');
    }
    if (evaluation.policyRelevance < 60) {
      evaluation.suggestions.push('정책적 함의를 실행 가능한 행동 계획으로 구체화하세요');
    }
    if (!content.includes('한계') && !content.includes('limitation')) {
      evaluation.suggestions.push('연구의 한계점을 명시하여 학술적 엄밀성을 높이세요');
    }
  }

  /**
   * 등급 결정
   */
  private determineRating(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  /**
   * 종합 평가 요약 생성
   */
  private generateSummary(evaluation: ProposalEvaluationResult): string {
    const ratingText = {
      excellent: '우수',
      good: '양호',
      fair: '보통',
      poor: '미흡',
    }[evaluation.rating];

    let summary = `### 종합 평가: ${ratingText} (${evaluation.overallScore}/100)\n\n`;

    // 점수 분해
    summary += `**점수 상세:**\n`;
    summary += `- 학술적 엄밀성: ${evaluation.academicRigor}/100\n`;
    summary += `- 방법론 적절성: ${evaluation.methodology}/100\n`;
    summary += `- 데이터 구성: ${evaluation.dataQuality}/100\n`;
    summary += `- 정책적 함의: ${evaluation.policyRelevance}/100\n\n`;

    // 강점
    if (evaluation.strengths.length > 0) {
      summary += `**강점:**\n`;
      evaluation.strengths.forEach(s => summary += `  ✓ ${s}\n`);
      summary += `\n`;
    }

    // 약점
    if (evaluation.weaknesses.length > 0) {
      summary += `**개선이 필요한 부분:**\n`;
      evaluation.weaknesses.forEach(w => summary += `  ⚠ ${w}\n`);
      summary += `\n`;
    }

    // 제언
    if (evaluation.suggestions.length > 0) {
      summary += `**개선 제언:**\n`;
      evaluation.suggestions.forEach(s => summary += `  → ${s}\n`);
    }

    return summary;
  }

  /**
   * 유휴 시간에 대기열 처리
   */
  private async processQueueWhenIdle(): Promise<void> {
    if (this.state.isWorking || this.evaluationQueue.length === 0) {
      return;
    }

    const item = this.evaluationQueue.shift();
    if (!item) return;

    this.state.isWorking = true;
    this.state.currentTask = 'evaluation';

    try {
      const result = await this.evaluateProposal(item.proposal);
      if (item.callback) {
        item.callback(result);
      }
    } finally {
      this.state.isWorking = false;
      this.state.currentTask = null;
      this.state.lastActivity = Date.now();

      // 다음 대기열 처리
      if (this.evaluationQueue.length > 0) {
        this.processQueueWhenIdle();
      }
    }
  }

  /**
   * Orchestrator 종료 (리소스 정리)
   */
  shutdown(): void {
    logger.info('[랩장] Orchestrator 종료...');
    this.evaluationQueue = [];
    this.state.isWorking = false;
  }
}

/**
 * 싱글톤 인스턴스
 */
let orchestratorInstance: Orchestrator | null = null;

/**
 * Orchestrator 싱글톤 가져오기
 */
export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

/**
 * 연구계획서 타입 (간단 버전)
 */
export interface ResearchProposal {
  title: string;
  topic: string;
  researchQuestions: string[];
  hypotheses?: string[];
  methodology: string;
  data: string;
  variables?: string;
  expectedResults: string;
  policyImplications: string;
  fullText?: string;  // 전체 텍스트 (평가용)
}

// 기본 내보내기
export default Orchestrator;
