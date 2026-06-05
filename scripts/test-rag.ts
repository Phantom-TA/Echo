import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getEmbedding } from "@/lib/rag/embeddings";
import { queryDocuments } from "@/lib/rag/pinecone";

const TEST_QUERIES = [
  "Tell me about Tushar's work experience",
  "What tech stack does IntentSync use?",
  "What is TraceLens?",
  "What programming languages does Tushar know?",
  "What projects has Tushar built with AI or LLMs?",
  "What is Tushar's educational background?",
  "Tell me about the Codonova project",
  "What databases has Tushar worked with?",
  "Tell me about Tushar's skills in voice AI or Vapi",
  "Has Tushar built anything with Python?",
];

async function testRAG() {
  console.log("🧪 Testing RAG Retrieval Quality\n");
  console.log("═".repeat(60));

  for (const query of TEST_QUERIES) {
    console.log(`\n📌 Query: "${query}"`);
    console.log("─".repeat(60));

    const embedding = await getEmbedding(query);
    const results = await queryDocuments(embedding, 3);

    if (results.length === 0) {
      console.log("⚠️  No results found.");
      continue;
    }

    for (const r of results) {
      const meta = r.metadata;
      const repo = meta.source === "github" ? ` | Repo: ${meta.repo}` : "";
      console.log(`\n  Score: ${r.score.toFixed(4)} | Source: ${meta.source} | Type: ${meta.type}${repo}`);
      console.log(`  Content: ${r.content.slice(0, 200).replace(/\n/g, " ")}...`);
    }
  }

  console.log("\n\n✅ RAG retrieval test complete!");
}

testRAG().catch((err) => {
  console.error("❌ RAG test failed:", err);
  process.exit(1);
});
