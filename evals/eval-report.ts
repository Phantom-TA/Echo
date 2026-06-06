/**
 * eval-report.ts — Print the latest eval result in a human-readable format.
 *
 * Usage:
 *   npm run eval:report
 */

import * as fs from "fs";
import * as path from "path";

const RESULTS_DIR = path.join(__dirname, "results");

function getLatestResult(): string | null {
  if (!fs.existsSync(RESULTS_DIR)) return null;
  const files = fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  return files[0] ? path.join(RESULTS_DIR, files[0]) : null;
}

function main() {
  const file = getLatestResult();
  if (!file) {
    console.error("No eval results found. Run `npm run eval:chat` first.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║           Echo Chat Eval Report                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`Run at:   ${data.timestamp}`);
  console.log(`Target:   ${data.target}`);
  console.log(`Score:    ${data.score}  (${data.passed}/${data.total} passed)\n`);
  console.log("─".repeat(62));

  for (const r of data.results) {
    const icon = r.passed ? "✅" : r.error ? "💥" : "❌";
    console.log(`\n${icon} [${r.id}] ${r.question}`);
    if (r.error) {
      console.log(`   Error: ${r.error}`);
    } else {
      console.log(`   Response (${r.durationMs}ms): ${r.response.substring(0, 120)}...`);
      if (!r.passed) {
        if (r.missingKeywords.length > 0)
          console.log(`   Missing: ${r.missingKeywords.join(", ")}`);
        if (r.forbiddenFound.length > 0)
          console.log(`   Forbidden found: ${r.forbiddenFound.join(", ")}`);
      }
    }
  }

  console.log("\n" + "─".repeat(62));
  console.log(`\n📁 Source: ${file}\n`);
}

main();
