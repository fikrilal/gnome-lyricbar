const allowedTypes = ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'refactor', 'test'];

const allowedScopes = [
  'ci',
  'docs',
  'domain',
  'harness',
  'lifecycle',
  'lyrics',
  'mpris',
  'product',
  'release',
  'shell',
];

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
    'header-max-length': [2, 'always', 100],
    'scope-empty': [2, 'never'],
    'scope-enum': [2, 'always', allowedScopes],
    'subject-case': [2, 'always', ['lower-case', 'sentence-case']],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'type-enum': [2, 'always', allowedTypes],
  },
};
