import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import prettierRecommendedConfig from 'eslint-plugin-prettier/recommended';
import baseJsConfig from './base-js.mjs';

export default [
    ...baseJsConfig,
    prettierRecommendedConfig,
    {
        plugins: {
            'simple-import-sort': simpleImportSortPlugin,
        },
        rules: {
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
        },
    },
];
