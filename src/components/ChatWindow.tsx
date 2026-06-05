"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

const SUGGESTIONS = [
  "What is IntentSync?",
  "Tell me about TraceLens performance tool",
  "What programming languages do you know?",
  "What AI or LLM projects have you built?",
  "Schedule an interview / call",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let msgCounter = 0;
const newId = () => `msg-${++msgCounter}`;

export default function ChatWindow() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    setError(null);

    // Add user message immediately
    const userMsg: Message = { id: newId(), role: "user", content: text };
    const assistantId = newId();

    setMessages((prev) => [
      ...prev,
      userMsg,
    ]);
    setIsLoading(true);

    // Build history including the new user message
    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Add empty assistant placeholder
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + chunk }
              : m
          )
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("Chat fetch error:", err);
      setError("Connection error. Please try again.");
      // Remove the empty assistant placeholder on error
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, isLoading]);

  const handleSuggestionClick = (text: string) => {
    sendMessage(text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    sendMessage(text);
  };

  return (
    <div
      className="glass-container"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "900px",
        height: "80vh",
        maxHeight: "800px",
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      {/* Chat Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(16, 16, 24, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Avatar status indicator */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent) 0%, #4f46e5 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "1.1rem",
                color: "#ffffff",
                boxShadow: "0 0 16px var(--accent-glow)",
              }}
            >
              TA
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "2px",
                right: "2px",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "var(--success)",
                border: "2px solid var(--bg-secondary)",
              }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)" }}>
              Tushar Agrawal
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "5px" }}>
              <span>AI Software Engineer Intern</span>
              <span style={{ color: "var(--text-muted)" }}>•</span>
              <span style={{ color: "var(--success)" }}>Online</span>
            </div>
          </div>
        </div>

        {/* Calendar Shortcut */}
        <button
          onClick={() => handleSuggestionClick("Schedule an interview / call")}
          className="btn-primary"
          style={{ fontSize: "0.85rem", padding: "8px 16px" }}
        >
          📅 Book Call
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          padding: "24px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          background: "radial-gradient(circle at top, rgba(139, 92, 246, 0.03) 0%, transparent 70%)",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
              color: "var(--text-secondary)",
              padding: "0 20px",
            }}
          >
            <h2 style={{ color: "var(--text-primary)", marginBottom: "10px", fontSize: "1.5rem" }}>
              Chat with Tushar&apos;s AI Persona
            </h2>
            <p style={{ maxWidth: "480px", fontSize: "0.95rem", lineHeight: 1.6 }}>
              Ask me about my experience at Voice Games, technical skills, my projects like IntentSync and Codonova, or schedule an interview slot inline!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message as any} />
          ))
        )}

        {isLoading && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content === "" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", paddingLeft: "12px" }}>
              Tushar (AI)
            </span>
            <TypingIndicator />
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 18px",
              background: "rgba(248, 113, 113, 0.1)",
              border: "1px solid rgba(248, 113, 113, 0.2)",
              borderRadius: "12px",
              color: "var(--error)",
              fontSize: "0.9rem",
              alignSelf: "center",
            }}
          >
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Suggestion Chips */}
      {messages.length === 0 && (
        <div
          style={{
            padding: "12px 24px",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            justifyContent: "center",
            borderTop: "1px solid var(--border)",
            background: "rgba(16, 16, 24, 0.2)",
          }}
        >
          {SUGGESTIONS.map((text) => (
            <button
              key={text}
              onClick={() => handleSuggestionClick(text)}
              className="glass-card"
              style={{
                border: "1px solid var(--border)",
                borderRadius: "20px",
                padding: "6px 14px",
                fontSize: "0.85rem",
                color: "var(--text-primary)",
                cursor: "pointer",
                background: "rgba(255,255,255,0.02)",
                outline: "none",
              }}
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "20px 24px",
          borderTop: "1px solid var(--border)",
          background: "rgba(16, 16, 24, 0.6)",
          display: "flex",
          gap: "12px",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me a question or type 'schedule call'..."
          style={{
            flex: 1,
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "14px 18px",
            color: "var(--text-primary)",
            outline: "none",
            fontSize: "0.95rem",
            transition: "all 0.2s ease",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="btn-primary"
          style={{
            padding: "0 24px",
            borderRadius: "10px",
            fontSize: "0.95rem",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
