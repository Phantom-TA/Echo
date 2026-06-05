import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getEmbeddingBatch } from "@/lib/rag/embeddings";
import { upsertDocuments, getPineconeIndex } from "@/lib/rag/pinecone";
import { addContext } from "@/lib/rag/chunker";
import type { PineconeRecord } from "@/types/rag";

/**
 * Synthetic "Profile" Documents
 *
 * These are hand-crafted, keyword-rich summary documents that aggregate
 * information across resume + GitHub into single high-scoring retrieval chunks.
 * They solve the "scatter problem" where key facts are split across many chunks.
 *
 * Technique: "Summary Indexing" (Anthropic / LlamaIndex best practice)
 */

const PROFILE_DOCS = [
  {
    id: "profile-ai-projects",
    title: "Tushar's AI / LLM Projects Portfolio",
    content: `Tushar Agrawal has built multiple production-grade AI and LLM-powered projects:

1. IntentSync — AI-powered repository intelligence engine. Uses GraphRAG (combining PostgreSQL, ChromaDB semantic vectors, and Neo4j knowledge graph) to index codebases and answer engineering questions. LLM: Google Gemini. Language: TypeScript.

2. TraceLens — AI-assisted frontend performance intelligence platform. Automates browser audits, trace analysis, and bottleneck detection using AI root-cause reasoning. Built during internship at Voice Games. Uses Core Web Vitals, Lighthouse, and LLM-powered analysis. Language: TypeScript.

3. Codonova — Autonomous Software Development System powered by deep AI agents. Uses Neo4j knowledge graph, ChromaDB memory, and a real-time React dashboard. Agents plan, write, test, and critique code autonomously. Language: Python.

4. IntentSync also includes eval frameworks: answer grounding verification, hallucination detection using Gemini, and adversarial red-teaming pipelines.

All three projects are deployed and available on GitHub under Phantom-TA.`,
  },
  {
    id: "profile-skills-complete",
    title: "Tushar's Complete Technical Skills",
    content: `Tushar Agrawal's technical skills and expertise:

Languages: JavaScript, TypeScript, Python, C, C++
Frontend: React.js, Next.js
Backend: Node.js, Express.js, FastAPI
AI / LLM Frameworks: LangChain, LangGraph, GraphRAG, OpenAI API, Google Gemini API
Voice AI: Vapi (voice agents), ElevenLabs (TTS), Deepgram (STT), Retell
Vector Databases: ChromaDB, Pinecone
Graph Databases: Neo4j
Relational / NoSQL: MongoDB, PostgreSQL, MySQL, SQL
DevOps & Tools: Docker, Git, GitHub, Vercel, Render
Concepts: RAG pipelines, agentic systems, LLM-as-judge evals, streaming APIs, WebSockets, REST APIs, OAuth

Currently pursuing B.Tech in Computer Science at LNMIIT Jaipur (2023–2027).
Currently working as Software Engineer (AI) Intern at Voice Games.`,
  },
  {
    id: "profile-experience-summary",
    title: "Tushar's Work Experience and Background",
    content: `Tushar Agrawal — Software Engineer (AI) Intern at Voice Games (May 2026 – Present, Remote).
At Voice Games, Tushar engineered TraceLens — an AI-assisted frontend performance intelligence platform. He designed and built agentic pipelines for automated browser audits, trace analysis, and AI-powered root-cause reasoning with actionable fix recommendations.

Tushar is currently a 2nd-year B.Tech Computer Science student at LNM Institute of Information Technology (LNMIIT), Jaipur, India (July 2023 – June 2027), with a CGPA of 7.63.

His key strengths: shipping production-grade AI systems end-to-end, building agentic pipelines with real users, low-latency API design, and RAG pipeline architecture.`,
  },
  {
    id: "profile-voice-ai",
    title: "Tushar's Voice AI and Agent Experience",
    content: `Tushar Agrawal has hands-on experience with voice AI platforms and conversational agents:

- Vapi: Used for building voice agents with real-time STT (Deepgram), TTS (ElevenLabs), and LLM routing (GPT-4o Mini). Familiar with Vapi's assistant configuration, tool calling via webhooks, and BYO key setup.
- ElevenLabs: Used for text-to-speech voice synthesis in production agents.
- Deepgram: Used for low-latency speech-to-text transcription.
- Agentic Pipelines: Built multi-step agentic workflows using LangGraph and custom orchestration logic.
- Internship: At Voice Games (AI-focused gaming company), working on conversational and performance AI systems.`,
  },
  {
    id: "profile-open-source-repos",
    title: "Tushar's Public GitHub Repositories Overview",
    content: `Tushar Agrawal (GitHub: Phantom-TA) has 20 public repositories covering AI, full-stack, and systems projects:

AI / ML Projects:
- IntentSync (TypeScript) — GraphRAG-powered engineering memory and repo intelligence tool
- TraceLens (TypeScript) — AI frontend performance intelligence platform
- Codonova (Python) — Autonomous AI software development system
- NLP-Text-Modeling-using-RNN (Jupyter) — NLP text modeling with recurrent neural networks
- SMS-Spam-Detection (Jupyter) — ML spam classification model

Full-Stack Projects:
- Edigo (TypeScript) — Full-stack app, deployed at edigo-eta.vercel.app
- BlogSmith (JavaScript) — Full-stack blogging platform, deployed at blog-smith.vercel.app
- Consynk (JavaScript) — Offline-first sync engine
- GoStartup-Auth (JavaScript) — Authentication service

Other Projects:
- TypeBlitz, Unbeatable-TicTacToe, Galactic, Trillo, Natours — frontend / game projects
- Task-Manager-Api, Authentication-backend, Authentication-backend-with-sql — backend APIs`,
  },
];

async function ingestProfile() {
  console.log("📋 Starting Profile/Portfolio Document Ingestion...\n");

  await getPineconeIndex(true);

  const docContext = "This is a high-level summary document about Tushar Agrawal's skills, projects, and experience as an AI engineer.";

  const textsToEmbed = PROFILE_DOCS.map((doc) =>
    addContext(`${doc.title}\n\n${doc.content}`, docContext)
  );

  console.log(`🧠 Embedding ${textsToEmbed.length} profile documents...`);
  const embeddings = await getEmbeddingBatch(textsToEmbed);

  const records: PineconeRecord[] = PROFILE_DOCS.map((doc, i) => ({
    id: doc.id,
    values: embeddings[i],
    metadata: {
      source: "resume",
      type: "summary",
      section: "PROFILE",
      originalContent: `${doc.title}\n\n${doc.content}`,
      personaName: "Tushar Agrawal",
    },
  }));

  await upsertDocuments(records);
  console.log(`\n✅ Profile ingestion complete — ${records.length} synthetic documents upserted.`);
  console.log("   Documents:", PROFILE_DOCS.map((d) => d.id).join(", "));
}

ingestProfile().catch((err) => {
  console.error("❌ Profile ingestion failed:", err);
  process.exit(1);
});
