import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { execSync } from "child_process";

async function ingestAll() {
  console.log("🚀 Starting full ingestion pipeline...\n");

  const env = { ...process.env };

  console.log("Step 1/2: Resume ingestion");
  console.log("─".repeat(40));
  execSync("npx tsx --tsconfig tsconfig.json scripts/ingest-resume.ts", { stdio: "inherit", env });

  console.log("\nStep 2/2: GitHub ingestion");
  console.log("─".repeat(40));
  execSync("npx tsx --tsconfig tsconfig.json scripts/ingest-github.ts", { stdio: "inherit", env });

  console.log("\n✅ Full ingestion pipeline complete!");
}

ingestAll().catch((err) => {
  console.error("❌ Full ingestion failed:", err);
  process.exit(1);
});
