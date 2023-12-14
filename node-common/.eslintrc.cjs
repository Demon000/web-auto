require('@rushstack/eslint-patch/lib/modern-module-resolution');

module.exports = {
    extends: ['@web-auto/eslint-config-node'],
    parserOptions: {
        tsconfigRootDir: __dirname,
    },
};
