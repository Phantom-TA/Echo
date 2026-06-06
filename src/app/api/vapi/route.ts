import { NextResponse } from "next/server";
import { retrieve } from "@/lib/rag/retriever";
import { buildVapiSystemPrompt } from "@/lib/persona/system-prompt";
import { detectPromptInjection, INJECTION_REFUSAL } from "@/lib/persona/security";
import { getAvailableSlots, bookMeeting } from "@/lib/calendar/calcom";
import type { VapiMessage } from "@/types/chat";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Validates incoming Vapi requests via the shared secret header.
 */
function validateVapiRequest(req: Request): boolean {
  const secret = req.headers.get("x-vapi-secret");
  if (!process.env.VAPI_WEBHOOK_SECRET) return true; // Skip if not configured yet
  return secret === process.env.VAPI_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  // ── Webhook authentication ─────────────────────────────────────────────────
  if (!validateVapiRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: VapiMessage;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Handle Vapi message types ──────────────────────────────────────────────
  switch (body.type) {

    // Called when Vapi wants the assistant configuration
    case "assistant-request": {
      const { context } = await retrieve("Tell me about Tushar Agrawal AI engineer experience projects skills");
      const systemPrompt = buildVapiSystemPrompt(context);

      return NextResponse.json({
        assistant: {
          name: "Tushar",
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            systemPrompt,
            maxTokens: 250,
            temperature: 0.7,
          },
          voice: {
            provider: "11labs",
            voiceId: process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB",
          },
          transcriber: {
            provider: "deepgram",
            model: "nova-3",
            language: "en-IN",
          },
          firstMessage:
            "Hey there! I'm Tushar Agrawal, an AI engineer. Feel free to ask me anything about my projects, experience, or skills. What would you like to know?",
          endCallMessage:
            "Thanks for chatting! Feel free to check out my GitHub or book a call. Have a great day!",
        },
      });
    }

    // Called when the assistant invokes a tool/function
    case "function-call": {
      const fnName = body.functionCall?.name;
      const fnParams = body.functionCall?.parameters ?? {};

      // Tool: RAG lookup
      if (fnName === "knowledge_lookup") {
        const query = fnParams.query as string;
        const secCheck = detectPromptInjection(query ?? "");
        if (secCheck.blocked) {
          return NextResponse.json({ result: INJECTION_REFUSAL });
        }
        const { context } = await retrieve(query);
        return NextResponse.json({ result: context || "No specific information found for that query." });
      }

      // Tool: Get available slots
      if (fnName === "get_calendar_slots") {
        const slots = await getAvailableSlots(7);
        if (slots.length === 0) {
          return NextResponse.json({
            result: `No slots available right now. Please book directly at ${process.env.NEXT_PUBLIC_CALCOM_URL || "https://cal.com/tushar-agrawal"}`,
          });
        }
        const slotList = slots.slice(0, 5).map((s) => s.time).join(", ");
        return NextResponse.json({ result: `Available times: ${slotList}. Would you like to book one of these?` });
      }

      // Tool: Book a meeting
      if (fnName === "book_meeting") {
        const booking = await bookMeeting({
          startTime: fnParams.startTime as string,
          name: fnParams.name as string,
          email: fnParams.email as string,
          notes: fnParams.notes as string | undefined,
        });
        if (!booking) {
          return NextResponse.json({
            result: `I wasn't able to complete the booking automatically. Please book directly at ${process.env.NEXT_PUBLIC_CALCOM_URL || "https://cal.com/tushar-agrawal"}`,
          });
        }
        return NextResponse.json({
          result: `Your meeting has been booked successfully! Booking ID: ${booking.uid ?? booking.id}. You'll receive a confirmation email shortly. Looking forward to chatting, ${fnParams.name}!`,
        });
      }

      return NextResponse.json({ result: "Unknown function" }, { status: 400 });
    }

    // Status updates and end-of-call reports — acknowledge silently
    case "status-update":
    case "end-of-call-report":
    case "transcript":
      return NextResponse.json({ received: true });

    default:
      return NextResponse.json({ received: true });
  }
}
