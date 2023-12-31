module.exports = {
    root: true,
    env: {
        node: true,
    },
    extends: [
        'plugin:@typescript-eslint/recommended-type-checked',
        'prettier',
        '@web-auto/eslint-config',
    ],
    plugins: ['@typescript-eslint'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        project: 'tsconfig.json',
    },
};
