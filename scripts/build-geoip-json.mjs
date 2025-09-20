// Build geoip JSON files from Loyalsoldier/v2ray-rules-dat geoip.dat
// - Downloads latest geoip.dat from jsDelivr release (or use GEOIP_DAT_PATH)
// - Parses with protobufjs (Xray proto for GeoIPList)
// - Emits per-category JSON to dist/geoip-json/<name>.json with { name, cidr4, cidr6 }
// - Emits geoip-index.json mapping name -> https://direct.sleepstars.de/geoip/<name>
//
// Node 18+ required.

import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import protobuf from "protobufjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, "..", "dist");
const OUT_JSON_DIR = path.join(OUT_DIR, "geoip-json");
const INDEX_JSON_PATH = path.resolve(__dirname, "..", "geoip-index.json");

const GEOIP_DAT_URL =
  "https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat";

// Minimal proto for geoip.dat
const PROTO = `
syntax = "proto3";
package xray.app.router;

message CIDR { bytes ip = 1; uint32 prefix = 2; }

message GeoIP {
  string country_code = 1; // category name
  repeated CIDR cidr = 2;
}

message GeoIPList { repeated GeoIP entry = 1; }
`;

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const downloadArrayBuffer = async (url) => {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  return await res.arrayBuffer();
};

const decodeGeoIPList = (buf) => {
  const root = protobuf.parse(PROTO, { keepCase: true }).root;
  const GeoIPList = root.lookupType("xray.app.router.GeoIPList");
  const message = GeoIPList.decode(new Uint8Array(buf));
  const object = GeoIPList.toObject(message, { longs: String });
  return object; // { entry: [ { country_code, cidr: [ { ip, prefix } ] } ] }
};

const toIPv4String = (u8) => {
  if (!u8 || u8.length !== 4) return null;
  return `${u8[0]}.${u8[1]}.${u8[2]}.${u8[3]}`;
};

const toIPv6String = (u8) => {
  if (!u8 || u8.length !== 16) return null;
  const words = [];
  for (let i = 0; i < 16; i += 2) {
    words.push((u8[i] << 8) | u8[i + 1]);
  }
  // Find longest zero run for :: compression
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (words[i] === 0) {
      if (curStart === -1) curStart = i;
      curLen++;
    } else {
      if (curLen > bestLen) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curStart = -1;
      curLen = 0;
    }
  }
  if (curLen > bestLen) {
    bestStart = curStart;
    bestLen = curLen;
  }
  if (bestLen < 2) {
    bestStart = -1; // do not compress a single 0
  }
  const parts = [];
  let i = 0;
  while (i < 8) {
    if (i === bestStart) {
      parts.push("");
      i += bestLen;
      if (i >= 8) parts.push("");
      continue;
    }
    parts.push(words[i].toString(16));
    i++;
  }
  return parts.join(":").replace(/^:/, "::").replace(/:$/, "::");
};

const main = async () => {
  let buf;
  const local = process.env.GEOIP_DAT_PATH || process.env.GEO_DAT_PATH;
  if (local) {
    console.log("Using local geoip.dat:", local);
    const b = await fsp.readFile(local);
    buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  } else {
    console.log("Downloading geoip.dat from", GEOIP_DAT_URL);
    buf = await downloadArrayBuffer(GEOIP_DAT_URL);
  }
  console.log("Downloaded", (buf.byteLength / (1024 * 1024)).toFixed(2), "MB");

  console.log("Decoding geoip.dat ...");
  const list = decodeGeoIPList(buf);
  const entries = list.entry || [];
  console.log("Decoded groups:", entries.length);

  await ensureDir(OUT_JSON_DIR);

  const groups = [];
  for (const g of entries) {
    const name = String(g.country_code || "").trim();
    if (!name) continue;
    const cidrs = Array.isArray(g.cidr) ? g.cidr : [];
    const v4 = [];
    const v6 = [];
    for (const c of cidrs) {
      const ip = c.ip instanceof Uint8Array ? c.ip : new Uint8Array(c.ip?.data || c.ip || []);
      const prefix = Number(c.prefix || 0);
      if (ip.length === 4) {
        const s = toIPv4String(ip);
        if (s) v4.push(`${s}/${prefix}`);
      } else if (ip.length === 16) {
        const s = toIPv6String(ip);
        if (s) v6.push(`${s}/${prefix}`);
      }
    }
    v4.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    v6.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    const out = { name, cidr4: v4, cidr6: v6 };
    await fsp.writeFile(path.join(OUT_JSON_DIR, `${name}.json`), JSON.stringify(out) + "\n", "utf8");
    groups.push(name);
  }

  groups.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  const indexMap = {};
  for (const name of groups) {
    indexMap[name] = `https://direct.sleepstars.de/geoip/${name}`;
  }
  await fsp.writeFile(INDEX_JSON_PATH, JSON.stringify(indexMap) + "\n", "utf8");

  console.log("Done. Files written:");
  console.log(" -", INDEX_JSON_PATH);
  console.log(" -", OUT_JSON_DIR, "(per-group JSON)");
};

main().catch((err) => {
  console.error("Failed to build geoip JSON:", err);
  process.exit(1);
});

