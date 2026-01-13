export interface TextChunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
}

/**
 * Chunk text into smaller pieces for embedding
 * Uses a simple but effective character-based chunking with overlap
 *
 * @param text - The text to chunk
 * @param chunkSize - Maximum characters per chunk (default: 1000)
 * @param overlap - Character overlap between chunks (default: 200)
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let startChar = 0;
  let index = 0;

  while (startChar < text.length) {
    let endChar = Math.min(startChar + chunkSize, text.length);

    // If not at the end, try to break at a sentence or word boundary
    if (endChar < text.length) {
      // Look for sentence boundaries (., !, ?, newline) within last 100 chars
      const lookbackStart = Math.max(endChar - 100, startChar);
      const segment = text.substring(lookbackStart, endChar);
      const sentenceMatch = segment.match(/[.!?\n]\s/g);

      if (sentenceMatch) {
        const lastSentenceEnd = segment.lastIndexOf(sentenceMatch[sentenceMatch.length - 1]);
        if (lastSentenceEnd > 0) {
          endChar = lookbackStart + lastSentenceEnd + 2; // +2 to include the punctuation and space
        }
      } else {
        // No sentence boundary, try word boundary
        const wordSegment = text.substring(endChar - 50, endChar);
        const lastSpace = wordSegment.lastIndexOf(' ');
        if (lastSpace > 0) {
          endChar = endChar - 50 + lastSpace;
        }
      }
    }

    const chunkText = text.substring(startChar, endChar).trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index,
        startChar,
        endChar,
      });
      index++;
    }

    // Move forward by (chunkSize - overlap) to create overlap
    startChar = endChar - overlap;

    // Prevent infinite loop if we're not making progress
    if (startChar <= chunks[chunks.length - 1]?.startChar) {
      startChar = endChar;
    }
  }

  return chunks;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
