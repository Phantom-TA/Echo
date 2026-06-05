import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Octokit } from "@octokit/rest";
import { getEmbeddingBatch } from "@/lib/rag/embeddings";
import { upsertDocuments, getPineconeIndex, deleteByRepo } from "@/lib/rag/pinecone";
import { cleanText, addContext, filterMeaningfulCommits, splitText } from "@/lib/rag/chunker";
import type { PineconeRecord } from "@/types/rag";

// ─── Config ────────────────────────────────────────────────────────────────────
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || "Phantom-TA";
const FORKED_REPOS = (process.env.FORKED_REPOS || "EcommerseBackend,matrix.org")
  .split(",")
  .map((r) => r.trim());
const UPDATE_ONLY = process.argv.includes("--update-only");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// ─── Types ─────────────────────────────────────────────────────────────────────
interface RepoData {
  name: string;
  description: string | null;
  language: string | null;
  homepage: string | null;
  isFork: boolean;
  pushedAt: string;
  defaultBranch: string;
  topics: string[];
  readme: string | null;
  packageJson: string | null;
  fileTree: string[];
  commits: CommitEntry[];
  pullRequests: PREntry[];
  latestSha: string;
}

interface CommitEntry {
  sha: string;
  message: string;
  date: string;
  author: string;
}

interface PREntry {
  number: number;
  title: string;
  body: string | null;
  state: string;
  mergedAt: string | null;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────
async function ingestGitHub() {
  console.log(`\n🐙 Starting GitHub Ingestion for @${GITHUB_USERNAME}...\n`);
  console.log(UPDATE_ONLY ? "🔄 Mode: Update only (changed repos)\n" : "🔄 Mode: Full ingestion\n");

  // Ensure Pinecone index exists
  await getPineconeIndex(true);

  // Fetch all public repos
  const repos = await fetchAllRepos();
  console.log(`📦 Found ${repos.length} public repositories.\n`);

  let totalVectors = 0;
  let skipped = 0;

  for (const repo of repos) {
    console.log(`\n─── Processing: ${repo.name} ───`);

    // Fetch full repo data
    const repoData = await fetchRepoData(repo.name, repo.fork, repo.pushed_at ?? "", repo.default_branch ?? "main");

    if (!repoData) {
      console.log(`⚠  Skipping ${repo.name} (failed to fetch data).`);
      skipped++;
      continue;
    }

    // In update-only mode, skip if the repo hasn't changed
    // (We store the SHA in Pinecone metadata; if it matches the current, skip)
    // Note: For simplicity, we always re-ingest in full mode.
    // In update-only mode, we delete and re-ingest changed repos only.
    if (UPDATE_ONLY) {
      console.log(`✅ Would check SHA for ${repo.name} — re-ingesting to be safe.`);
    }

    // Build and embed chunks
    const records = await buildRepoRecords(repoData);

    if (records.length === 0) {
      console.log(`⚠  No embeddable content for ${repo.name}.`);
      skipped++;
      continue;
    }

    // Delete old vectors for this repo before upserting fresh ones
    await deleteByRepo(repo.name);

    // Upsert new vectors
    await upsertDocuments(records);
    totalVectors += records.length;
    console.log(`✅ ${repo.name}: ${records.length} vectors upserted.`);
  }

  console.log(`\n🎉 GitHub ingestion complete!`);
  console.log(`   Repos processed: ${repos.length - skipped}`);
  console.log(`   Repos skipped: ${skipped}`);
  console.log(`   Total vectors upserted: ${totalVectors}`);
}

// ─── Fetch All Public Repos ────────────────────────────────────────────────────
async function fetchAllRepos() {
  const { data } = await octokit.repos.listForUser({
    username: GITHUB_USERNAME,
    type: "all",       // "public" is not valid here; token scope limits to public anyway
    per_page: 100,
    sort: "updated",
  });
  return data;
}

// ─── Fetch Full Repo Data ──────────────────────────────────────────────────────
async function fetchRepoData(
  repoName: string,
  isFork: boolean,
  pushedAt: string,
  defaultBranch: string
): Promise<RepoData | null> {
  try {
    // 1. README
    let readme: string | null = null;
    try {
      const { data } = await octokit.repos.getReadme({
        owner: GITHUB_USERNAME,
        repo: repoName,
      });
      readme = cleanText(Buffer.from(data.content, "base64").toString("utf-8"));
      console.log(`  📖 README: ${readme.length} chars`);
    } catch {
      console.log(`  📖 README: Not found`);
    }

    // 2. package.json or requirements.txt
    let packageJson: string | null = null;
    for (const depFile of ["package.json", "requirements.txt", "pyproject.toml"]) {
      try {
        const { data } = await octokit.repos.getContent({
          owner: GITHUB_USERNAME,
          repo: repoName,
          path: depFile,
        });
        if ("content" in data) {
          packageJson = cleanText(Buffer.from(data.content, "base64").toString("utf-8"));
          console.log(`  📦 Deps (${depFile}): Found`);
          break;
        }
      } catch {
        // not found, try next
      }
    }

    // 3. Top-level file tree
    let fileTree: string[] = [];
    try {
      const { data } = await octokit.git.getTree({
        owner: GITHUB_USERNAME,
        repo: repoName,
        tree_sha: defaultBranch,
      });
      fileTree = data.tree
        .filter((f) => f.type === "blob" || f.type === "tree")
        .map((f) => f.path ?? "")
        .filter((p) => !p.includes("node_modules") && !p.includes(".git"))
        .slice(0, 80); // limit to top 80 entries
      console.log(`  🗂  File tree: ${fileTree.length} entries`);
    } catch {
      console.log(`  🗂  File tree: Could not fetch`);
    }

    // 4. All commits
    const commits = await fetchCommits(repoName, isFork);
    console.log(`  📝 Commits: ${commits.length} (relevant to ${GITHUB_USERNAME})`);

    // 5. All Pull Requests
    const pullRequests = await fetchPullRequests(repoName);
    console.log(`  🔀 PRs: ${pullRequests.length}`);

    // 6. Latest commit SHA
    let latestSha = "";
    try {
      const { data } = await octokit.repos.listCommits({
        owner: GITHUB_USERNAME,
        repo: repoName,
        per_page: 1,
      });
      latestSha = data[0]?.sha ?? "";
    } catch {
      latestSha = pushedAt;
    }

    // 7. Topics
    let topics: string[] = [];
    try {
      const { data } = await octokit.repos.getAllTopics({
        owner: GITHUB_USERNAME,
        repo: repoName,
      });
      topics = data.names ?? [];
    } catch {
      // no topics
    }

    return {
      name: repoName,
      description: null,
      language: null,
      homepage: null,
      isFork,
      pushedAt,
      defaultBranch,
      topics,
      readme,
      packageJson,
      fileTree,
      commits,
      pullRequests,
      latestSha,
    };
  } catch (err) {
    console.error(`  ❌ Error fetching ${repoName}:`, err);
    return null;
  }
}

// ─── Fetch Commits ─────────────────────────────────────────────────────────────
async function fetchCommits(repoName: string, isFork: boolean): Promise<CommitEntry[]> {
  const isForkRepo = FORKED_REPOS.includes(repoName);
  const commits: CommitEntry[] = [];
  let page = 1;

  while (true) {
    try {
      const params: Parameters<typeof octokit.repos.listCommits>[0] = {
        owner: GITHUB_USERNAME,
        repo: repoName,
        per_page: 100,
        page,
        // For forked repos, only get commits by the owner
        ...(isForkRepo ? { author: GITHUB_USERNAME } : {}),
      };

      const { data } = await octokit.repos.listCommits(params);
      if (data.length === 0) break;

      for (const c of data) {
        commits.push({
          sha: c.sha,
          message: c.commit.message.split("\n")[0], // first line only
          date: c.commit.committer?.date ?? "",
          author: c.commit.author?.name ?? "",
        });
      }

      if (data.length < 100) break;
      page++;
    } catch {
      break;
    }
  }

  return commits;
}

// ─── Fetch Pull Requests ──────────────────────────────────────────────────────
async function fetchPullRequests(repoName: string): Promise<PREntry[]> {
  const prs: PREntry[] = [];
  let page = 1;

  while (true) {
    try {
      const { data } = await octokit.pulls.list({
        owner: GITHUB_USERNAME,
        repo: repoName,
        state: "all",
        per_page: 100,
        page,
      });

      if (data.length === 0) break;

      for (const pr of data) {
        // Only store PRs with meaningful descriptions
        const bodyLength = (pr.body ?? "").length;
        if (pr.title.length > 5 || bodyLength > 30) {
          prs.push({
            number: pr.number,
            title: pr.title,
            body: bodyLength > 30 ? pr.body : null,
            state: pr.state,
            mergedAt: pr.merged_at,
          });
        }
      }

      if (data.length < 100) break;
      page++;
    } catch {
      break;
    }
  }

  return prs;
}

// ─── Build Pinecone Records from Repo Data ────────────────────────────────────
async function buildRepoRecords(repo: RepoData): Promise<PineconeRecord[]> {
  const isForkRepo = FORKED_REPOS.includes(repo.name);
  const baseMetadata = {
    source: "github",
    repo: repo.name,
    language: repo.language ?? "Unknown",
    homepage: repo.homepage ?? "",
    has_readme: String(!!repo.readme),
    is_fork: String(isForkRepo),
    pushed_at: repo.pushedAt,
    commit_sha: repo.latestSha,
  };

  const chunks: Array<{ id: string; text: string; originalContent: string; type: string }> = [];

  // ── 1. Repo Overview chunk ────────────────────────────────────────────────
  const overviewParts = [
    `Repository: ${repo.name}`,
    repo.description ? `Description: ${repo.description}` : null,
    repo.language ? `Primary Language: ${repo.language}` : null,
    repo.topics.length > 0 ? `Topics: ${repo.topics.join(", ")}` : null,
    repo.homepage ? `Live URL: ${repo.homepage}` : null,
    isForkRepo ? `Note: This is a forked repository. Only commits and changes by ${GITHUB_USERNAME} are documented.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  chunks.push({
    id: `github-${repo.name}-overview`,
    text: addContext(overviewParts, `GitHub repository overview for ${repo.name} by ${GITHUB_USERNAME}`),
    originalContent: overviewParts,
    type: "repo-overview",
  });

  // ── 2. README chunks ──────────────────────────────────────────────────────
  if (repo.readme) {
    const readmeChunks = repo.readme.length > 2000
      ? splitText(repo.readme, 1500, 150)
      : [repo.readme];

    for (let i = 0; i < readmeChunks.length; i++) {
      chunks.push({
        id: `github-${repo.name}-readme-${i}`,
        text: addContext(
          readmeChunks[i],
          `README documentation for ${repo.name} — a ${repo.language ?? "software"} project by ${GITHUB_USERNAME}`
        ),
        originalContent: readmeChunks[i],
        type: "repo-readme",
      });
    }
  }

  // ── 3. Tech stack chunk (package.json / requirements.txt) ─────────────────
  if (repo.packageJson) {
    const techContent = `Tech Stack / Dependencies for ${repo.name}:\n${repo.packageJson.slice(0, 2000)}`;
    chunks.push({
      id: `github-${repo.name}-techstack`,
      text: addContext(techContent, `Dependencies and tech stack for ${repo.name} by ${GITHUB_USERNAME}`),
      originalContent: techContent,
      type: "repo-techstack",
    });
  }

  // ── 4. Architecture / file tree chunk ─────────────────────────────────────
  if (repo.fileTree.length > 0) {
    const treeContent = `File structure for ${repo.name}:\n${repo.fileTree.join("\n")}`;
    chunks.push({
      id: `github-${repo.name}-architecture`,
      text: addContext(treeContent, `Project file structure and architecture for ${repo.name} by ${GITHUB_USERNAME}`),
      originalContent: treeContent,
      type: "repo-architecture",
    });
  }

  // ── 5. Commits chunk ──────────────────────────────────────────────────────
  if (repo.commits.length > 0) {
    const meaningfulMessages = filterMeaningfulCommits(repo.commits.map((c) => c.message));

    if (meaningfulMessages.length > 0) {
      // Batch commits into chunks of 30 messages each
      for (let i = 0; i < meaningfulMessages.length; i += 30) {
        const batch = meaningfulMessages.slice(i, i + 30);
        const commitContent = isForkRepo
          ? `Commits by ${GITHUB_USERNAME} in forked repo ${repo.name}:\n${batch.join("\n")}`
          : `Commit history for ${repo.name}:\n${batch.join("\n")}`;

        chunks.push({
          id: `github-${repo.name}-commits-${Math.floor(i / 30)}`,
          text: addContext(commitContent, `Development history for ${repo.name} by ${GITHUB_USERNAME}`),
          originalContent: commitContent,
          type: "repo-commits",
        });
      }
    }
  } else if (isForkRepo) {
    // Forked repo with no commits by owner
    const forkNote = `${repo.name} is a forked repository. ${GITHUB_USERNAME} has not made any custom commits or pull requests to this fork.`;
    chunks.push({
      id: `github-${repo.name}-forked-note`,
      text: addContext(forkNote, `Note about forked repository ${repo.name}`),
      originalContent: forkNote,
      type: "repo-forked-note",
    });
  }

  // ── 6. Pull Requests chunk ────────────────────────────────────────────────
  if (repo.pullRequests.length > 0) {
    const prContent = repo.pullRequests
      .map((pr) => {
        const parts = [`PR #${pr.number}: ${pr.title} [${pr.state}]`];
        if (pr.body) parts.push(pr.body.slice(0, 500));
        if (pr.mergedAt) parts.push(`Merged: ${pr.mergedAt}`);
        return parts.join("\n");
      })
      .join("\n\n---\n\n");

    // Split if too large
    const prChunks = prContent.length > 2000 ? splitText(prContent, 1500, 100) : [prContent];
    for (let i = 0; i < prChunks.length; i++) {
      chunks.push({
        id: `github-${repo.name}-prs-${i}`,
        text: addContext(prChunks[i], `Pull requests for ${repo.name} by ${GITHUB_USERNAME}`),
        originalContent: prChunks[i],
        type: "repo-prs",
      });
    }
  }

  // ── 7. Generate embeddings and build records ──────────────────────────────
  if (chunks.length === 0) return [];

  const embeddings = await getEmbeddingBatch(chunks.map((c) => c.text));

  return chunks.map((chunk, i) => ({
    id: chunk.id,
    values: embeddings[i],
    metadata: {
      ...baseMetadata,
      type: chunk.type,
      originalContent: chunk.originalContent.slice(0, 2000), // Pinecone metadata limit
    },
  }));
}

// ─── Run ───────────────────────────────────────────────────────────────────────
ingestGitHub().catch((err) => {
  console.error("❌ GitHub ingestion failed:", err);
  process.exit(1);
});
