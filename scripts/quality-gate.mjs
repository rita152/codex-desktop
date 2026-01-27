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
const SRC_ROOT = path.resolve('src');
const MAX_IMPORT_DEPTH = getNumberEnv('QUALITY_GATE_MAX_IMPORT_DEPTH', 4);
const MAX_PATH_DEPTH = getNumberEnv('QUALITY_GATE_MAX_PATH_DEPTH', 4);
const MAX_REEXPORT_ONLY_FILES = getNumberEnv('QUALITY_GATE_MAX_REEXPORT_ONLY_FILES', 4);
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
checkAbstraction();

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

function checkAbstraction() {
  if (SKIP.has('abstraction')) {
    console.log('[skip] abstraction');
    return;
  }
  if (!fs.existsSync(SRC_ROOT)) {
    console.error(`Missing source root: ${SRC_ROOT}`);
    process.exit(1);
  }

  const files = listFiles(SRC_ROOT).filter((file) => isSourceFile(file));
  const fileSet = new Set(files.map((file) => path.normalize(file)));
  const contents = new Map();
  const reexportOnlyFiles = [];
  const reexportEdges = new Map();
  const depthViolations = [];
  const importDepthViolations = [];
  let maxImportDepth = 0;
  let maxPathDepth = 0;
  let maxPathDepthFile = '';
  let maxImportDepthFile = '';

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    contents.set(file, content);

    const relPath = path.relative(SRC_ROOT, file);
    const pathDepth = relPath.split(path.sep).length - 1;
    if (pathDepth > maxPathDepth) {
      maxPathDepth = pathDepth;
      maxPathDepthFile = file;
    }
    if (pathDepth > MAX_PATH_DEPTH) {
      depthViolations.push({ file, pathDepth });
    }

    for (const spec of getModuleSpecifiers(content)) {
      if (!spec.startsWith('.')) {
        continue;
      }
      const depth = getImportDepth(spec);
      if (depth > maxImportDepth) {
        maxImportDepth = depth;
        maxImportDepthFile = file;
      }
      if (depth > MAX_IMPORT_DEPTH) {
        importDepthViolations.push({ file, spec, depth });
      }
    }

    if (isReexportOnlyModule(content)) {
      reexportOnlyFiles.push(file);
      const targets = getReexportTargets(content)
        .map((spec) => resolveImportPath(file, spec, fileSet))
        .filter(Boolean);
      if (targets.length > 0) {
        reexportEdges.set(file, targets);
      }
    }
  }

  const failures = [];

  if (depthViolations.length > 0) {
    failures.push(
      `Path depth ${maxPathDepth} > ${MAX_PATH_DEPTH} (e.g. ${formatPath(maxPathDepthFile)})`
    );
  } else {
    console.log(
      `Path depth max ${maxPathDepth} <= ${MAX_PATH_DEPTH} (e.g. ${formatPath(maxPathDepthFile)})`
    );
  }

  if (importDepthViolations.length > 0) {
    failures.push(
      `Import depth ${maxImportDepth} > ${MAX_IMPORT_DEPTH} (e.g. ${formatPath(
        maxImportDepthFile
      )})`
    );
  } else {
    console.log(
      `Import depth max ${maxImportDepth} <= ${MAX_IMPORT_DEPTH} (e.g. ${formatPath(
        maxImportDepthFile
      )})`
    );
  }

  if (reexportOnlyFiles.length > MAX_REEXPORT_ONLY_FILES) {
    failures.push(
      `Re-export-only modules ${reexportOnlyFiles.length} > ${MAX_REEXPORT_ONLY_FILES}`
    );
  } else {
    console.log(`Re-export-only modules ${reexportOnlyFiles.length} <= ${MAX_REEXPORT_ONLY_FILES}`);
  }

  const reexportChains = findReexportChains(reexportEdges);
  if (reexportChains.length > 0) {
    failures.push(
      `Re-export chains detected: ${reexportChains
        .slice(0, 3)
        .map((chain) => chain.map(formatPath).join(' -> '))
        .join(' | ')}`
    );
  } else {
    console.log('Re-export chains: none');
  }

  const cycles = findImportCycles(contents, fileSet);
  if (cycles.length > 0) {
    failures.push(
      `Import cycles detected: ${cycles
        .slice(0, 3)
        .map((cycle) => cycle.map(formatPath).join(' -> '))
        .join(' | ')}`
    );
  } else {
    console.log('Import cycles: none');
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
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

function isSourceFile(file) {
  const ext = path.extname(file);
  return ext === '.ts' || ext === '.tsx';
}

function formatPath(filePath) {
  if (!filePath) {
    return 'unknown';
  }
  return path.relative(process.cwd(), filePath);
}

function stripComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function isReexportOnlyModule(content) {
  const lines = stripComments(content).split('\n');
  let hasReexport = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^\s*import\b/.test(line)) {
      continue;
    }
    if (isReexportLine(line)) {
      hasReexport = true;
      continue;
    }
    if (/^\s*export\b/.test(line)) {
      return false;
    }
    return false;
  }
  return hasReexport;
}

function isReexportLine(line) {
  return (
    /^\s*export\s+(?:type\s+)?\{[^}]*\}\s+from\s+['"][^'"]+['"];\s*$/.test(line) ||
    /^\s*export\s+(?:type\s+)?\{[^}]*\}\s+from\s+['"][^'"]+['"]\s*$/.test(line) ||
    /^\s*export\s+\*\s+from\s+['"][^'"]+['"];\s*$/.test(line) ||
    /^\s*export\s+\*\s+from\s+['"][^'"]+['"]\s*$/.test(line)
  );
}

function getReexportTargets(content) {
  const targets = [];
  const regexes = [
    /export\s+(?:type\s+)?\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g,
    /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
  ];
  for (const regex of regexes) {
    let match = null;
    while ((match = regex.exec(content))) {
      targets.push(match[1]);
    }
  }
  return targets;
}

function getModuleSpecifiers(content) {
  const specs = [];
  const regexes = [
    /(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const regex of regexes) {
    let match = null;
    while ((match = regex.exec(content))) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function getImportDepth(specifier) {
  return (specifier.match(/\.\.\//g) || []).length;
}

function resolveImportPath(fromFile, specifier, fileSet) {
  if (!specifier.startsWith('.')) {
    return null;
  }
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [];
  if (path.extname(base)) {
    candidates.push(base);
  } else {
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      candidates.push(`${base}${ext}`);
    }
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      candidates.push(path.join(base, `index${ext}`));
    }
  }
  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (fileSet.has(normalized)) {
      return normalized;
    }
  }
  return null;
}

function findReexportChains(reexportEdges) {
  const chains = [];
  for (const [file, targets] of reexportEdges.entries()) {
    for (const target of targets) {
      if (reexportEdges.has(target)) {
        chains.push([file, target]);
      }
    }
  }
  return chains;
}

function findImportCycles(contents, fileSet) {
  const graph = new Map();
  for (const [file, content] of contents.entries()) {
    const deps = new Set();
    for (const spec of getModuleSpecifiers(content)) {
      const resolved = resolveImportPath(file, spec, fileSet);
      if (resolved) {
        deps.add(resolved);
      }
    }
    graph.set(file, deps);
  }

  const visited = new Set();
  const stack = new Set();
  const cycles = [];
  const pathStack = [];

  function dfs(node) {
    if (stack.has(node)) {
      const index = pathStack.indexOf(node);
      if (index !== -1) {
        cycles.push(pathStack.slice(index).concat(node));
      }
      return;
    }
    if (visited.has(node)) {
      return;
    }
    visited.add(node);
    stack.add(node);
    pathStack.push(node);
    for (const dep of graph.get(node) ?? []) {
      if (cycles.length >= 5) {
        break;
      }
      dfs(dep);
    }
    pathStack.pop();
    stack.delete(node);
  }

  for (const node of graph.keys()) {
    if (cycles.length >= 5) {
      break;
    }
    dfs(node);
  }

  return cycles;
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
