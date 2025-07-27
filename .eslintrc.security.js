// ESLint Security Configuration for X/Twitter Automation Platform
// Specifically configured for Node.js services with TypeScript

module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:security/recommended',
    'plugin:node/recommended'
  ],
  
  plugins: [
    'security',
    'no-secrets',
    '@typescript-eslint'
  ],
  
  parser: '@typescript-eslint/parser',
  
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  
  rules: {
    // Security-specific rules
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-unsafe-regex': 'error',
    
    // Secret detection rules
    'no-secrets/no-secrets': ['error', {
      'tolerance': 4.2,
      'additionalRegexes': {
        'X API Key': 'x[_-]?api[_-]?key[_-]?[a-zA-Z0-9]{25,}',
        'Twitter Bearer Token': 'AAAAAAAAAAAAAAAAAAAAAA[a-zA-Z0-9%]{50,}',
        'Telegram Bot Token': '[0-9]{8,10}:[a-zA-Z0-9_-]{35}',
        'JWT Secret': 'jwt[_-]?secret[_-]?[a-zA-Z0-9]{32,}',
        'Database URL': 'postgresql://[^\\s]+',
        'Redis URL': 'redis://[^\\s]+',
        'Generic API Key': 'api[_-]?key[_-]?[a-zA-Z0-9]{20,}'
      }
    }],
    
    // TypeScript security rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    
    // Node.js security rules
    'node/no-deprecated-api': 'error',
    'node/no-extraneous-import': 'error',
    'node/no-missing-import': 'off', // Handled by TypeScript
    'node/no-unpublished-import': 'off', // Allow dev dependencies
    
    // General security best practices
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    
    // Prevent common injection vulnerabilities
    'no-template-curly-in-string': 'error',
    'prefer-template': 'error',
    
    // Async/await security
    'require-await': 'error',
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'warn',
    
    // Error handling
    'no-empty-catch': 'error',
    'no-throw-literal': 'error',
    
    // Variable security
    'no-global-assign': 'error',
    'no-implicit-globals': 'error',
    'no-redeclare': 'error',
    'no-shadow': 'error',
    'no-undef': 'error',
    'no-unused-vars': 'off', // Handled by TypeScript
    '@typescript-eslint/no-unused-vars': 'error'
  },
  
  overrides: [
    {
      // Specific rules for backend service
      files: ['backend/src/**/*.ts'],
      rules: {
        'security/detect-child-process': 'error', // Stricter for backend
        'no-secrets/no-secrets': ['error', {
          'tolerance': 3.5, // Lower tolerance for backend
          'additionalRegexes': {
            'Twikit Session': 'twikit[_-]?session[_-]?[a-zA-Z0-9]{20,}',
            'Encryption Key': 'encryption[_-]?key[_-]?[a-zA-Z0-9]{32,}',
            'Private Key': '-----BEGIN [A-Z ]+PRIVATE KEY-----'
          }
        }]
      }
    },
    {
      // Specific rules for frontend service
      files: ['frontend/src/**/*.ts', 'frontend/src/**/*.tsx'],
      env: {
        browser: true
      },
      rules: {
        'no-console': 'error', // No console logs in production frontend
        'security/detect-object-injection': 'error' // Stricter for frontend
      }
    },
    {
      // Specific rules for telegram-bot service
      files: ['telegram-bot/src/**/*.ts'],
      rules: {
        'no-secrets/no-secrets': ['error', {
          'tolerance': 3.0, // Lowest tolerance for bot
          'additionalRegexes': {
            'Telegram Bot Token': '[0-9]{8,10}:[a-zA-Z0-9_-]{35}',
            'Webhook URL': 'https://[^\\s]+/webhook'
          }
        }]
      }
    },
    {
      // Test files - more lenient rules
      files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
      rules: {
        'no-secrets/no-secrets': 'off',
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-child-process': 'off',
        'no-console': 'off'
      }
    },
    {
      // Configuration files
      files: ['**/*.config.js', '**/*.config.ts'],
      rules: {
        'no-secrets/no-secrets': 'warn', // Warn instead of error for config
        'security/detect-non-literal-require': 'off'
      }
    }
  ],
  
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    }
  },
  
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.d.ts',
    'logs/',
    'venv/',
    'python_env/',
    '__pycache__/'
  ]
};
