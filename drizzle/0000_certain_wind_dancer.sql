CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_id" uuid NOT NULL,
	"text" text NOT NULL,
	"chunk_type" text DEFAULT 'general',
	"embedding" vector(3072),
	"chunk_index" integer NOT NULL,
	"chunk_sha256" text,
	"storage_bucket" text,
	"storage_key" text,
	"pinecone_vector_id" text,
	"pinecone_namespace" text,
	"token_count" integer,
	"indexed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"source" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"content_sha256" text,
	"status" text DEFAULT 'processing',
	"raw_storage_bucket" text,
	"raw_storage_key" text,
	"embedding_model" text,
	"embedding_dim" integer,
	"ingested_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"type" text NOT NULL,
	"author_handle" text,
	"timestamp" timestamp NOT NULL,
	"url" text,
	"text" text NOT NULL,
	"engagement" jsonb DEFAULT '{}'::jsonb,
	"language" text DEFAULT 'en',
	"tags" jsonb DEFAULT '[]'::jsonb,
	"raw_payload" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"embedding" vector(1536),
	"sentiment" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"relevance_score" double precision DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"summary" text NOT NULL,
	"velocity_24h" double precision DEFAULT 0,
	"velocity_7d" double precision DEFAULT 0,
	"source_diversity" double precision DEFAULT 0,
	"coherence_score" double precision DEFAULT 0,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_doc_id_knowledge_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_items" ADD CONSTRAINT "thread_items_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_items" ADD CONSTRAINT "thread_items_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_idx" ON "chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_doc_chunk_idx" ON "knowledge_chunks" USING btree ("doc_id","chunk_index");--> statement-breakpoint
CREATE INDEX "knowledge_docs_content_sha256_idx" ON "knowledge_docs" USING btree ("content_sha256");--> statement-breakpoint
CREATE INDEX "signals_source_timestamp_idx" ON "signals" USING btree ("source","timestamp");--> statement-breakpoint
CREATE INDEX "thread_items_thread_signal_idx" ON "thread_items" USING btree ("thread_id","signal_id");