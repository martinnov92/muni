import {defineConfig, globalIgnores} from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      quotes: ['error', 'single'],
      'jsx-quotes': ['error', 'prefer-single'],
      semi: ['error', 'always'],
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs', {allowSingleLine: false}],
      'padding-line-between-statements': [
        'error',
        {blankLine: 'always', prev: 'if', next: '*'},
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    '.test-dist/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
