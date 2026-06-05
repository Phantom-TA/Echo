import OpenAI from "openai";

const MODEL = "text-embedding-3-large";
const DIMENSIONS = 3072;
const BATCH_SIZE = 20; // OpenAI recommends ≤ 100, we use 20 to stay well within rate limits

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set in environment variables.");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Embed a single text string into a 3072-dimension vector.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const openai = getClient();
  const response = await openai.embeddings.create({
    model: MODEL,
    input: text.slice(0, 8000), // safety trim
    dimensions: DIMENSIONS,
  });
  return response.data[0].embedding;
}

/**
 * Embed a batch of text strings.
 * Automatically batches into groups of BATCH_SIZE with a short delay to avoid rate limits.
 */
export async function getEmbeddingBatch(texts: string[]): Promise<number[][]> {
  const openai = getClient();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000));
    const response = await openai.embeddings.create({
      model: MODEL,
      input: batch,
      dimensions: DIMENSIONS,
    });
    results.push(...response.data.map((d) => d.embedding));

    // Small delay between batches to avoid rate limit errors
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}
