// Build Cloudflare D1 seed SQL from existing geosite / geoip JSON outputs.
// Usage:
//   node scripts/build-d1-sql.mjs
// Result:
//   dist/d1/seed.sql (use wrangler d1 execute ... --file dist/d1/seed.sql)

import fsp from "node:fs/promises";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(REPO_ROOT, "dist");
const GEOSITE_JSON_DIR = path.join(DIST_DIR, "geosite-json");
const GEOIP_JSON_DIR = path.join(DIST_DIR, "geoip-json");
const OUT_SQL_DIR = path.join(DIST_DIR, "d1");
const OUT_SQL_PATH = path.join(OUT_SQL_DIR, "seed.sql");

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const escapeSql = (value) => {
  return value.replace(/'/g, "''");
};

const toLowerArray = (arr) => arr.map((item) => item.toLowerCase());

const chunkArray = (arr, size) => {
  if (size <= 0) return [arr];
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const reverseDomain = (value) => {
  const trimmed = value.trim().replace(/^\*\./, "").replace(/\.+$/, "");
  if (!trimmed) return null;
  const parts = trimmed.split(".").filter(Boolean);
  if (parts.length === 0) return null;
  return parts.reverse().join(".");
};

const D1_SCHEMA_VERSION = 2;

const getGeositeFiles = async () => {
  const entries = await fsp.readdir(GEOSITE_JSON_DIR, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(GEOSITE_JSON_DIR, entry.name))
    .sort();
};

const getGeoipFiles = async () => {
  const entries = await fsp.readdir(GEOIP_JSON_DIR, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(GEOIP_JSON_DIR, entry.name))
    .sort();
};

const ipv4Range = (cidr) => {
  const [ipPart, prefixPart] = cidr.split("/");
  const prefix = Number(prefixPart);
  if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }
  const octets = ipPart.split(".");
  if (octets.length !== 4) return null;
  let base = 0;
  for (const oct of octets) {
    const n = Number(oct);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    base = (base << 8) | (n & 0xff);
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const start = base & mask;
  const end = start | (0xffffffff >>> prefix);
  return { start, end, prefix };
};

const ipv6ToBigInt = (ip) => {
  if (!ip.includes(":")) return null;
  const [head, tail] = ip.split("::");
  const headParts = head ? head.split(":").filter(Boolean) : [];
  const tailParts = tail ? tail.split(":").filter(Boolean) : [];
  const missing = 8 - (headParts.length + tailParts.length);
  if (missing < 0) return null;
  const parts = [...headParts];
  for (let i = 0; i < missing; i += 1) parts.push("0");
  parts.push(...tailParts);
  if (parts.length !== 8) return null;
  let value = 0n;
  for (const part of parts) {
    if (part.includes(".")) {
      const v4 = ipv4Range(part + "/32");
      if (!v4) return null;
      value = (value << 32n) | BigInt(v4.start >>> 16);
      value = (value << 16n) | BigInt(v4.start & 0xffff);
    } else {
      const parsed = parseInt(part || "0", 16);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffff) return null;
      value = (value << 16n) | BigInt(parsed);
    }
  }
  return value;
};

const ipv6Range = (cidr) => {
  const [ipPart, prefixPart] = cidr.split("/");
  const prefix = Number(prefixPart);
  if (!Number.isFinite(prefix) || prefix < 0 || prefix > 128) {
    return null;
  }
  const base = ipv6ToBigInt(ipPart.toLowerCase());
  if (base === null) return null;
  const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
  const start = base & mask;
  const end = start | (~mask & ((1n << 128n) - 1n));
  const split = (value) => {
    const hi = Number((value >> 64n) & ((1n << 64n) - 1n));
    const lo = Number(value & ((1n << 64n) - 1n));
    return { hi, lo };
  };
  return {
    startHex: start.toString(16).padStart(32, "0"),
    endHex: end.toString(16).padStart(32, "0"),
    prefix,
  };
};

const buildGeositeStatements = async () => {
  const files = await getGeositeFiles();
  const statements = [];
  let duplicateRuleCount = 0;
  statements.push("CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  statements.push(
    `INSERT INTO schema_meta (key, value) VALUES ('d1_schema_version', '${D1_SCHEMA_VERSION}')\n` +
      "  ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
  );
  statements.push(`PRAGMA user_version = ${D1_SCHEMA_VERSION};`);
  statements.push(
    "CREATE TABLE IF NOT EXISTS geosite_list (\n" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,\n" +
      "  name TEXT UNIQUE NOT NULL,\n" +
      "  rule_count INTEGER NOT NULL,\n" +
      "  attrs TEXT NOT NULL DEFAULT '[]'\n" +
      ");"
  );
  statements.push(
    "CREATE TABLE IF NOT EXISTS geosite_rule (\n" +
      "  list_id INTEGER NOT NULL,\n" +
      "  type TEXT NOT NULL,\n" +
      "  value TEXT NOT NULL,\n" +
      "  value_lower TEXT NOT NULL,\n" +
      "  value_rev TEXT,\n" +
      "  attrs TEXT NOT NULL,\n" +
      "  PRIMARY KEY (list_id, type, value),\n" +
      "  FOREIGN KEY (list_id) REFERENCES geosite_list(id)\n" +
      ");"
  );
  statements.push("CREATE INDEX IF NOT EXISTS geosite_rule_value_idx ON geosite_rule(value_lower);");
  statements.push("CREATE INDEX IF NOT EXISTS geosite_rule_type_idx ON geosite_rule(type, value_lower);");
  statements.push("CREATE INDEX IF NOT EXISTS geosite_rule_list_idx ON geosite_rule(list_id);");
  statements.push("CREATE INDEX IF NOT EXISTS geosite_rule_rev_idx ON geosite_rule(value_rev);");
  statements.push("DELETE FROM geosite_rule;");
  statements.push("DELETE FROM geosite_list;");

  let listId = 0;
  const ruleRows = [];
  for (const file of files) {
    const raw = await fsp.readFile(file, "utf8");
    const json = JSON.parse(raw);
    const name = json.name || path.basename(file, ".json");
    const rules = Array.isArray(json.rules) ? json.rules : [];
    const listAttrSet = new Set();
    const ruleMap = new Map();
    for (const rule of rules) {
      const type = String(rule.type || "domain");
      const value = String(rule.value || "");
      const key = `${type}\u0000${value}`;
      const attrsLower = Array.isArray(rule.attrs)
        ? rule.attrs.map((attr) => String(attr).toLowerCase())
        : [];
      attrsLower.forEach((attr) => listAttrSet.add(attr));
      const existing = ruleMap.get(key);
      if (existing) {
        attrsLower.forEach((attr) => existing.attrs.add(attr));
        duplicateRuleCount += 1;
      } else {
        const valueLower = value.toLowerCase();
        const reverseForType = type === "domain" || type === "full";
        const valueRev = reverseForType ? reverseDomain(valueLower) : null;
        ruleMap.set(key, {
          type,
          value,
          valueLower,
          valueRev,
          attrs: new Set(attrsLower),
        });
      }
    }
    const dedupedRules = Array.from(ruleMap.values());
    const attrsArray = Array.from(listAttrSet).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    listId += 1;
    statements.push(
      `INSERT INTO geosite_list (id, name, rule_count, attrs) VALUES (${listId}, '${escapeSql(
        name
      )}', ${dedupedRules.length}, '${escapeSql(JSON.stringify(attrsArray))}');`
    );
    for (const entry of dedupedRules) {
      const attrsJson = JSON.stringify(
        Array.from(entry.attrs).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
      );
      ruleRows.push({
        listId,
        type: entry.type,
        value: entry.value,
        valueLower: entry.valueLower,
        valueRev: entry.valueRev,
        attrsJson,
      });
    }
  }

  const RULE_CHUNK = 500;
  for (const chunk of chunkArray(ruleRows, RULE_CHUNK)) {
    const values = chunk
      .map(
        (row) =>
          `(${row.listId}, '${escapeSql(row.type)}', '${escapeSql(row.value)}', '${escapeSql(row.valueLower)}', ${
            row.valueRev ? `'${escapeSql(row.valueRev)}'` : "NULL"
          }, '${escapeSql(row.attrsJson)}')`
      )
      .join(",\n");
    statements.push(
      `INSERT INTO geosite_rule (list_id, type, value, value_lower, value_rev, attrs) VALUES\n${values};`
    );
  }

  if (duplicateRuleCount > 0) {
    console.warn(`Deduplicated ${duplicateRuleCount} geosite rule occurrence(s) with identical type/value.`);
  }

  return statements;
};

const buildGeoipStatements = async () => {
  const files = await getGeoipFiles();
  const statements = [];
  statements.push(
    "CREATE TABLE IF NOT EXISTS geoip_list (\n" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,\n" +
      "  name TEXT UNIQUE NOT NULL,\n" +
      "  cidr4_count INTEGER NOT NULL,\n" +
      "  cidr6_count INTEGER NOT NULL\n" +
      ");"
  );
  statements.push(
    "CREATE TABLE IF NOT EXISTS geoip_cidr (\n" +
      "  list_id INTEGER NOT NULL,\n" +
      "  version INTEGER NOT NULL,\n" +
      "  cidr TEXT NOT NULL,\n" +
      "  cidr_lower TEXT NOT NULL,\n" +
      "  start_v4 INTEGER,\n" +
      "  end_v4 INTEGER,\n" +
      "  start_hex TEXT,\n" +
      "  end_hex TEXT,\n" +
      "  prefix INTEGER NOT NULL,\n" +
      "  PRIMARY KEY (list_id, version, cidr),\n" +
      "  FOREIGN KEY (list_id) REFERENCES geoip_list(id)\n" +
      ");"
  );
  statements.push("CREATE INDEX IF NOT EXISTS geoip_cidr_v4_idx ON geoip_cidr(version, start_v4, end_v4);");
  statements.push("CREATE INDEX IF NOT EXISTS geoip_cidr_v6_idx ON geoip_cidr(version, start_hex, end_hex);");
  statements.push("CREATE INDEX IF NOT EXISTS geoip_cidr_list_idx ON geoip_cidr(list_id);");
  statements.push("CREATE INDEX IF NOT EXISTS geoip_cidr_lower_idx ON geoip_cidr(cidr_lower);");
  statements.push("DELETE FROM geoip_cidr;");
  statements.push("DELETE FROM geoip_list;");

  let listId = 0;
  const cidrRows = [];
  for (const file of files) {
    const raw = await fsp.readFile(file, "utf8");
    const json = JSON.parse(raw);
    const name = json.name || path.basename(file, ".json");
    const cidr4 = Array.isArray(json.cidr4) ? json.cidr4 : [];
    const cidr6 = Array.isArray(json.cidr6) ? json.cidr6 : [];
    listId += 1;
    statements.push(
      `INSERT INTO geoip_list (id, name, cidr4_count, cidr6_count) VALUES (${listId}, '${escapeSql(
        name
      )}', ${cidr4.length}, ${cidr6.length});`
    );
    for (const cidr of cidr4) {
      const range = ipv4Range(cidr);
      if (!range) continue;
      cidrRows.push({
        listId,
        version: 4,
        cidr,
        cidrLower: cidr.toLowerCase(),
        start_v4: range.start,
        end_v4: range.end,
        start_hex: null,
        end_hex: null,
        prefix: range.prefix,
      });
    }
    for (const cidr of cidr6) {
      const range = ipv6Range(cidr);
      if (!range) continue;
      cidrRows.push({
        listId,
        version: 6,
        cidr,
        cidrLower: cidr.toLowerCase(),
        start_v4: null,
        end_v4: null,
        start_hex: range.startHex,
        end_hex: range.endHex,
        prefix: range.prefix,
      });
    }
  }

  const CIDR_CHUNK = 400;
  for (const chunk of chunkArray(cidrRows, CIDR_CHUNK)) {
    const values = chunk
      .map((row) => {
        const startV4 = row.start_v4 == null ? "NULL" : row.start_v4;
        const endV4 = row.end_v4 == null ? "NULL" : row.end_v4;
        const startHex = row.start_hex == null ? "NULL" : `'${escapeSql(row.start_hex)}'`;
        const endHex = row.end_hex == null ? "NULL" : `'${escapeSql(row.end_hex)}'`;
        return `(${row.listId}, ${row.version}, '${escapeSql(row.cidr)}', '${escapeSql(
          row.cidrLower
        )}', ${startV4}, ${endV4}, ${startHex}, ${endHex}, ${row.prefix})`;
      })
      .join(",\n");
    statements.push(
      `INSERT INTO geoip_cidr (list_id, version, cidr, cidr_lower, start_v4, end_v4, start_hex, end_hex, prefix) VALUES\n${values};`
    );
  }

  return statements;
};

const main = async () => {
  await ensureDir(OUT_SQL_DIR);
  const chunks = [
    ...(await buildGeositeStatements()),
    ...(await buildGeoipStatements()),
  ];
  await fsp.writeFile(OUT_SQL_PATH, chunks.join("\n") + "\n", "utf8");
  console.log("D1 seed written to", OUT_SQL_PATH);
};

main().catch((error) => {
  console.error("Failed to build D1 SQL seed:", error);
  process.exit(1);
});
