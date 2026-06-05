// ─── Source Types ─────────────────────────────────────────────────────────────
export type DocumentSource = "resume" | "github";

export type ResumeChunkType =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "achievements"
  | "contact"
  | "misc";

export type GitHubChunkType =
  | "repo-overview"
  | "repo-readme"
  | "repo-techstack"
  | "repo-architecture"
  | "repo-commits"
  | "repo-prs"
  | "repo-deployment"
  | "repo-forked-note";

export type ChunkType = ResumeChunkType | GitHubChunkType;

// ─── Document Metadata ────────────────────────────────────────────────────────
export interface ResumeMetadata {
  source: "resume";
  type: ResumeChunkType;
  section: string;
}

export interface GitHubMetadata {
  source: "github";
  type: GitHubChunkType;
  repo: string;
  language?: string;
  homepage?: string;
  has_readme: boolean;
  is_fork: boolean;
  pushed_at: string;
  commit_sha: string;
}

export type DocumentMetadata = ResumeMetadata | GitHubMetadata;

// ─── Core Document Types ──────────────────────────────────────────────────────
export interface RawDocument {
  id: string;
  /** The content that will be embedded (may include prepended context) */
  contextualContent: string;
  /** The original content stored in metadata for display */
  originalContent: string;
  metadata: DocumentMetadata;
}

export interface EmbeddedDocument extends RawDocument {
  embedding: number[];
}

// ─── Pinecone Vector Record ───────────────────────────────────────────────────
export interface PineconeRecord {
  id: string;
  values: number[];
  metadata: Record<string, string | boolean | number>;
}

// ─── Retrieval Result ─────────────────────────────────────────────────────────
export interface RetrievedChunk {
  id: string;
  score: number;
  content: string;
  metadata: DocumentMetadata;
}

// ─── Ingestion State (for change detection) ──────────────────────────────────
export interface RepoIngestionState {
  repo: string;
  commit_sha: string;
  pushed_at: string;
  ingested_at: string;
}
