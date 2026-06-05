/**
 * Contextual Chunking Helpers
 *
 * Contextual chunking prepends a short document-level summary to each chunk
 * before embedding. This dramatically improves retrieval accuracy because
 * the embedding model understands *where* the chunk comes from, not just
 * what it says in isolation.
 *
 * Reference: Anthropic's "Contextual Retrieval" research (2024)
 */

export interface TextChunk {
  id: string;
  content: string;
  contextualContent: string;
  section: string;
}

/**
 * Wraps a chunk with its document-level context before embedding.
 * The contextualContent is what gets embedded; originalContent is stored for display.
 */
export function addContext(chunkContent: string, documentContext: string): string {
  return `<document_context>\n${documentContext}\n</document_context>\n\n<chunk>\n${chunkContent}\n</chunk>`;
}

/**
 * Basic text splitter by character count with sentence-boundary awareness.
 * Avoids splitting mid-sentence for cleaner chunks.
 */
export function splitText(text: string, maxChars = 1200, overlapChars = 100): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    // Walk back to the nearest sentence boundary (. ! ?)
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastSentence = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("\n\n")
      );
      if (lastSentence > maxChars * 0.5) {
        end = start + lastSentence + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    // Always advance start forward — overlap must never push us backwards
    const next = end - overlapChars;
    start = next > start ? next : end;
  }

  return chunks.filter((c) => c.length > 50);
}

/**
 * Splits resume text by known section headers.
 * Returns an array of { section, content } pairs.
 */
export function splitResumeIntoSections(text: string): Array<{ section: string; content: string }> {
  const SECTION_HEADERS = [
    "SUMMARY",
    "OBJECTIVE",
    "EXPERIENCE",
    "WORK EXPERIENCE",
    "EMPLOYMENT",
    "EDUCATION",
    "SKILLS",
    "TECHNICAL SKILLS",
    "PROJECTS",
    "ACHIEVEMENTS",
    "CERTIFICATIONS",
    "AWARDS",
    "CONTACT",
  ];

  const sectionPattern = new RegExp(
    `\\n?(${SECTION_HEADERS.join("|")})[:\\s]*\\n`,
    "gi"
  );

  const sections: Array<{ section: string; content: string }> = [];
  const matches = [...text.matchAll(sectionPattern)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const sectionName = match[1].trim().toUpperCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    const content = text.slice(start, end).trim();
    if (content.length > 20) {
      sections.push({ section: sectionName, content });
    }
  }

  // If no sections found, treat the whole text as a single chunk
  if (sections.length === 0) {
    sections.push({ section: "FULL_RESUME", content: text.trim() });
  }

  return sections;
}

/**
 * Cleans raw text extracted from PDFs or GitHub markdown.
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")         // Normalize line endings
    .replace(/\n{3,}/g, "\n\n")     // Collapse excessive blank lines
    .replace(/[ \t]+/g, " ")        // Collapse multiple spaces
    .replace(/[^\S\n]+\n/g, "\n")   // Trim trailing spaces from lines
    .trim();
}

/**
 * Filters out commit messages that are too short or clearly meaningless.
 */
export function filterMeaningfulCommits(messages: string[]): string[] {
  const NOISE_PATTERNS = [
    /^(fix|wip|update|misc|temp|test|initial|init|first commit|chore)$/i,
    /^.{1,12}$/, // Too short (less than 12 chars)
  ];

  return messages.filter((msg) => {
    const trimmed = msg.trim();
    return !NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
  });
}
