# Comprehensive Testing Strategy

## Testing Pyramid Structure

### 1. Unit Tests (70% of tests)
**Location**: `__tests__/unit/`
**Framework**: Jest + Testing Library
**Coverage Target**: 90%

#### Backend Unit Tests
```typescript
// Example: backend/__tests__/unit/services/userService.test.ts
import { UserService } from '../../../src/services/userService';
import { prismaMock } from '../../mocks/prisma';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedPassword'
      };

      prismaMock.user.create.mockResolvedValue({
        id: '1',
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await userService.createUser(userData);
      expect(result.email).toBe(userData.email);
    });
  });
});
```

#### Frontend Unit Tests
```typescript
// Example: frontend/__tests__/unit/components/PostForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PostForm } from '../../../src/components/PostForm';

describe('PostForm', () => {
  it('should validate post content length', () => {
    render(<PostForm onSubmit={jest.fn()} />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { 
      target: { value: 'a'.repeat(281) } 
    });
    
    expect(screen.getByText(/exceeds 280 characters/)).toBeInTheDocument();
  });
});
```

### 2. Integration Tests (20% of tests)
**Location**: `__tests__/integration/`
**Framework**: Jest + Supertest
**Coverage**: All API endpoints

#### API Integration Tests
```typescript
// Example: backend/__tests__/integration/auth.test.ts
import request from 'supertest';
import app from '../../src/app';
import { setupTestDb, cleanupTestDb } from '../helpers/database';

describe('Authentication API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.token).toBeDefined();
    });
  });
});
```

### 3. End-to-End Tests (10% of tests)
**Location**: `__tests__/e2e/`
**Framework**: Playwright
**Coverage**: Critical user journeys

#### E2E Test Examples
```typescript
// Example: __tests__/e2e/content-generation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Content Generation Flow', () => {
  test('should generate and post content', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password');
    await page.click('[data-testid=login-button]');

    // Navigate to content generation
    await page.click('[data-testid=generate-content]');
    
    // Fill content generation form
    await page.fill('[data-testid=topic]', 'Bitcoin market update');
    await page.selectOption('[data-testid=tone]', 'professional');
    await page.click('[data-testid=generate-button]');

    // Verify content is generated
    await expect(page.locator('[data-testid=generated-content]')).toBeVisible();
    
    // Post the content
    await page.click('[data-testid=post-button]');
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
  });
});
```

## Test Configuration Files

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
};
```

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '__tests__/e2e',
  timeout: 30000,
  retries: 2,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
```

## Testing Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest __tests__/unit",
    "test:integration": "jest __tests__/integration",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

## Continuous Integration
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      
      - name: Run E2E tests
        run: npm run test:e2e
```
