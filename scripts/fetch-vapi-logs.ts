/**
 * fetch-vapi-logs.ts — Auto-fetch Vapi call data for the eval report
 *
 * Fetches the most recent N calls from the Vapi API and extracts:
 *   - Duration, cost, first-response latency
 *   - Full transcript (what user said vs AI said)
 *   - Tools called per call
 *   - Success / booking status
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/fetch-vapi-logs.ts
 *   npx tsx --tsconfig tsconfig.json scripts/fetch-vapi-logs.ts --limit 8
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const RESULTS_DIR = path.join(__dirname, "..", "evals", "results");
const LIMIT = parseInt(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "10");

if (!VAPI_API_KEY) {
  console.error("\n❌ VAPI_API_KEY not set in .env.local");
  console.error("   Go to Vapi Dashboard → Settings → API Keys → copy the Private Key\n");
  process.exit(1);
}

async function fetchCalls(): Promise<any[]> {
  const res = await fetch(`https://api.vapi.ai/call?limit=${LIMIT}`, {
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Vapi API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  // Vapi returns either an array or { results: [] }
  return Array.isArray(data) ? data : (data.results ?? []);
}

function extractLatency(call: any): number | null {
  // Try latency from analysis
  const analysis = call.analysis ?? {};
  if (analysis.firstResponseTime) return analysis.firstResponseTime;

  // Try from costBreakdown or messages
  const messages: any[] = call.messages ?? [];
  const botFirstMsg = messages.find((m: any) => m.role === "bot" || m.role === "assistant");
  const userFirstMsg = messages.find((m: any) => m.role === "user");

  if (botFirstMsg?.time && userFirstMsg?.time) {
    return Math.round(botFirstMsg.time - userFirstMsg.time);
  }

  return null;
}

function extractTranscript(call: any): string {
  const transcript = call.transcript ?? "";
  if (typeof transcript === "string" && transcript.length > 0) return transcript;

  // Build from messages
  const messages: any[] = call.messages ?? [];
  return messages
    .filter((m: any) => m.role === "user" || m.role === "assistant" || m.role === "bot")
    .map((m: any) => `${m.role === "user" ? "USER" : "AI"}: ${m.message ?? m.content ?? ""}`)
    .join("\n");
}

function extractToolCalls(call: any): string[] {
  const messages: any[] = call.messages ?? [];
  return messages
    .filter((m: any) => m.role === "tool_calls" || m.toolCalls)
    .flatMap((m: any) => (m.toolCalls ?? []).map((t: any) => t.function?.name ?? t.name ?? "unknown"));
}

function durationSeconds(call: any): number {
  if (call.startedAt && call.endedAt) {
    return Math.round(
      (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
    );
  }
  return 0;
}

async function main() {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  console.log(`\n📞 Fetching last ${LIMIT} Vapi calls...\n`);

  const calls = await fetchCalls();

  if (calls.length === 0) {
    console.log("No calls found. Run some voice calls first via the Talk button.");
    process.exit(0);
  }

  const processed = calls.map((call: any, i: number) => {
    const latencyMs = extractLatency(call);
    const transcript = extractTranscript(call);
    const toolCalls = extractToolCalls(call);
    const duration = durationSeconds(call);

    return {
      index: i + 1,
      callId: call.id,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      durationSeconds: duration,
      cost: call.cost ?? null,
      costBreakdown: call.costBreakdown ?? null,
      firstResponseLatencyMs: latencyMs,
      endReason: call.endedReason ?? call.status ?? "unknown",
      toolsCalled: toolCalls,
      bookingAttempted: toolCalls.includes("book_meeting"),
      transcript,
    };
  });

  // ── Print summary ──────────────────────────────────────────────────────────
  console.log("─".repeat(70));
  console.log(`${"#".padEnd(3)} ${"Duration".padEnd(12)} ${"Latency".padEnd(12)} ${"Cost".padEnd(10)} ${"Tools"}`);
  console.log("─".repeat(70));

  const latencies = processed.filter(c => c.firstResponseLatencyMs !== null).map(c => c.firstResponseLatencyMs!);

  for (const c of processed) {
    const lat = c.firstResponseLatencyMs !== null ? `${c.firstResponseLatencyMs}ms` : "N/A";
    const cost = c.cost !== null ? `$${c.cost.toFixed(3)}` : "N/A";
    const tools = c.toolsCalled.length > 0 ? c.toolsCalled.join(", ") : "none";
    console.log(`${String(c.index).padEnd(3)} ${String(c.durationSeconds + "s").padEnd(12)} ${lat.padEnd(12)} ${cost.padEnd(10)} ${tools}`);
  }

  // ── Latency stats ──────────────────────────────────────────────────────────
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const mean = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    console.log("\n📊 First-Response Latency:");
    console.log(`   Mean: ${mean}ms  |  P95: ${p95}ms  |  Min: ${min}ms  |  Max: ${max}ms`);
    console.log(`   Under 2s: ${latencies.filter(l => l < 2000).length}/${latencies.length} calls ✅`);
  }

  // ── Booking stats ──────────────────────────────────────────────────────────
  const bookingCalls = processed.filter(c => c.bookingAttempted);
  console.log(`\n📅 Booking attempts: ${bookingCalls.length} calls triggered book_meeting`);

  // ── Save raw JSON ──────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(RESULTS_DIR, `voice-calls-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ fetchedAt: new Date().toISOString(), calls: processed }, null, 2));

  console.log(`\n📁 Raw data saved to: ${outFile}`);
  console.log("\n✅ Done — share this file with me and I'll incorporate the data into the eval report.\n");
}

main().catch(err => {
  console.error("Failed:", err.message);
  process.exit(1);
});
