# Code Style & Conventions

## Language
- TypeScript strict, ES2022, no emit (type-check via bundler)
- JSX: SolidJS (`jsxImportSource: "solid-js"`)
- Path alias: `@/` = project root

## Engine Purity (CRITICAL)
`services/playgame/engine/` is a pure, deterministic, framework-free zone. ESLint enforces:
- NO: `solid-js`, DOM globals, `Math.random`, `Date.now`, `fetch`, `crypto`, `howler`, `pixi.js`
- NO imports from: `@/components`, `@/contexts`, `@/services/vfx`, `@/utils/id`
- Randomness: only via `rng: Rng` parameter (sfc32 seeded PRNG)
- ID generation: via `rng.fork(tag)` not `@/utils/id`

## Naming
- Components: PascalCase `.tsx`
- Services/utils: camelCase `.ts`
- Card definitions: PascalCase files in `cards/`
- Test files: `.test.ts` colocated or in `__tests__/`

## No comments by default
Only comment WHY (hidden constraint, subtle invariant, workaround). No "what" comments.

## SolidJS patterns
- Use contexts for shared state (UserContext, GameContext, PlayGameContext, UIContext)
- Custom hooks in `hooks/` prefixed `use*`
- Screens in `components/screens/`

## Testing
- Engine tests: `node` environment (pure, no DOM)
- UI tests: `jsdom` environment
- Setup: `services/playgame/engine/__tests__/setup.ts`
