// Incrementally sync Cloudflare D1 with locally generated segments using the REST query API.
// Usage:
//   node scripts/import-d1-rest.mjs
// Environment variables (required unless DRY_RUN=1):
//   CLOUDFLARE_API_TOKEN
//   CLOUDFLARE_ACCOUNT_ID
//   D1_DATABASE_ID
// Optional:
//   DRY_RUN=1               Print actions without executing remote mutations

import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const API_BASE = "https://api.cloudflare.com/client/v4";
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_D1_DIR = path.join(REPO_ROOT, "dist", "d1");
const BASE_SQL_PATH = path.join(DIST_D1_DIR, "base.sql");
const D1_SCHEMA_VERSION = 2;

const isDryRun = ["1", "true", "yes"].includes(String(process.env.DRY_RUN || "").toLowerCase());

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value && !isDryRun) {
    throw new Error(`${key} environment variable is required.`);
  }
  return value || null;
};

const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
const databaseId = requiredEnv("D1_DATABASE_ID");
const queryUrl = !isDryRun && accountId && databaseId
  ? `${API_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`
  : null;

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const escapeLiteral = (value) => {
  return value.replace(/'/g, "''");
};

const sha256File = async (filePath) => {
  const content = await fsp.readFile(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
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

const executeSql = async (label, sql) => {
  if (isDryRun) {
    console.log(`[dry-run] ${label} (SQL ${sql.length} chars)`);
    return [];
  }
  if (!queryUrl || !apiToken) {
    throw new Error(`${label}: missing query endpoint configuration.`);
  }
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
  const result = data.result;
  if (!Array.isArray(result)) {
    throw new Error(`${label}: unexpected response shape.`);
  }
  for (const entry of result) {
    if (entry?.success === false) {
      const entryErrors = Array.isArray(entry.errors) && entry.errors.length > 0
        ? entry.errors.map((item) => item.message || String(item)).join("; ")
        : entry.error || "Statement failed";
      throw new Error(`${label}: ${entryErrors}`);
    }
  }
  return result;
};

const queryRows = async (label, sql) => {
  const segments = await executeSql(label, sql);
  const rows = [];
  for (const segment of segments) {
    if (Array.isArray(segment.results)) {
      rows.push(...segment.results);
    }
  }
  return rows;
};

const collectLocalSegments = async () => {
  const segmentDirs = [
    { kind: "geosite", dir: path.join(DIST_D1_DIR, "segments", "geosite") },
    { kind: "geoip", dir: path.join(DIST_D1_DIR, "segments", "geoip") },
  ];

  const map = new Map();

  for (const { kind, dir } of segmentDirs) {
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch((error) => {
      if (error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
      const name = entry.name.slice(0, -4);
      const filePath = path.join(dir, entry.name);
      const stats = await fsp.stat(filePath);
      const sha256 = await sha256File(filePath);
      const key = `${kind}/${name}`;
      map.set(key, {
        kind,
        name,
        sha256,
        size: stats.size,
        path: filePath,
      });
    }
  }

  return map;
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
    if (/(no such table|no such column)/i.test(error.message)) {
      return null;
    }
    throw error;
  }
};

const loadRemoteManifest = async () => {
  try {
    const rows = await queryRows(
      "Fetch remote manifest",
      "SELECT value FROM schema_meta WHERE key = 'd1_manifest';"
    );
    if (rows.length === 0) {
      return new Map();
    }
    const raw = rows[0]?.value;
    if (!raw) {
      return new Map();
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.warn("Remote manifest JSON invalid; treating as empty.");
      return new Map();
    }
    const entries = parsed?.segments;
    if (!entries || typeof entries !== "object") {
      return new Map();
    }
    const map = new Map();
    for (const [key, value] of Object.entries(entries)) {
      if (!value || typeof value !== "object") continue;
      map.set(key, {
        kind: value.kind,
        name: value.name,
        sha256: value.sha256,
        size: value.size,
      });
    }
    return map;
  } catch (error) {
    if (/(no such table|no such column)/i.test(error.message)) {
      return new Map();
    }
    throw error;
  }
};

const writeRemoteManifest = async (schemaVersion, segments) => {
  if (isDryRun) {
    console.log("[dry-run] Update remote manifest entry");
    return;
  }
  const payload = {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    segments: Object.fromEntries(
      [...segments.entries()].map(([key, value]) => [key, {
        kind: value.kind,
        name: value.name,
        sha256: value.sha256,
        size: value.size,
      }])
    ),
  };
  const json = escapeLiteral(JSON.stringify(payload));
  const sql =
    `INSERT INTO schema_meta (key, value) VALUES ('d1_manifest', '${json}')\n` +
    "  ON CONFLICT(key) DO UPDATE SET value = excluded.value;";
  await executeSql("Persist remote manifest", sql);
};

const applyBaseSchema = async (baseSqlPath) => {
  const sql = await fsp.readFile(baseSqlPath, "utf8");
  await executeSql("Apply base schema", sql);
  console.log("Base schema applied.");
};

const deleteSegmentData = async (segmentKey, kind, name) => {
  if (!kind || !name) {
    console.warn(`Skipping deletion for ${segmentKey}: missing kind or name metadata.`);
    return;
  }
  const escapedName = escapeLiteral(name);
  if (kind === "geosite") {
    const sql =
      "BEGIN TRANSACTION;\n" +
      `DELETE FROM geosite_rule WHERE list_id = (SELECT id FROM geosite_list WHERE name = '${escapedName}');\n` +
      `DELETE FROM geosite_list WHERE name = '${escapedName}';\n` +
      "COMMIT;";
    await executeSql(`Delete geosite list ${name}`, sql);
  } else if (kind === "geoip") {
    const sql =
      "BEGIN TRANSACTION;\n" +
      `DELETE FROM geoip_cidr WHERE list_id = (SELECT id FROM geoip_list WHERE name = '${escapedName}');\n` +
      `DELETE FROM geoip_list WHERE name = '${escapedName}';\n` +
      "COMMIT;";
    await executeSql(`Delete geoip list ${name}`, sql);
  } else {
    throw new Error(`Unknown segment kind '${kind}' for ${segmentKey}`);
  }
};

const main = async () => {
  const localSegments = await collectLocalSegments();
  const localVersion = D1_SCHEMA_VERSION;

  console.log(`Local segments ready: ${localSegments.size} file(s).`);

  let remoteVersion = null;
  let remoteSegments = new Map();

  if (isDryRun) {
    console.log("Dry run enabled; skipping remote state discovery (assuming empty manifest).");
  } else {
    remoteVersion = await loadRemoteSchemaVersion();
    remoteSegments = await loadRemoteManifest();
  }

  if (!isDryRun) {
    console.log(
      remoteVersion
        ? `Remote schema version: ${remoteVersion}`
        : "Remote schema version unavailable."
    );
  }

  const needsBase = !isDryRun && remoteVersion !== String(localVersion);
  if (needsBase) {
    console.log(
      remoteVersion
        ? `Schema version mismatch (remote ${remoteVersion} != local ${localVersion}); applying base schema.`
        : "Schema metadata missing; applying base schema."
    );
    await applyBaseSchema(BASE_SQL_PATH);
    remoteSegments = new Map();
  } else if (!isDryRun && remoteSegments.size === 0) {
    console.log("Remote manifest is empty; base schema assumed to be current.");
  }

  const segmentsToDelete = [];
  for (const [segmentKey, meta] of remoteSegments.entries()) {
    if (!localSegments.has(segmentKey)) {
      segmentsToDelete.push({ key: segmentKey, ...meta });
    }
  }

  const segmentsToApply = [];
  for (const [segmentKey, segment] of localSegments.entries()) {
    const remoteMeta = remoteSegments.get(segmentKey);
    if (!remoteMeta || remoteMeta.sha256 !== segment.sha256) {
      segmentsToApply.push({ key: segmentKey, ...segment });
    }
  }

  console.log(
    `Planned operations: ${segmentsToApply.length} update(s), ${segmentsToDelete.length} deletion(s).`
  );

  for (const stale of segmentsToDelete) {
    console.log(`Removing stale segment ${stale.key}`);
    await deleteSegmentData(stale.key, stale.kind, stale.name);
  }

  for (const segment of segmentsToApply) {
    console.log(`Updating ${segment.key} (${formatBytes(segment.size)})`);
    const sql = await fsp.readFile(segment.path, "utf8");
    await executeSql(`Apply segment ${segment.key}`, sql);
  }

  if (!isDryRun) {
    await writeRemoteManifest(localVersion, localSegments);
  }

  if (segmentsToApply.length === 0 && segmentsToDelete.length === 0) {
    console.log("No changes required; D1 manifest is up to date.");
  } else {
    console.log("Incremental D1 sync completed.");
  }
};

main().catch((error) => {
  console.error("D1 incremental sync failed:", error.message);
  process.exit(1);
});
