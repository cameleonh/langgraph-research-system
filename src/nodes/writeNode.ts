/**
 * Write Node - Draft Generation
 * Generates a draft report based on the analysis results
 */

import type { State } from '../state/schema.js';
import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config.js';
import { promises as fs } from 'fs';
import path from 'path';
import { callLLM, type LLMMessage } from '../utils/llmService.js';
import type { StateUpdate } from '../state/schema.js';

const logger = createLogger('WriteNode');

/**
 * System prompt for draft generation
 */
const DRAFT_SYSTEM_PROMPT = `당신은 연구 논문과 문헌 리뷰를 전문으로 작성하는 전문 학술 작가입니다. 제공된 분석 결과를 바탕으로 포괄적이고 잘 구조화된 초안을 작성해야 합니다.

작성하는 초안은 다음 요건을 충족해야 합니다:
1. 명확하고 간결하며 잘 정리되어야 함
2. 학술적 작성 표준을 따름
3. 적절한 인용과 참고문헌 포함
4. 학술적 어조 유지
5. 적절한 제목과 섹션으로 구조화
6. 정보를 효과적으로 종합

반드시 **한국어**로 작성해야 합니다. 출판 가능하거나 거의 완성된 수준의 초안을 작성하세요.`;

/**
 * Write node - Generates draft based on analysis
 * @param state Current workflow state
 * @returns State update with generated draft
 */
export async function writeNode(state: State): Promise<StateUpdate> {
  try {
    logger.info('Starting draft generation');

    if (!state.analysis) {
      return {
        status: 'error',
        error: 'No analysis available for draft generation',
      };
    }

    const config = getConfig();

    // Build the draft prompt
    const userPrompt = buildDraftPrompt(state);

    logger.info(`Sending draft generation request to ${config.llm.provider.toUpperCase()} LLM`);

    // Call LLM API
    const messages: LLMMessage[] = [
      { role: 'system', content: DRAFT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await callLLM(messages, {
      maxTokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
    });

    const draft = response.content;

    logger.info('Draft generated successfully');

    // Save draft to file if output directory is configured
    let outputPath: string | undefined;
    if (config.output.analysisDir) {
      outputPath = await saveDraft(draft, state);
    }

    return {
      status: 'completed',
      draft,
      log: [
        'Draft generated successfully',
        `Draft length: ${draft.length} characters`,
        outputPath ? `Draft saved to: ${outputPath}` : undefined,
      ].filter(Boolean) as string[],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Write node failed', error);

    return {
      status: 'error',
      error: errorMessage,
      log: [`Draft generation error: ${errorMessage}`],
    };
  }
}

/**
 * Write node with custom template
 * @param state Current workflow state
 * @param template Custom template for the draft
 * @returns State update with generated draft
 */
export async function writeNodeWithTemplate(
  state: State,
  template: string
): Promise<StateUpdate> {
  try {
    logger.info('Starting draft generation with custom template');

    if (!state.analysis) {
      return {
        status: 'error',
        error: 'No analysis available for draft generation',
      };
    }

    // Apply template to analysis
    const draft = applyTemplate(template, state);

    logger.info('Draft generated from template');

    return {
      status: 'completed',
      draft,
      log: ['Draft generated from custom template'],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Write node with template failed', error);

    return {
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Write node for literature review
 * @param state Current workflow state
 * @returns State update with literature review draft
 */
export async function writeLiteratureReviewNode(state: State): Promise<StateUpdate> {
  try {
    logger.info('Starting literature review generation');

    if (!state.analysis) {
      return {
        status: 'error',
        error: 'No analysis available for literature review',
      };
    }

    const config = getConfig();

    // Build literature review prompt
    const userPrompt = buildLiteratureReviewPrompt(state);

    logger.info(`Sending literature review request to ${config.llm.provider.toUpperCase()} LLM`);

    // Call LLM API
    const messages: LLMMessage[] = [
      { role: 'system', content: DRAFT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await callLLM(messages, {
      maxTokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
    });

    const draft = response.content;

    logger.info('Literature review generated successfully');

    return {
      status: 'quality_check',
      draft,
      log: [
        'Literature review generated successfully',
        `Review length: ${draft.length} characters`,
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Write literature review node failed', error);

    return {
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Write node for comparative analysis
 * @param state Current workflow state with multiple paper results
 * @returns State update with comparative analysis draft
 */
export async function writeComparativeAnalysisNode(state: State): Promise<StateUpdate> {
  try {
    logger.info('Starting comparative analysis generation');

    if (!state.aggregatedResults || state.aggregatedResults.length === 0) {
      return {
        status: 'error',
        error: 'No aggregated results available for comparative analysis',
      };
    }

    const config = getConfig();

    // Build comparative analysis prompt
    const userPrompt = buildComparativeAnalysisPrompt(state);

    logger.info(`Sending comparative analysis request to ${config.llm.provider.toUpperCase()} LLM`);

    // Call LLM API
    const messages: LLMMessage[] = [
      { role: 'system', content: DRAFT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await callLLM(messages, {
      maxTokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
    });

    const draft = response.content;

    logger.info('Comparative analysis generated successfully');

    return {
      status: 'completed',
      draft,
      log: [
        'Comparative analysis generated successfully',
        `Analysis length: ${draft.length} characters`,
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Write comparative analysis node failed', error);

    return {
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Build the draft generation prompt
 */
function buildDraftPrompt(state: State): string {
  const { query, analysis, summary, metadata } = state;

  let prompt = '다음 분석 결과를 바탕으로 포괄적인 연구 보고서를 한국어로 작성해 주세요:\n\n';

  if (query) {
    prompt += `연구 주제: ${query}\n\n`;
  }

  if (metadata?.title) {
    prompt += `논문 제목: ${metadata.title}\n\n`;
  }

  if (summary) {
    prompt += `요약:\n${summary}\n\n`;
  }

  prompt += '## 분석 결과\n\n';

  if (analysis?.methodology) {
    prompt += `### 연구 방법론\n${analysis.methodology}\n\n`;
  }

  if (analysis?.keyFindings && analysis.keyFindings.length > 0) {
    prompt += '### 핵심 발견\n';
    analysis.keyFindings.forEach((finding, index) => {
      prompt += `${index + 1}. ${finding.finding}\n`;
      if (finding.evidence) {
        prompt += `   근거: ${finding.evidence}\n`;
      }
    });
    prompt += '\n';
  }

  if (analysis?.researchGap && analysis.researchGap.length > 0) {
    prompt += '### 해결된 연구 갭\n';
    analysis.researchGap.forEach((gap, index) => {
      prompt += `${index + 1}. ${gap.description}\n`;
    });
    prompt += '\n';
  }

  if (analysis?.conclusions) {
    prompt += `### 결론\n${analysis.conclusions}\n\n`;
  }

  if (analysis?.limitations && analysis.limitations.length > 0) {
    prompt += '### 한계점\n';
    analysis.limitations.forEach((limitation, index) => {
      prompt += `- ${limitation}\n`;
    });
    prompt += '\n';
  }

  if (analysis?.suggestions && analysis.suggestions.length > 0) {
    prompt += '### 향후 연구 제안\n';
    analysis.suggestions.forEach((suggestion, index) => {
      prompt += `${index + 1}. ${suggestion}\n`;
    });
    prompt += '\n';
  }

  prompt += '이 정보를 종합하여 잘 구조화된 연구 보고서를 한국어로 작성해 주세요.';

  return prompt;
}

/**
 * Build literature review prompt
 */
function buildLiteratureReviewPrompt(state: State): string {
  const { query, analysis, summary } = state;

  let prompt = 'Please generate a comprehensive literature review based on the following analysis:\n\n';

  if (query) {
    prompt += `Research Question: ${query}\n\n`;
  }

  if (summary) {
    prompt += `Paper Summary:\n${summary}\n\n`;
  }

  prompt += '## Detailed Analysis\n\n';

  if (analysis?.keyFindings && analysis.keyFindings.length > 0) {
    prompt += '### Key Contributions\n';
    analysis.keyFindings.forEach((finding) => {
      prompt += `- ${finding.finding}\n`;
    });
    prompt += '\n';
  }

  if (analysis?.relatedPapers && analysis.relatedPapers.length > 0) {
    prompt += '### Related Work\n';
    analysis.relatedPapers.forEach((paper) => {
      prompt += `- ${paper.title}`;
      if (paper.authors && paper.authors.length > 0) {
        prompt += ` (${paper.authors[0]} et al.)`;
      }
      if (paper.year) {
        prompt += ` ${paper.year}`;
      }
      prompt += '\n';
    });
    prompt += '\n';
  }

  if (analysis?.researchGap && analysis.researchGap.length > 0) {
    prompt += '### Research Gaps\n';
    analysis.researchGap.forEach((gap) => {
      prompt += `- ${gap.description}\n`;
    });
    prompt += '\n';
  }

  prompt += 'Generate a literature review that:\n';
  prompt += '1. Provides context and background\n';
  prompt += '2. Discusses related work and its relevance\n';
  prompt += '3. Identifies research gaps and contributions\n';
  prompt += '4. Synthesizes key findings and themes\n';
  prompt += '5. Concludes with implications and future directions\n';

  return prompt;
}

/**
 * Build comparative analysis prompt
 */
function buildComparativeAnalysisPrompt(state: State): string {
  const { query, aggregatedResults } = state;

  let prompt = 'Please generate a comparative analysis of the following research papers:\n\n';

  if (query) {
    prompt += `Analysis Focus: ${query}\n\n`;
  }

  prompt += '## Papers Analyzed\n\n';

  aggregatedResults?.forEach((result: Record<string, unknown>, index) => {
    prompt += `### Paper ${index + 1}\n`;

    if (result.metadata && typeof result.metadata === 'object') {
      const metadata = result.metadata as { title?: string; authors?: string[] };
      if (metadata.title) {
        prompt += `Title: ${metadata.title}\n`;
      }
      if (metadata.authors && metadata.authors.length > 0) {
        prompt += `Authors: ${metadata.authors.join(', ')}\n`;
      }
    }

    if (result.analysis && typeof result.analysis === 'object') {
      const analysis = result.analysis as { keyFindings?: { finding: string }[] };
      if (analysis.keyFindings && analysis.keyFindings.length > 0) {
        prompt += 'Key Findings:\n';
        analysis.keyFindings.slice(0, 3).forEach((finding) => {
          prompt += `- ${finding.finding}\n`;
        });
      }
    }

    prompt += '\n';
  });

  prompt += 'Generate a comparative analysis that:\n';
  prompt += '1. Identifies common themes and approaches\n';
  prompt += '2. Highlights differences and contradictions\n';
  prompt += '3. Compares methodologies and findings\n';
  prompt += '4. Synthesizes insights across papers\n';
  prompt += '5. Provides an overall conclusion\n';

  return prompt;
}

/**
 * Apply custom template to analysis
 */
function applyTemplate(template: string, state: State): string {
  let result = template;

  // Replace placeholders with actual values
  result = result.replace(/\{\{title\}\}/g, state.metadata?.title || 'Untitled');
  result = result.replace(/\{\{summary\}\}/g, state.summary || 'No summary available');
  result = result.replace(/\{\{query\}\}/g, state.query || '');
  result = result.replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]);

  if (state.analysis) {
    result = result.replace(/\{\{methodology\}\}/g, state.analysis.methodology || '');
    result = result.replace(/\{\{conclusions\}\}/g, state.analysis.conclusions || '');

    const findings = state.analysis.keyFindings
      .map((f, i) => `${i + 1}. ${f.finding}`)
      .join('\n');
    result = result.replace(/\{\{findings\}\}/g, findings);

    const gaps = state.analysis.researchGap
      .map((g, i) => `${i + 1}. ${g.description}`)
      .join('\n');
    result = result.replace(/\{\{gaps\}\}/g, gaps);

    const strengths = state.analysis.strengths
      .map((s, i) => `- ${s}`)
      .join('\n');
    result = result.replace(/\{\{strengths\}\}/g, strengths);

    const limitations = state.analysis.limitations
      .map((l, i) => `- ${l}`)
      .join('\n');
    result = result.replace(/\{\{limitations\}\}/g, limitations);
  }

  return result;
}

/**
 * Save draft to file
 */
async function saveDraft(draft: string, state: State): Promise<string> {
  const config = getConfig();

  try {
    // Ensure output directory exists
    await fs.mkdir(config.output.analysisDir, { recursive: true });

    // Generate filename
    const baseName = state.metadata?.title
      ? state.metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      : `paper_${Date.now()}`;

    const filename = `${baseName}_analysis.md`;
    const outputPath = path.join(config.output.analysisDir, filename);

    // Write draft to file
    await fs.writeFile(outputPath, draft, 'utf-8');

    logger.info(`Draft saved to: ${outputPath}`);

    return outputPath;

  } catch (error) {
    logger.warn('Failed to save draft to file', error);
    throw error;
  }
}

export default writeNode;
