/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
    root: true,
    extends: [
        'plugin:vue/vue3-essential',
        '@vue/eslint-config-typescript',
        '@vue/eslint-config-prettier/skip-formatting',
        '@web-auto/eslint-config',
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        project: ['tsconfig.app.json', 'tsconfig.node.json'],
    },
};
