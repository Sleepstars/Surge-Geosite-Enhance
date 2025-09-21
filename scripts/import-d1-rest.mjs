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
const MANIFEST_PATH = path.join(DIST_D1_DIR, "manifest.json");
const SEGMENTS_ROOT = path.join(DIST_D1_DIR, "segments");

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

const loadManifest = async () => {
  const raw = await fsp.readFile(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
};

const resolveSegmentPath = (relativePath) => {
  return path.resolve(REPO_ROOT, relativePath);
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
      "SELECT segment, kind, name, sha256 FROM seed_manifest;"
    );
    const map = new Map();
    for (const row of rows) {
      if (row?.segment) {
        map.set(row.segment, {
          kind: row.kind,
          name: row.name,
          sha256: row.sha256,
        });
      }
    }
    return map;
  } catch (error) {
    if (/(no such table|does not exist)/i.test(error.message)) {
      return null;
    }
    throw error;
  }
};

const applyBaseSchema = async (baseSqlPath) => {
  const sql = await fsp.readFile(baseSqlPath, "utf8");
  await executeSql("Apply base schema", sql);
  console.log("Base schema applied.");
};

const updateManifestEntry = async (segment, sha256, size) => {
  const sql =
    `INSERT INTO seed_manifest (segment, kind, name, sha256, size, updated_at) VALUES (` +
    `'${escapeLiteral(segment.key)}', '${escapeLiteral(segment.kind)}', '${escapeLiteral(segment.name)}', '${escapeLiteral(sha256)}', ${size}, CURRENT_TIMESTAMP)` +
    `\nON CONFLICT(segment) DO UPDATE SET sha256 = excluded.sha256, size = excluded.size, updated_at = CURRENT_TIMESTAMP;`;
  await executeSql(`Update manifest for ${segment.key}`, sql);
};

const removeManifestEntry = async (segmentKey) => {
  const sql = `DELETE FROM seed_manifest WHERE segment = '${escapeLiteral(segmentKey)}';`;
  await executeSql(`Remove manifest entry ${segmentKey}`, sql);
};

const deleteSegmentData = async (segmentKey, kind, name) => {
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
  await removeManifestEntry(segmentKey);
};

const validateLocalSegment = async (segment) => {
  const absolutePath = resolveSegmentPath(segment.path);
  const stats = await fsp.stat(absolutePath).catch((error) => {
    if (error && error.code === "ENOENT") {
      throw new Error(`Missing local segment file: ${segment.path}`);
    }
    throw error;
  });
  const checksum = await sha256File(absolutePath);
  if (checksum !== segment.sha256) {
    throw new Error(`Checksum mismatch for ${segment.path}: manifest has ${segment.sha256}, file is ${checksum}`);
  }
  return { absolutePath, size: stats.size };
};

const main = async () => {
  const manifest = await loadManifest();
  const localVersion = manifest.schemaVersion;
  const localSegments = new Map(manifest.segments.map((segment) => [segment.key, segment]));

  console.log(`Local manifest: schema version ${localVersion}, ${localSegments.size} segment(s).`);

  let remoteVersion = null;
  let remoteSegments = new Map();

  if (isDryRun) {
    console.log("Dry run enabled; skipping remote state discovery (assuming empty manifest).");
  } else {
    remoteVersion = await loadRemoteSchemaVersion();
    const manifestResult = await loadRemoteManifest();
    if (manifestResult === null) {
      console.log("Remote manifest table missing; base schema will be applied.");
      remoteSegments = new Map();
      remoteVersion = null;
    } else {
      remoteSegments = manifestResult;
    }
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
  for (const segment of localSegments.values()) {
    const remoteMeta = remoteSegments.get(segment.key);
    if (!remoteMeta || remoteMeta.sha256 !== segment.sha256) {
      segmentsToApply.push(segment);
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
    const { absolutePath, size } = await validateLocalSegment(segment);
    console.log(`Updating ${segment.key} (${formatBytes(size)})`);
    const sql = await fsp.readFile(absolutePath, "utf8");
    await executeSql(`Apply segment ${segment.key}`, sql);
    await updateManifestEntry(segment, segment.sha256, size);
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

