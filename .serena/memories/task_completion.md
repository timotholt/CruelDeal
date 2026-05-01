# Task Completion Checklist

After completing any coding task:

1. **Lint**: `npm run lint` — must pass with 0 warnings
2. **Tests** (if engine code touched): `npx vitest run services/playgame/engine`
3. **Tests** (if UI code touched): `npx vitest run` 
4. **Engine purity** (if touching `services/playgame/engine/`): verify no forbidden imports added
5. **Type check**: bundler handles this via `vite build` or dev server — no separate tsc step needed

No build step required for development — Vite handles it.
