"use client";

import React, { useState } from "react";
import CalendarPicker from "./CalendarPicker";

export interface MessageType {
  role: "system" | "user" | "assistant" | "tool" | "data";
  content: string;
}

interface MessageBubbleProps {
  message: MessageType;
}

function getMessageContent(message: any): string {
  if (message.content) return message.content;
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  }
  return "";
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const [showCalendar, setShowCalendar] = useState(false);
  const content = getMessageContent(message);

  // Detect if the message mentions booking or scheduling a meeting
  const hasCalendarSuggestion =
    isAssistant &&
    (content.toLowerCase().includes("cal.com") ||
      content.toLowerCase().includes("schedule") ||
      content.toLowerCase().includes("book a time") ||
      content.toLowerCase().includes("interview") ||
      content.toLowerCase().includes("calendar"));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isAssistant ? "flex-start" : "flex-end",
        width: "100%",
        gap: "6px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          paddingLeft: isAssistant ? "12px" : "0",
          paddingRight: isAssistant ? "0" : "12px",
        }}
      >
        {isAssistant ? "Tushar (AI)" : "You"}
      </div>

      <div
        style={{
          maxWidth: "85%",
          padding: "12px 18px",
          borderRadius: "18px",
          lineHeight: "1.5",
          fontSize: "0.95rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          ...(isAssistant
            ? {
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderTopLeftRadius: "4px",
              }
            : {
                background: "linear-gradient(135deg, var(--accent) 0%, #6d28d9 100%)",
                color: "#ffffff",
                borderTopRightRadius: "4px",
                boxShadow: "0 4px 12px rgba(139, 92, 246, 0.15)",
              }),
        }}
      >
        {content}

        {hasCalendarSuggestion && !showCalendar && (
          <div style={{ marginTop: "12px" }}>
            <button
              onClick={() => setShowCalendar(true)}
              className="btn-primary pulse-glow"
              style={{
                fontSize: "0.85rem",
                padding: "8px 14px",
                borderRadius: "6px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: "none",
                fontWeight: 600,
              }}
            >
              📅 Schedule Inline
            </button>
          </div>
        )}

        {showCalendar && (
          <div style={{ marginTop: "12px", width: "100%", maxWidth: "450px" }}>
            <CalendarPicker
              onBookingSuccess={(details) => {
                // Close the picker or show a nice message
                console.log(details);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
