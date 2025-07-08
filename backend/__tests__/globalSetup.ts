import { execSync } from 'child_process';

export default async function globalSetup() {
  console.log('🧪 Setting up test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
  
  try {
    // Setup test database if needed
    if (process.env.SETUP_TEST_DB === 'true') {
      console.log('📊 Setting up test database...');
      execSync('npx prisma db push --force-reset', { 
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      });
      console.log('✅ Test database setup complete');
    }
  } catch (error) {
    console.warn('⚠️  Test database setup skipped (likely using mocks)');
  }
  
  console.log('✅ Test environment setup complete');
}
