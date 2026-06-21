#!/usr/bin/env node
/**
 * Drops the unused `React` default import from .jsx files that don't actually
 * reference `React` anywhere in the file body.
 *
 * With the React 18+ JSX transform, the default React import is no longer
 * required just to render JSX — it's needed only when you call React.foo
 * directly (React.useState, React.Fragment, React.memo, etc.).
 *
 * Safe pattern: only rewrites files that satisfy BOTH:
 *   1. Start with `import React, { ... } from "react";`
 *   2. No `React.` or bare `React` reference outside that import line.
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
    else if (/\.(jsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const importRe = /^import\s+React\s*,\s*\{\s*([^}]+)\s*\}\s+from\s+["']react["'];?$/m;
const referenceRe = /\bReact\b/;
let changed = 0;

for (const f of walk(ROOT)) {
  let src = fs.readFileSync(f, "utf8");
  const m = src.match(importRe);
  if (!m) continue;
  const named = m[1];
  // Strip the import line; check for any other React reference.
  const without = src.replace(importRe, "");
  if (referenceRe.test(without)) continue;     // React.X used elsewhere — keep import
  const replacement = `import { ${named.trim()} } from "react";`;
  src = src.replace(importRe, replacement);
  fs.writeFileSync(f, src);
  changed++;
  console.log(`  ✓ ${path.relative(process.cwd(), f)}`);
}

console.log(`\nDropped unused React default import from ${changed} files.`);
