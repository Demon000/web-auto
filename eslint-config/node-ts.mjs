import globals from 'globals';
import { configs as typescriptConfigs } from 'typescript-eslint';
import typescriptParser from '@typescript-eslint/parser';
import nodeJsConfigs from './node-js.mjs';
import baseTsConfig from './base-ts.mjs';

export default [
    ...typescriptConfigs['recommendedTypeChecked'],
    ...nodeJsConfigs,
    ...baseTsConfig,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 'latest',
                project: 'tsconfig.json',
            },
        },
    },
];
