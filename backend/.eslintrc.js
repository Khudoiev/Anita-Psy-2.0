module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
  },
  plugins: ['node'],
  rules: {
    // ─── КРИТИЧЕСКИЕ — блокируют CI ───────────────────────────────

    // Ловит: db.query() без require('../db') — как в contextManager.js
    'no-undef': 'error',

    // Ловит: hideTyping() когда функция называется removeTyping()
    'no-unused-vars': ['error', {
      vars: 'all',
      args: 'after-used',
      ignoreRestSiblings: true,
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],

    // Ловит: async функции без try/catch — причина непойманных 500
    'node/handle-callback-err': 'error',

    // Ловит: require() внутри функций (медленно, хрупко)
    'global-require': 'warn',

    // Ловит: == вместо === (частая логическая ошибка)
    'eqeqeq': ['error', 'always', { null: 'ignore' }],

    // ─── ПРЕДУПРЕЖДЕНИЯ — не блокируют CI, но видны ───────────────

    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-empty': ['warn', { allowEmptyCatch: false }],
    'no-unreachable': 'warn',
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.js'],
      env: { jest: true },
      rules: {
        'no-undef': 'off',       // jest globals (describe, test, expect)
        'global-require': 'off',
        'no-unused-vars': 'off', // test setup vars are often declared for clarity
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'coverage/', 'dist/'],
};
