#!/usr/bin/env node

/**
 * Performance Benchmark Script
 *
 * Measures key performance metrics after Context → Store migration:
 * - Bundle size (main JS and CSS)
 * - Build time
 * - Test execution time
 *
 * Run: node scripts/benchmark.mjs
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const DIST_DIR = 'dist/assets';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(msg, color = '') {
  console.log(`${color}${msg}${colors.reset}`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Measure bundle sizes
 */
function measureBundleSize() {
  log('\n📦 Bundle Size Analysis', colors.bright + colors.cyan);
  log('─'.repeat(50));

  if (!existsSync(DIST_DIR)) {
    log('Building project first...', colors.yellow);
    execSync('npm run build', { stdio: 'inherit' });
  }

  const files = readdirSync(DIST_DIR);
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const cssFiles = files.filter((f) => f.endsWith('.css'));

  let totalJsSize = 0;
  let totalCssSize = 0;
  let mainBundleSize = 0;

  // Main bundles (largest JS file is typically the main app bundle)
  const jsSizes = jsFiles.map((f) => {
    const size = statSync(join(DIST_DIR, f)).size;
    totalJsSize += size;
    return { name: f, size };
  });

  jsSizes.sort((a, b) => b.size - a.size);
  const mainBundle = jsSizes[0];
  mainBundleSize = mainBundle?.size || 0;

  // CSS sizes
  cssFiles.forEach((f) => {
    totalCssSize += statSync(join(DIST_DIR, f)).size;
  });

  const results = {
    mainBundleSize,
    mainBundleName: mainBundle?.name || 'N/A',
    totalJsSize,
    totalCssSize,
    totalSize: totalJsSize + totalCssSize,
    jsFileCount: jsFiles.length,
    cssFileCount: cssFiles.length,
  };

  log(`Main JS Bundle: ${results.mainBundleName}`);
  log(`  Size: ${formatBytes(results.mainBundleSize)}`, colors.green);
  log(`Total JS: ${formatBytes(results.totalJsSize)} (${results.jsFileCount} files)`);
  log(`Total CSS: ${formatBytes(results.totalCssSize)} (${results.cssFileCount} files)`);
  log(`Total Bundle: ${formatBytes(results.totalSize)}`, colors.bright);

  return results;
}

/**
 * Measure build time
 */
function measureBuildTime() {
  log('\n⏱️ Build Time', colors.bright + colors.cyan);
  log('─'.repeat(50));

  // Clean build
  try {
    execSync('rm -rf dist', { stdio: 'pipe' });
  } catch {
    // ignore
  }

  const start = Date.now();
  execSync('npm run build', { stdio: 'pipe' });
  const buildTime = Date.now() - start;

  log(`Build Time: ${formatTime(buildTime)}`, colors.green);

  return { buildTime };
}

/**
 * Measure test execution time
 */
function measureTestTime() {
  log('\n🧪 Test Execution Time', colors.bright + colors.cyan);
  log('─'.repeat(50));

  const start = Date.now();
  try {
    execSync('npm run test:unit', { stdio: 'pipe' });
  } catch {
    // Tests might fail but we still want timing
  }
  const testTime = Date.now() - start;

  log(`Test Execution Time: ${formatTime(testTime)}`, colors.green);

  return { testTime };
}

/**
 * Count source files and lines
 */
function countSourceMetrics() {
  log('\n📊 Source Code Metrics', colors.bright + colors.cyan);
  log('─'.repeat(50));

  // Count stores
  const storeCount = readdirSync('src/stores').filter(
    (f) => f.endsWith('.ts') && !f.includes('.test.')
  ).length;

  // Check if contexts directory exists
  const contextsExist = existsSync('src/contexts');
  const contextCount = contextsExist
    ? readdirSync('src/contexts').filter((f) => f.endsWith('.tsx')).length
    : 0;

  // Count hooks
  const hookCount = readdirSync('src/hooks').filter(
    (f) => f.endsWith('.ts') && !f.includes('.test.')
  ).length;

  log(`Zustand Stores: ${storeCount}`, colors.green);
  log(`React Contexts: ${contextCount}`, contextCount === 0 ? colors.green : colors.yellow);
  log(`Hooks: ${hookCount}`);

  return { storeCount, contextCount, hookCount };
}

/**
 * Main benchmark execution
 */
async function main() {
  log('🚀 Performance Benchmark', colors.bright + colors.cyan);
  log('═'.repeat(50));
  log('Migration: Context → Store (Zustand)');
  log(`Date: ${new Date().toISOString()}`);

  const sourceMetrics = countSourceMetrics();
  const bundleMetrics = measureBundleSize();
  const buildMetrics = measureBuildTime();
  const testMetrics = measureTestTime();

  // Summary
  log('\n📋 Summary', colors.bright + colors.cyan);
  log('═'.repeat(50));

  const summary = {
    date: new Date().toISOString(),
    migration: 'Context → Store',
    status: sourceMetrics.contextCount === 0 ? 'COMPLETE' : 'IN_PROGRESS',
    metrics: {
      ...sourceMetrics,
      ...bundleMetrics,
      ...buildMetrics,
      ...testMetrics,
    },
  };

  console.log('\n```json');
  console.log(JSON.stringify(summary, null, 2));
  console.log('```\n');

  // Final status
  if (sourceMetrics.contextCount === 0) {
    log('✅ Migration Complete: All Contexts removed', colors.green);
  } else {
    log(
      `⚠️ Migration In Progress: ${sourceMetrics.contextCount} Contexts remaining`,
      colors.yellow
    );
  }

  return summary;
}

main().catch(console.error);
