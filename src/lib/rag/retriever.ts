import { getEmbedding } from "@/lib/rag/embeddings";
import { queryDocuments } from "@/lib/rag/pinecone";
import type { RetrievedChunk } from "@/types/rag";

const TOP_K = 8;
const MIN_SCORE = 0.25; // Retrieve more chunks — model will use the best ones

/**
 * Retrieves relevant knowledge chunks for a given query.
 * Embeds the query → queries Pinecone → filters by score → returns formatted context.
 */
export async function retrieve(query: string): Promise<{
  chunks: RetrievedChunk[];
  context: string;
}> {
  try {
    // Attempt standard Pinecone + OpenAI RAG with a timeout of 2.5 seconds
    const embeddingPromise = getEmbedding(query);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("RAG timeout")), 5000) // 5s — allows Pinecone cold starts
    );

    const embedding = await Promise.race([embeddingPromise, timeoutPromise]);
    const chunks = await queryDocuments(embedding, TOP_K);

    // Filter out very low-relevance chunks
    const relevant = chunks.filter((c) => c.score >= MIN_SCORE);

    if (relevant.length > 0) {
      return {
        chunks: relevant,
        context: formatContext(relevant),
      };
    }
  } catch (error) {
    console.warn("⚠️ RAG query failed or timed out, falling back to local JSON index:", error);
  }

  // Fallback: simple keyword/relevance match on static local JSON
  try {
    const fallbackData = require("./fallback-data.json") as Array<{
      id: string;
      source: string;
      section: string;
      content: string;
    }>;

    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const scoredChunks = fallbackData.map((item) => {
      let score = 0;
      const contentLower = item.content.toLowerCase();
      queryWords.forEach((word) => {
        if (contentLower.includes(word)) {
          score += 1;
        }
      });
      return {
        id: item.id,
        score: score > 0 ? 0.5 + (score / (queryWords.length + 1)) : 0.1,
        content: item.content,
        metadata: {
          source: item.source,
          type: "summary",
          section: item.section,
          originalContent: item.content,
          personaName: "Tushar Agrawal",
        } as any,
      };
    });

    // Sort by score and filter out irrelevant
    const relevant = scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((c) => c.score > 0.2);

    return {
      chunks: relevant,
      context: formatContext(relevant),
    };
  } catch (fallbackError) {
    console.error("❌ Fallback retrieval failed:", fallbackError);
  }

  return { chunks: [], context: "" };
}

function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const meta = chunk.metadata;
      const source =
        meta.source === "github"
          ? `[GitHub — ${(meta as { repo: string }).repo}]`
          : `[Resume — ${(meta as { section: string }).section ?? ""}]`;

      return `--- Context ${i + 1} ${source} ---\n${chunk.content}`;
    })
    .join("\n\n");
}

export function getLastUserMessage(
  messages: any[]
): string {
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "";
  const lastMsg = userMessages[userMessages.length - 1];
  if (!lastMsg) return "";
  if (typeof lastMsg.content === "string") return lastMsg.content;
  if (Array.isArray(lastMsg.content)) {
    return lastMsg.content
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("");
  }
  if (lastMsg.parts && Array.isArray(lastMsg.parts)) {
    return lastMsg.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("");
  }
  return "";
}
