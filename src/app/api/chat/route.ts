import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { detectPromptInjection, INJECTION_REFUSAL } from "@/lib/persona/security";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";
import { retrieve, getLastUserMessage } from "@/lib/rag/retriever";
import type { ChatRequest } from "@/types/chat";

export const runtime = "nodejs";
export const maxDuration = 30;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();
    const { messages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // ── Layer 1: Prompt injection detection ───────────────────────────────────
    const lastUserMessage = getLastUserMessage(messages);
    const securityCheck = detectPromptInjection(lastUserMessage);

    if (securityCheck.blocked) {
      // Return a streaming refusal that looks like a normal response
      const result = await streamText({
        model: openai("gpt-4o-mini"),
        system: "You are Tushar Agrawal. Respond with exactly the following text, word for word, with no changes: " + INJECTION_REFUSAL,
        messages: [{ role: "user", content: "." }],
        maxOutputTokens: 100,
      });
      return result.toTextStreamResponse();
    }

    // ── RAG Retrieval ─────────────────────────────────────────────────────────
    const { context } = await retrieve(lastUserMessage);

    // ── Layer 2: Build system prompt with context and guardrails ──────────────
    const systemPrompt = buildSystemPrompt(context);

    // Build plain model messages from the incoming array
    const modelMessages = messages.map((m: any) => ({
      role: m.role as "user" | "assistant" | "system",
      content: typeof m.content === "string"
        ? m.content
        : (m.parts ?? []).filter((p: any) => p.type === "text").map((p: any) => p.text).join("") || ".",
    }));

    // ── Stream LLM response ───────────────────────────────────────────────────
    const result = await streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 600,
      temperature: 0.1,  // Lower = more factual, less hallucination
      abortSignal: AbortSignal.timeout(25_000),
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[/api/chat] Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// Preflight CORS for potential cross-origin chat widget usage
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
