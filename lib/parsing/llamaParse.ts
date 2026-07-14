const LLAMA_CLOUD_BASE_URL = "https://api.cloud.llamaindex.ai";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "ERROR" | "CANCELLED";

// GET /api/v2/parse/{job_id} nests job metadata under `job`; the parsed
// content fields (markdown, markdown_full, text, ...) are top-level
// siblings, populated only when requested via `?expand=...`. Confirmed
// against a real response — the docs' prose ("job.status") undersold that
// this is a literal nesting, not just a way of referring to the field.
interface LlamaParseStatusResponse {
  job: {
    id: string;
    status: JobStatus;
    error_message: string | null;
  };
  markdown?: { pages: { markdown: string }[] } | null;
  markdown_full?: string | null;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("LLAMA_CLOUD_API_KEY is not set.");
  }
  return { Authorization: `Bearer ${apiKey}`, ...extra };
}

async function parseJsonOrThrow<T>(res: Response, step: string): Promise<T> {
  if (!res.ok) {
    throw new Error(`LlamaParse ${step} failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function fetchStatus(jobId: string, expandMarkdown: boolean): Promise<LlamaParseStatusResponse> {
  const url = expandMarkdown
    ? `${LLAMA_CLOUD_BASE_URL}/api/v2/parse/${jobId}?expand=markdown`
    : `${LLAMA_CLOUD_BASE_URL}/api/v2/parse/${jobId}`;
  return parseJsonOrThrow<LlamaParseStatusResponse>(await fetch(url, { headers: authHeaders() }), "status check");
}

// The one PDF -> markdown preprocessing step every extractor will sit behind:
// upload -> start a parse job -> poll until done -> fetch the markdown. Kept
// as plain REST calls (upload/job/poll/result) rather than the LlamaCloud
// SDK so this has no extra dependency beyond the LLAMA_CLOUD_API_KEY env var.
export async function parsePdfToMarkdown(file: { buffer: Buffer; fileName: string }): Promise<string> {
  const uploadForm = new FormData();
  uploadForm.append("file", new Blob([new Uint8Array(file.buffer)], { type: "application/pdf" }), file.fileName);
  uploadForm.append("purpose", "parse");

  const uploaded = await parseJsonOrThrow<{ id: string }>(
    await fetch(`${LLAMA_CLOUD_BASE_URL}/api/v1/beta/files`, {
      method: "POST",
      headers: authHeaders(),
      body: uploadForm,
    }),
    "upload"
  );

  // Unlike the status/result endpoint, the create-job response is flat —
  // its top-level `id` is a real, usable job id (confirmed: polling with it
  // reaches a real job rather than 404ing).
  const created = await parseJsonOrThrow<{ id: string }>(
    await fetch(`${LLAMA_CLOUD_BASE_URL}/api/v2/parse`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id: uploaded.id, tier: "agentic", version: "latest" }),
    }),
    "job creation"
  );

  const startedAt = Date.now();
  let status = await fetchStatus(created.id, false);
  while (status.job.status === "PENDING" || status.job.status === "RUNNING") {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error("LlamaParse job timed out.");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    status = await fetchStatus(created.id, false);
  }

  if (status.job.status !== "COMPLETED") {
    throw new Error(`LlamaParse job ${status.job.status}: ${status.job.error_message ?? "unknown error"}`);
  }

  const result = await fetchStatus(created.id, true);

  if (result.markdown_full) {
    return result.markdown_full;
  }
  const pages = result.markdown?.pages;
  if (pages) {
    return pages.map((page) => page.markdown).join("\n\n---\n\n");
  }

  throw new Error(`LlamaParse result missing markdown. Raw result response: ${JSON.stringify(result)}`);
}
