# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shibuya is an AI-powered consumer research and signal intelligence platform that monitors and analyzes data from Reddit, app stores, Product Hunt, Hacker News, VC blogs, and other sources. The system ingests signals (posts, reviews, launches), stores them in a PostgreSQL database with vector embeddings for semantic search, and provides an AI research assistant powered by Google Gemini. It also supports uploading internal documents (text or PDF) to build a searchable knowledge base.

## Development Commands

### Running the Development Server
```bash
npm run dev
```
Open http://localhost:3000

### Building for Production
```bash
npm run build
```

### Running Production Build
```bash
npm start
```

### Linting
```bash
npm run lint
```

### Database Management

Database schema is managed using Drizzle ORM. The schema is located at `lib/db/schema.ts`.

**Generate migrations:**
```bash
npx drizzle-kit generate
```

**Run migrations:**
```bash
npx drizzle-kit migrate
```

**Push schema changes directly to DB (development only):**
```bash
npx drizzle-kit push
```

**Open Drizzle Studio (database GUI):**
```bash
npx drizzle-kit studio
```

Database connection configuration is in `drizzle.config.ts` and uses `.env.local` for credentials.

## Architecture

### Data Flow

1. **Ingestion Pipeline** (`lib/ingestion/ingest.ts`): The `IngestService` orchestrates fetching signals from all data sources in parallel. Each source implements the `DataSource` interface from `lib/data-sources/types.ts`.

2. **Data Sources** (`lib/data-sources/`): Modular clients for each platform (Reddit, Product Hunt, App Store, Play Store, Hacker News, RSS feeds, YC Companies, Crunchbase, Dealroom). Sources are configured in `lib/config.ts` with the `MONITORING_CONFIG` object.

3. **Database** (`lib/db/schema.ts`): PostgreSQL with Drizzle ORM. Key tables:
   - `signals`: Raw signal data
   - `threads`: Clustered/grouped signals
   - `thread_items`: Many-to-many relationship between threads and signals
   - `knowledgeDocs` and `knowledgeChunks`: Internal document knowledge base with vector embeddings (pgvector)
   - `conversations` and `chat_messages`: Chat history with AI assistant

4. **Knowledge Base** (`lib/knowledge/`): Document ingestion and semantic search system
   - `embeddings.ts`: OpenAI text-embedding-3-large (3072 dimensions)
   - `chunking.ts`: Intelligent text chunking with sentence/word boundary detection
   - Supports both text and PDF ingestion
   - Uses PostgreSQL pgvector extension for semantic search with cosine similarity

5. **AI Chat** (`app/api/chat/route.ts`): Streaming chat endpoint using Google Gemini 2.0 Flash Exp. Manages conversation history and persists messages to DB.

### Key Routes

- `/` - Home page with monitoring overview and knowledge base upload
- `/research` - AI research chat interface
- `/signals` - Live signals feed
- `/trends` - Trend clustering view (beta)
- `/api/chat` - Streaming chat API
- `/api/knowledge/ingest` - Text document ingestion
- `/api/knowledge/ingest-file` - PDF document ingestion
- `/api/knowledge/search` - Semantic search over uploaded documents
- `/api/knowledge/[docId]` - Get or delete specific documents
- `/api/trends/sync` - Manual ingestion trigger (also runs hourly via Vercel Cron)

### Environment Variables

Required variables (see `env.example`):
- `DATABASE_URL`: PostgreSQL connection string (must support pgvector extension)
- `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY`: For AI chat (Gemini)
- `OPENAI_API_KEY`: For embeddings (text-embedding-3-large, 3072 dimensions)
- Optional: `CRUNCHBASE_API_KEY`, `DEALROOM_API_KEY` (disabled by default)

## Important Implementation Notes

### Knowledge Base System

**Document Ingestion:**
- Text and PDF files are chunked into ~1000 character segments with 200 character overlap
- Chunks are split at sentence or word boundaries when possible for better context preservation
- Each chunk gets a 3072-dimensional embedding from OpenAI's text-embedding-3-large model
- Documents are deduplicated by content SHA256 hash
- Status tracking: `processing`, `ready`, `failed`, `deleted`

**Semantic Search:**
- Uses PostgreSQL pgvector extension with cosine distance (`<=>` operator)
- Returns chunks sorted by similarity score (1 - distance)
- Includes source document metadata (title, source, ingest date)
- Default topK is 5, max is 50

**PDF Processing:**
- Uses `pdf-parse` library to extract text from PDFs
- Only works with text-based PDFs (scanned/image-based PDFs will fail)
- Extracted text is processed the same way as manual text input

### Signal Deduplication

Signals are deduplicated by URL within a 20-hour window (see `lib/ingestion/ingest.ts:84`). This allows daily snapshots of app rankings while avoiding duplicate posts.

### Chat System

- Uses Google Gemini 2.0 Flash Exp model with streaming responses
- Conversation history is persisted to `chat_messages` table
- System instruction configures it as a "market researcher for the music industry"
- First message in history must be from user (Gemini requirement)

### Automated Sync

`vercel.json` configures a cron job that hits `/api/trends/sync` hourly to run the ingestion pipeline automatically on Vercel.

### Monitoring Configuration

All data source monitoring is configured in `lib/config.ts` with `MONITORING_CONFIG`. This includes:
- Reddit subreddits to monitor
- App store categories
- RSS feeds (VC blogs, TechCrunch, etc.)
- Keyword filters for funding/acquisition news
- Enable/disable flags for each source

### Path Aliases

TypeScript is configured with `@/*` as an alias for the project root (see `tsconfig.json`). Use `@/lib/...` instead of relative imports.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with pgvector extension
- **ORM**: Drizzle ORM
- **AI Models**:
  - Google Gemini 2.0 Flash Exp (chat)
  - OpenAI text-embedding-3-large (embeddings)
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand (signals store in `lib/store/signals.ts`)
- **Deployment**: Vercel (with cron jobs)

## Code Organization

- `app/`: Next.js App Router pages and API routes
  - `app/api/`: API endpoints
  - `app/components/`: Shared React components
  - `app/research/`, `app/signals/`: Feature-specific pages
- `lib/`: Core business logic
  - `lib/data-sources/`: Platform-specific data fetchers
  - `lib/db/`: Database schema and client
  - `lib/ingestion/`: Signal ingestion orchestration
  - `lib/knowledge/`: Document embedding and chunking utilities
  - `lib/store/`: Zustand state management stores
- `types/`: TypeScript type definitions
- `drizzle/`: Database migration files
