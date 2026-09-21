import fs from "fs";
import path from "path";

const distDir = "dist";
const activePages = [
  "index.html",
  "assessment",
  "assurance",
  "enterprise",
  "health-check",
  "partners",
  "quick-scan",
  "remediation"
];
const activeAssets = [
  "assets/img/ciscomaster/executive-risk-summary-v1.png",
  "assets/img/ciscomaster/lifecycle-readiness-matrix-v1.png"
];

function copyFile(src, dest) {
  if (!fs.existsSync(src)) throw new Error(`Required build input missing: ${src}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.lstatSync(srcPath).isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// Ship only the active V3 public surface. Historical pages/assets remain in GitHub.
for (const page of activePages) {
  const srcPath = path.join("src", page);
  const destPath = path.join(distDir, page);
  if (page.endsWith(".html")) copyFile(srcPath, destPath);
  else copyDir(srcPath, destPath);
}

for (const asset of activeAssets) {
  copyFile(path.join("src", asset), path.join(distDir, asset));
}

copyDir("css", path.join(distDir, "css"));

console.log("Build complete. Active V3 pages and required assets copied to dist.");
