// Build mihomo MRS rule-sets from prebuilt geosite JSON
// - Reads dist/geosite-json/<name>.json
// - Applies attribute filters: none, @cn, @!cn
// - Emits MRS binaries to dist/mrs/<name>.mrs (and <name>@cn.mrs, <name>@!cn.mrs)
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
const SRC_JSON_DIR = path.join(DIST_DIR, "geosite-json");
const MRS_OUT_DIR = path.join(DIST_DIR, "mrs");

const MIHOMO_BIN = process.env.MIHOMO_BIN || "mihomo";

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const listCategoryFiles = async () => {
  const files = await fsp.readdir(SRC_JSON_DIR);
  return files.filter((f) => f.endsWith(".json"));
};

const readCategory = async (name) => {
  const filePath = path.join(SRC_JSON_DIR, `${name}.json`);
  const txt = await fsp.readFile(filePath, "utf8");
  return JSON.parse(txt);
};

const toMihomoYaml = (rules, filter) => {
  const target = filter?.toLowerCase() || null; // "cn" or "!cn" (negation starts with !)
  const neg = target?.startsWith("!") ? true : false;
  const key = neg ? target?.slice(1) : target; // attribute name without '!'

  const payload = [];

  for (const r of rules) {
    const attrs = Array.isArray(r.attrs) ? r.attrs.map((a) => String(a).toLowerCase()) : [];
    if (key) {
      const has = attrs.includes(key);
      if ((!neg && !has) || (neg && has)) continue;
    }

    // Only include domain and full types
    // Skip regexp - mihomo domain behavior doesn't handle regex well
    switch (r.type) {
      case "full":
        payload.push(r.value);
        break;
      case "domain":
        payload.push(r.value);
        break;
      // case "regexp": skip - not supported in mihomo domain behavior
    }
  }

  if (payload.length === 0) return null;

  // Return YAML string with payload array
  return `payload:\n${payload.map((v) => `  - ${v}`).join("\n")}`;
};

const compileMRS = async (sourcePath, outputPath) => {
  // mihomo convert-ruleset domain yaml <input> <output>
  const args = ["convert-ruleset", "domain", "yaml", sourcePath, outputPath];
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

  const files = await listCategoryFiles();
  // Use deterministic ordering
  const names = files.map((f) => f.replace(/\.json$/, "")).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  const filtersEnv = process.env.MRS_FILTERS || "cn,!cn";
  const filters = [null, ...filtersEnv.split(",").map((s) => s.trim()).filter(Boolean)];

  const concurrency = Math.max(1, Number(process.env.MRS_CONCURRENCY || 6));
  const tasks = [];
  for (const name of names) {
    const data = await readCategory(name);
    for (const filter of filters) {
      const yaml = toMihomoYaml(data.rules || [], filter);
      if (!yaml) continue;
      const srcPath = path.join(MRS_OUT_DIR, `.${name}${filter ? `@${filter}` : ""}.yaml`);
      const outPath = path.join(MRS_OUT_DIR, `${name}${filter ? `@${filter}` : ""}.mrs`);
      tasks.push(async () => {
        await fsp.writeFile(srcPath, yaml, "utf8");
        await compileMRS(srcPath, outPath);
      });
    }
  }
  console.log(`Compiling ${tasks.length} MRS files with concurrency=${concurrency} ...`);
  await runPool(tasks, concurrency);
  console.log(`MRS build done. Generated ${tasks.length} files at ${MRS_OUT_DIR}`);
};

main().catch((err) => {
  console.error("Failed to build MRS:", err);
  process.exit(1);
});
