module.exports = {
  env: {
    commonjs: true,
    es6: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    'radix': 'off',
    'no-plusplus': 'off',
    'no-underscore-dangle': 'off',
    'arrow-parens': [2, 'as-needed', { 'requireForBlockBody': false }],
    'object-curly-newline': [2, {
      'ObjectExpression': { 'minProperties': 6, 'multiline': true, 'consistent': true },
      'ObjectPattern': { 'minProperties': 6, 'multiline': true, 'consistent': true },
      'ImportDeclaration': { 'minProperties': 6, 'multiline': true, 'consistent': true },
      'ExportDeclaration': { 'minProperties': 6, 'multiline': true, 'consistent': true }
    }],
    'import/prefer-default-export': 'off',
  },
};
