# mobile/kimi.md — Mobile app guidance

## Scope

`mobile/` is an Expo React Native app sharing the same Supabase backend as the web SPA.

## Commands

```bash
cd mobile
npm start        # Expo dev server
npm run typecheck   # tsc
cd mobile && npm run build:web   # export for web/CI parity
```

## Architecture

- Same Supabase project, functions, and RLS as web.
- No duplicated backend logic.
- Entry: `mobile/App.tsx`.
- Screens: `mobile/screens/`.
- Components: `mobile/components/`.
- Shared libs: `mobile/lib/`.

## Auth

Uses the same Supabase Auth project. Biometric lock is implemented.  
No service-role key in the mobile client.

## Uploads

Use the same `UploadFile()` pattern via `src/integrations/Core.js` equivalents.  
Resumés and attachments go to the private `uploads` bucket scoped to `<uid>/…`.

## Token-saving lookups

- Mobile-specific README: `mobile/README.md`.
- Build config: `mobile/app.json`, `mobile/eas.json`.
- Backend details: `../supabase/kimi.md`.

## Common tasks (cookbook)

### Add a screen
1. Create `mobile/screens/MyScreen.tsx`.
2. Wire navigation in the navigator config.
3. Keep components small; reuse `mobile/components/`.

### Call the backend
- Use Supabase client from `mobile/lib/supabase.ts` (or equivalent).
- For LLM/proxy calls, prefer routing through existing Edge Functions instead of adding new ones.
