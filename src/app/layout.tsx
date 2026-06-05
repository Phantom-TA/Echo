import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Tushar Agrawal — AI Persona",
  description:
    "Chat with Tushar's AI Persona — powered by RAG over his resume and public GitHub projects. Ask anything about his skills, experience, or schedule a call.",
  keywords: ["AI Engineer", "Tushar Agrawal", "AI Persona", "RAG", "Voice Agent"],
  authors: [{ name: "Tushar Agrawal" }],
  openGraph: {
    title: "Tushar Agrawal — AI Persona",
    description:
      "An AI persona representing Tushar Agrawal. Ask about his experience, projects, or schedule a meeting.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
