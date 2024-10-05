import { plugin as typescriptPlugin } from 'typescript-eslint';

export default [
    {
        plugins: {
            '@typescript-eslint': typescriptPlugin,
        },
        rules: {
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

            '@typescript-eslint/explicit-member-accessibility': 'error',

            '@typescript-eslint/no-floating-promises': 'error',
        },
    },
];
