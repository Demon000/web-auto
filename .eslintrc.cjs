module.exports = {
    root: true,
    env: {
        node: true,
    },
    parser: "@typescript-eslint/parser",
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    parserOptions: { ecmaVersion: 2018, sourceType: "module" },
    plugins: ["@typescript-eslint"],
    rules: {
        "linebreak-style": ["error", "unix"],

        indent: "off",
        "@typescript-eslint/indent": "off",

        "comma-dangle": "off",
        "@typescript-eslint/comma-dangle": ["error", "always-multiline"],

        quotes: "off",
        "@typescript-eslint/quotes": ["error", "single"],

        semi: "off",
        "@typescript-eslint/semi": ["error", "always"],

        "no-extra-semi": "off",
        "@typescript-eslint/no-extra-semi": ["error"],

        "space-before-function-paren": "off",
        "@typescript-eslint/space-before-function-paren": [
            "error",
            {
                anonymous: "always",
                asyncArrow: "always",
                named: "never",
            },
        ],

        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            },
        ],

        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-empty-interface": "off",

        "@typescript-eslint/strict-boolean-expressions": [
            "error",
            {
                allowNullableBoolean: true,
            },
        ],

        "vue/no-unused-components": ["warn"],
        "vue/comment-directive": "off",

        "no-constant-condition": [
            "error",
            {
                checkLoops: false,
            },
        ],
    },
};
