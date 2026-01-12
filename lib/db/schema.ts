import { pgTable, text, timestamp, jsonb, doublePrecision, integer, index, uniqueIndex, uuid, vector, boolean } from 'drizzle-orm/pg-core';

// 1. Signals Feed
export const signals = pgTable('signals', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: text('source').notNull(), // reddit, producthunt, appstore, twitter, youtube
  type: text('type').notNull(), // post, comment, review, launch
  authorHandle: text('author_handle'),
  timestamp: timestamp('timestamp').notNull(),
  url: text('url'),
  text: text('text').notNull(),
  engagement: jsonb('engagement').$type<{ likes?: number; replies?: number; views?: number }>().default({}),
  language: text('language').default('en'),
  tags: jsonb('tags').$type<string[]>().default([]),
  rawPayload: jsonb('raw_payload').default({}),
  metadata: jsonb('metadata').default({}),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI compatible
  sentiment: doublePrecision('sentiment'), // -1 to 1
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    sourceTimestampIdx: index('signals_source_timestamp_idx').on(table.source, table.timestamp),
    // Removed textIdx as it fails for large text content (>8KB)
  };
});

// 2. Threads (Clustering)
export const threads = pgTable('threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  summary: text('summary').notNull(),
  velocity24h: doublePrecision('velocity_24h').default(0),
  velocity7d: doublePrecision('velocity_7d').default(0),
  sourceDiversity: doublePrecision('source_diversity').default(0), // 0-1 score
  coherenceScore: doublePrecision('coherence_score').default(0), // 0-1 score
  status: text('status').default('active'), // active, archived
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Link signals to threads
export const threadItems = pgTable('thread_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  threadId: uuid('thread_id').references(() => threads.id).notNull(),
  signalId: uuid('signal_id').references(() => signals.id).notNull(),
  relevanceScore: doublePrecision('relevance_score').default(1.0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    threadSignalIdx: index('thread_items_thread_signal_idx').on(table.threadId, table.signalId),
  };
});

// 3. Knowledge Base (Internal)
export const knowledgeDocs = pgTable('knowledge_docs', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  source: text('source'), // notion, slack, pdf
  metadata: jsonb('metadata').default({}),
  
  // Ingestion metadata
  contentSha256: text('content_sha256'),
  status: text('status').default('processing'), // processing | ready | failed | deleted
  rawStorageBucket: text('raw_storage_bucket'),
  rawStorageKey: text('raw_storage_key'),
  embeddingModel: text('embedding_model'),
  embeddingDim: integer('embedding_dim'),
  ingestedAt: timestamp('ingested_at'),
  error: text('error'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    contentSha256Unique: uniqueIndex('knowledge_docs_content_sha256_uidx').on(table.contentSha256),
  };
});

export const knowledgeChunks = pgTable('knowledge_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  docId: uuid('doc_id').references(() => knowledgeDocs.id).notNull(),
  text: text('text').notNull(),
  chunkType: text('chunk_type').default('general'), // thesis, idea, decision
  embedding: vector('embedding', { dimensions: 3072 }), // Updated to text-embedding-3-large
  
  // Chunk metadata
  chunkIndex: integer('chunk_index').notNull(),
  chunkSha256: text('chunk_sha256'),
  storageBucket: text('storage_bucket'),
  storageKey: text('storage_key'),
  pineconeVectorId: text('pinecone_vector_id'),
  pineconeNamespace: text('pinecone_namespace'),
  tokenCount: integer('token_count'),
  indexedAt: timestamp('indexed_at'),
  error: text('error'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    docChunkUnique: uniqueIndex('knowledge_chunks_doc_chunk_uidx').on(table.docId, table.chunkIndex),
  };
});

// 4. Chat & Research
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull().default('New Chat'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  role: text('role').notNull(), // user, assistant
  content: text('content').notNull(),
  sources: jsonb('sources').$type<{
    type: 'internal' | 'external' | 'web';
    title: string;
    url?: string;
    snippet: string;
  }[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    conversationIdx: index('chat_messages_conversation_idx').on(table.conversationId, table.createdAt),
  };
});
