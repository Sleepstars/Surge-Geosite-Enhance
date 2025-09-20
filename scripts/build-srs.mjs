// Build sing-box SRS rule-sets from prebuilt geosite JSON
// - Reads dist/geosite-json/<name>.json
// - Applies attribute filters: none, @cn, @!cn
// - Emits SRS binaries to dist/srs/<name>.srs (and <name>@cn.srs, <name>@!cn.srs)
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
const SRC_JSON_DIR = path.join(DIST_DIR, "geosite-json");
const SRS_OUT_DIR = path.join(DIST_DIR, "srs");

const SING_BOX_BIN = process.env.SING_BOX_BIN || "sing-box";

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

const toHeadlessRule = (rules, filter) => {
  const target = filter?.toLowerCase() || null; // "cn" or "!cn" (negation starts with !)
  const neg = target?.startsWith("!") ? true : false;
  const key = neg ? target?.slice(1) : target; // attribute name without '!'

  const agg = {
    domain: [],
    domain_suffix: [],
    domain_keyword: [],
    domain_regex: [],
  };

  for (const r of rules) {
    const attrs = Array.isArray(r.attrs) ? r.attrs.map((a) => String(a).toLowerCase()) : [];
    if (key) {
      const has = attrs.includes(key);
      if ((!neg && !has) || (neg && has)) continue;
    }
    switch (r.type) {
      case "full":
        agg.domain.push(r.value);
        break;
      case "domain":
        agg.domain_suffix.push(r.value);
        break;
      case "keyword":
        agg.domain_keyword.push(r.value);
        break;
      case "regexp":
        agg.domain_regex.push(r.value);
        break;
    }
  }

  // Remove empty arrays to keep source compact
  const headless = {};
  for (const [k, v] of Object.entries(agg)) {
    if (v.length > 0) headless[k] = v;
  }
  return headless;
};

const compileSRS = async (sourcePath, outputPath) => {
  const args = ["rule-set", "compile", "--output", outputPath, sourcePath];
  await execFileP(SING_BOX_BIN, args, { stdio: "inherit" });
};

const main = async () => {
  await ensureDir(SRS_OUT_DIR);

  const files = await listCategoryFiles();
  // Use deterministic ordering
  const names = files.map((f) => f.replace(/\.json$/, "")).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  const filtersEnv = process.env.SRS_FILTERS || "cn,!cn";
  const filters = [null, ...filtersEnv.split(",").map((s) => s.trim()).filter(Boolean)];
  let total = 0;

  for (const name of names) {
    const data = await readCategory(name);
    for (const filter of filters) {
      const rule = toHeadlessRule(data.rules || [], filter);
      if (Object.keys(rule).length === 0) {
        // No entries for this filter; skip emitting
        continue;
      }
      const source = { version: 3, rules: [rule] };
      const srcPath = path.join(SRS_OUT_DIR, `.${name}${filter ? `@${filter}` : ""}.json`);
      const outPath = path.join(SRS_OUT_DIR, `${name}${filter ? `@${filter}` : ""}.srs`);
      await fsp.writeFile(srcPath, JSON.stringify(source), "utf8");
      await compileSRS(srcPath, outPath);
      total++;
    }
  }
  console.log(`SRS build done. Generated ${total} files at ${SRS_OUT_DIR}`);
};

main().catch((err) => {
  console.error("Failed to build SRS:", err);
  process.exit(1);
});
