import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SKIP = new Set(
  (process.env.QUALITY_GATE_SKIP ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
);

const KB = 1024;
const JS_GZIP_LIMIT_KB = getNumberEnv('QUALITY_GATE_JS_GZIP_LIMIT_KB', 250);
const CSS_GZIP_LIMIT_KB = getNumberEnv('QUALITY_GATE_CSS_GZIP_LIMIT_KB', 50);
const AUDIT_REGISTRY = process.env.QUALITY_GATE_AUDIT_REGISTRY ?? 'https://registry.npmjs.org/';
const COVERAGE_THRESHOLDS = {
  lines: getNumberEnv('QUALITY_GATE_COVERAGE_LINES', 80),
  statements: getNumberEnv('QUALITY_GATE_COVERAGE_STATEMENTS', 80),
  functions: getNumberEnv('QUALITY_GATE_COVERAGE_FUNCTIONS', 80),
  branches: getNumberEnv('QUALITY_GATE_COVERAGE_BRANCHES', 70),
};

const steps = [
  { name: 'format', cmd: ['npm', 'run', 'format'] },
  { name: 'lint', cmd: ['npm', 'run', 'lint', '--', '--max-warnings=0'] },
  { name: 'build', cmd: ['npm', 'run', 'build'] },
  {
    name: 'coverage',
    cmd: [
      'npm',
      'exec',
      '--',
      'vitest',
      '--run',
      '--config',
      'vitest.unit.config.ts',
      '--coverage',
      '--coverage.reporter=json-summary',
      '--coverage.reporter=text-summary',
      '--coverage.reportsDirectory',
      'coverage',
    ],
  },
  { name: 'test', cmd: ['npm', 'run', 'test'] },
  { name: 'audit', cmd: ['npm', 'audit', '--audit-level=high', '--registry', AUDIT_REGISTRY] },
];

for (const step of steps) {
  runStep(step);
  if (step.name === 'coverage') {
    checkCoverage();
  }
}

checkBundleSizes();

function runStep({ name, cmd }) {
  if (SKIP.has(name)) {
    console.log(`[skip] ${name}`);
    return;
  }
  console.log(`[run] ${name}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function checkCoverage() {
  if (SKIP.has('coverage')) {
    console.log('[skip] coverage check');
    return;
  }
  const summaryPath = path.join('coverage', 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.error(`Missing coverage summary: ${summaryPath}`);
    process.exit(1);
  }
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const total = summary.total ?? {};
  let failed = false;
  for (const [metric, threshold] of Object.entries(COVERAGE_THRESHOLDS)) {
    const pct = total[metric]?.pct;
    if (typeof pct !== 'number') {
      console.error(`Coverage metric missing: ${metric}`);
      failed = true;
      continue;
    }
    if (pct < threshold) {
      console.error(`Coverage ${metric} ${pct}% < ${threshold}%`);
      failed = true;
    } else {
      console.log(`Coverage ${metric} ${pct}% >= ${threshold}%`);
    }
  }
  if (failed) {
    process.exit(1);
  }
}

function checkBundleSizes() {
  if (SKIP.has('size')) {
    console.log('[skip] size');
    return;
  }
  const assetsDir = path.join('dist', 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.error(`Missing build assets: ${assetsDir}`);
    process.exit(1);
  }
  const files = listFiles(assetsDir);
  const totals = { js: 0, css: 0 };
  const maxByType = { js: 0, css: 0 };
  const offenders = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ext !== '.js' && ext !== '.mjs' && ext !== '.css') {
      continue;
    }
    const gzipped = zlib.gzipSync(fs.readFileSync(file));
    const gzSize = gzipped.length;
    if (ext === '.css') {
      totals.css += gzSize;
      maxByType.css = Math.max(maxByType.css, gzSize);
    } else {
      totals.js += gzSize;
      maxByType.js = Math.max(maxByType.js, gzSize);
    }
    const limit = ext === '.css' ? CSS_GZIP_LIMIT_KB * KB : JS_GZIP_LIMIT_KB * KB;
    if (gzSize > limit) {
      offenders.push({ file, size: gzSize, limit });
    }
  }

  const jsLimit = JS_GZIP_LIMIT_KB * KB;
  const cssLimit = CSS_GZIP_LIMIT_KB * KB;
  console.log(
    `Bundle gzip size: js=${formatBytes(totals.js)} (max ${formatBytes(
      maxByType.js
    )}) css=${formatBytes(totals.css)} (max ${formatBytes(maxByType.css)})`
  );

  if (offenders.length > 0) {
    for (const offender of offenders) {
      console.error(
        `${offender.file} gzip size ${formatBytes(offender.size)} > ${formatBytes(offender.limit)}`
      );
    }
    process.exit(1);
  }
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function getNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (Number.isNaN(value)) {
    console.error(`Invalid number for ${name}: ${raw}`);
    process.exit(1);
  }
  return value;
}

function formatBytes(bytes) {
  return `${Math.round(bytes / KB)}KB`;
}
