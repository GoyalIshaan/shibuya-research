DROP INDEX "knowledge_chunks_doc_chunk_idx";--> statement-breakpoint
DROP INDEX "knowledge_docs_content_sha256_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_doc_chunk_uidx" ON "knowledge_chunks" USING btree ("doc_id","chunk_index");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_docs_content_sha256_uidx" ON "knowledge_docs" USING btree ("content_sha256");