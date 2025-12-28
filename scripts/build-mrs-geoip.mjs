// Build mihomo MRS rule-sets from prebuilt geoip JSON
// - Reads dist/geoip-json/<name>.json
// - Emits MRS binaries to dist/mrs-geoip/<name>.mrs (and <name>@v4.mrs, <name>@v6.mrs)
// - Requires mihomo CLI available (env MIHOMO_BIN or in PATH)

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
const MRS_OUT_DIR = path.join(DIST_DIR, "mrs-geoip");

const MIHOMO_BIN = process.env.MIHOMO_BIN || "mihomo";

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

const toMihomoYaml = (data, filter) => {
  const wantV4 = !filter || filter.toLowerCase() === "v4" || filter.toLowerCase() === "ipv4";
  const wantV6 = !filter || filter.toLowerCase() === "v6" || filter.toLowerCase() === "ipv6";

  const payload = [];
  if (wantV4 && Array.isArray(data.cidr4)) {
    payload.push(...data.cidr4);
  }
  if (wantV6 && Array.isArray(data.cidr6)) {
    payload.push(...data.cidr6);
  }

  if (payload.length === 0) return null;

  // Return YAML string with payload array
  return `payload:\n${payload.map((v) => `  - ${v}`).join("\n")}`;
};

const compileMRS = async (sourcePath, outputPath) => {
  // mihomo convert-ruleset ipcidr yaml <input> <output>
  const args = ["convert-ruleset", "ipcidr", "yaml", sourcePath, outputPath];
  await execFileP(MIHOMO_BIN, args);
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
  await ensureDir(MRS_OUT_DIR);

  const files = await listGroupFiles();
  const names = files.map((f) => f.replace(/\.json$/, "")).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  if (names.length === 0) {
    console.log("No geoip JSON found in", SRC_JSON_DIR, "— run npm run build:geoip first.");
    return;
  }

  const filters = [null, "v4", "v6"]; // build combined, v4-only, v6-only
  const concurrency = Math.max(1, Number(process.env.MRS_CONCURRENCY || 6));
  const tasks = [];

  for (const name of names) {
    const data = await readGroup(name);
    for (const filter of filters) {
      const yaml = toMihomoYaml(data, filter);
      if (!yaml) continue;
      const srcPath = path.join(MRS_OUT_DIR, `.${name}${filter ? `@${filter}` : ""}.yaml`);
      const outPath = path.join(MRS_OUT_DIR, `${name}${filter ? `@${filter}` : ""}.mrs`);
      tasks.push(async () => {
        await fsp.writeFile(srcPath, yaml, "utf8");
        await compileMRS(srcPath, outPath);
      });
    }
  }

  console.log(`Compiling ${tasks.length} GeoIP MRS files with concurrency=${concurrency} ...`);
  await runPool(tasks, concurrency);
  console.log(`GeoIP MRS build done. Generated ${tasks.length} files at ${MRS_OUT_DIR}`);
};

main().catch((err) => {
  console.error("Failed to build GeoIP MRS:", err);
  process.exit(1);
});
