// Build geosite JSON files from Loyalsoldier/v2ray-rules-dat geosite.dat
// - Downloads latest geosite.dat from jsDelivr release
// - Parses with protobufjs (Xray proto for GeoSiteList)
// - Emits per-category JSON to dist/geosite-json/<name>.json
// - Emits index.json mapping name -> https://direct.sleepstars.de/geosite/<name>
// - Emits data_files.md for README table generation
//
// Node 18+ required.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import protobuf from "protobufjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Write outputs to the repository root (one level up from scripts/)
const OUT_DIR = path.resolve(__dirname, "..", "dist");
const OUT_JSON_DIR = path.join(OUT_DIR, "geosite-json");
const INDEX_JSON_PATH = path.resolve(__dirname, "..", "index.json");
const README_TABLE_PATH = path.resolve(__dirname, "..", "data_files.md");

const GEO_DAT_URL =
  "https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat";

// Minimal proto definitions required to decode geosite.dat
const PROTO = `
syntax = "proto3";
package xray.app.router;

message Domain {
  enum Type { Plain = 0; Regex = 1; Domain = 2; Full = 3; }
  Type type = 1;
  string value = 2;
  message Attribute {
    string key = 1;
    oneof typed_value { bool bool_value = 2; int64 int_value = 3; }
  }
  repeated Attribute attribute = 3;
}

message GeoSite {
  string country_code = 1; // actually category name
  repeated Domain domain = 2;
}

message GeoSiteList { repeated GeoSite entry = 1; }
`;

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const downloadArrayBuffer = async (url) => {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.arrayBuffer();
};

const decodeGeoSiteList = (buf) => {
  const root = protobuf.parse(PROTO, { keepCase: true }).root;
  const GeoSiteList = root.lookupType("xray.app.router.GeoSiteList");
  const message = GeoSiteList.decode(new Uint8Array(buf));
  const object = GeoSiteList.toObject(message, { enums: String, longs: String });
  return object; // { entry: [ { country_code, domain: [ { type, value, attribute: [...] } ] } ] }
};

const domainTypeToRuleType = (type) => {
  // Proto enums stringified via toObject with { enums: String }
  switch (type) {
    case "Domain":
      return "domain"; // DOMAIN-SUFFIX
    case "Full":
      return "full"; // exact
    case "Plain":
      return "keyword"; // substring match
    case "Regex":
      return "regexp";
    default:
      return "domain";
  }
};

const extractAttrs = (attrList) => {
  if (!Array.isArray(attrList)) return [];
  const attrs = [];
  for (const a of attrList) {
    if (!a || typeof a.key !== "string") continue;
    if (Object.prototype.hasOwnProperty.call(a, "bool_value")) {
      if (a.bool_value) attrs.push(a.key);
    } else if (Object.prototype.hasOwnProperty.call(a, "int_value")) {
      // Preserve int attributes as key=value string for completeness
      attrs.push(`${a.key}=${a.int_value}`);
    } else {
      attrs.push(a.key);
    }
  }
  return attrs;
};

const writeJSON = async (filePath, data) => {
  const json = JSON.stringify(data, null, 0);
  await fsp.writeFile(filePath, json + "\n", "utf8");
};

const main = async () => {
  let buf;
  const localGeo = process.env.GEO_DAT_PATH;
  if (localGeo) {
    console.log("Using local geosite.dat:", localGeo);
    const b = await fsp.readFile(localGeo);
    buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  } else {
    console.log("Downloading geosite.dat from", GEO_DAT_URL);
    buf = await downloadArrayBuffer(GEO_DAT_URL);
  }
  console.log("Downloaded", (buf.byteLength / (1024 * 1024)).toFixed(2), "MB");

  console.log("Decoding geosite.dat ...");
  const list = decodeGeoSiteList(buf);
  const entries = list.entry || [];
  console.log("Decoded categories:", entries.length);

  await ensureDir(OUT_JSON_DIR);

  // Collect categories first to allow deterministic sorting
  const categories = [];
  for (const site of entries) {
    const name = String(site.country_code || "").trim();
    if (!name) continue;
    const domains = Array.isArray(site.domain) ? site.domain : [];
    // Normalize attributes and ensure stable ordering
    const rules = domains
      .map((d) => ({
        type: domainTypeToRuleType(d.type),
        value: String(d.value || "").trim(),
        attrs: extractAttrs(d.attribute).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
      }))
      // Sort rules for deterministic output within each category
      .sort((a, b) => {
        if (a.type === b.type) return a.value.localeCompare(b.value, "en", { sensitivity: "base" });
        return a.type.localeCompare(b.type, "en", { sensitivity: "base" });
      });
    categories.push({ name, rules });
  }

  // Sort categories by name for stable README and index.json
  categories.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  // Write per-category JSON files
  for (const { name, rules } of categories) {
    const outPath = path.join(OUT_JSON_DIR, `${name}.json`);
    await writeJSON(outPath, { name, rules });
  }

  // Build sorted index.json (object keys inserted in sorted order)
  const indexMapSorted = {};
  for (const { name } of categories) {
    indexMapSorted[name] = `https://direct.sleepstars.de/geosite/${name}`;
  }
  await writeJSON(INDEX_JSON_PATH, indexMapSorted);

  // Build sorted README table
  const tableLines = ["| Name | Link |", "|------|------|"];
  for (const { name } of categories) {
    const link = `https://direct.sleepstars.de/geosite/${name}`;
    tableLines.push(`| ${name} | ${link} |`);
  }
  await fsp.writeFile(README_TABLE_PATH, tableLines.join("\n") + "\n", "utf8");

  console.log("Done. Files written:");
  console.log(" -", INDEX_JSON_PATH);
  console.log(" -", README_TABLE_PATH);
  console.log(" -", OUT_JSON_DIR, "(per-category JSON)");
};

main().catch((err) => {
  console.error("Failed to build geosite JSON:", err);
  process.exit(1);
});
