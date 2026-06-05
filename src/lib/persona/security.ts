/**
 * Security Layer — Input Filter
 *
 * Regex-based prompt injection detector that runs BEFORE the LLM.
 * If a pattern is matched, we return a canned refusal response instead
 * of forwarding the message to GPT-4o Mini.
 *
 * This is Layer 1 of the dual-layer security model:
 * Layer 1 = This filter (pre-LLM)
 * Layer 2 = Guardrails embedded inside the system prompt (in-LLM)
 */

const INJECTION_PATTERNS: RegExp[] = [
  // Classic ignore/override attempts
  /ignore\s+(previous|prior|above|all)\s+(instructions?|rules?|prompts?|context)/i,
  /forget\s+(your\s+)?(instructions?|rules?|persona|identity|system\s+prompt)/i,
  /disregard\s+(your\s+)?(instructions?|rules?|constraints?)/i,

  // Prompt reveal attempts
  /reveal\s+(your\s+)?(system\s+prompt|instructions?|rules?|configuration)/i,
  /what\s+are\s+your\s+(exact\s+)?(instructions?|rules?|system\s+prompt|prompt)/i,
  /show\s+(me\s+)?(your\s+)?(prompt|system\s+prompt|instructions?)/i,
  /print\s+(your\s+)?(system\s+prompt|instructions?|initial\s+prompt)/i,
  /repeat\s+(your\s+)?(system\s+prompt|instructions?)/i,
  /output\s+(your\s+)?(system\s+prompt|instructions?)/i,

  // Role / persona override attempts
  /you\s+are\s+now\s+(a\s+)?(different|new|another)/i,
  /act\s+as\s+(if\s+)?(you\s+are|you're)\s+(not|a\s+different|an?\s+unrestricted)/i,
  /pretend\s+(you\s+are|you're|to\s+be)\s+(not\s+tushar|a\s+different)/i,
  /switch\s+(your\s+)?(role|persona|mode|identity)/i,
  /enter\s+(developer|jailbreak|god|admin|unrestricted)\s+mode/i,
  /\bDAN\b/,           // Do Anything Now jailbreak
  /\bjailbreak\b/i,

  // Model / implementation reveal attempts
  /what\s+(model|llm|ai)\s+(are|is|powers?|behind)\s+you/i,
  /which\s+(model|llm|version|api)\s+(are|is)\s+(you|this|powering)/i,
  /are\s+you\s+(really\s+)?(gpt|openai|claude|gemini|llama)/i,
  /what\s+(technology|tech\s+stack|infrastructure)\s+(powers?|runs?)\s+(you|this)/i,

  // Injection via unusual characters / encoding
  /\\u[0-9a-f]{4}/i,  // Unicode escape injection
  /base64/i,
];

export interface SecurityCheckResult {
  blocked: boolean;
  reason?: string;
}

/**
 * Checks whether a user message contains prompt injection patterns.
 * Returns { blocked: true, reason } if injection is detected.
 */
export function detectPromptInjection(text: string): SecurityCheckResult {
  const normalized = text.trim();

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        blocked: true,
        reason: "prompt_injection_detected",
      };
    }
  }

  return { blocked: false };
}

/**
 * The canned response returned when injection is detected.
 * Stays in-persona and doesn't acknowledge the attempt explicitly.
 */
export const INJECTION_REFUSAL =
  "Hey, I'm here to chat about my experience, projects, and skills as an AI engineer. " +
  "Happy to talk about IntentSync, TraceLens, Codonova, or anything else on my resume. " +
  "What would you like to know?";

/**
 * Detects whether the user is asking to schedule a meeting.
 */
export function detectCalendarIntent(text: string): boolean {
  const CALENDAR_PATTERNS = [
    /\b(schedule|book|set up|arrange|plan)\b.{0,20}\b(call|meeting|interview|chat|session|time)\b/i,
    /\b(call|meeting|interview|chat)\b.{0,20}\b(schedule|book|available|availability)\b/i,
    /\bwhen\b.{0,20}\b(available|free|can\s+we\s+(talk|meet|chat))\b/i,
    /\bcal\.com\b/i,
    /\bbook\s+a\b/i,
  ];
  return CALENDAR_PATTERNS.some((p) => p.test(text));
}
