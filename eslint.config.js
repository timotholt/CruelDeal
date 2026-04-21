import js from '@eslint/js'
import globals from 'globals'
import solid from 'eslint-plugin-solid'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      solid,
    },
    rules: {
      ...solid.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  // ---- Engine purity wall ------------------------------------------------
  // Code under services/playgame/engine/ must remain pure: no Solid, no DOM,
  // no animations, no Math.random / Date.now. Randomness flows through the
  // seeded `rng` parameter; time flows through event payloads. See
  // `services/playgame/engine/README.md` and PLAY_REFACTOR_PLAN.md §4.4.
  {
    files: ['services/playgame/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['solid-js', 'solid-js/*'],      message: 'engine/ must stay framework-free (no Solid).' },
            { group: ['@/components/*', '@/contexts/*'], message: 'engine/ must not import UI or context modules.' },
            { group: ['@/services/vfx/*'],            message: 'engine/ must not import VFX / animation code.' },
            { group: ['@/utils/id'],                  message: 'engine/ must generate ids via the seeded rng, not utils/id.' },
            { group: ['howler', 'pixi.js'],           message: 'engine/ must not import audio / render libraries.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document',    message: 'engine/ must not touch the DOM.' },
        { name: 'window',      message: 'engine/ must not touch the DOM.' },
        { name: 'self',        message: 'engine/ must not use global self.' },
        { name: 'fetch',       message: 'engine/ is pure; transport lives outside.' },
        { name: 'performance', message: 'engine/ must not read wallclock time.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'engine/ must use the seeded rng instead of Math.random.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'engine/ must not use wallclock time (Date.now).',
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'engine/ must not use wallclock time (new Date()).',
        },
        {
          selector: "MemberExpression[object.name='crypto']",
          message: 'engine/ must not use crypto.* directly; intent ids come from outside the engine.',
        },
      ],
    },
  },
)
