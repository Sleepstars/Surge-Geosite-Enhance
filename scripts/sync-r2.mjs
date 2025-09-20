// Incremental R2 upload using a manifest to minimize Class A ops
// - Scans local build outputs and computes sha256 per object
// - Downloads a single manifest from R2 (Class B GET)
// - Uploads ONLY changed/new objects (Class A PUT per changed key)
// - Updates the manifest
//
// Included paths → bucket keys:
//   dist/geosite-json/*.json  → geosite-json/<file>
//   dist/srs/*.srs            → geosite/<file>
//   index.json (repo root)    → geosite/index.json
//
// Usage:
//   R2_BUCKET=<bucket_name> node scripts/sync-r2.mjs
//   # Optional env:
//   #   R2_CONCURRENCY=6  DRY_RUN=1  MANIFEST_KEY=manifests/geosite.json
//
// Requires Wrangler 4.x and auth to the account that owns the bucket.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST_DIR = path.join(REPO_ROOT, "dist");
const SRC_JSON_DIR = path.join(DIST_DIR, "geosite-json");
const SRS_DIR = path.join(DIST_DIR, "srs");
const ROOT_INDEX_JSON = path.join(REPO_ROOT, "index.json");

const DEFAULT_MANIFEST_KEY = process.env.MANIFEST_KEY || "manifests/geosite.json";
const CONCURRENCY = Math.max(1, Number(process.env.R2_CONCURRENCY || 6));
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

// Resolve bucket name: env R2_BUCKET wins; else parse wrangler.toml heuristically
const getBucketName = async () => {
  if (process.env.R2_BUCKET && process.env.R2_BUCKET.trim().length > 0) {
    return process.env.R2_BUCKET.trim();
  }
  const tomlPath = path.join(REPO_ROOT, "wrangler.toml");
  const txt = await fsp.readFile(tomlPath, "utf8");
  // naive parse: first [[r2_buckets]] bucket_name = "..."
  const m = txt.match(/\[\[r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"([^"]+)"/);
  if (m && m[1]) return m[1];
  throw new Error("R2 bucket name not found. Set env R2_BUCKET or wrangler.toml [[r2_buckets]].bucket_name");
};

const walk = async (dir, filterFn) => {
  const res = [];
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        res.push(...(await walk(full, filterFn)));
      } else if (!filterFn || filterFn(full)) {
        res.push(full);
      }
    }
  } catch (_) {
    // ignore missing dirs
  }
  return res;
};

const sha256File = async (file) => {
  const h = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const s = fs.createReadStream(file);
    s.on("error", reject);
    s.on("data", (chunk) => h.update(chunk));
    s.on("end", resolve);
  });
  return h.digest("hex");
};

const contentTypeFor = (file) => {
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".srs")) return "application/octet-stream";
  return "application/octet-stream";
};

const buildLocalPlan = async () => {
  const plan = [];
  // dist/geosite-json → geosite-json/
  const jsonFiles = await walk(SRC_JSON_DIR, (f) => f.endsWith(".json"));
  for (const f of jsonFiles) {
    const key = `geosite-json/${path.basename(f)}`;
    plan.push({ file: f, key, size: (await fsp.stat(f)).size });
  }
  // dist/srs → geosite/
  const srsFiles = await walk(SRS_DIR, (f) => f.endsWith(".srs"));
  for (const f of srsFiles) {
    const key = `geosite/${path.basename(f)}`;
    plan.push({ file: f, key, size: (await fsp.stat(f)).size });
  }
  // repo index.json → geosite/index.json
  try {
    const st = await fsp.stat(ROOT_INDEX_JSON);
    if (st.isFile()) {
      plan.push({ file: ROOT_INDEX_JSON, key: "geosite/index.json", size: st.size });
    }
  } catch (_) {}
  // compute sha256
  for (const p of plan) {
    p.sha256 = await sha256File(p.file);
    p.contentType = contentTypeFor(p.file);
  }
  return plan;
};

const resolveWranglerCmd = () => {
  const bin = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
  const local = path.join(REPO_ROOT, "node_modules", ".bin", bin);
  if (fs.existsSync(local)) return local;
  return bin; // fallback to global
};

const wrangler = async (...args) => {
  const cmd = resolveWranglerCmd();
  const { stdout, stderr } = await execFileP(cmd, args, { cwd: REPO_ROOT });
  return { stdout, stderr };
};

const fetchRemoteManifest = async (bucket, key) => {
  const tmp = path.join(os.tmpdir(), `r2-manifest-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  try {
    // Always use the remote API to avoid local mode inconsistencies
    await wrangler("--remote", "r2", "object", "get", `${bucket}/${key}`, "--file", tmp);
    const txt = await fsp.readFile(tmp, "utf8");
    await fsp.unlink(tmp).catch(() => {});
    return JSON.parse(txt);
  } catch (e) {
    // Treat missing or invalid manifest as empty
    await fsp.unlink(tmp).catch(() => {});
    return { version: 1, generatedAt: 0, entries: {} };
  }
};

const putObject = async (bucket, key, file, contentType) => {
  const args = [
    "--remote",
    "r2",
    "object",
    "put",
    `${bucket}/${key}`,
    "--file",
    file,
    "--content-type",
    contentType,
  ];
  await wrangler(...args);
};

const uploadPlan = async (bucket, manifestKey, localPlan, remoteManifest) => {
  const remoteEntries = remoteManifest?.entries || {};
  const changed = [];
  for (const item of localPlan) {
    const remote = remoteEntries[item.key];
    if (!remote || remote.sha256 !== item.sha256 || remote.size !== item.size) {
      changed.push(item);
    }
  }
  if (changed.length === 0) {
    console.log("All objects up-to-date. No uploads needed.");
    return remoteEntries;
  }
  console.log(`Uploading ${changed.length} changed object(s) with concurrency=${CONCURRENCY} ...`);

  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < changed.length) {
      const i = idx++;
      const it = changed[i];
      if (!it) break;
      if (DRY_RUN) {
        console.log(`[DRY] PUT ${it.key} ← ${path.relative(REPO_ROOT, it.file)} (${it.size} bytes)`);
        continue;
      }
      try {
        await putObject(bucket, it.key, it.file, it.contentType);
        console.log(`PUT ${it.key} (${it.size} bytes)`);
      } catch (e) {
        console.error(`Failed PUT ${it.key}:`, e?.stderr || e?.message || e);
        throw e;
      }
    }
  });
  await Promise.all(workers);

  // Merge manifest entries
  const merged = { ...remoteEntries };
  for (const it of localPlan) {
    merged[it.key] = { sha256: it.sha256, size: it.size };
  }
  // Write new manifest locally, then upload it
  const manifest = { version: 1, generatedAt: Date.now(), entries: merged };
  const tmp = path.join(os.tmpdir(), `r2-manifest-out-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  await fsp.writeFile(tmp, JSON.stringify(manifest));
  if (DRY_RUN) {
    console.log(`[DRY] PUT ${manifestKey} (manifest)`);
  } else {
    await putObject(bucket, manifestKey, tmp, "application/json");
    console.log(`PUT ${manifestKey} (manifest)`);
  }
  await fsp.unlink(tmp).catch(() => {});
  return merged;
};

const main = async () => {
  const bucket = await getBucketName();
  const manifestKey = DEFAULT_MANIFEST_KEY;

  console.log(`Bucket: ${bucket}`);
  console.log(`Manifest key: ${manifestKey}`);
  if (DRY_RUN) console.log("DRY RUN enabled; no writes will occur.");

  const plan = await buildLocalPlan();
  if (plan.length === 0) {
    console.log("No local artifacts found to sync.");
    return;
  }
  // Deterministic order for stable logs
  plan.sort((a, b) => a.key.localeCompare(b.key));

  const remoteManifest = await fetchRemoteManifest(bucket, manifestKey);
  await uploadPlan(bucket, manifestKey, plan, remoteManifest);
};

main().catch((err) => {
  console.error("R2 manifest sync failed:", err);
  process.exit(1);
});
