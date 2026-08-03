# scripts/kimi.md — Automation scripts guidance

## Scope

`scripts/` contains Node.js helpers for repo maintenance, imports, and audits.

## Key scripts

| Script | Purpose |
|--------|---------|
| `dedupe-entity-imports.js` | Deduplicate entity imports |
| `drop-unused-react-imports.js` | Remove unused React imports |
| `feature-audit.js` | Audit feature completeness |
| `import-csv-data.js` / `import-base44-csv-to-supabase.mjs` | CSV/Base44 data import |
| `disconnect-base44.js` | Base44 disconnection tasks |
| `deploy-livekit.sh` | LiveKit deployment |
| `verify_020_approval_gate.sql` | Verify migration 020 policies |

## Conventions

- Scripts should not import UI code or React components.
- Use the Supabase service client or admin client for backend scripts.
- Keep scripts idempotent where possible.
- Do not commit PII or `.env.local`.

## Token-saving tips

- Before writing a new script, check if an existing one solves 80% of the problem.
- For one-off operations, prefer a script with `--dry-run` flag.
- For migrations, prefer `supabase/migrations/*.sql` over scripts unless complex data transformation is required.
