import { configs as typescriptConfigs } from 'typescript-eslint';
import baseJsConfig from './base-js.mjs';
import baseTsConfig from './base-ts.mjs';

export default [
    ...typescriptConfigs['recommendedTypeChecked'],
    ...baseJsConfig,
    ...baseTsConfig,
];
