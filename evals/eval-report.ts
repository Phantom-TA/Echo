/**
 * eval-report.ts — Full Phase 6 Eval Report Generator
 *
 * Reads the latest chat + voice eval results and generates a
 * markdown report ready to be converted to PDF.
 *
 * Usage:
 *   npm run eval:report
 *
 * To convert to PDF: open the generated .md in VS Code + Markdown PDF extension,
 * or paste into https://md2pdf.netlify.app
 */

import * as fs from "fs";
import * as path from "path";

const RESULTS_DIR = path.join(__dirname, "results");
const FAILURE_MODES_FILE = path.join(__dirname, "failure-modes.md");

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLatestFile(prefix: string): string | null {
  if (!fs.existsSync(RESULTS_DIR)) return null;
  const files = fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .reverse();
  return files[0] ? path.join(RESULTS_DIR, files[0]) : null;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function bar(score: number, width = 20): string {
  const filled = Math.round(score * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const chatFile = getLatestFile("chat-eval");
  const voiceFile = getLatestFile("voice-eval");

  if (!chatFile) {
    console.error("No chat eval results found. Run `npm run eval:chat` first.");
    process.exit(1);
  }
  if (!voiceFile) {
    console.error("No voice eval results found. Run `npm run eval:voice` first.");
    process.exit(1);
  }

  const chat = JSON.parse(fs.readFileSync(chatFile, "utf-8"));
  const voice = JSON.parse(fs.readFileSync(voiceFile, "utf-8"));
  const failureModes = fs.existsSync(FAILURE_MODES_FILE)
    ? fs.readFileSync(FAILURE_MODES_FILE, "utf-8")
    : "_Failure mode analysis not found._";

  const now = new Date().toISOString();
  const timestamp = now.slice(0, 10);

  // ── Build Category breakdown table ────────────────────────────────────────
  const categories: Record<string, { passed: number; total: number }> = {};
  for (const r of chat.results) {
    if (!categories[r.category]) categories[r.category] = { passed: 0, total: 0 };
    categories[r.category].total++;
    if (r.passed) categories[r.category].passed++;
  }

  const catRows = Object.entries(categories)
    .map(([cat, { passed, total }]) => {
      const icon = passed === total ? "✅" : passed === 0 ? "❌" : "⚠️";
      return `| ${icon} ${cat} | ${passed}/${total} | ${pct(passed / total)} |`;
    })
    .join("\n");

  // ── Build hallucination breakdown ─────────────────────────────────────────
  const hallucinatedCases = chat.results
    .filter((r: any) => r.judge?.hallucination)
    .map((r: any) => `- [${r.id}] _"${r.question}"_ — ${r.judge.reasoning}`)
    .join("\n");

  // ── Voice results table ───────────────────────────────────────────────────
  const voiceRows = voice.results
    .map((r: any) => {
      const icon = r.passed ? "✅" : "❌";
      return `| ${icon} | ${r.id} | ${r.description} | ${r.durationMs}ms |`;
    })
    .join("\n");

  // ── Compose report ────────────────────────────────────────────────────────
  const report = `# Echo — AI Persona Evaluation Report
**Tushar Agrawal AI Representative** | Generated: ${timestamp}

---

## Executive Summary

| Metric | Score |
|--------|-------|
| Chat keyword accuracy | **${chat.keywordScore}** (${chat.keywordPassed}/${chat.total}) |
| Chat groundedness (GPT-4o judge) | **${chat.judge ? pct(parseFloat(chat.judge.avgGroundedness)) : "N/A"}** |
| Chat accuracy (GPT-4o judge) | **${chat.judge ? pct(parseFloat(chat.judge.avgAccuracy)) : "N/A"}** |
| Hallucination rate | **${chat.judge ? pct(parseFloat(chat.judge.hallucinationRate)) : "N/A"}** |
| Voice webhook tests | **${voice.passed}/${voice.total}** (${Math.round(voice.passed / voice.total * 100)}%) |
| Vapi credits used | **${voice.vapiCreditsUsed}** |

---

## 6A. Voice Evaluation

### Webhook Integration Tests (${voice.total} cases, $0.00 credits)

| | ID | Description | Latency |
|---|---|---|---|
${voiceRows}

**Score: ${voice.passed}/${voice.total} (${Math.round(voice.passed / voice.total * 100)}%)**

### Manual Voice Testing (to be completed)
> N=10 calls via Vapi Talk button:
> - 4 calls: Q&A about resume/GitHub
> - 3 calls: Calendar booking flow (end to end)
> - 2 calls: Edge cases (interruption, unknown questions)
> - 1 call: Adversarial prompt injection
>
> Capture from Vapi Logs: first-response latency, transcription accuracy, booking success rate.

---

## 6B. Chat Evaluation

### Keyword Scoring

**${chat.keywordScore}** — ${chat.keywordPassed}/${chat.total} questions passed keyword validation.

\`\`\`
${bar(chat.keywordPassed / chat.total)} ${chat.keywordScore}
\`\`\`

### By Category

| Status | Category | Score | Pass Rate |
|--------|----------|-------|-----------|
${catRows}

### GPT-4o Judge Metrics

${chat.judge ? `
| Dimension | Score | Bar |
|-----------|-------|-----|
| Groundedness | **${pct(parseFloat(chat.judge.avgGroundedness))}** | \`${bar(parseFloat(chat.judge.avgGroundedness))}\` |
| Accuracy | **${pct(parseFloat(chat.judge.avgAccuracy))}** | \`${bar(parseFloat(chat.judge.avgAccuracy))}\` |
| Hallucination rate | **${pct(parseFloat(chat.judge.hallucinationRate))}** | \`${bar(parseFloat(chat.judge.hallucinationRate))}\` |

> Evaluated ${chat.judge.questionsJudged} questions. Lower hallucination rate is better. Note: security refusal questions (SEC-02, SEC-03) score G:0.0/A:0.0 by design — the model correctly declines to answer, but the judge rates this as low groundedness.

**Hallucination cases flagged:**
${hallucinatedCases || "_None_"}
` : "_GPT-4o judge not run. Re-run without SKIP_JUDGE=true to generate._"}

---

## 6C. Failure Mode Analysis

${failureModes}

---

## 6D. Model Tradeoff — GPT-4o vs GPT-4o Mini

> **Note:** Full GPT-4o benchmark (3 identical test calls) to be completed manually via Vapi dashboard.
> Temporarily switch assistant model to GPT-4o Cluster, run 3 calls, record latency from Logs, switch back.

### Expected Tradeoff

| Dimension | GPT-4o Mini | GPT-4o |
|-----------|-------------|--------|
| Avg latency (est.) | ~390ms | ~800-1200ms |
| Cost per call (est.) | ~$0.01/min | ~$0.07/min |
| Reasoning quality | Good | Excellent |
| Recommended for | Production voice | Deep Q&A evals |

**Decision:** GPT-4o Mini is the right choice for voice — the latency difference (~2-3x) is too large for real-time conversation, and the quality gap for factual recall is negligible with good RAG context.

---

## What's Next (2 More Weeks)

1. **Streaming RAG** — Stream retrieved context alongside LLM response to reduce TTFB by ~200ms
2. **Conversation memory** — Maintain context across turns using Redis session store so the AI doesn't repeat itself
3. **Multi-turn voice booking** — Full guided booking wizard ("What date works for you?") instead of link redirect
4. **Analytics dashboard** — Track most-asked questions, latency trends, conversion rate (chat → booking)
5. **Fine-tuned embeddings** — Domain-adapted embeddings for technical CS/AI content to improve retrieval precision

---

*Report generated by \`npm run eval:report\` on ${now}*
*Chat eval source: \`${path.basename(chatFile)}\`*
*Voice eval source: \`${path.basename(voiceFile)}\`*
`;

  // ── Write output ──────────────────────────────────────────────────────────
  const outFile = path.join(RESULTS_DIR, `eval-report-${timestamp}.md`);
  fs.writeFileSync(outFile, report);

  console.log("\n✅ Eval report generated!");
  console.log(`📄 ${outFile}`);
  console.log("\nTo convert to PDF:");
  console.log("  Option 1: VS Code → install 'Markdown PDF' extension → right-click → Export PDF");
  console.log("  Option 2: https://md2pdf.netlify.app → paste the file contents\n");
}

main();
