// Import Cloudflare D1 seed SQL using the D1 Import REST API with chunked uploads.
// Usage:
//   node scripts/import-d1-rest.mjs
// Environment variables:
//   CLOUDFLARE_API_TOKEN (required)
//   CLOUDFLARE_ACCOUNT_ID (required)
//   D1_DATABASE_ID (required)
//   D1_IMPORT_POLL_INTERVAL_MS (optional, default 1000)

import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const API_BASE = "https://api.cloudflare.com/client/v4";
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_D1_DIR = path.join(REPO_ROOT, "dist", "d1");
const SEED_SQL_PATH = path.join(DIST_D1_DIR, "seed.sql");
const CHUNKS_DIR = path.join(DIST_D1_DIR, "chunks");

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} environment variable is required.`);
  }
  return value;
};

const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
const databaseId = requiredEnv("D1_DATABASE_ID");
const pollIntervalMs = Number(process.env.D1_IMPORT_POLL_INTERVAL_MS || "1000");
const listChunkFiles = async () => {
  const chunks = await fsp
    .readdir(CHUNKS_DIR, { withFileTypes: true })
    .then((entries) =>
      entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
        .map((entry) => path.join(CHUNKS_DIR, entry.name))
        .sort()
    )
    .catch((error) => {
      if (error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    });
  if (chunks.length > 0) {
    return chunks;
  }
  try {
    await fsp.access(SEED_SQL_PATH);
    return [SEED_SQL_PATH];
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error("No SQL seed found. Run npm run build:d1 first.");
    }
    throw error;
  }
};

const fetchJson = async (url, options, label) => {
  const response = await fetch(url, options).catch((error) => {
    throw new Error(`${label}: network error ${error.message}`);
  });
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`${label}: failed to parse JSON (status ${response.status})`);
  }
  if (!response.ok || data.success === false) {
    const errors = Array.isArray(data.errors) && data.errors.length > 0 ? data.errors : null;
    const message = errors ? errors.map((item) => item.message || String(item)).join("; ") : `status ${response.status}`;
    throw new Error(`${label}: ${message}`);
  }
  return data;
};

const importChunk = async (chunkPath, importUrl, chunkIndex, totalChunks) => {
  const label = path.basename(chunkPath);
  console.log(`Starting import for ${label} (${chunkIndex + 1}/${totalChunks})`);
  const contents = await fsp.readFile(chunkPath);
  const md5 = createHash("md5").update(contents).digest("hex");

  const initData = await fetchJson(
    importUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "init",
        etag: md5,
      }),
    },
    `D1 import init (${label})`
  );

  const uploadUrl = initData.result?.upload_url;
  const filename = initData.result?.filename;
  if (!filename) {
    throw new Error(`D1 import init (${label}) did not return a filename.`);
  }

  if (uploadUrl) {
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/sql",
      },
      body: contents,
    }).catch((error) => {
      throw new Error(`Upload to R2 (${label}): network error ${error.message}`);
    });
    if (!uploadResponse.ok) {
      throw new Error(`Upload to R2 (${label}) failed with status ${uploadResponse.status}`);
    }
    const etagHeader = uploadResponse.headers.get("etag");
    if (etagHeader) {
      const normalized = etagHeader.replace(/"/g, "").trim();
      if (normalized && normalized !== md5) {
        throw new Error(`Upload to R2 (${label}) ETag mismatch (expected ${md5}, got ${normalized}).`);
      }
    }
  } else {
    console.log(`Upload skipped for ${label} (server reported existing upload).`);
  }

  const ingestData = await fetchJson(
    importUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "ingest",
        etag: md5,
        filename,
      }),
    },
    `D1 import ingest (${label})`
  );

  const bookmark = ingestData.result?.at_bookmark;
  await pollImport(importUrl, bookmark, label);
  console.log(`Completed import for ${label}.`);
};

const pollImport = async (importUrl, bookmark, label) => {
  if (!bookmark) {
    console.log(`No bookmark returned for ${label}; assuming ingest completed immediately.`);
    return;
  }
  while (true) {
    await sleep(pollIntervalMs);
    const pollData = await fetchJson(
      importUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "poll",
          current_bookmark: bookmark,
        }),
      },
      `D1 import poll (${label})`
    );

    const result = pollData.result || {};
    if (Array.isArray(result.messages) && result.messages.length > 0) {
      for (const message of result.messages) {
        console.log(`[${label}] ${message}`);
      }
    }
    if (result.status === "error") {
      const errorMessage = result.error || "Unknown import error.";
      throw new Error(`D1 import poll (${label}) reported error: ${errorMessage}`);
    }
    if (result.success || result.status === "complete") {
      return;
    }
    if (result.error === "Not currently importing anything.") {
      return;
    }
  }
};

const main = async () => {
  const chunkPaths = await listChunkFiles();
  const importUrl = `${API_BASE}/accounts/${accountId}/d1/database/${databaseId}/import`;
  console.log(`Importing ${chunkPaths.length} SQL chunk(s) into D1 database ${databaseId}.`);
  for (let i = 0; i < chunkPaths.length; i += 1) {
    await importChunk(chunkPaths[i], importUrl, i, chunkPaths.length);
  }
};

main().catch((error) => {
  console.error("D1 REST import failed:", error.message);
  process.exit(1);
});
