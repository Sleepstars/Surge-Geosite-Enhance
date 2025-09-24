// Prepare chunked SQL and import into Cloudflare D1 using the REST Import API.
// Supports incremental updates based on dist/d1-changed.json produced by sync-r2 (SRS manifest diff).
// Usage:
//   node scripts/import-d1-rest.mjs
// Environment variables:
//   CLOUDFLARE_API_TOKEN (required)
//   CLOUDFLARE_ACCOUNT_ID (required)
//   D1_DATABASE_ID (required)
// Optional:
//   D1_IMPORT_POLL_INTERVAL_MS (default 1000)

import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const API_BASE = "https://api.cloudflare.com/client/v4";
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(REPO_ROOT, "dist");
const DIST_D1_DIR = path.join(DIST_DIR, "d1");
const SEED_SQL_PATH = path.join(DIST_D1_DIR, "seed.sql");
const SEGMENTS_GEOSITE_DIR = path.join(DIST_D1_DIR, "segments", "geosite");
const SEGMENTS_GEOIP_DIR = path.join(DIST_D1_DIR, "segments", "geoip");
const CHUNKS_DIR = path.join(DIST_D1_DIR, "chunks");
const D1_CHANGED_PATH = path.join(DIST_DIR, "d1-changed.json");

const D1_SCHEMA_VERSION = 2;
const MAX_STATEMENTS_PER_CHUNK = 300;

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

const splitStatements = (sql) => {
  return sql
    .split(/;\s*(?:\n|$)/g)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => (statement.endsWith(";") ? statement : `${statement};`));
};

const writeChunkFiles = async (statements) => {
  if (statements.length === 0) {
    return [];
  }
  await fsp.rm(CHUNKS_DIR, { recursive: true, force: true });
  await fsp.mkdir(CHUNKS_DIR, { recursive: true });

  const chunkPaths = [];
  let chunkStatements = [];
  let chunkIndex = 0;

  const flushChunk = async () => {
    if (chunkStatements.length === 0) return;
    chunkIndex += 1;
    const fileName = `chunk-${String(chunkIndex).padStart(4, "0")}.sql`;
    const filePath = path.join(CHUNKS_DIR, fileName);
    const content = chunkStatements.join("\n");
    const normalized = content.endsWith("\n") ? content : `${content}\n`;
    await fsp.writeFile(filePath, normalized, "utf8");
    chunkPaths.push(filePath);
    chunkStatements = [];
  };

  for (const statement of statements) {
    chunkStatements.push(statement);
    if (chunkStatements.length >= MAX_STATEMENTS_PER_CHUNK) {
      // eslint-disable-next-line no-await-in-loop
      await flushChunk();
    }
  }
  await flushChunk();

  return chunkPaths;
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

const queryRows = async (label, sql) => {
  const queryUrl = `${API_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`;
  const data = await fetchJson(
    queryUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    },
    label
  );

  const rows = [];
  const resultArray = Array.isArray(data.result) ? data.result : [];
  for (const entry of resultArray) {
    if (Array.isArray(entry.results)) {
      rows.push(...entry.results);
    }
  }
  return rows;
};

const loadRemoteSchemaVersion = async () => {
  try {
    const rows = await queryRows(
      "Fetch remote schema version",
      "SELECT value FROM schema_meta WHERE key = 'd1_schema_version';"
    );
    if (rows.length === 0) return null;
    return rows[0]?.value ?? null;
  } catch (error) {
    const message = error?.message || "";
    if (/no such table/i.test(message) || /does not exist/i.test(message)) {
      return null;
    }
    throw error;
  }
};

const loadChangedSummary = async () => {
  try {
    const raw = await fsp.readFile(D1_CHANGED_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      geosite: Array.isArray(parsed.geosite) ? parsed.geosite : [],
      geoip: Array.isArray(parsed.geoip) ? parsed.geoip : [],
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    console.warn(`Failed to read ${D1_CHANGED_PATH}; assuming full rebuild.`, error.message || error);
    return null;
  }
};

const readSegmentStatements = async (dir, name) => {
  const filePath = path.join(dir, `${name}.sql`);
  try {
    const sql = await fsp.readFile(filePath, "utf8");
    return splitStatements(sql);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`Segment SQL not found for ${name} at ${filePath}. Run npm run build:d1 first.`);
    }
    throw error;
  }
};

const prepareChunks = async ({ fullRebuild, summary }) => {
  const statements = [];

  if (fullRebuild) {
    const seedSql = await fsp.readFile(SEED_SQL_PATH, "utf8").catch((error) => {
      if (error && error.code === "ENOENT") {
        throw new Error(`Seed SQL missing at ${SEED_SQL_PATH}; run npm run build:d1 first.`);
      }
      throw error;
    });
    statements.push(...splitStatements(seedSql));
    console.log(`Preparing full rebuild from seed.sql with ${statements.length} statement(s).`);
    const chunkPaths = await writeChunkFiles(statements);
    return { chunkPaths, mode: "full" };
  }

  const geositeLists = (summary?.geosite || []).filter(Boolean);
  const geoipLists = (summary?.geoip || []).filter(Boolean);

  if (geositeLists.length === 0 && geoipLists.length === 0) {
    return { chunkPaths: [], mode: "incremental" };
  }

  for (const name of geositeLists) {
    const parts = await readSegmentStatements(SEGMENTS_GEOSITE_DIR, name);
    statements.push(...parts);
  }
  for (const name of geoipLists) {
    const parts = await readSegmentStatements(SEGMENTS_GEOIP_DIR, name);
    statements.push(...parts);
  }

  if (statements.length === 0) {
    return { chunkPaths: [], mode: "incremental" };
  }

  console.log(
    `Preparing incremental update: ${geositeLists.length} geosite and ${geoipLists.length} geoip list(s), ${statements.length} statement(s) total.`
  );
  const chunkPaths = await writeChunkFiles(statements);
  return { chunkPaths, mode: "incremental", geositeLists, geoipLists };
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
  const summary = await loadChangedSummary();
  const remoteSchemaVersion = await loadRemoteSchemaVersion();
  const schemaChanged = remoteSchemaVersion === null || remoteSchemaVersion !== String(D1_SCHEMA_VERSION);

  if (remoteSchemaVersion === null) {
    console.log("Remote schema version unavailable (schema_meta missing).");
  } else {
    console.log(`Remote schema version: ${remoteSchemaVersion}`);
  }

  if (schemaChanged) {
    console.log(
      remoteSchemaVersion === null
        ? "Remote schema version unavailable; performing full rebuild."
        : `Schema version mismatch (remote ${remoteSchemaVersion} != local ${D1_SCHEMA_VERSION}); performing full rebuild.`
    );
  }

  const { chunkPaths, mode, geositeLists = [], geoipLists = [] } = await prepareChunks({
    fullRebuild: schemaChanged || !summary,
    summary,
  });

  if (chunkPaths.length === 0) {
    console.log("No SQL statements to import; skipping D1 sync.");
    return;
  }

  if (mode === "incremental") {
    console.log(
      `Incremental update will apply ${geositeLists.length} geosite and ${geoipLists.length} geoip list(s).`
    );
    if (geositeLists.length > 0) console.log(`  Geosite: ${geositeLists.join(", ")}`);
    if (geoipLists.length > 0) console.log(`  GeoIP: ${geoipLists.join(", ")}`);
  }

  console.log(
    `Prepared ${chunkPaths.length} chunk file(s) under ${CHUNKS_DIR} (<= ${MAX_STATEMENTS_PER_CHUNK} statements per chunk).`
  );

  const importUrl = `${API_BASE}/accounts/${accountId}/d1/database/${databaseId}/import`;
  console.log(`Importing ${chunkPaths.length} SQL chunk(s) into D1 database ${databaseId}.`);
  for (let i = 0; i < chunkPaths.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await importChunk(chunkPaths[i], importUrl, i, chunkPaths.length);
  }

  // Run a light-weight optimize after imports to refresh stats.
  // This uses a small analysis limit to control cost on large datasets.
  console.log("Executing PRAGMA optimize on D1 (analysis_limit=400)...");
  await queryRows("PRAGMA analysis_limit", "PRAGMA analysis_limit=400;");
  await queryRows("PRAGMA optimize", "PRAGMA optimize;");
  console.log("PRAGMA optimize completed.");
};

main().catch((error) => {
  console.error("D1 REST import failed:", error.message);
  process.exit(1);
});
