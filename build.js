import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
}

mkdirSync(dist, { recursive: true });
for (const entry of readdirSync(root)) {
  if (entry.endsWith(".html")) {
    cpSync(join(root, entry), join(dist, entry));
  }
}
cpSync(join(root, "src"), join(dist, "src"), { recursive: true });

console.log("Built static site into dist/");
