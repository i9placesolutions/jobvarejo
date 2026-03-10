import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const envFiles = [resolve(rootDir, '.env.local'), resolve(rootDir, '.env')];
const candidateKeys = [
  'POSTGRES_DATABASE_URL',
  'DATABASE_URL',
  'NUXT_POSTGRES_DATABASE_URL',
  'TARGET_DATABASE_URL',
];

function parseDotenv(fileContent) {
  const values = new Map();

  for (const rawLine of fileContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

function loadDatabaseUrl() {
  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;

    const values = parseDotenv(readFileSync(envFile, 'utf8'));
    for (const key of candidateKeys) {
      const rawValue = values.get(key);
      if (!rawValue) continue;

      const sanitizedValue = rawValue
        .replace(/\\n$/, '')
        .replace(/[\r\n]+$/g, '')
        .trim();

      if (sanitizedValue) {
        return {
          envFile,
          key,
          value: sanitizedValue,
        };
      }
    }
  }

  return null;
}

function redactDatabaseUrl(databaseUrl) {
  return databaseUrl.replace(/\/\/([^:/?#]+):([^@/]+)@/, '//$1:***@');
}

const match = loadDatabaseUrl();

if (!match) {
  console.error(
    `Postgres MCP: no database URL found in ${envFiles
      .map((file) => `'${file}'`)
      .join(' or ')}`
  );
  process.exit(1);
}

if (process.argv.includes('--check')) {
  console.log(
    `Postgres MCP ready using ${match.key} from ${match.envFile}: ${redactDatabaseUrl(match.value)}`
  );
  process.exit(0);
}

const child = spawn(
  'npx',
  ['-y', '@modelcontextprotocol/server-postgres', match.value],
  {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(`Postgres MCP: failed to start server: ${error.message}`);
  process.exit(1);
});
