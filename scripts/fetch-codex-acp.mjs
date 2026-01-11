import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = "0.8.2";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sh(command, args, options = {}) {
  return execFileSync(command, args, { stdio: "pipe", encoding: "utf8", ...options }).trim();
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function platformPkg() {
  const { platform, arch } = process;
  if (platform === "darwin" && arch === "arm64") return "@zed-industries/codex-acp-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "@zed-industries/codex-acp-darwin-x64";
  if (platform === "linux" && arch === "arm64") return "@zed-industries/codex-acp-linux-arm64";
  if (platform === "linux" && arch === "x64") return "@zed-industries/codex-acp-linux-x64";
  if (platform === "win32" && arch === "arm64") return "@zed-industries/codex-acp-win32-arm64";
  if (platform === "win32" && arch === "x64") return "@zed-industries/codex-acp-win32-x64";
  return null;
}

function platformTargetTriple() {
  const { platform, arch } = process;
  if (platform === "darwin" && arch === "arm64") return "aarch64-apple-darwin";
  if (platform === "darwin" && arch === "x64") return "x86_64-apple-darwin";
  if (platform === "linux" && arch === "arm64") return "aarch64-unknown-linux-gnu";
  if (platform === "linux" && arch === "x64") return "x86_64-unknown-linux-gnu";
  if (platform === "win32" && arch === "arm64") return "aarch64-pc-windows-msvc";
  if (platform === "win32" && arch === "x64") return "x86_64-pc-windows-msvc";
  return null;
}

const pkg = platformPkg();
const target = platformTargetTriple();
if (!pkg || !target) {
  fail(`Unsupported platform/arch: ${process.platform}/${process.arch}`);
}

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, "src-tauri", "bin");
ensureDir(outDir);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-acp-pack-"));
try {
  const tarball = sh("npm", ["pack", `${pkg}@${VERSION}`], { cwd: tmp });
  const tarballPath = path.join(tmp, tarball);

  try {
    execFileSync("tar", ["-xzf", tarballPath], { cwd: tmp, stdio: "inherit" });
  } catch (err) {
    fail(`Failed to extract ${tarball} via 'tar' (is tar installed?): ${err?.message ?? err}`);
  }

  const binName = process.platform === "win32" ? "codex-acp.exe" : "codex-acp";
  const extracted = path.join(tmp, "package", "bin", binName);
  if (!fs.existsSync(extracted)) {
    fail(`Expected binary not found at ${extracted}`);
  }

  const outName = `codex-acp-${target}${process.platform === "win32" ? ".exe" : ""}`;
  const outPath = path.join(outDir, outName);
  fs.copyFileSync(extracted, outPath);
  if (process.platform !== "win32") {
    fs.chmodSync(outPath, 0o755);
  }

  console.log(`Fetched ${pkg}@${VERSION} -> ${path.relative(repoRoot, outPath)}`);
} finally {
  rmrf(tmp);
}

