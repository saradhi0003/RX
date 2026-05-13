#!/usr/bin/env node
/**
 * Removes duplicate entity imports created by disconnect-base44.js.
 *
 * If a file imports `import { X } from "@/entities/all"` AND also has
 * `import { X } from "@/entities/X"`, the second is a duplicate — remove it.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "src");

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

let changedCount = 0;

for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, "utf8");
  const allImportRe = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]@\/entities\/all['"]\s*;?/;
  const allMatch = src.match(allImportRe);
  if (!allMatch) continue;

  const fromAll = new Set(allMatch[1].split(",").map(s => s.trim()).filter(Boolean));
  let modified = false;

  // For each `import { Foo } from "@/entities/Foo"` line, if Foo is already in
  // the @/entities/all import, drop the line.
  src = src.replace(
    /^[ \t]*import\s*\{\s*([A-Z][a-zA-Z0-9_]+)\s*\}\s*from\s*['"]@\/entities\/\1['"]\s*;?\s*\n/gm,
    (line, name) => {
      if (fromAll.has(name)) {
        modified = true;
        return "";
      }
      return line;
    }
  );

  if (modified) {
    fs.writeFileSync(file, src);
    changedCount++;
    console.log(`  • ${path.relative(process.cwd(), file)}`);
  }
}

console.log(`\n✅ Deduplicated ${changedCount} files`);
