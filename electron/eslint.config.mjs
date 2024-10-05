import baseConfig from '@web-auto/eslint-config/node-ts';

export default [
    ...baseConfig,
    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
];
