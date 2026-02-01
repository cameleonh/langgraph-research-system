/**
 * Unified LLM Service
 * Supports GLM-4.7 and Anthropic Claude APIs
 */

import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config.js';

const logger = createLogger('LLMService');

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Call LLM API (GLM or Anthropic based on configuration)
 */
export async function callLLM(
  messages: LLMMessage[],
  options?: LLMOptions
): Promise<LLMResponse> {
  const config = getConfig();

  if (config.llm.provider === 'glm') {
    return callGLMAPI(messages, options);
  } else {
    return callAnthropicAPI(messages, options);
  }
}

/**
 * Call GLM API (Zhipu AI)
 */
async function callGLMAPI(
  messages: LLMMessage[],
  options?: LLMOptions
): Promise<LLMResponse> {
  const config = getConfig();

  try {
    logger.info(`Calling GLM API: ${config.llm.model}`);

    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const requestBody = {
      model: config.llm.model,
      messages: userMessages,
      max_tokens: options?.maxTokens || config.llm.maxTokens,
      temperature: options?.temperature || config.llm.temperature,
      // response_format: { type: "json_object" },  // Disable to allow Korean text responses
      ...(systemMessage && { system: systemMessage.content }),
    };

    const response = await fetch(`${config.llm.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    logger.info('GLM API call successful');

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model || config.llm.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('GLM API call failed', error);
    throw new Error(`GLM API error: ${errorMessage}`);
  }
}

/**
 * Call Anthropic Claude API (fallback)
 */
async function callAnthropicAPI(
  messages: LLMMessage[],
  options?: LLMOptions
): Promise<LLMResponse> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const config = getConfig();

  try {
    logger.info(`Calling Anthropic API: ${config.anthropic.model}`);

    const anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });

    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: options?.maxTokens || config.anthropic.maxTokens,
      temperature: options?.temperature || config.anthropic.temperature,
      system: systemMessage?.content,
      messages: userMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    logger.info('Anthropic API call successful');

    const content = response.content
      .filter((block: { type: string; text?: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('\n\n');

    return {
      content,
      model: response.model || config.anthropic.model,
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      } : undefined,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Anthropic API call failed', error);
    throw new Error(`Anthropic API error: ${errorMessage}`);
  }
}

export default callLLM;