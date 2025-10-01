module.exports = {
    env: {
        node: true,
        browser: true,
        es2022: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
    },
    plugins: ['@typescript-eslint'],
    rules: {
        'prefer-const': 'error',
        'no-var': 'error',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
        'no-undef': 'off' // Turn off no-undef for TypeScript files
    },
    ignorePatterns: ['dist/', 'node_modules/', '*.js']
};