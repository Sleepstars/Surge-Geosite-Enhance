// Build sing-box SRS rule-sets from prebuilt geoip JSON
// - Reads dist/geoip-json/<name>.json
// - Emits SRS binaries to dist/srs-geoip/<name>.srs (and <name>@v4.srs, <name>@v6.srs)
// - Requires sing-box CLI available (env SING_BOX_BIN or in PATH)

import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileP = promisify(execFile);

const DIST_DIR = path.resolve(__dirname, "..", "dist");
const SRC_JSON_DIR = path.join(DIST_DIR, "geoip-json");
const SRS_OUT_DIR = path.join(DIST_DIR, "srs-geoip");

const SING_BOX_BIN = process.env.SING_BOX_BIN || "sing-box";

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const listGroupFiles = async () => {
  try {
    const files = await fsp.readdir(SRC_JSON_DIR);
    return files.filter((f) => f.endsWith(".json"));
  } catch (_) {
    return [];
  }
};

const readGroup = async (name) => {
  const filePath = path.join(SRC_JSON_DIR, `${name}.json`);
  const txt = await fsp.readFile(filePath, "utf8");
  return JSON.parse(txt);
};

const toHeadlessRule = (data, filter) => {
  const wantV4 = !filter || filter.toLowerCase() === "v4" || filter.toLowerCase() === "ipv4";
  const wantV6 = !filter || filter.toLowerCase() === "v6" || filter.toLowerCase() === "ipv6";
  const ip_cidr = [];
  if (wantV4 && Array.isArray(data.cidr4)) {
    for (const x of data.cidr4) ip_cidr.push(x);
  }
  if (wantV6 && Array.isArray(data.cidr6)) {
    for (const x of data.cidr6) ip_cidr.push(x);
  }
  if (ip_cidr.length === 0) return null;
  return { ip_cidr };
};

const compileSRS = async (sourcePath, outputPath) => {
  const args = ["rule-set", "compile", "--output", outputPath, sourcePath];
  await execFileP(SING_BOX_BIN, args);
};

const runPool = async (tasks, concurrency) => {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= tasks.length) break;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        results[idx] = e;
        console.error("Task failed:", e);
      }
    }
  });
  await Promise.all(workers);
  return results;
};

const main = async () => {
  await ensureDir(SRS_OUT_DIR);

  const files = await listGroupFiles();
  const names = files.map((f) => f.replace(/\.json$/, "")).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  if (names.length === 0) {
    console.log("No geoip JSON found in", SRC_JSON_DIR, "— run npm run build:geoip first.");
    return;
  }

  const filters = [null, "v4", "v6"]; // build combined, v4-only, v6-only
  const concurrency = Math.max(1, Number(process.env.SRS_CONCURRENCY || 6));
  const tasks = [];

  for (const name of names) {
    const data = await readGroup(name);
    for (const filter of filters) {
      const rule = toHeadlessRule(data, filter);
      if (!rule) continue;
      const source = { version: 3, rules: [rule] };
      const srcPath = path.join(SRS_OUT_DIR, `.${name}${filter ? `@${filter}` : ""}.json`);
      const outPath = path.join(SRS_OUT_DIR, `${name}${filter ? `@${filter}` : ""}.srs`);
      tasks.push(async () => {
        await fsp.writeFile(srcPath, JSON.stringify(source), "utf8");
        await compileSRS(srcPath, outPath);
      });
    }
  }

  console.log(`Compiling ${tasks.length} GeoIP SRS files with concurrency=${concurrency} ...`);
  await runPool(tasks, concurrency);
  console.log(`GeoIP SRS build done. Generated ${tasks.length} files at ${SRS_OUT_DIR}`);
};

main().catch((err) => {
  console.error("Failed to build GeoIP SRS:", err);
  process.exit(1);
});
