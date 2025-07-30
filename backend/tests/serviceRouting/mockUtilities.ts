/**
 * Mock Utilities for Service Routing Pattern Testing
 * 
 * Provides mock implementations for external dependencies to enable
 * comprehensive testing without requiring full infrastructure setup.
 */

import { EventEmitter } from 'events';

// ============================================================================
// REDIS MOCK
// ============================================================================

export class MockRedis extends EventEmitter {
  private data: Map<string, any> = new Map();
  private connected: boolean = true;

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any, ...args: any[]): Promise<'OK'> {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    // Mock expiration - in real implementation would set timeout
    return this.data.has(key) ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());
    if (pattern === '*') return keys;
    // Simple pattern matching for testing
    const regex = new RegExp(pattern.replace('*', '.*'));
    return keys.filter(key => regex.test(key));
  }

  async flushall(): Promise<'OK'> {
    this.data.clear();
    return 'OK';
  }

  disconnect(): void {
    this.connected = false;
    this.emit('close');
  }

  get status(): string {
    return this.connected ? 'ready' : 'close';
  }
}

// ============================================================================
// POSTGRESQL MOCK
// ============================================================================

export class MockPostgreSQLPool {
  private connected: boolean = true;

  async query(text: string, params?: any[]): Promise<any> {
    // Mock query results based on query type
    if (text.includes('SELECT')) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes('INSERT') || text.includes('UPDATE') || text.includes('DELETE')) {
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  async connect(): Promise<MockPostgreSQLClient> {
    return new MockPostgreSQLClient();
  }

  async end(): Promise<void> {
    this.connected = false;
  }

  get totalCount(): number {
    return 10; // Mock pool size
  }

  get idleCount(): number {
    return 8; // Mock idle connections
  }

  get waitingCount(): number {
    return 0; // Mock waiting connections
  }
}

export class MockPostgreSQLClient {
  async query(text: string, params?: any[]): Promise<any> {
    return { rows: [], rowCount: 0 };
  }

  async release(): Promise<void> {
    // Mock release
  }
}

// ============================================================================
// PRISMA MOCK
// ============================================================================

export class MockPrismaClient {
  // Mock Prisma models
  twikitAccount = {
    findUnique: async (args: any) => null,
    findMany: async (args: any) => [],
    create: async (args: any) => ({ id: 'mock-id', ...args.data }),
    update: async (args: any) => ({ id: args.where.id, ...args.data }),
    delete: async (args: any) => ({ id: args.where.id }),
  };

  twikitSession = {
    findUnique: async (args: any) => null,
    findMany: async (args: any) => [],
    create: async (args: any) => ({ id: 'mock-session-id', ...args.data }),
    update: async (args: any) => ({ id: args.where.id, ...args.data }),
  };

  rateLimitEvent = {
    create: async (args: any) => ({ id: 'mock-event-id', ...args.data }),
    findMany: async (args: any) => [],
  };

  complianceAuditEvent = {
    create: async (args: any) => ({ id: 'mock-audit-id', ...args.data }),
    findMany: async (args: any) => [],
  };

  async $connect(): Promise<void> {
    // Mock connection
  }

  async $disconnect(): Promise<void> {
    // Mock disconnection
  }

  async $transaction(fn: any): Promise<any> {
    return await fn(this);
  }
}

// ============================================================================
// FILE SYSTEM MOCK
// ============================================================================

export class MockFileSystem {
  private files: Map<string, string> = new Map();

  async readFile(path: string): Promise<string> {
    return this.files.get(path) || '{}';
  }

  async writeFile(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async mkdir(path: string): Promise<void> {
    // Mock directory creation
  }
}

// ============================================================================
// HTTP CLIENT MOCK
// ============================================================================

export class MockHttpClient {
  async get(url: string, config?: any): Promise<any> {
    return {
      status: 200,
      data: { success: true, url },
      headers: {},
    };
  }

  async post(url: string, data?: any, config?: any): Promise<any> {
    return {
      status: 200,
      data: { success: true, url, data },
      headers: {},
    };
  }

  async put(url: string, data?: any, config?: any): Promise<any> {
    return {
      status: 200,
      data: { success: true, url, data },
      headers: {},
    };
  }

  async delete(url: string, config?: any): Promise<any> {
    return {
      status: 200,
      data: { success: true, url },
      headers: {},
    };
  }
}

// ============================================================================
// MOCK FACTORY
// ============================================================================

export class MockFactory {
  static createRedis(): MockRedis {
    return new MockRedis();
  }

  static createPostgreSQLPool(): MockPostgreSQLPool {
    return new MockPostgreSQLPool();
  }

  static createPrismaClient(): MockPrismaClient {
    return new MockPrismaClient();
  }

  static createFileSystem(): MockFileSystem {
    return new MockFileSystem();
  }

  static createHttpClient(): MockHttpClient {
    return new MockHttpClient();
  }
}

// ============================================================================
// TEST ENVIRONMENT SETUP
// ============================================================================

export function setupTestEnvironment(): void {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
  
  // Disable external API calls
  process.env.DISABLE_EXTERNAL_APIS = 'true';
  
  // Set test-specific configurations
  process.env.RATE_LIMIT_ENABLED = 'false';
  process.env.CACHE_ENABLED = 'true';
  process.env.LOGGING_LEVEL = 'info';
}

export function cleanupTestEnvironment(): void {
  // Reset environment variables
  delete process.env.NODE_ENV;
  delete process.env.DISABLE_EXTERNAL_APIS;
  delete process.env.RATE_LIMIT_ENABLED;
  delete process.env.CACHE_ENABLED;
}
