"use client";

import React from "react";
import ChatWindow from "@/components/ChatWindow";

export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px",
        background: "radial-gradient(circle at 50% 50%, #11111e 0%, #06060c 100%)",
        gap: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          textAlign: "center",
          maxWidth: "700px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(139, 92, 246, 0.1)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
            color: "var(--accent-light)",
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "0.8rem",
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            alignSelf: "center",
          }}
        >
          AI Candidate Representative
        </div>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            background: "linear-gradient(to right, #ffffff, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: "8px 0 0 0",
            letterSpacing: "-0.02em",
          }}
        >
          Echo — Tushar Agrawal&apos;s AI Representative
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "1rem",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          I am Tushar&apos;s AI agent. You can ask me technical questions about my work,
          review my public GitHub code, or schedule a calendar call directly.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ChatWindow />
      </div>

      {/* Profile Footer info */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          marginTop: "12px",
        }}
      >
        <a
          href="https://github.com/Phantom-TA"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          🐙 GitHub: Phantom-TA
        </a>
        <span>•</span>
        <a
          href="https://cal.com/tushar-agrawal"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          📅 Schedule Call
        </a>
        <span>•</span>
        <span>IST Timezone (India)</span>
      </div>
    </main>
  );
}
