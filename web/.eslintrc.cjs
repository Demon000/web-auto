/* eslint-env node */
require('@rushstack/eslint-patch/lib/modern-module-resolution');

module.exports = {
    root: true,
    extends: [
        'plugin:vue/vue3-essential',
        '@vue/eslint-config-typescript',
        '@vue/eslint-config-prettier/skip-formatting',
        '@web-auto/eslint-config',
    ],
    rules: {
        'vue/multi-word-component-names': ['off'],
        'vue/no-deprecated-slot-attribute': ['off'],
    },
    parser: 'vue-eslint-parser',
    parserOptions: {
        parser: '@typescript-eslint/parser',
        sourceType: 'module',
        tsconfigRootDir: __dirname,
        project: './tsconfig.json',
    },
};
