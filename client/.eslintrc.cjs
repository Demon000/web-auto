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
            ],
        },
    ],
    rules: {
        'linebreak-style': ['error', 'unix'],

        indent: 'off',
        '@typescript-eslint/indent': 'off',

        'comma-dangle': 'off',
        '@typescript-eslint/comma-dangle': ['error', 'always-multiline'],

        quotes: 'off',
        '@typescript-eslint/quotes': ['error', 'single'],

        semi: 'off',
        '@typescript-eslint/semi': ['error', 'always'],

        'no-extra-semi': 'off',
        '@typescript-eslint/no-extra-semi': ['error'],

        'space-before-function-paren': 'off',
        '@typescript-eslint/space-before-function-paren': [
            'error',
            {
                anonymous: 'always',
                asyncArrow: 'always',
                named: 'never',
            },
        ],

        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            },
        ],

        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-empty-interface': 'off',

        '@typescript-eslint/strict-boolean-expressions': [
            'error',
            {
                allowNullableBoolean: true,
            },
        ],

        'no-constant-condition': [
            'error',
            {
                checkLoops: false,
            },
        ],

        '@typescript-eslint/explicit-member-accessibility': 'error',
    },
};
