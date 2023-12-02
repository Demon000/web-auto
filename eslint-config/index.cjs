module.exports = {
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    extends: ['eslint:recommended'],
    rules: {
        'no-undef': 'off',

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

        // TODO
        // '@typescript-eslint/strict-boolean-expressions': [
        //     'error',
        //     {
        //         allowNullableBoolean: true,
        //     },
        // ],

        'no-constant-condition': [
            'error',
            {
                checkLoops: false,
            },
        ],

        '@typescript-eslint/explicit-member-accessibility': 'error',

        '@typescript-eslint/no-floating-promises': 'error',
    },
};
