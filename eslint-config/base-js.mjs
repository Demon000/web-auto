import stylisticPlugin from '@stylistic/eslint-plugin';
import js from '@eslint/js';

export default [
    js.configs['recommended'],
    {
        plugins: {
            '@stylistic': stylisticPlugin,
        },
        rules: {
            'no-undef': 'off',

            'linebreak-style': ['error', 'unix'],

            '@stylistic/indent': 'off',
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/no-extra-semi': ['error'],
            '@stylistic/space-before-function-paren': [
                'error',
                {
                    anonymous: 'always',
                    asyncArrow: 'always',
                    named: 'never',
                },
            ],

            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],

            'no-constant-condition': [
                'error',
                {
                    checkLoops: false,
                },
            ],
        },
    },
    {
        ignores: ['dist', 'eslint.config.mjs'],
    },
];
