/**
 * Analyze Node - LLM Analysis of Paper Content
 * Core analysis node using GLM/Claude LLM to extract insights from papers
 */

import type { State, PaperAnalysis, KeyFinding, ResearchGap, RelatedPaper } from '../state/schema.js';
import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config.js';
import { searchPapers } from '../tools/WebSearch.js';
import { callLLM, type LLMMessage } from '../utils/llmService.js';
import type { StateUpdate } from '../state/schema.js';

const logger = createLogger('AnalyzeNode');

/**
 * System prompt for paper analysis
 */
const ANALYSIS_SYSTEM_PROMPT = `당신은 다양한 분야에 깊은 지식을 가진 전문 학술 연구 분석가입니다. 연구 논문을 분석하고 핵심 통찰을 추출하는 것이 작업입니다.

논문 분석 결과를 **한국어로** 마크다운 형식으로 작성해 주세요. 다음 항목들을 포함해야 합니다:

## 핵심 발견 (Key Findings)
논문의 주요 발견 3-5개를 나열하세요.

## 연구 갭 (Research Gaps)
연구에서 식별된 공백이나 해결이 필요한 문제 2-3개를 나열하세요.

## 연구 방법론 (Methodology)
사용된 연구 방법에 대한 간략한 설명을 작성하세요.

## 결론 (Conclusions)
주요 시사점과 함의를 작성하세요.

## 장점 (Strengths)
논문이 잘한 점 2-3개를 나열하세요.

## 한계점 (Limitations)
논문의 약점이나 제약 2-3개를 나열하세요.

## 향후 연구 제안 (Suggestions)
향후 연구에 대한 권장사항 2-3개를 나열하세요.

반드시 한국어로 작성하고, 각 항목을 명확하게 구분해서 응답하세요.`;

/**
 * Analyze node - Analyzes paper content using Claude LLM
 * @param state Current workflow state
 * @returns State update with analysis results
 */
export async function analyzeNode(state: State): Promise<StateUpdate> {
  try {
    logger.info('Starting paper analysis');

    if (!state.markdown) {
      return {
        status: 'error',
        error: 'No markdown content to analyze',
      };
    }

    const config = getConfig();

    // Build the analysis prompt
    const userPrompt = buildAnalysisPrompt(state);

    logger.info(`Sending request to ${config.llm.provider.toUpperCase()} LLM`);

    // Call LLM API
    const messages: LLMMessage[] = [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await callLLM(messages, {
      maxTokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
    });
    
    // Debug: Log raw response
    logger.info(`GLM Raw Response (first 500 chars): ${response.content.substring(0, 500)}`);
    
    // Extract and parse the response
    const analysis = parseAnalysisResponse(response.content);
    const summary = extractSummary(state.markdown, response.content);

    logger.info('Analysis completed successfully');

    return {
      status: 'writing',
      analysis,
      summary,
      log: [
        'Paper analysis completed',
        `Extracted ${analysis.keyFindings.length} key findings`,
        `Identified ${analysis.researchGap.length} research gaps`,
        `Found ${analysis.relatedPapers.length} related papers`,
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Analyze node failed', error);

    return {
      status: 'error',
      error: errorMessage,
      log: [`Analysis error: ${errorMessage}`],
    };
  }
}

/**
 * Analyze node with web search for related papers
 * @param state Current workflow state
 * @returns State update with enhanced analysis including related papers
 */
export async function analyzeNodeWithSearch(state: State): Promise<StateUpdate> {
  try {
    logger.info('Starting analysis with related paper search');

    // First, run the basic analysis
    const analysisResult = await analyzeNode(state);

    if (analysisResult.status === 'error') {
      return analysisResult;
    }

    // Extract key terms for web search
    const searchTerms = extractSearchTerms(state.markdown!, analysisResult.analysis!);

    // Search for related papers
    const searchResults: RelatedPaper[] = [];

    for (const term of searchTerms.slice(0, 3)) {
      const result = await searchPapers(term, { maxResults: 3 });

      if (result.success && result.data) {
        for (const paper of result.data) {
          searchResults.push({
            title: paper.title,
            authors: paper.authors || [],
            year: paper.year,
            url: paper.url,
            relevanceScore: paper.relevanceScore || 0.5,
            relationship: 'similar',
          });
        }
      }
    }

    // Update analysis with related papers from web search
    const updatedAnalysis: PaperAnalysis = {
      ...analysisResult.analysis!,
      relatedPapers: [
        ...analysisResult.analysis!.relatedPapers,
        ...searchResults.slice(0, 5),
      ],
    };

    logger.info(`Found ${searchResults.length} additional related papers`);

    return {
      ...analysisResult,
      analysis: updatedAnalysis,
      log: [
        ...(analysisResult.log || []),
        `Web search completed: ${searchResults.length} related papers found`,
      ],
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Analyze node with search failed', error);

    return {
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Analyze node with retry logic
 * @param state Current workflow state
 * @returns State update with analysis or retry status
 */
export async function analyzeNodeWithRetry(state: State): Promise<StateUpdate> {
  const maxRetries = state.maxRetries || 3;
  const currentAttempt = state.retryInfo?.attempt || 0;

  try {
    const result = await analyzeNode(state);

    // If analysis succeeded, return the result
    if (result.status !== 'error') {
      return result;
    }

    // Check if we should retry
    if (currentAttempt < maxRetries) {
      logger.warn(`Analysis failed, retrying (attempt ${currentAttempt + 1}/${maxRetries})`);

      return {
        status: 'retry',
        retryInfo: {
          attempt: currentAttempt + 1,
          maxAttempts: maxRetries,
          reason: 'LLM analysis failed',
          lastError: result.error,
        },
        log: [`Analysis retry attempt ${currentAttempt + 1}/${maxRetries}`],
      };
    }

    // Max retries exceeded
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Analyze node with retry failed', error);

    return {
      status: 'error',
      error: errorMessage,
      retryInfo: {
        attempt: currentAttempt + 1,
        maxAttempts: maxRetries,
        reason: 'Unexpected error during analysis',
        lastError: errorMessage,
      },
    };
  }
}

/**
 * Build the analysis prompt
 */
function buildAnalysisPrompt(state: State): string {
  const { query, markdown } = state;

  // Truncate markdown if too long (Claude has context limits)
  const maxMarkdownLength = 100000; // ~100k chars
  const truncatedMarkdown =
    markdown && markdown.length > maxMarkdownLength
      ? markdown.substring(0, maxMarkdownLength) + '\n\n[내용이 잘렸습니다...]'
      : markdown || '';

  let prompt = '다음 연구 논문을 분석해 주세요';

  if (query) {
    prompt += `. 연구 초점은 다음과 같습니다: "${query}"`;
  }

  prompt += '\n\n';

  if (state.metadata?.title) {
    prompt += `제목: ${state.metadata.title}\n\n`;
  }

  if (state.metadata?.authors) {
    prompt += `저자: ${state.metadata.authors.join(', ')}\n\n`;
  }

  prompt += `논문 내용 (Markdown 형식):\n\n${truncatedMarkdown}\n\n`;
  prompt += `시스템 프롬프트에 outlined된 구조를 따라 포괄적인 분석을 한국어로 제공해 주세요.`;

  return prompt;
}

/**
 * Parse the LLM response into structured analysis
 */
function parseAnalysisResponse(text: string): PaperAnalysis {
  
  // Initialize default analysis
  const analysis: PaperAnalysis = {
    researchGap: [],
    relatedPapers: [],
    keyFindings: [],
    methodology: '',
    conclusions: '',
    strengths: [],
    limitations: [],
    suggestions: [],
  };
  
  // Try to parse JSON response
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
    
    const parsed = JSON.parse(jsonString);
    
    // GLM sometimes returns {"answer": "..."} format
    const content = parsed.answer || parsed.response || parsed.content || parsed;
    
    // If content is a string (not structured), try to parse it further
    if (typeof content === 'string') {
      // Try to extract structured data from the text content
      return parseAnalysisResponseFromString(content);
    }
    
    // Otherwise, parse from the structured JSON
    return parseAnalysisResponseFromJSON(parsed);
  } catch (error) {
    logger.warn('JSON parsing failed, falling back to regex parsing', error);
    
    // Fallback to regex parsing (original logic)
    return parseAnalysisResponseFromString(text);
  }
}

/**
 * Parse analysis from structured JSON object
 */
function parseAnalysisResponseFromJSON(parsed: any): PaperAnalysis {
  const analysis: PaperAnalysis = {
    researchGap: [],
    relatedPapers: [],
    keyFindings: [],
    methodology: '',
    conclusions: '',
    strengths: [],
    limitations: [],
    suggestions: [],
  };
  
  // Map JSON response to PaperAnalysis structure
  if (parsed.keyFindings && Array.isArray(parsed.keyFindings)) {
    analysis.keyFindings = parsed.keyFindings.map((f: any) => ({
      title: f.title || 'Finding',
      description: f.description || f.finding || f,
      evidence: '',
      confidence: 'medium',
    }));
  }
  
  if (parsed.researchGap && Array.isArray(parsed.researchGap)) {
    analysis.researchGap = parsed.researchGap.map((g: any) => ({
      category: 'general',
      title: g.title || 'Research Gap',
      description: g.description || g,
      significance: 'medium',
    }));
  }
  
  if (parsed.relatedPapers && Array.isArray(parsed.relatedPapers)) {
    analysis.relatedPapers = parsed.relatedPapers.map((p: any) => ({
      title: p.title || 'Related Paper',
      authors: p.author ? [p.author] : p.authors || [],
      year: p.year || '',
      relevance: p.relevance || '',
      relevanceScore: 0.7,
      relationship: 'similar',
    }));
  }
  
  if (parsed.methodology) {
    analysis.methodology = parsed.methodology;
  }
  
  if (parsed.conclusions) {
    analysis.conclusions = parsed.conclusions;
  }
  
  if (parsed.strengths && Array.isArray(parsed.strengths)) {
    analysis.strengths = parsed.strengths;
  }
  
  if (parsed.limitations && Array.isArray(parsed.limitations)) {
    analysis.limitations = parsed.limitations;
  }
  
  if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
    analysis.suggestions = parsed.suggestions;
  }
  
  return analysis;
}

/**
 * Parse analysis from string content (fallback method)
 */
function parseAnalysisResponseFromString(text: string): PaperAnalysis {
  const analysis: PaperAnalysis = {
    researchGap: [],
    relatedPapers: [],
    keyFindings: [],
    methodology: '',
    conclusions: '',
    strengths: [],
    limitations: [],
    suggestions: [],
  };
  
  // Parse research gaps
  const gapMatch = text.match(/(?:Research Gaps|Gaps|연구 공백|연구문제)[\s\S]*?(?=\n\n##|\n\n###|\n\n\d+\.|$)/i);
  if (gapMatch) {
    const gaps = parseListItems(gapMatch[0]);
    analysis.researchGap = gaps.map((g) => ({
      category: 'general',
      description: g,
      significance: 'medium',
    }));
  }
  
  // Parse related papers
  const relatedMatch = text.match(/(?:Related Papers|Related Work|관련 논문)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (relatedMatch) {
    const papers = parseListItems(relatedMatch[0]);
    analysis.relatedPapers = papers.map((p) => ({
      title: p.split('(')[0].trim(),
      authors: [],
      relevanceScore: 0.7,
      relationship: 'similar',
    }));
  }
  
  // Parse key findings
  const findingsMatch = text.match(/(?:Key Findings|Findings|Contributions|주요 발견|핵심 내용)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (findingsMatch) {
    const findings = parseListItems(findingsMatch[0]);
    analysis.keyFindings = findings.map((f) => ({
      finding: f,
      evidence: '',
      confidence: 'medium',
    }));
  }
  
  // Extract methodology
  const methodologyMatch = text.match(/(?:Methodology|Methods|방법론)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (methodologyMatch) {
    analysis.methodology = extractParagraph(methodologyMatch[0]);
  }
  
  // Extract conclusions
  const conclusionsMatch = text.match(/(?:Conclusions|Conclusion|Summary|결론)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (conclusionsMatch) {
    analysis.conclusions = extractParagraph(conclusionsMatch[0]);
  }
  
  // Parse strengths
  const strengthsMatch = text.match(/(?:Strengths|Advantages|장점)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (strengthsMatch) {
    analysis.strengths = parseListItems(strengthsMatch[0]);
  }
  
  // Parse limitations
  const limitationsMatch = text.match(/(?:Limitations|Weaknesses|한계점)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (limitationsMatch) {
    analysis.limitations = parseListItems(limitationsMatch[0]);
  }
  
  // Parse suggestions
  const suggestionsMatch = text.match(/(?:Suggestions|Future Work|제안|향후 연구)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (suggestionsMatch) {
    analysis.suggestions = parseListItems(suggestionsMatch[0]);
  }
  
  return analysis;
}

/**
 * Extract summary from markdown and response
 */
function extractSummary(markdown: string, responseText: string): string {
  const text = responseText;

  // Try to extract summary from the response
  const summaryMatch = text.match(/(?:Summary|Overview|Abstract)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (summaryMatch) {
    return extractParagraph(summaryMatch[0]);
  }

  // Fallback: use first paragraph from markdown
  const firstParagraph = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (firstParagraph) {
    return firstParagraph[1];
  }

  // Last resort: first 200 chars
  return markdown.substring(0, 200) + '...';
}

/**
 * Extract search terms from markdown and analysis
 */
function extractSearchTerms(markdown: string, analysis: PaperAnalysis): string[] {
  const terms: string[] = [];

  // Add from analysis
  if (analysis.methodology) {
    terms.push(analysis.methodology.split(' ').slice(0, 5).join(' '));
  }

  // Extract key phrases from markdown (simple heuristic)
  const titleMatch = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (titleMatch) {
    terms.push(titleMatch[1]);
  }

  // Add first few key findings as search terms
  analysis.keyFindings.slice(0, 2).forEach((finding) => {
    const words = finding.finding.split(' ').slice(0, 5).join(' ');
    terms.push(words);
  });

  return [...new Set(terms)].filter(Boolean);
}

/**
 * Parse list items from a section
 */
function parseListItems(text: string): string[] {
  const items: string[] = [];

  // Match numbered or bulleted lists
  const patterns = [
    /^\d+\.\s+(.+)$/gm, // 1. Item
    /^[-*]\s+(.+)$/gm, // - Item or * Item
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      items.push(...matches.map((m) => m.replace(/^\d+\.\s+|^[-*]\s+/, '').trim()));
    }
  }

  return items;
}

/**
 * Extract the first paragraph from a section
 */
function extractParagraph(text: string): string {
  const lines = text.split('\n').slice(1); // Skip heading

  const paragraph: string[] = [];
  for (const line of lines) {
    if (line.trim() === '' || line.match(/^#{1,6}\s/)) {
      break;
    }
    paragraph.push(line.trim());
  }

  return paragraph.join(' ').replace(/#{1,6}\s/g, '').trim();
}

export default analyzeNode;
