import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import vueTsEslintConfig from '@vue/eslint-config-typescript';
import skipFormattingConfig from '@vue/eslint-config-prettier/skip-formatting';
import baseConfig from '@web-auto/eslint-config/common-ts';

export default [
    ...vuePlugin.configs['flat/essential'],
    ...vueTsEslintConfig(),
    ...[skipFormattingConfig],
    ...baseConfig,
    {
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: '@typescript-eslint/parser',
                sourceType: 'module',
                tsconfigRootDir: import.meta.dirname,
                project: ['./tsconfig.json', './tsconfig.node.json'],
            },
        },
        rules: {
            'vue/multi-word-component-names': ['off'],
            'vue/no-deprecated-slot-attribute': ['off'],
        },
    },
    {
        ignores: ['browser-data', 'vite.config.ts', 'env.d.ts'],
    },
];
