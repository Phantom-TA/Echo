/**
 * eval-chat.ts — Automated Chat Evaluation
 *
 * Sends each golden Q&A question to the running chat API,
 * evaluates the response, and writes results to evals/results/.
 *
 * Usage:
 *   npm run eval:chat                         # hits localhost:3002
 *   EVAL_BASE_URL=https://echo-umber-seven.vercel.app npm run eval:chat
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { GOLDEN_QA, GoldenQA } from "./golden-qa";

dotenv.config({ path: ".env.local" });

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:3002";
const RESULTS_DIR = path.join(__dirname, "results");
const TIMEOUT_MS = 30_000;

interface EvalResult {
  id: string;
  category: GoldenQA["category"];
  question: string;
  response: string;
  passed: boolean;
  missingKeywords: string[];
  forbiddenFound: string[];
  durationMs: number;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function askChat(question: string): Promise<{ text: string; durationMs: number }> {
  const start = Date.now();

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  return { text: text.trim(), durationMs: Date.now() - start };
}

function evaluate(qa: GoldenQA, response: string): Pick<EvalResult, "passed" | "missingKeywords" | "forbiddenFound"> {
  const lower = response.toLowerCase();

  const missingKeywords = (qa.mustContain ?? []).filter(
    (kw) => !lower.includes(kw.toLowerCase())
  );

  const forbiddenFound = (qa.mustNotContain ?? []).filter(
    (kw) => lower.includes(kw.toLowerCase())
  );

  const passed = missingKeywords.length === 0 && forbiddenFound.length === 0;

  return { passed, missingKeywords, forbiddenFound };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  console.log(`\n🧪 Echo Chat Eval — ${GOLDEN_QA.length} test cases`);
  console.log(`📡 Target: ${BASE_URL}\n`);
  console.log("─".repeat(60));

  const results: EvalResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const qa of GOLDEN_QA) {
    process.stdout.write(`[${qa.id}] ${qa.question.substring(0, 50).padEnd(52)}`);

    try {
      const { text, durationMs } = await askChat(qa.question);
      const { passed: testPassed, missingKeywords, forbiddenFound } = evaluate(qa, text);

      const result: EvalResult = {
        id: qa.id,
        category: qa.category,
        question: qa.question,
        response: text,
        passed: testPassed,
        missingKeywords,
        forbiddenFound,
        durationMs,
      };

      results.push(result);

      if (testPassed) {
        passed++;
        console.log(`✅  ${durationMs}ms`);
      } else {
        failed++;
        const issues: string[] = [];
        if (missingKeywords.length > 0) issues.push(`missing: [${missingKeywords.join(", ")}]`);
        if (forbiddenFound.length > 0) issues.push(`forbidden: [${forbiddenFound.join(", ")}]`);
        console.log(`❌  ${durationMs}ms — ${issues.join(" | ")}`);
      }
    } catch (err: any) {
      failed++;
      const result: EvalResult = {
        id: qa.id,
        category: qa.category,
        question: qa.question,
        response: "",
        passed: false,
        missingKeywords: qa.mustContain ?? [],
        forbiddenFound: [],
        durationMs: 0,
        error: err.message,
      };
      results.push(result);
      console.log(`💥  ERROR — ${err.message}`);
    }

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  // ── Save results JSON ────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(RESULTS_DIR, `chat-eval-${timestamp}.json`);
  const summary = {
    timestamp: new Date().toISOString(),
    target: BASE_URL,
    total: GOLDEN_QA.length,
    passed,
    failed,
    score: `${Math.round((passed / GOLDEN_QA.length) * 100)}%`,
    results,
  };

  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  // ── Print summary ────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log(`\n📊 Results: ${passed}/${GOLDEN_QA.length} passed  (${summary.score})`);

  // Breakdown by category
  const categories = [...new Set(GOLDEN_QA.map((q) => q.category))];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.passed).length;
    const icon = catPassed === catResults.length ? "✅" : catPassed === 0 ? "❌" : "⚠️ ";
    console.log(`  ${icon} ${cat.padEnd(10)} ${catPassed}/${catResults.length}`);
  }

  console.log(`\n📁 Full results saved to: ${outFile}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Eval runner crashed:", err);
  process.exit(1);
});
