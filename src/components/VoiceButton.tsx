"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Vapi from "@vapi-ai/web";

type CallState = "idle" | "connecting" | "active" | "ending";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!;
const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!;

export default function VoiceButton() {
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  // Initialise Vapi once
  useEffect(() => {
    if (!PUBLIC_KEY) return;
    const vapi = new Vapi(PUBLIC_KEY);

    vapi.on("call-start", () => setCallState("active"));
    vapi.on("call-end", () => {
      setCallState("idle");
      setIsMuted(false);
    });
    vapi.on("error", (e: unknown) => {
      console.error("Vapi error:", e);
      setCallState("idle");
    });

    vapiRef.current = vapi;

    return () => {
      vapi.stop();
    };
  }, []);

  const startCall = useCallback(async () => {
    if (!vapiRef.current || !ASSISTANT_ID) return;
    setCallState("connecting");
    try {
      await vapiRef.current.start(ASSISTANT_ID);
    } catch (err) {
      console.error("Failed to start Vapi call:", err);
      setCallState("idle");
    }
  }, []);

  const stopCall = useCallback(() => {
    if (!vapiRef.current) return;
    setCallState("ending");
    vapiRef.current.stop();
  }, []);

  const toggleMute = useCallback(() => {
    if (!vapiRef.current) return;
    const next = !isMuted;
    vapiRef.current.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const buttonBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    borderRadius: "10px",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    transition: "all 0.2s ease",
  };

  const pulseStyle: React.CSSProperties =
    callState === "active"
      ? {
          animation: "pulse-ring 1.4s cubic-bezier(0.4,0,0.6,1) infinite",
        }
      : {};

  if (callState === "idle") {
    return (
      <button
        id="voice-call-btn"
        onClick={startCall}
        style={{
          ...buttonBase,
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          color: "#fff",
          boxShadow: "0 0 12px rgba(124,58,237,0.4)",
        }}
      >
        🎙️ Voice Call
      </button>
    );
  }

  if (callState === "connecting") {
    return (
      <button
        id="voice-call-btn"
        disabled
        style={{
          ...buttonBase,
          background: "rgba(124,58,237,0.2)",
          color: "#a78bfa",
          border: "1px solid rgba(124,58,237,0.3)",
        }}
      >
        ⏳ Connecting…
      </button>
    );
  }

  if (callState === "ending") {
    return (
      <button
        id="voice-call-btn"
        disabled
        style={{
          ...buttonBase,
          background: "rgba(239,68,68,0.1)",
          color: "#f87171",
          border: "1px solid rgba(239,68,68,0.2)",
        }}
      >
        ⏳ Ending…
      </button>
    );
  }

  // active state — show mute + end
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <button
        id="voice-mute-btn"
        onClick={toggleMute}
        style={{
          ...buttonBase,
          background: isMuted ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
          color: isMuted ? "#f87171" : "#4ade80",
          border: `1px solid ${isMuted ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
          padding: "8px 12px",
        }}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? "🔇" : "🎤"}
      </button>

      <button
        id="voice-call-btn"
        onClick={stopCall}
        style={{
          ...buttonBase,
          background: "rgba(239,68,68,0.15)",
          color: "#f87171",
          border: "1px solid rgba(239,68,68,0.3)",
          ...pulseStyle,
        }}
      >
        🔴 End Call
      </button>

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  );
}
