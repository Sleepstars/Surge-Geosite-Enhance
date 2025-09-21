import fsp from "node:fs/promises";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(__dirname, "..");
const SEED_SQL_PATH = path.join(REPO_ROOT, "dist", "d1", "seed.sql");
const CHUNK_DIR = path.join(REPO_ROOT, "dist", "d1", "chunks");
const MAX_STATEMENTS_PER_CHUNK = 1000;
const MAX_CHARS_PER_CHUNK = 200_000;

const readSeedSql = async () => {
  try {
    return await fsp.readFile(SEED_SQL_PATH, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      console.warn(`D1 seed file not found at ${SEED_SQL_PATH}; skipping chunk split.`);
      return null;
    }
    throw error;
  }
};

const splitStatements = (sql) => {
  return sql
    .split(/;\s*(?:\n|$)/g)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => (statement.endsWith(";") ? statement : `${statement};`));
};

const flushChunk = async (chunks, current) => {
  if (current.statements.length === 0) return;
  const index = chunks.length + 1;
  const fileName = `chunk-${String(index).padStart(4, "0")}.sql`;
  const filePath = path.join(CHUNK_DIR, fileName);
  const content = current.statements.join("\n") + "\n";
  await fsp.writeFile(filePath, content, "utf8");
  chunks.push({ filePath, statementCount: current.statements.length });
  current.statements = [];
  current.charCount = 0;
};

const main = async () => {
  const sql = await readSeedSql();
  if (!sql) return;

  const statements = splitStatements(sql);
  if (statements.length === 0) {
    await fsp.rm(CHUNK_DIR, { recursive: true, force: true });
    console.warn("No SQL statements found to chunk.");
    return;
  }

  await fsp.rm(CHUNK_DIR, { recursive: true, force: true });
  await fsp.mkdir(CHUNK_DIR, { recursive: true });

  const chunks = [];
  const current = { statements: [], charCount: 0 };

  for (const statement of statements) {
    const text = statement.endsWith(";") ? statement : `${statement};`;
    const projectedCharCount = current.charCount + text.length + 1;
    const projectedStatementCount = current.statements.length + 1;
    if (
      current.statements.length > 0 &&
      (projectedStatementCount > MAX_STATEMENTS_PER_CHUNK || projectedCharCount > MAX_CHARS_PER_CHUNK)
    ) {
      await flushChunk(chunks, current);
    }
    current.statements.push(text);
    current.charCount += text.length + 1;
  }

  await flushChunk(chunks, current);

  console.log(
    `Split ${statements.length} statement(s) into ${chunks.length} chunk file(s) under ${CHUNK_DIR}.`
  );
};

main().catch((error) => {
  console.error("Failed to split D1 SQL seed into chunks:", error);
  process.exit(1);
});
