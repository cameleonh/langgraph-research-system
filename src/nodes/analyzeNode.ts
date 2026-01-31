/**
 * Analyze Node - LLM Analysis of Paper Content
 * Core analysis node using Claude LLM to extract insights from papers
 */

import Anthropic from '@anthropic-ai/sdk';
import type { State, PaperAnalysis, KeyFinding, ResearchGap, RelatedPaper } from '../state/schema.js';
import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config.js';
import { searchPapers } from '../tools/WebSearch.js';
import type { StateUpdate } from '../state/schema.js';

const logger = createLogger('AnalyzeNode');

/**
 * System prompt for paper analysis
 */
const ANALYSIS_SYSTEM_PROMPT = `You are an expert academic research analyst with deep knowledge across multiple fields. Your task is to analyze research papers and extract key insights.

For each paper, provide:
1. Research Gaps: Identify what questions or problems the paper addresses that were not previously solved
2. Related Papers: Suggest relevant papers that build on, contradict, or extend this work
3. Key Findings: Extract the main contributions and discoveries with supporting evidence
4. Methodology: Summarize the research approach and methods used
5. Conclusions: Identify the main takeaways and implications
6. Strengths: List what the paper does well
7. Limitations: Identify weaknesses or constraints
8. Suggestions: Provide recommendations for future work

Be thorough, accurate, and scholarly in your analysis.`;

/**
 * Analyze node - Analyzes paper content using Claude LLM
 * @param state Current workflow state
 * @returns State update with analysis results
 */
export async function analyzeNode(state: State): Promise<StateUpdate> {
  const config = getConfig();

  try {
    logger.info('Starting paper analysis');

    if (!state.markdown) {
      return {
        status: 'error',
        error: 'No markdown content to analyze',
      };
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });

    // Build the analysis prompt
    const userPrompt = buildAnalysisPrompt(state);

    logger.info('Sending request to Claude LLM');

    // Call Claude API
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      temperature: config.anthropic.temperature,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract and parse the response
    const analysis = parseAnalysisResponse(response);
    const summary = extractSummary(state.markdown, response);

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
      ? markdown.substring(0, maxMarkdownLength) + '\n\n[Content truncated...]'
      : markdown || '';

  let prompt = 'Please analyze the following research paper';

  if (query) {
    prompt += ` with this research focus in mind: "${query}"`;
  }

  prompt += '\n\n';

  if (state.metadata?.title) {
    prompt += `Title: ${state.metadata.title}\n\n`;
  }

  if (state.metadata?.authors) {
    prompt += `Authors: ${state.metadata.authors.join(', ')}\n\n`;
  }

  prompt += `Paper Content (Markdown format):\n\n${truncatedMarkdown}\n\n`;
  prompt += `Please provide a comprehensive analysis following the structure outlined in the system prompt.`;

  return prompt;
}

/**
 * Parse the LLM response into structured analysis
 */
function parseAnalysisResponse(response: Anthropic.Messages.Message): PaperAnalysis {
  const text = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');

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

  // Parse research gaps
  const gapMatch = text.match(/(?:Research Gaps|Gaps)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (gapMatch) {
    const gaps = parseListItems(gapMatch[0]);
    analysis.researchGap = gaps.map((g) => ({
      category: 'general',
      description: g,
      significance: 'medium',
    }));
  }

  // Parse related papers
  const relatedMatch = text.match(/(?:Related Papers|Related Work)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
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
  const findingsMatch = text.match(/(?:Key Findings|Findings|Contributions)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (findingsMatch) {
    const findings = parseListItems(findingsMatch[0]);
    analysis.keyFindings = findings.map((f) => ({
      finding: f,
      evidence: '',
      confidence: 'medium',
    }));
  }

  // Extract methodology
  const methodologyMatch = text.match(/(?:Methodology|Methods)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (methodologyMatch) {
    analysis.methodology = extractParagraph(methodologyMatch[0]);
  }

  // Extract conclusions
  const conclusionsMatch = text.match(/(?:Conclusions|Conclusion|Summary)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (conclusionsMatch) {
    analysis.conclusions = extractParagraph(conclusionsMatch[0]);
  }

  // Parse strengths
  const strengthsMatch = text.match(/(?:Strengths|Advantages)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (strengthsMatch) {
    analysis.strengths = parseListItems(strengthsMatch[0]);
  }

  // Parse limitations
  const limitationsMatch = text.match(/(?:Limitations|Weaknesses)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (limitationsMatch) {
    analysis.limitations = parseListItems(limitationsMatch[0]);
  }

  // Parse suggestions
  const suggestionsMatch = text.match(/(?:Suggestions|Future Work)[\s\S]*?(?=\n\n##|\n\n###|$)/i);
  if (suggestionsMatch) {
    analysis.suggestions = parseListItems(suggestionsMatch[0]);
  }

  return analysis;
}

/**
 * Extract summary from markdown and response
 */
function extractSummary(markdown: string, response: Anthropic.Messages.Message): string {
  const text = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');

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
