import { Pinecone } from "@pinecone-database/pinecone";
import type { PineconeRecord, RetrievedChunk, DocumentMetadata } from "@/types/rag";

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "tushar-persona";
const DIMENSIONS = 3072;
const UPSERT_BATCH_SIZE = 100;

let pineconeClient: Pinecone | null = null;

function getClient(): Pinecone {
  if (!pineconeClient) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is not set in environment variables.");
    }
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return pineconeClient;
}

/**
 * Returns the Pinecone index instance.
 * Creates the index if it does not exist (runs only during ingestion).
 */
export async function getPineconeIndex(createIfMissing = false) {
  const pc = getClient();

  if (createIfMissing) {
    const existing = await pc.listIndexes();
    const names = existing.indexes?.map((i) => i.name) ?? [];
    if (!names.includes(INDEX_NAME)) {
      console.log(`⏳ Creating Pinecone index "${INDEX_NAME}"...`);
      await pc.createIndex({
        name: INDEX_NAME,
        dimension: DIMENSIONS,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      // Wait for the index to be ready
      await new Promise((r) => setTimeout(r, 60_000));
      console.log(`✅ Index "${INDEX_NAME}" is ready.`);
    }
  }

  return pc.index(INDEX_NAME);
}

/**
 * Upsert documents to Pinecone in batches of 100.
 */
export async function upsertDocuments(records: PineconeRecord[]): Promise<void> {
  const index = await getPineconeIndex();

  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    await index.upsert(batch);
    console.log(`  ✓ Upserted ${Math.min(i + UPSERT_BATCH_SIZE, records.length)}/${records.length} vectors`);
  }
}

/**
 * Query Pinecone for similar documents.
 */
export async function queryDocuments(
  embedding: number[],
  topK = 5,
  filter?: Record<string, string>
): Promise<RetrievedChunk[]> {
  const index = await getPineconeIndex();
  const response = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    ...(filter ? { filter } : {}),
  });

  return (response.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score ?? 0,
    content: (m.metadata?.originalContent as string) ?? "",
    metadata: m.metadata as unknown as DocumentMetadata,
  }));
}

/**
 * Delete all vectors belonging to a specific GitHub repo.
 * Used for targeted updates when a repo changes.
 */
export async function deleteByRepo(repoName: string): Promise<void> {
  try {
    const index = await getPineconeIndex();
    await index.deleteMany({ filter: { repo: repoName, source: "github" } });
    console.log(`🗑  Deleted existing vectors for repo: ${repoName}`);
  } catch {
    // 404 = no vectors existed yet (first run) — safe to ignore
    console.log(`ℹ️  No existing vectors to delete for repo: ${repoName}`);
  }
}

/**
 * Delete all resume vectors for a full re-ingest.
 */
export async function deleteResumeVectors(): Promise<void> {
  try {
    const index = await getPineconeIndex();
    await index.deleteMany({ filter: { source: "resume" } });
    console.log("🗑  Deleted existing resume vectors.");
  } catch {
    // 404 = no vectors existed yet (first run) — safe to ignore
    console.log("ℹ️  No existing resume vectors to delete (first run).");
  }
}

/**
 * Warm up Pinecone by running a dummy query.
 * Used by the keep-warm cron endpoint.
 */
export async function warmUpPinecone(): Promise<void> {
  const index = await getPineconeIndex();
  await index.query({
    vector: new Array(DIMENSIONS).fill(0),
    topK: 1,
    includeMetadata: false,
  });
}
