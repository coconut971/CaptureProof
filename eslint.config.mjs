import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/bin/**', '**/obj/**', '.agent-local/**', '.tools/**'] },
  ...tseslint.configs.recommended,
  { files: ['**/*.{js,mjs,ts,tsx}'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], '@typescript-eslint/no-explicit-any': 'error' } }
);
