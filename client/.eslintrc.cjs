/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
    root: true,
    env: {
        es2022: true,
        node: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        tsconfigRootDir: __dirname,
    },
    overrides: [
        {
            files: ['src/**/*.ts', 'src/**/*.vue'],
            parserOptions: {
                project: 'tsconfig.app.json',
            },
            extends: [
                'plugin:vue/vue3-essential',
                'eslint:recommended',
                '@vue/eslint-config-typescript',
                '@vue/eslint-config-prettier/skip-formatting',
                '@web-auto/eslint-config',
            ],
        },
        {
            files: ['electron/**/*.ts'],
            parserOptions: {
                project: 'tsconfig.node.json',
            },
            extends: [
                'eslint:recommended',
                'plugin:@typescript-eslint/recommended',
                'prettier',
                '@web-auto/eslint-config',
                '@web-auto/eslint-config',
            ],
        },
    ],
};
