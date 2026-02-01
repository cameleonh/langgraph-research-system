/**
 * WebSearch - Related Paper Search Tool
 * Uses Serper API for finding related academic papers
 */

import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config.js';
import type { ToolResult, WebSearchOptions, WebSearchResult } from '../types/index.js';

const logger = createLogger('WebSearch');

/**
 * Default options for web search
 */
const DEFAULT_OPTIONS: WebSearchOptions = {
  maxResults: 10,
  timeout: 10000,
  includeSnippets: true,
};

/**
 * WebSearch class for finding related papers
 */
export class WebSearch {
  private config = getConfig();
  private readonly baseUrl = 'https://google.serper.dev/search';

  /**
   * Search for papers related to a query
   */
  async search(
    query: string,
    options: Partial<WebSearchOptions> = {}
  ): Promise<ToolResult<WebSearchResult[]>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
      logger.info(`Searching for: "${query}"`);

      // Build search query with academic focus
      const academicQuery = this.buildAcademicQuery(query);

      // Make API request
      const response = await this.makeRequest(academicQuery, {
        num: opts.maxResults,
      });

      // Parse and filter results
      const results = this.parseResults(response, query);

      logger.info(`Found ${results.length} related papers`);

      return {
        success: true,
        data: results.slice(0, opts.maxResults),
        metadata: {
          query: academicQuery,
          totalResults: results.length,
          returned: Math.min(results.length, opts.maxResults!),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Web search failed', error);

      return {
        success: false,
        data: undefined,
        error: errorMessage,
        metadata: undefined,
      };
    }
  }

  /**
   * Search for papers that cite a given paper
   */
  async searchCitingPapers(
    paperTitle: string,
    options: Partial<WebSearchOptions> = {}
  ): Promise<ToolResult<WebSearchResult[]>> {
    const query = `cite:"${paperTitle}"`;
    return this.search(query, options);
  }

  /**
   * Search for papers by specific authors
   */
  async searchByAuthor(
    author: string,
    options: Partial<WebSearchOptions> = {}
  ): Promise<ToolResult<WebSearchResult[]>> {
    const query = `author:"${author}"`;
    return this.search(query, options);
  }

  /**
   * Search for papers in a specific time range
   */
  async searchByDateRange(
    query: string,
    startDate: Date,
    endDate: Date,
    options: Partial<WebSearchOptions> = {}
  ): Promise<ToolResult<WebSearchResult[]>> {
    const dateQuery = `${query} after:${startDate.toISOString().split('T')[0]} before:${endDate.toISOString().split('T')[0]}`;
    return this.search(dateQuery, options);
  }

  /**
   * Search for papers from specific venues
   */
  async searchByVenue(
    query: string,
    venue: string,
    options: Partial<WebSearchOptions> = {}
  ): Promise<ToolResult<WebSearchResult[]>> {
    const venueQuery = `${query} source:"${venue}"`;
    return this.search(venueQuery, options);
  }

  /**
   * Build an academic-focused search query
   */
  private buildAcademicQuery(query: string): string {
    // Add academic search terms
    const academicTerms = ['research', 'paper', 'study', 'journal', 'conference'];

    // Check if query already has academic terms
    const hasAcademicTerms = academicTerms.some((term) =>
      query.toLowerCase().includes(term)
    );

    if (!hasAcademicTerms) {
      return `${query} research paper`;
    }

    return query;
  }

  /**
   * Make HTTP request to Serper API
   */
  private async makeRequest(
    query: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    const apiKey = this.config.webSearch.serperApiKey;

    if (!apiKey) {
      throw new Error('SERPER_API_KEY is not configured');
    }

    const url = new URL(this.baseUrl);
    url.searchParams.append('q', query);
    url.searchParams.append('apiKey', apiKey);

    // Add additional parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Parse search results and extract academic paper information
   */
  private parseResults(response: unknown, originalQuery: string): WebSearchResult[] {
    const data = response as {
      organic?: Array<{
        title: string;
        link: string;
        snippet?: string;
      }>;
    };

    if (!data.organic) {
      return [];
    }

    return data.organic
      .filter((item) => this.isAcademicResult(item))
      .map((item) => this.extractPaperInfo(item, originalQuery));
  }

  /**
   * Check if a search result is likely an academic paper
   */
  private isAcademicResult(item: { title: string; link: string }): boolean {
    const academicDomains = [
      'arxiv.org',
      'scholar.google.com',
      'dl.acm.org',
      'ieeexplore.ieee.org',
      'springer.com',
      'sciencedirect.com',
      'nature.com',
      'science.org',
      'jstor.org',
      'researchgate.net',
      'semanticscholar.org',
    ];

    const academicKeywords = [
      'pdf',
      'proceedings',
      'conference',
      'journal',
      'transactions',
      'symposium',
    ];

    const url = item.link.toLowerCase();

    // Check if domain is academic
    if (academicDomains.some((domain) => url.includes(domain))) {
      return true;
    }

    // Check if URL contains academic keywords
    if (academicKeywords.some((keyword) => url.includes(keyword))) {
      return true;
    }

    // Check if title has academic patterns
    const title = item.title.toLowerCase();
    if (title.includes('pdf') || title.includes('arxiv')) {
      return true;
    }

    return false;
  }

  /**
   * Extract paper information from search result
   */
  private extractPaperInfo(
    item: { title: string; link: string; snippet?: string },
    originalQuery: string
  ): WebSearchResult {
    const result: WebSearchResult = {
      title: item.title,
      url: item.link,
    };

    if (item.snippet) {
      result.snippet = item.snippet;
    }

    // Try to extract year from title or URL
    const yearMatch = item.title.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[0], 10);
    }

    // Try to extract authors from snippet
    if (item.snippet) {
      const authors = this.extractAuthors(item.snippet);
      if (authors.length > 0) {
        result.authors = authors;
      }
    }

    // Calculate relevance score based on query match
    result.relevanceScore = this.calculateRelevance(item, originalQuery);

    return result;
  }

  /**
   * Extract author names from text
   */
  private extractAuthors(text: string): string[] {
    // Common patterns for author names
    const patterns = [
      /by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})(?:,|\s+and|\s*-)/,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}),/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].split(/\s+and\s+|\s*,\s*/).map((a) => a.trim());
      }
    }

    return [];
  }

  /**
   * Calculate relevance score for a search result
   */
  private calculateRelevance(
    item: { title: string; link: string; snippet?: string },
    query: string
  ): number {
    let score = 0;
    const queryTerms = query.toLowerCase().split(/\s+/);

    // Check title matches
    const title = item.title.toLowerCase();
    queryTerms.forEach((term) => {
      if (title.includes(term)) {
        score += 0.5;
      }
    });

    // Check snippet matches
    if (item.snippet) {
      const snippet = item.snippet.toLowerCase();
      queryTerms.forEach((term) => {
        if (snippet.includes(term)) {
          score += 0.3;
        }
      });
    }

    // Bonus for academic domains
    if (item.link.includes('arxiv.org')) {
      score += 0.5;
    }

    return Math.min(score, 1);
  }

  /**
   * Get paper abstract from URL (if available)
   */
  async getAbstract(url: string): Promise<ToolResult<string>> {
    try {
      logger.debug(`Fetching abstract from: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Try to extract abstract (basic implementation)
      const abstractMatch = html.match(
        /<abstract[^>]*>(.+?)<\/abstract>/is
      );

      if (abstractMatch) {
        // Strip HTML tags
        const abstract = abstractMatch[1].replace(/<[^>]+>/g, ' ').trim();
        return { success: true, data: abstract };
      }

      return {
        success: false,
        data: undefined,
        error: 'Abstract not found',
        metadata: undefined,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch abstract', error);

      return {
        success: false,
        data: undefined,
        error: errorMessage,
        metadata: undefined,
      };
    }
  }
}

/**
 * Singleton instance
 */
let searchInstance: WebSearch | null = null;

/**
 * Get the WebSearch singleton instance
 */
export function getWebSearch(): WebSearch {
  if (!searchInstance) {
    searchInstance = new WebSearch();
  }
  return searchInstance;
}

/**
 * Convenience function to search for papers
 */
export async function searchPapers(
  query: string,
  options?: Partial<WebSearchOptions>
): Promise<ToolResult<WebSearchResult[]>> {
  const search = getWebSearch();
  return search.search(query, options);
}

export default WebSearch;
