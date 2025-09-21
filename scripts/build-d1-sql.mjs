// Build Cloudflare D1 incremental segments and manifest from geosite / geoip JSON outputs.
// Usage:
//   node scripts/build-d1-sql.mjs
// Result:
//   dist/d1/base.sql           (schema + triggers)
//   dist/d1/segments/geosite/* (per-geosite list SQL segments)
//   dist/d1/segments/geoip/*   (per-geoip list SQL segments)

import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(REPO_ROOT, "dist");
const GEOSITE_JSON_DIR = path.join(DIST_DIR, "geosite-json");
const GEOIP_JSON_DIR = path.join(DIST_DIR, "geoip-json");
const D1_DIR = path.join(DIST_DIR, "d1");
const BASE_SQL_PATH = path.join(D1_DIR, "base.sql");
const SEGMENTS_DIR = path.join(D1_DIR, "segments");
const GEOSITE_SEGMENTS_DIR = path.join(SEGMENTS_DIR, "geosite");
const GEOIP_SEGMENTS_DIR = path.join(SEGMENTS_DIR, "geoip");

const D1_SCHEMA_VERSION = 2;
const GEOSITE_RULE_CHUNK = 2000;
const GEOIP_CIDR_CHUNK = 2000;

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const sha256String = (value) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};

const writeFileWithHash = async (filePath, content) => {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, normalized, "utf8");
  return {
    path: filePath,
    size: Buffer.byteLength(normalized, "utf8"),
    sha256: sha256String(normalized),
  };
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
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      return null;
    }
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
      const v4 = ipv4Range(`${part}/32`);
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
  const startHex = start.toString(16).padStart(32, "0");
  const endHex = end.toString(16).padStart(32, "0");
  return { startHex, endHex, prefix };
};

const readJsonFile = async (filePath) => {
  const raw = await fsp.readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const listJsonFiles = async (dir) => {
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
};

const buildBaseSql = () => {
  const statements = [];
  statements.push("BEGIN TRANSACTION;");
  statements.push(
    "CREATE TABLE IF NOT EXISTS schema_meta (" +
      "  key TEXT PRIMARY KEY," +
      "  value TEXT NOT NULL" +
      ");"
  );
  statements.push(
    "CREATE TABLE IF NOT EXISTS geosite_list (" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "  name TEXT UNIQUE NOT NULL," +
      "  rule_count INTEGER NOT NULL," +
      "  attrs TEXT NOT NULL DEFAULT '[]'" +
      ");"
  );
  statements.push(
    "CREATE TABLE IF NOT EXISTS geosite_rule (" +
      "  list_id INTEGER NOT NULL," +
      "  type TEXT NOT NULL," +
      "  value TEXT NOT NULL," +
      "  value_lower TEXT NOT NULL," +
      "  value_rev TEXT," +
      "  attrs TEXT NOT NULL," +
      "  PRIMARY KEY (list_id, type, value)," +
      "  FOREIGN KEY (list_id) REFERENCES geosite_list(id)" +
      ");"
  );
  statements.push("CREATE INDEX IF NOT EXISTS geosite_rule_value_idx ON geosite_rule(value_lower);");
  statements.push("CREATE INDEX IF NOT EXISTS geosite_rule_type_idx ON geosite_rule(type, value_lower);");
  statements.push("CREATE INDEX IF NOT EXISTS geosite_rule_list_idx ON geosite_rule(list_id);");
  statements.push("CREATE INDEX IF NOT EXISTS geosite_rule_rev_idx ON geosite_rule(value_rev);");
  statements.push("DROP TRIGGER IF EXISTS geosite_rule_ai;");
  statements.push("DROP TRIGGER IF EXISTS geosite_rule_ad;");
  statements.push("DROP TRIGGER IF EXISTS geosite_rule_au;");
  statements.push("DROP TABLE IF EXISTS geosite_rule_fts;");
  statements.push(
    "CREATE VIRTUAL TABLE geosite_rule_fts USING fts5(" +
      "  value," +
      "  value_rev," +
      "  attrs," +
      "  list_name," +
      "  list_id UNINDEXED," +
      "  type UNINDEXED," +
      "  tokenize = 'unicode61 remove_diacritics 2'" +
      ");"
  );
  statements.push(
    "CREATE TRIGGER geosite_rule_ai AFTER INSERT ON geosite_rule BEGIN" +
      "  INSERT INTO geosite_rule_fts(rowid, value, value_rev, attrs, list_name, list_id, type)" +
      "  VALUES (" +
      "    new.rowid," +
      "    new.value," +
      "    COALESCE(new.value_rev, '')," +
      "    new.attrs," +
      "    COALESCE((SELECT name FROM geosite_list WHERE id = new.list_id), '')," +
      "    new.list_id," +
      "    new.type" +
      "  );" +
      "END;"
  );
  statements.push(
    "CREATE TRIGGER geosite_rule_ad AFTER DELETE ON geosite_rule BEGIN" +
      "  INSERT INTO geosite_rule_fts(geosite_rule_fts, rowid) VALUES ('delete', old.rowid);" +
      "END;"
  );
  statements.push(
    "CREATE TRIGGER geosite_rule_au AFTER UPDATE ON geosite_rule BEGIN" +
      "  INSERT INTO geosite_rule_fts(geosite_rule_fts, rowid) VALUES ('delete', old.rowid);" +
      "  INSERT INTO geosite_rule_fts(rowid, value, value_rev, attrs, list_name, list_id, type)" +
      "  VALUES (" +
      "    new.rowid," +
      "    new.value," +
      "    COALESCE(new.value_rev, '')," +
      "    new.attrs," +
      "    COALESCE((SELECT name FROM geosite_list WHERE id = new.list_id), '')," +
      "    new.list_id," +
      "    new.type" +
      "  );" +
      "END;"
  );
  statements.push(
    "CREATE TABLE IF NOT EXISTS geoip_list (" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "  name TEXT UNIQUE NOT NULL," +
      "  cidr4_count INTEGER NOT NULL," +
      "  cidr6_count INTEGER NOT NULL" +
      ");"
  );
  statements.push(
    "CREATE TABLE IF NOT EXISTS geoip_cidr (" +
      "  list_id INTEGER NOT NULL," +
      "  version INTEGER NOT NULL," +
      "  cidr TEXT NOT NULL," +
      "  cidr_lower TEXT NOT NULL," +
      "  start_v4 INTEGER," +
      "  end_v4 INTEGER," +
      "  start_hex TEXT," +
      "  end_hex TEXT," +
      "  prefix INTEGER NOT NULL," +
      "  PRIMARY KEY (list_id, version, cidr)," +
      "  FOREIGN KEY (list_id) REFERENCES geoip_list(id)" +
      ");"
  );
  statements.push("CREATE INDEX IF NOT EXISTS geoip_cidr_v4_idx ON geoip_cidr(version, start_v4, end_v4);");
  statements.push("CREATE INDEX IF NOT EXISTS geoip_cidr_v6_idx ON geoip_cidr(version, start_hex, end_hex);");
  statements.push("CREATE INDEX IF NOT EXISTS geoip_cidr_list_idx ON geoip_cidr(list_id);");
  statements.push("CREATE INDEX IF NOT EXISTS geoip_cidr_lower_idx ON geoip_cidr(cidr_lower);");
  statements.push(
    `INSERT INTO schema_meta (key, value) VALUES ('d1_schema_version', '${D1_SCHEMA_VERSION}')\n` +
      "  ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
  );
  statements.push("COMMIT;");
  return statements.join("\n");
};

const buildGeositeSegments = async () => {
  const files = await listJsonFiles(GEOSITE_JSON_DIR);
  const segments = [];
  let duplicateRuleCount = 0;
  let totalRuleCount = 0;

  for (const file of files) {
    const json = await readJsonFile(file);
    const name = json.name || path.basename(file, ".json");
    const rules = Array.isArray(json.rules) ? json.rules : [];
    const listAttrSet = new Set();
    const ruleMap = new Map();

    for (const rule of rules) {
      const type = String(rule.type || "domain");
      const value = String(rule.value || "");
      const key = `${type}\u0000${value}`;
      const attrsLower = Array.isArray(rule.attrs)
        ? toLowerArray(rule.attrs.map((attr) => String(attr)))
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
    totalRuleCount += dedupedRules.length;

    const statements = [];
    statements.push("BEGIN TRANSACTION;");
    statements.push(
      `INSERT INTO geosite_list (name, rule_count, attrs) VALUES ('${escapeSql(name)}', ${dedupedRules.length}, '${escapeSql(
        JSON.stringify(attrsArray)
      )}')\n  ON CONFLICT(name) DO UPDATE SET rule_count = excluded.rule_count, attrs = excluded.attrs;`
    );
    statements.push(
      `DELETE FROM geosite_rule WHERE list_id = (SELECT id FROM geosite_list WHERE name = '${escapeSql(name)}');`
    );

    for (const chunk of chunkArray(dedupedRules, GEOSITE_RULE_CHUNK)) {
      const values = chunk
        .map((row) => {
          const typeLiteral = `'${escapeSql(row.type)}'`;
          const valueLiteral = `'${escapeSql(row.value)}'`;
          const valueLowerLiteral = `'${escapeSql(row.valueLower)}'`;
          const valueRevLiteral = row.valueRev ? `'${escapeSql(row.valueRev)}'` : "NULL";
          const attrsJson = `'${escapeSql(
            JSON.stringify(Array.from(row.attrs).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })))
          )}'`;
          return `  (${typeLiteral}, ${valueLiteral}, ${valueLowerLiteral}, ${valueRevLiteral}, ${attrsJson})`;
        })
        .join(",\n");

      statements.push(
        `WITH list AS (\n  SELECT id FROM geosite_list WHERE name = '${escapeSql(name)}'\n),\ninput(type, value, value_lower, value_rev, attrs) AS (\n${values}\n)\nINSERT INTO geosite_rule (list_id, type, value, value_lower, value_rev, attrs)\nSELECT list.id, input.type, input.value, input.value_lower, input.value_rev, input.attrs\nFROM list\nJOIN input;`
      );
    }

    statements.push("COMMIT;");
    const sqlContent = statements.join("\n");
    const filePath = path.join(GEOSITE_SEGMENTS_DIR, `${name}.sql`);
    const fileInfo = await writeFileWithHash(filePath, sqlContent);
    segments.push({
      key: `geosite/${name}`,
      kind: "geosite",
      name,
      path: path.relative(REPO_ROOT, fileInfo.path),
      sha256: fileInfo.sha256,
      size: fileInfo.size,
      ruleCount: dedupedRules.length,
      chunkCount: Math.max(1, Math.ceil(dedupedRules.length / GEOSITE_RULE_CHUNK)),
      attrs: attrsArray,
    });
  }

  return {
    segments,
    totalRuleCount,
    duplicateRuleCount,
    listCount: segments.length,
  };
};

const buildGeoipSegments = async () => {
  const files = await listJsonFiles(GEOIP_JSON_DIR);
  const segments = [];
  let totalCidrs = 0;

  for (const file of files) {
    const json = await readJsonFile(file);
    const name = json.name || path.basename(file, ".json");
    const cidr4 = Array.isArray(json.cidr4) ? json.cidr4 : [];
    const cidr6 = Array.isArray(json.cidr6) ? json.cidr6 : [];
    const rows = [];

    for (const cidr of cidr4) {
      const range = ipv4Range(cidr);
      if (!range) continue;
      rows.push({
        version: 4,
        cidr,
        cidrLower: cidr.toLowerCase(),
        startV4: range.start,
        endV4: range.end,
        startHex: null,
        endHex: null,
        prefix: range.prefix,
      });
    }

    for (const cidr of cidr6) {
      const range = ipv6Range(cidr);
      if (!range) continue;
      rows.push({
        version: 6,
        cidr,
        cidrLower: cidr.toLowerCase(),
        startV4: null,
        endV4: null,
        startHex: range.startHex,
        endHex: range.endHex,
        prefix: range.prefix,
      });
    }

    totalCidrs += rows.length;

    const statements = [];
    statements.push("BEGIN TRANSACTION;");
    statements.push(
      `INSERT INTO geoip_list (name, cidr4_count, cidr6_count) VALUES ('${escapeSql(name)}', ${cidr4.length}, ${cidr6.length})\n  ON CONFLICT(name) DO UPDATE SET cidr4_count = excluded.cidr4_count, cidr6_count = excluded.cidr6_count;`
    );
    statements.push(
      `DELETE FROM geoip_cidr WHERE list_id = (SELECT id FROM geoip_list WHERE name = '${escapeSql(name)}');`
    );

    for (const chunk of chunkArray(rows, GEOIP_CIDR_CHUNK)) {
      const values = chunk
        .map((row) => {
          const versionLiteral = row.version;
          const cidrLiteral = `'${escapeSql(row.cidr)}'`;
          const cidrLowerLiteral = `'${escapeSql(row.cidrLower)}'`;
          const startV4Literal = row.startV4 == null ? "NULL" : row.startV4;
          const endV4Literal = row.endV4 == null ? "NULL" : row.endV4;
          const startHexLiteral = row.startHex == null ? "NULL" : `'${escapeSql(row.startHex)}'`;
          const endHexLiteral = row.endHex == null ? "NULL" : `'${escapeSql(row.endHex)}'`;
          return `  (${versionLiteral}, ${cidrLiteral}, ${cidrLowerLiteral}, ${startV4Literal}, ${endV4Literal}, ${startHexLiteral}, ${endHexLiteral}, ${row.prefix})`;
        })
        .join(",\n");

      statements.push(
        `WITH list AS (\n  SELECT id FROM geoip_list WHERE name = '${escapeSql(name)}'\n),\ninput(version, cidr, cidr_lower, start_v4, end_v4, start_hex, end_hex, prefix) AS (\n${values}\n)\nINSERT INTO geoip_cidr (list_id, version, cidr, cidr_lower, start_v4, end_v4, start_hex, end_hex, prefix)\nSELECT list.id, input.version, input.cidr, input.cidr_lower, input.start_v4, input.end_v4, input.start_hex, input.end_hex, input.prefix\nFROM list\nJOIN input;`
      );
    }

    statements.push("COMMIT;");
    const sqlContent = statements.join("\n");
    const filePath = path.join(GEOIP_SEGMENTS_DIR, `${name}.sql`);
    const fileInfo = await writeFileWithHash(filePath, sqlContent);
    segments.push({
      key: `geoip/${name}`,
      kind: "geoip",
      name,
      path: path.relative(REPO_ROOT, fileInfo.path),
      sha256: fileInfo.sha256,
      size: fileInfo.size,
      cidr4Count: cidr4.length,
      cidr6Count: cidr6.length,
      chunkCount: Math.max(1, Math.ceil(rows.length / GEOIP_CIDR_CHUNK)),
    });
  }

  return {
    segments,
    totalCidrs,
    listCount: segments.length,
  };
};

const main = async () => {
  await ensureDir(DIST_DIR);
  await fsp.rm(D1_DIR, { recursive: true, force: true });
  await ensureDir(GEOSITE_SEGMENTS_DIR);
  await ensureDir(GEOIP_SEGMENTS_DIR);

  const baseSql = buildBaseSql();
  const baseInfo = await writeFileWithHash(BASE_SQL_PATH, baseSql);

  const geosite = await buildGeositeSegments();
  const geoip = await buildGeoipSegments();

  const allSegments = [...geosite.segments, ...geoip.segments].sort((a, b) => a.key.localeCompare(b.key));

  console.log(`D1 base schema written to ${BASE_SQL_PATH} (${baseInfo.size} bytes).`);
  console.log(
    `Geosite segments: ${geosite.listCount} list(s), ${geosite.totalRuleCount} rule(s), ${geosite.duplicateRuleCount} duplicate occurrence(s) merged.`
  );
  console.log(`GeoIP segments: ${geoip.listCount} list(s), ${geoip.totalCidrs} CIDR entry(ies).`);
  console.log(`Segment files written under ${SEGMENTS_DIR} (total ${allSegments.length}).`);
};

main().catch((error) => {
  console.error("Failed to build D1 segments:", error);
  process.exit(1);
});
