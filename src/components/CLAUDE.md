# src/components — UI building blocks

Organized by domain: `candidates/`, `jobs/`, `companies/`, `submissions/`,
`ai/`, `ai-recruiter/`, `agents/`, `automation/`, `playbooks/`, `dashboard/`,
`approval-queue/`, `channel-inbox/`, `emails/`, `recruiters/`, `accounts/`,
`resume/`, `previews/`, `mobile/`, `common/`, `notifications/`, and **`ui/`**.

## `ui/` is special — don't hand-edit
`components/ui/*` is vendored **shadcn/Radix** (New York style). Regenerate/add
via the shadcn CLI per [../../components.json](../../components.json). Treat as a
library; wrap it, don't fork it.

## Conventions
- Class names via `cn()` (`@/lib/utils`); use the Tailwind CSS-variable tokens
  (`bg-primary`, `text-muted-foreground`, …) so light/dark + brand theming work.
- Icons: `lucide-react`. Toasts: `@/components/ui/toaster` (or `sonner`).
- Data via entities + react-query; lift server calls out of leaf components.
- Prefer composition over deep prop drilling; shared state via context in
  `common/` (`PermissionsContext`, refresh bus) or `@/lib/appCache`.
- Keep a domain component's Supabase/LLM access behind the entity/`llm.js` layer.

## Notable domains
- **ai/** and **ai-recruiter/** — scoring, matching, drafting, the AI recruiter
  run UI (Semantic / Agentic / Investigation layers in TESTING.md).
- **approval-queue/** — the human review gate before actions execute.
- **automation/** — `executeAutomation.jsx` runs rule actions (Execution layer).

## Tests
Component tests: Vitest + React Testing Library under `tests/unit/ui/`
(example: `tests/unit/ui/button.test.jsx`). Assert roles/labels and behavior, not
pixels. See [../../TESTING.md](../../TESTING.md).
