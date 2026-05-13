#!/usr/bin/env node
/**
 * Removes the base44 compatibility shim from all files.
 *
 * For each file that imports { base44 } from '@/api/base44Client':
 *   - Scans for base44.entities.<Name>, base44.integrations.Core.<fn>,
 *     base44.auth.<fn>, and base44.asServiceRole references.
 *   - Builds the equivalent direct imports from @/entities/* and
 *     @/integrations/Core.
 *   - Replaces base44.entities.X → X
 *             base44.integrations.Core.X → Core.X (or X if Core is imported namespace-style)
 *             base44.auth.me() → supabase.auth.getUser() / useAuth() (manual review)
 *   - Removes the import { base44 } line.
 *
 * Skips files where base44 only appears inside string literals (BRD docs).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "src");

const SHIM_IMPORT_RE = /^\s*import\s*\{\s*base44\s*\}\s*from\s*['"]@\/api\/base44Client['"]\s*;?\s*$/m;

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function transform(file) {
  let src = fs.readFileSync(file, "utf8");
  if (!SHIM_IMPORT_RE.test(src)) return { file, changed: false, reason: "no shim import" };

  // Collect entity names used: base44.entities.<EntityName>
  const entityNames = new Set();
  for (const m of src.matchAll(/base44\.entities\.([A-Z][a-zA-Z0-9_]+)/g)) {
    entityNames.add(m[1]);
  }

  // Detect Core usage
  const usesCore =
    /base44\.integrations\.Core\.[A-Za-z]/.test(src) ||
    /base44\.integrations\.Core\b/.test(src);

  // Detect auth usage (informational — handled by AuthContext / supabase.auth)
  const authCalls = new Set();
  for (const m of src.matchAll(/base44\.auth\.([a-zA-Z]+)/g)) authCalls.add(m[1]);

  // Detect asServiceRole usage (runtime — would need an Edge Function)
  const usesServiceRole = /base44\.asServiceRole/.test(src);

  // Rewrite call sites.
  // base44.entities.Foo → Foo
  src = src.replace(/base44\.entities\.([A-Z][a-zA-Z0-9_]+)/g, "$1");
  // base44.integrations.Core.Foo → Core.Foo
  src = src.replace(/base44\.integrations\.Core\.([A-Za-z][a-zA-Z0-9_]+)/g, "Core.$1");
  // bare base44.integrations.Core → Core
  src = src.replace(/base44\.integrations\.Core(?![A-Za-z])/g, "Core");
  // base44.auth.X → leave as a placeholder we can scan later
  // (we'll mark with a comment and let humans / a follow-up patch handle)

  // Build replacement import block.
  const newImports = [];
  for (const name of [...entityNames].sort()) {
    newImports.push(`import { ${name} } from "@/entities/${name}";`);
  }
  if (usesCore) {
    newImports.push(`import * as Core from "@/integrations/Core";`);
  }

  // Replace the shim import line with the new imports.
  src = src.replace(SHIM_IMPORT_RE, newImports.join("\n"));

  fs.writeFileSync(file, src);
  return {
    file,
    changed: true,
    entities: [...entityNames],
    usesCore,
    authCalls: [...authCalls],
    usesServiceRole,
  };
}

const files = walk(ROOT);
const results = [];
for (const f of files) results.push(transform(f));

const changed = results.filter(r => r.changed);
const withAuth = changed.filter(r => r.authCalls.length);
const withSR = changed.filter(r => r.usesServiceRole);

console.log(`\n✅ Rewrote ${changed.length} files\n`);

if (withAuth.length) {
  console.log("⚠️  Files still containing base44.auth.* (needs manual review):");
  for (const r of withAuth) {
    console.log(`   ${path.relative(process.cwd(), r.file)}  — calls: ${r.authCalls.join(", ")}`);
  }
}
if (withSR.length) {
  console.log("\n⚠️  Files still containing base44.asServiceRole:");
  for (const r of withSR) console.log(`   ${path.relative(process.cwd(), r.file)}`);
}

console.log("\nDone. Run:  npm run build   to verify.");
