import fs from "fs";
import path from "path";

const distDir = "dist";

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

copyDir("src", distDir);
copyDir("css", path.join(distDir, "css"));

console.log("Build complete. Files copied to dist.");