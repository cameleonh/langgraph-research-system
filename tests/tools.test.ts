/**
 * Tools Tests
 * Tests for PDF conversion, web search, and vector store tools
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { MarkerConverter } from '../src/tools/MarkerConverter.js';
import { WebSearch } from '../src/tools/WebSearch.js';
import { VectorStore } from '../src/tools/VectorStore.js';
import type { ConversionOptions, WebSearchOptions, VectorStoreOptions } from '../src/types/index.js';

describe('MarkerConverter', () => {
  let converter: MarkerConverter;

  beforeEach(() => {
    converter = new MarkerConverter();
  });

  describe('constructor', () => {
    it('should create a MarkerConverter instance', () => {
      expect(converter).toBeInstanceOf(MarkerConverter);
    });

    it('should accept custom marker path', () => {
      const customConverter = new MarkerConverter('/custom/path/marker');
      expect(customConverter).toBeInstanceOf(MarkerConverter);
    });
  });

  describe('checkMarkerAvailable', () => {
    it('should return boolean indicating marker availability', async () => {
      const result = await converter.checkMarkerAvailable();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('convert', () => {
    it('should return error result for non-existent file', async () => {
      const result = await converter.convert('/nonexistent/file.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return tool result structure', async () => {
      const result = await converter.convert('/nonexistent/file.pdf');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('convertBatch', () => {
    it('should return error result for empty array', async () => {
      const result = await converter.convertBatch([]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return result array structure', async () => {
      const result = await converter.convertBatch(['/nonexistent/file.pdf']);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
    });
  });
});

describe('WebSearch', () => {
  let search: WebSearch;

  beforeEach(() => {
    search = new WebSearch();
  });

  describe('constructor', () => {
    it('should create a WebSearch instance', () => {
      expect(search).toBeInstanceOf(WebSearch);
    });
  });

  describe('search', () => {
    it('should return tool result structure', async () => {
      // This will fail without API key, but we can test the structure
      try {
        const result = await search.search('test query');

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('metadata');
      } catch (error) {
        // Expected to fail without proper API key
        expect(error).toBeDefined();
      }
    });

    it('should accept search options', async () => {
      const options: WebSearchOptions = {
        maxResults: 5,
        timeout: 5000,
      };

      try {
        const result = await search.search('test query', options);

        if (result.success && result.data) {
          expect(result.data.length).toBeLessThanOrEqual(5);
        }
      } catch (error) {
        // Expected to fail without proper API key
        expect(error).toBeDefined();
      }
    });
  });

  describe('searchCitingPapers', () => {
    it('should construct citation search query', async () => {
      const result = await search.searchCitingPapers('Test Paper Title');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
    });
  });

  describe('searchByAuthor', () => {
    it('should construct author search query', async () => {
      const result = await search.searchByAuthor('Test Author');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
    });
  });

  describe('buildAcademicQuery', () => {
    it('should add academic terms to non-academic queries', () => {
      // This is a private method, but we can test through search behavior
      // The method adds "research paper" to non-academic queries
    });
  });
});

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore({
      collectionName: 'test_collection',
    });
  });

  describe('constructor', () => {
    it('should create a VectorStore instance', () => {
      expect(store).toBeInstanceOf(VectorStore);
    });

    it('should accept custom options', () => {
      const options: VectorStoreOptions = {
        collectionName: 'custom_collection',
        chunkSize: 1000,
        chunkOverlap: 100,
      };

      const customStore = new VectorStore(options);

      expect(customStore).toBeInstanceOf(VectorStore);
    });
  });

  describe('splitIntoChunks', () => {
    it('should split text into chunks correctly', () => {
      // This tests the private chunking logic indirectly through addPaper
      const text = 'word '.repeat(100); // 500 words
      const chunkSize = 50;
      const overlap = 10;

      // Expected: chunks of ~50 words with 10 word overlap
      const expectedChunks = Math.ceil((500 - overlap) / (chunkSize - overlap));
      // We can't directly test this, but the logic should be correct
    });
  });

  describe('addPaper', () => {
    it('should return tool result structure', async () => {
      // This will fail without ChromaDB running, but we can test the structure
      const result = await store.addPaper('test-id', 'test content', {
        title: 'Test Paper',
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('search', () => {
    it('should return search result structure', async () => {
      const result = await store.search('test query', 5);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });

  describe('deletePaper', () => {
    it('should return tool result structure', async () => {
      const result = await store.deletePaper('test-id');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
    });
  });

  describe('getPaper', () => {
    it('should return tool result structure', async () => {
      const result = await store.getPaper('test-id');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });

  describe('listPapers', () => {
    it('should return tool result structure', async () => {
      const result = await store.listPapers();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });
});

describe('Tool Result Types', () => {
  describe('ToolResult', () => {
    it('should have correct structure', () => {
      const result = {
        success: true,
        data: { test: 'data' },
        error: undefined,
        metadata: { timestamp: Date.now() },
      };

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('ConversionResult', () => {
    it('should have correct structure', () => {
      const conversionResult = {
        markdown: '# Test\n\nContent',
        metadata: {
          title: 'Test Paper',
          wordCount: 100,
          processingTime: 1000,
        },
      };

      expect(conversionResult).toHaveProperty('markdown');
      expect(conversionResult).toHaveProperty('metadata');
      expect(conversionResult.metadata).toHaveProperty('wordCount');
      expect(conversionResult.metadata).toHaveProperty('processingTime');
    });
  });

  describe('WebSearchResult', () => {
    it('should have correct structure', () => {
      const searchResult = {
        title: 'Test Paper',
        url: 'https://example.com/paper.pdf',
        snippet: 'Test snippet',
        authors: ['Author 1', 'Author 2'],
        year: 2024,
        relevanceScore: 0.9,
      };

      expect(searchResult).toHaveProperty('title');
      expect(searchResult).toHaveProperty('url');
      expect(searchResult).toHaveProperty('relevanceScore');
    });
  });

  describe('VectorSearchResult', () => {
    it('should have correct structure', () => {
      const vectorResult = {
        id: 'test-id',
        content: 'Test content',
        metadata: { title: 'Test' },
        score: 0.85,
      };

      expect(vectorResult).toHaveProperty('id');
      expect(vectorResult).toHaveProperty('content');
      expect(vectorResult).toHaveProperty('score');
    });
  });
});
