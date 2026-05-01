# Suggested Commands

## Development
```bash
npm run dev                  # Vite dev server (main app)
npm run asset-foundry        # Vite dev server for asset workbench tool
npm run asset-foundry:build  # Build asset foundry
npm run build                # Production build
npm run preview              # Preview production build
```

## Testing
```bash
npx vitest                   # Run all tests (watch mode)
npx vitest run               # Run all tests once
npx vitest run services/playgame/engine  # Engine tests only (node env)
```

## Linting
```bash
npm run lint                 # ESLint (0 warnings allowed)
```

## Engine CLI
```bash
npm run engine:cli           # Run game engine in terminal via tsx
# → executes: tsx services/playgame/engine/cli/main.ts
```

## Utilities
```bash
git log --oneline -10        # Recent commits
find . -name "*.ts" -not -path "*/node_modules/*"  # Find TS files
grep -r "pattern" --include="*.ts" --include="*.tsx" -l  # Search
```
