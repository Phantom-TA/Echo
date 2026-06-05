import { NextResponse } from "next/server";
import { warmUpPinecone } from "@/lib/rag/pinecone";
import { getEmbedding } from "@/lib/rag/embeddings";

export const runtime = "nodejs";

/**
 * Keep-warm endpoint — pinged every 10 minutes by UptimeRobot / cron-job.org
 * to prevent Vercel cold starts and Pinecone connection drops.
 *
 * What it does:
 * 1. Embeds a dummy query (warms up the OpenAI embedding client)
 * 2. Queries Pinecone with the dummy embedding (warms up the Pinecone connection)
 *
 * Expected response time: < 500ms when warm.
 */
export async function GET(req: Request) {
  // Optional: validate a secret header to prevent abuse
  const authHeader = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && authHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    // Warm up both clients
    await Promise.all([
      getEmbedding("warm up"),
      warmUpPinecone(),
    ]);

    const latency = Date.now() - start;

    return NextResponse.json({
      status: "warm",
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[/api/cron/keep-warm] Error:", error);
    return NextResponse.json(
      { status: "error", message: "Keep-warm failed" },
      { status: 500 }
    );
  }
}
