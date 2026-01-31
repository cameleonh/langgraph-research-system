/**
 * VectorStore - ChromaDB Integration Tool
 * Manages paper embeddings and similarity search
 */

import { ChromaClient, Collection } from 'chromadb';
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config.js';
import type { ToolResult, VectorStoreOptions, VectorSearchResult } from '../types/index.js';

const logger = createLogger('VectorStore');

/**
 * Default options for vector store
 */
const DEFAULT_OPTIONS: VectorStoreOptions = {
  collectionName: 'papers',
  embeddingModel: 'all-MiniLM-L6-v2',
  chunkSize: 500,
  chunkOverlap: 50,
};

/**
 * VectorStore class for managing paper embeddings
 */
export class VectorStore {
  private config = getConfig();
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private options: VectorStoreOptions;

  constructor(options: Partial<VectorStoreOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize the ChromaDB client and collection
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing ChromaDB client');

      // Initialize ChromaDB client
      this.client = new ChromaClient({
        path: `http://${this.config.chroma.host}:${this.config.chroma.port}`,
      });

      // Get or create collection
      this.collection = await this.getOrCreateCollection(this.options.collectionName!);

      logger.info(`ChromaDB initialized: collection="${this.options.collectionName}"`);

    } catch (error) {
      logger.error('Failed to initialize ChromaDB', error);
      throw error;
    }
  }

  /**
   * Add a paper to the vector store
   */
  async addPaper(
    id: string,
    content: string,
    metadata: Record<string, unknown>
  ): Promise<ToolResult<void>> {
    try {
      await this.ensureInitialized();

      logger.info(`Adding paper to vector store: ${id}`);

      // Split content into chunks
      const chunks = this.splitIntoChunks(content, this.options.chunkSize!, this.options.chunkOverlap!);

      // Prepare documents, ids, and metadata for each chunk
      const documents: string[] = [];
      const ids: string[] = [];
      const metadatas: Record<string, unknown>[] = [];

      chunks.forEach((chunk, index) => {
        documents.push(chunk.text);
        ids.push(`${id}_chunk_${index}`);
        metadatas.push({
          ...metadata,
          chunk_index: index,
          total_chunks: chunks.length,
        });
      });

      // Add to collection
      await this.collection!.add({
        ids,
        documents,
        metadatas,
      });

      logger.info(`Added ${chunks.length} chunks for paper: ${id}`);

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to add paper to vector store', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Search for similar papers/content
   */
  async search(
    query: string,
    nResults: number = 10,
    filter?: Record<string, unknown>
  ): Promise<ToolResult<VectorSearchResult[]>> {
    try {
      await this.ensureInitialized();

      logger.info(`Searching vector store: query="${query.substring(0, 50)}..."`);

      // Query the collection
      const results = await this.collection!.query({
        queryTexts: [query],
        nResults,
        where: filter,
      });

      // Format results
      const searchResults: VectorSearchResult[] = [];

      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          const doc = results.documents[0][i];
          const metadata = results.metadatas?.[0]?.[i];
          const distance = results.distances?.[0]?.[i];

          // Convert distance to similarity score
          const score = distance !== undefined ? 1 - distance : 0;

          searchResults.push({
            id: results.ids?.[0]?.[i] || `result_${i}`,
            content: doc,
            metadata: metadata || {},
            score,
          });
        }
      }

      logger.info(`Found ${searchResults.length} results`);

      return {
        success: true,
        data: searchResults,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Vector search failed', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get similar papers based on content similarity
   */
  async findSimilarPapers(
    content: string,
    excludeId?: string,
    nResults: number = 5
  ): Promise<ToolResult<VectorSearchResult[]>> {
    const filter = excludeId ? { paper_id: { $ne: excludeId } } : undefined;
    return this.search(content, nResults, filter as Record<string, unknown>);
  }

  /**
   * Delete a paper from the vector store
   */
  async deletePaper(id: string): Promise<ToolResult<void>> {
    try {
      await this.ensureInitialized();

      // Find all chunk IDs for this paper
      const results = await this.collection!.get({
        where: { paper_id: id } as Record<string, unknown>,
      });

      if (results.ids.length > 0) {
        await this.collection!.delete({
          ids: results.ids,
        });

        logger.info(`Deleted ${results.ids.length} chunks for paper: ${id}`);
      }

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to delete paper from vector store', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Update paper metadata
   */
  async updatePaper(
    id: string,
    metadata: Record<string, unknown>
  ): Promise<ToolResult<void>> {
    try {
      await this.ensureInitialized();

      // Get all chunks for this paper
      const results = await this.collection!.get({
        where: { paper_id: id } as Record<string, unknown>,
      });

      if (results.ids.length === 0) {
        return {
          success: false,
          error: `Paper not found: ${id}`,
        };
      }

      // Update metadata for each chunk
      const metadatas = results.ids.map(() => ({
        ...results.metadatas![0],
        ...metadata,
      }));

      await this.collection!.update({
        ids: results.ids,
        metadatas,
      });

      logger.info(`Updated metadata for paper: ${id}`);

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update paper metadata', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get paper by ID
   */
  async getPaper(id: string): Promise<ToolResult<{ content: string; metadata: Record<string, unknown> }>> {
    try {
      await this.ensureInitialized();

      const results = await this.collection!.get({
        where: { paper_id: id } as Record<string, unknown>,
      });

      if (results.ids.length === 0) {
        return {
          success: false,
          error: `Paper not found: ${id}`,
        };
      }

      // Combine all chunks
      const chunks = results.documents || [];
      const content = chunks.join('\n\n');
      const metadata = results.metadatas?.[0] || {};

      return {
        success: true,
        data: { content, metadata },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get paper from vector store', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * List all papers in the collection
   */
  async listPapers(): Promise<ToolResult<Array<{ id: string; metadata: Record<string, unknown> }>>> {
    try {
      await this.ensureInitialized();

      const results = await this.collection!.get();

      // Group chunks by paper_id
      const papers = new Map<string, Record<string, unknown>>();

      for (let i = 0; i < results.ids.length; i++) {
        const id = results.ids[i];
        const metadata = results.metadatas?.[i] || {};
        const paperId = (metadata.paper_id as string) || id;

        if (!papers.has(paperId)) {
          papers.set(paperId, { id: paperId, metadata });
        }
      }

      return {
        success: true,
        data: Array.from(papers.values()),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to list papers', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Clear all papers from the collection
   */
  async clearCollection(): Promise<ToolResult<void>> {
    try {
      await this.ensureInitialized();

      // Delete and recreate collection
      const collectionName = this.options.collectionName!;
      await this.client!.deleteCollection({ name: collectionName });
      this.collection = await this.getOrCreateCollection(collectionName);

      logger.info(`Cleared collection: ${collectionName}`);

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to clear collection', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Split text into chunks with overlap
   */
  private splitIntoChunks(
    text: string,
    chunkSize: number,
    overlap: number
  ): Array<{ text: string; index: number }> {
    const chunks: Array<{ text: string; index: number }> = [];
    const words = text.split(/\s+/);

    let start = 0;
    let index = 0;

    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      const chunk = words.slice(start, end).join(' ');

      chunks.push({ text: chunk, index });

      start = end - overlap;
      index++;
    }

    return chunks;
  }

  /**
   * Ensure client is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.client || !this.collection) {
      await this.initialize();
    }
  }

  /**
   * Get or create a collection
   */
  private async getOrCreateCollection(name: string): Promise<Collection> {
    try {
      // Try to get existing collection
      return await this.client!.getCollection({ name });
    } catch {
      // Collection doesn't exist, create it
      logger.info(`Creating new collection: ${name}`);
      return await this.client!.createCollection({ name });
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    this.client = null;
    this.collection = null;
    logger.debug('VectorStore connection closed');
  }
}

/**
 * Singleton instance
 */
let vectorStoreInstance: VectorStore | null = null;

/**
 * Get the VectorStore singleton instance
 */
export async function getVectorStore(
  options?: Partial<VectorStoreOptions>
): Promise<VectorStore> {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore(options);
    await vectorStoreInstance.initialize();
  }
  return vectorStoreInstance;
}

/**
 * Convenience function to add a paper
 */
export async function addPaperToVectorStore(
  id: string,
  content: string,
  metadata: Record<string, unknown>
): Promise<ToolResult<void>> {
  const store = await getVectorStore();
  return store.addPaper(id, content, metadata);
}

/**
 * Convenience function to search papers
 */
export async function searchVectorStore(
  query: string,
  nResults?: number,
  filter?: Record<string, unknown>
): Promise<ToolResult<VectorSearchResult[]>> {
  const store = await getVectorStore();
  return store.search(query, nResults, filter);
}

export default VectorStore;
