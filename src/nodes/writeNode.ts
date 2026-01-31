/**
 * Write Node - Draft Generation
 * Generates a draft report based on the analysis results
 */

import Anthropic from '@anthropic-ai/sdk';
import type { State } from '../state/schema.js';
import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config.js';
import { promises as fs } from 'fs';
import path from 'path';
import type { StateUpdate } from '../state/schema.js';

const logger = createLogger('WriteNode');

/**
 * System prompt for draft generation
 */
const DRAFT_SYSTEM_PROMPT = `You are an expert academic writer specializing in research papers and literature reviews. Your task is to generate comprehensive, well-structured drafts based on provided analysis.

Your drafts should:
1. Be clear, concise, and well-organized
2. Follow academic writing standards
3. Include proper citations and references
4. Maintain a scholarly tone
5. Be structured with appropriate headings and sections
6. Synthesize information effectively

Generate drafts that are publication-ready or very close to it.`;

/**
 * Write node - Generates draft based on analysis
 * @param state Current workflow state
 * @returns State update with generated draft
 */
export async function writeNode(state: State): Promise<StateUpdate> {
  const config = getConfig();

  try {
    logger.info('Starting draft generation');

    if (!state.analysis) {
      return {
        status: 'error',
        error: 'No analysis available for draft generation',
      };
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });

    // Build the draft prompt
    const userPrompt = buildDraftPrompt(state);

    logger.info('Sending draft generation request to Claude LLM');

    // Call Claude API
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      temperature: config.anthropic.temperature,
      system: DRAFT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract the draft from response
    const draft = extractDraft(response);

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
  const config = getConfig();

  try {
    logger.info('Starting literature review generation');

    if (!state.analysis) {
      return {
        status: 'error',
        error: 'No analysis available for literature review',
      };
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });

    // Build literature review prompt
    const userPrompt = buildLiteratureReviewPrompt(state);

    logger.info('Sending literature review request to Claude LLM');

    // Call Claude API
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      temperature: config.anthropic.temperature,
      system: DRAFT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract the draft from response
    const draft = extractDraft(response);

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
  const config = getConfig();

  try {
    logger.info('Starting comparative analysis generation');

    if (!state.aggregatedResults || state.aggregatedResults.length === 0) {
      return {
        status: 'error',
        error: 'No aggregated results available for comparative analysis',
      };
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });

    // Build comparative analysis prompt
    const userPrompt = buildComparativeAnalysisPrompt(state);

    logger.info('Sending comparative analysis request to Claude LLM');

    // Call Claude API
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      temperature: config.anthropic.temperature,
      system: DRAFT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract the draft from response
    const draft = extractDraft(response);

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

  let prompt = 'Please generate a comprehensive research report based on the following analysis:\n\n';

  if (query) {
    prompt += `Research Focus: ${query}\n\n`;
  }

  if (metadata?.title) {
    prompt += `Paper Title: ${metadata.title}\n\n`;
  }

  if (summary) {
    prompt += `Summary:\n${summary}\n\n`;
  }

  prompt += '## Analysis Results\n\n';

  if (analysis?.methodology) {
    prompt += `### Methodology\n${analysis.methodology}\n\n`;
  }

  if (analysis?.keyFindings && analysis.keyFindings.length > 0) {
    prompt += '### Key Findings\n';
    analysis.keyFindings.forEach((finding, index) => {
      prompt += `${index + 1}. ${finding.finding}\n`;
      if (finding.evidence) {
        prompt += `   Evidence: ${finding.evidence}\n`;
      }
    });
    prompt += '\n';
  }

  if (analysis?.researchGap && analysis.researchGap.length > 0) {
    prompt += '### Research Gaps Addressed\n';
    analysis.researchGap.forEach((gap, index) => {
      prompt += `${index + 1}. ${gap.description}\n`;
    });
    prompt += '\n';
  }

  if (analysis?.conclusions) {
    prompt += `### Conclusions\n${analysis.conclusions}\n\n`;
  }

  if (analysis?.limitations && analysis.limitations.length > 0) {
    prompt += '### Limitations\n';
    analysis.limitations.forEach((limitation, index) => {
      prompt += `- ${limitation}\n`;
    });
    prompt += '\n';
  }

  if (analysis?.suggestions && analysis.suggestions.length > 0) {
    prompt += '### Suggestions for Future Work\n';
    analysis.suggestions.forEach((suggestion, index) => {
      prompt += `${index + 1}. ${suggestion}\n`;
    });
    prompt += '\n';
  }

  prompt += 'Please generate a well-structured research report that synthesizes this information effectively.';

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
 * Extract draft from Claude response
 */
function extractDraft(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');
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
