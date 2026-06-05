import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";
import pdfParse from "pdf-parse";
import { getEmbeddingBatch } from "@/lib/rag/embeddings";
import { upsertDocuments, getPineconeIndex, deleteResumeVectors } from "@/lib/rag/pinecone";
import { splitResumeIntoSections, splitText, cleanText, addContext } from "@/lib/rag/chunker";
import type { PineconeRecord } from "@/types/rag";

// ─── Config ────────────────────────────────────────────────────────────────────
const RESUME_PDF_PATH = path.resolve(process.cwd(), "Tushar_Agrawal_Resume_up.pdf");
const PERSONA_NAME = "Tushar Agrawal";

async function ingestResume() {
  console.log("📄 Starting Resume Ingestion...\n");

  // 1. Check PDF exists
  if (!fs.existsSync(RESUME_PDF_PATH)) {
    throw new Error(`Resume PDF not found at: ${RESUME_PDF_PATH}`);
  }

  // 2. Parse PDF
  console.log("⏳ Parsing PDF...");
  const buffer = fs.readFileSync(RESUME_PDF_PATH);
  const parsed = await pdfParse(buffer);
  const rawText = cleanText(parsed.text);
  console.log(`✅ Parsed ${rawText.length} characters from resume.\n`);

  // 3. Split into sections
  const sections = splitResumeIntoSections(rawText);
  console.log(`📦 Found ${sections.length} resume sections: ${sections.map((s) => s.section).join(", ")}\n`);

  // 4. Build document context for contextual chunking
  const documentContext = `This is a chunk from the resume of ${PERSONA_NAME}, an AI Engineer. The resume contains information about Tushar's work experience, education, technical skills, and personal projects.`;

  // 5. Build chunks with context
  const records: PineconeRecord[] = [];
  const textsToEmbed: string[] = [];
  const chunkMeta: Array<{ id: string; originalContent: string; section: string }> = [];

  for (const section of sections) {
    // Split large sections into sub-chunks
    const subChunks = section.content.length > 1200
      ? splitText(section.content, 1200, 100)
      : [section.content];

    for (let i = 0; i < subChunks.length; i++) {
      const chunkId = `resume-${section.section.toLowerCase().replace(/\s+/g, "-")}-${i}`;
      const originalContent = subChunks[i];
      const contextualContent = addContext(originalContent, documentContext);

      textsToEmbed.push(contextualContent);
      chunkMeta.push({ id: chunkId, originalContent, section: section.section });
    }
  }

  console.log(`🔢 Prepared ${textsToEmbed.length} chunks for embedding...\n`);

  // 6. Ensure Pinecone index exists
  await getPineconeIndex(true);

  // 7. Delete old resume vectors (full re-ingest)
  await deleteResumeVectors();

  // 8. Generate embeddings in batch
  console.log("🧠 Generating embeddings...");
  const embeddings = await getEmbeddingBatch(textsToEmbed);
  console.log(`✅ Generated ${embeddings.length} embeddings.\n`);

  // 9. Build Pinecone records
  for (let i = 0; i < chunkMeta.length; i++) {
    const { id, originalContent, section } = chunkMeta[i];
    records.push({
      id,
      values: embeddings[i],
      metadata: {
        source: "resume",
        type: mapSectionToType(section),
        section,
        originalContent,
        personaName: PERSONA_NAME,
      },
    });
  }

  // 10. Upsert to Pinecone
  console.log(`📤 Upserting ${records.length} vectors to Pinecone...`);
  await upsertDocuments(records);

  console.log("\n🎉 Resume ingestion complete!");
  console.log(`   Total vectors upserted: ${records.length}`);
  console.log(`   Sections processed: ${sections.map((s) => s.section).join(", ")}`);
}

function mapSectionToType(section: string): string {
  const map: Record<string, string> = {
    SUMMARY: "summary",
    OBJECTIVE: "summary",
    EXPERIENCE: "experience",
    "WORK EXPERIENCE": "experience",
    EMPLOYMENT: "experience",
    EDUCATION: "education",
    SKILLS: "skills",
    "TECHNICAL SKILLS": "skills",
    PROJECTS: "projects",
    ACHIEVEMENTS: "achievements",
    CERTIFICATIONS: "achievements",
    AWARDS: "achievements",
    CONTACT: "contact",
    FULL_RESUME: "misc",
  };
  return map[section] ?? "misc";
}

ingestResume().catch((err) => {
  console.error("❌ Resume ingestion failed:", err);
  process.exit(1);
});
