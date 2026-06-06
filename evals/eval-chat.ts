/**
 * eval-chat.ts — Automated Chat Evaluation with GPT-4o Judge
 *
 * Usage:
 *   npm run eval:chat                         # localhost:3002 + GPT-4o judge
 *   EVAL_BASE_URL=https://echo-umber-seven.vercel.app npm run eval:chat
 *   SKIP_JUDGE=true npm run eval:chat         # skip GPT-4o judge (faster, no cost)
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import OpenAI from "openai";
import { GOLDEN_QA, GoldenQA } from "./golden-qa";

dotenv.config({ path: ".env.local" });

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:3002";
const SKIP_JUDGE = process.env.SKIP_JUDGE === "true";
const RESULTS_DIR = path.join(__dirname, "results");
const TIMEOUT_MS = 30_000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Types ────────────────────────────────────────────────────────────────────

interface JudgeScore {
  groundedness: number;   // 0-1: Is answer supported by context?
  accuracy: number;       // 0-1: Does it match expected answer?
  hallucination: boolean; // true if contains fabricated info
  reasoning: string;
}

interface EvalResult {
  id: string;
  category: GoldenQA["category"];
  question: string;
  response: string;
  passed: boolean;
  missingKeywords: string[];
  forbiddenFound: string[];
  durationMs: number;
  judge?: JudgeScore;
  error?: string;
}

// ── Chat helper ───────────────────────────────────────────────────────────────

async function askChat(question: string): Promise<{ text: string; durationMs: number }> {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: question }] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
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

// ── GPT-4o judge ─────────────────────────────────────────────────────────────

async function judgeResponse(qa: GoldenQA, response: string): Promise<JudgeScore> {
  const prompt = `You are an evaluation judge for an AI persona chatbot representing Tushar Agrawal, a 3rd-year CS student and AI Engineer.

QUESTION: ${qa.question}
EXPECTED ANSWER (ground truth): ${qa.expectedAnswer ?? "N/A"}
ACTUAL RESPONSE: ${response}

Rate the actual response on these three dimensions. Be strict but fair.

1. GROUNDEDNESS (0.0-1.0): Is the answer grounded in factual information about Tushar? Penalize vague, generic, or off-topic answers.
2. ACCURACY (0.0-1.0): How closely does the response match the expected answer? Full credit only if key facts are present.
3. HALLUCINATION (true/false): Does the response contain any clearly fabricated information about Tushar's projects, skills, or background?

Respond ONLY with this JSON (no markdown, no explanation outside the JSON):
{"groundedness": 0.0, "accuracy": 0.0, "hallucination": false, "reasoning": "one sentence"}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 150,
    temperature: 0,
  });

  const raw = completion.choices[0].message.content?.trim() ?? "{}";
  try {
    return JSON.parse(raw) as JudgeScore;
  } catch {
    return { groundedness: 0, accuracy: 0, hallucination: false, reasoning: "Parse error: " + raw };
  }
}

// ── Keyword evaluator ────────────────────────────────────────────────────────

function evaluateKeywords(qa: GoldenQA, response: string) {
  const lower = response.toLowerCase();
  const missingKeywords = (qa.mustContain ?? []).filter((kw) => !lower.includes(kw.toLowerCase()));
  const forbiddenFound = (qa.mustNotContain ?? []).filter((kw) => lower.includes(kw.toLowerCase()));
  return { missingKeywords, forbiddenFound, passed: missingKeywords.length === 0 && forbiddenFound.length === 0 };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const judgedQuestions = GOLDEN_QA.filter((q) => q.expectedAnswer);
  const estimatedCost = judgedQuestions.length * 500 * 0.000005; // ~$0.000005/token input

  console.log(`\n🧪 Echo Chat Eval — ${GOLDEN_QA.length} test cases`);
  console.log(`📡 Target: ${BASE_URL}`);
  console.log(`🤖 GPT-4o judge: ${SKIP_JUDGE ? "SKIPPED" : `enabled (${judgedQuestions.length} questions, ~$${estimatedCost.toFixed(3)})`}`);
  console.log("\n" + "─".repeat(65));

  const results: EvalResult[] = [];
  let keywordPassed = 0;
  let totalJudged = 0;
  let totalGroundedness = 0;
  let totalAccuracy = 0;
  let hallucinationCount = 0;

  for (const qa of GOLDEN_QA) {
    process.stdout.write(`[${qa.id}] ${qa.question.substring(0, 46).padEnd(48)}`);

    try {
      const { text, durationMs } = await askChat(qa.question);
      const { passed, missingKeywords, forbiddenFound } = evaluateKeywords(qa, text);

      let judge: JudgeScore | undefined;
      if (!SKIP_JUDGE && qa.expectedAnswer) {
        judge = await judgeResponse(qa, text);
        totalJudged++;
        totalGroundedness += judge.groundedness;
        totalAccuracy += judge.accuracy;
        if (judge.hallucination) hallucinationCount++;
      }

      if (passed) keywordPassed++;

      const result: EvalResult = {
        id: qa.id, category: qa.category, question: qa.question,
        response: text, passed, missingKeywords, forbiddenFound, durationMs, judge,
      };
      results.push(result);

      const judgeStr = judge
        ? ` | G:${judge.groundedness.toFixed(1)} A:${judge.accuracy.toFixed(1)} H:${judge.hallucination ? "⚠️" : "✓"}`
        : "";
      const icon = passed ? "✅" : "❌";
      console.log(`${icon}  ${durationMs}ms${judgeStr}`);

      if (!passed) {
        if (missingKeywords.length > 0) console.log(`   ⚠ missing: [${missingKeywords.join(", ")}]`);
        if (forbiddenFound.length > 0) console.log(`   🚫 forbidden: [${forbiddenFound.join(", ")}]`);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.log(`💥  ERROR — ${err.message}`);
      }
      results.push({
        id: qa.id, category: qa.category, question: qa.question,
        response: "", passed: false, missingKeywords: [], forbiddenFound: [],
        durationMs: 0, error: err.message,
      });
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  // ── Aggregate metrics ────────────────────────────────────────────────────
  const avgGroundedness = totalJudged > 0 ? totalGroundedness / totalJudged : null;
  const avgAccuracy = totalJudged > 0 ? totalAccuracy / totalJudged : null;
  const hallucinationRate = totalJudged > 0 ? hallucinationCount / totalJudged : null;
  const keywordScore = `${Math.round((keywordPassed / GOLDEN_QA.length) * 100)}%`;

  // ── Save results ──────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(RESULTS_DIR, `chat-eval-${timestamp}.json`);
  const summary = {
    timestamp: new Date().toISOString(),
    target: BASE_URL,
    total: GOLDEN_QA.length,
    keywordPassed,
    keywordFailed: GOLDEN_QA.length - keywordPassed,
    keywordScore,
    judge: totalJudged > 0 ? {
      questionsJudged: totalJudged,
      avgGroundedness: avgGroundedness?.toFixed(3),
      avgAccuracy: avgAccuracy?.toFixed(3),
      hallucinationRate: hallucinationRate?.toFixed(3),
      hallucinationCount,
    } : null,
    results,
  };
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  // ── Print summary ────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(65));
  console.log(`\n📊 Keyword Score: ${keywordPassed}/${GOLDEN_QA.length} (${keywordScore})`);

  if (totalJudged > 0) {
    console.log(`\n🤖 GPT-4o Judge (${totalJudged} questions):`);
    console.log(`   Groundedness:      ${(avgGroundedness! * 100).toFixed(1)}%`);
    console.log(`   Accuracy:          ${(avgAccuracy! * 100).toFixed(1)}%`);
    console.log(`   Hallucination rate: ${(hallucinationRate! * 100).toFixed(1)}%  (${hallucinationCount} cases)`);
  }

  // Category breakdown
  console.log("\n📂 By category:");
  const categories = [...new Set(GOLDEN_QA.map((q) => q.category))];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.passed).length;
    const icon = catPassed === catResults.length ? "✅" : catPassed === 0 ? "❌" : "⚠️ ";
    console.log(`  ${icon} ${cat.padEnd(12)} ${catPassed}/${catResults.length}`);
  }

  console.log(`\n📁 Full results: ${outFile}\n`);

  if (keywordPassed < GOLDEN_QA.length) process.exit(1);
}

main().catch((err) => {
  console.error("Eval crashed:", err);
  process.exit(1);
});
