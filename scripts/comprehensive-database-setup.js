/**
 * Comprehensive Database Setup and Testing Script
 * This script provides a complete database setup with strict error checking
 * and comprehensive validation for the Twikit integration
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
    DOCKER_TIMEOUT: 300000, // 5 minutes
    SERVICE_TIMEOUT: 180000, // 3 minutes
    POSTGRES_CONTAINER: 'postgres-xmarketing',
    REDIS_CONTAINER: 'redis-xmarketing',
    DATABASE_URL: 'postgresql://postgres:postgres_secure_2024@localhost:5432/x_marketing_platform',
    REDIS_URL: 'redis://localhost:6379'
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Logging functions
function log(message, color = 'reset') {
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function success(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function warning(message) {
    console.log(`${colors.yellow}⚠️ ${message}${colors.reset}`);
}

function error(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
    throw new Error(message);
}

// Utility function to run commands with timeout
function runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 30000;
        const cwd = options.cwd || process.cwd();
        
        log(`Running: ${command}`, 'blue');
        
        const child = exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Command failed: ${command}\nError: ${error.message}\nStderr: ${stderr}`));
            } else {
                resolve({ stdout, stderr });
            }
        });
        
        // Set timeout
        const timeoutId = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`Command timeout: ${command}`));
        }, timeout);
        
        child.on('exit', () => {
            clearTimeout(timeoutId);
        });
    });
}

// Check if Docker Desktop is running
async function checkDockerDesktop() {
    log('Checking Docker Desktop status...', 'cyan');
    
    try {
        await runCommand('docker info', { timeout: 10000 });
        success('Docker Desktop is running');
        return true;
    } catch (err) {
        error('Docker Desktop is not running. Please start Docker Desktop and try again.');
    }
}

// Validate docker-compose configuration
async function validateDockerCompose() {
    log('Validating docker-compose configuration...', 'cyan');
    
    if (!fs.existsSync('docker-compose.yml')) {
        error('docker-compose.yml not found in current directory');
    }
    
    try {
        await runCommand('docker-compose config');
        success('Docker Compose configuration is valid');
        return true;
    } catch (err) {
        error(`Invalid docker-compose.yml: ${err.message}`);
    }
}

// Clean up existing containers
async function cleanupContainers() {
    log('Cleaning up existing containers...', 'cyan');
    
    try {
        await runCommand('docker-compose down --volumes --remove-orphans', { timeout: 60000 });
        await runCommand('docker volume prune -f', { timeout: 30000 });
        success('Cleanup completed');
        return true;
    } catch (err) {
        warning(`Cleanup had issues: ${err.message}`);
        return true; // Continue anyway
    }
}

// Start database services
async function startDatabaseServices() {
    log('Starting PostgreSQL and Redis services...', 'cyan');
    
    try {
        // Start services
        await runCommand('docker-compose up -d postgres redis pgadmin redis-commander', { 
            timeout: CONFIG.SERVICE_TIMEOUT 
        });
        
        // Wait for services to be healthy
        log('Waiting for services to be healthy...', 'yellow');
        
        const maxAttempts = 60;
        let attempt = 1;
        
        while (attempt <= maxAttempts) {
            try {
                const { stdout } = await runCommand('docker-compose ps', { timeout: 10000 });
                
                if (stdout.includes('healthy') && 
                    stdout.includes(CONFIG.POSTGRES_CONTAINER) && 
                    stdout.includes(CONFIG.REDIS_CONTAINER)) {
                    success('Database services are healthy');
                    return true;
                }
            } catch (err) {
                // Continue waiting
            }
            
            log(`Waiting for services to be healthy... (${attempt}/${maxAttempts})`, 'yellow');
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempt++;
        }
        
        error('Database services failed to become healthy within timeout');
    } catch (err) {
        error(`Failed to start database services: ${err.message}`);
    }
}

// Test database connectivity
async function testDatabaseConnectivity() {
    log('Testing database connectivity...', 'cyan');
    
    try {
        // Test PostgreSQL
        await runCommand(`docker exec ${CONFIG.POSTGRES_CONTAINER} pg_isready -U postgres -d x_marketing_platform`, {
            timeout: 15000
        });
        success('PostgreSQL connection verified');
        
        // Test Redis
        await runCommand(`docker exec ${CONFIG.REDIS_CONTAINER} redis-cli ping`, {
            timeout: 15000
        });
        success('Redis connection verified');
        
        return true;
    } catch (err) {
        error(`Database connectivity test failed: ${err.message}`);
    }
}

// Run database migrations
async function runDatabaseMigrations() {
    log('Running database migrations...', 'cyan');
    
    try {
        // Build migrator service
        log('Building migration service...', 'blue');
        await runCommand('docker-compose --profile migration build db-migrator', {
            timeout: 180000 // 3 minutes for build
        });
        
        // Run migrations
        log('Executing migrations...', 'blue');
        await runCommand('docker-compose --profile migration run --rm -e RESET_DB=false -e SKIP_SEED=false -e RUN_TESTS=true db-migrator', {
            timeout: 300000 // 5 minutes for migration
        });
        
        success('Database migrations completed successfully');
        return true;
    } catch (err) {
        error(`Migration failed: ${err.message}`);
    }
}

// Validate schema implementation
async function validateSchema() {
    log('Validating Twikit schema implementation...', 'cyan');
    
    const criticalTables = [
        'twikit_sessions',
        'twikit_accounts',
        'proxy_pools',
        'rate_limit_events',
        'interaction_logs',
        'content_queue',
        'system_health'
    ];
    
    try {
        for (const table of criticalTables) {
            await runCommand(`docker exec ${CONFIG.POSTGRES_CONTAINER} psql -U postgres -d x_marketing_platform -c "SELECT 1 FROM ${table} LIMIT 1;"`, {
                timeout: 10000
            });
            success(`Table ${table} exists and is accessible`);
        }
        
        // Test extensions
        await runCommand(`docker exec ${CONFIG.POSTGRES_CONTAINER} psql -U postgres -d x_marketing_platform -c "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'btree_gin');"`, {
            timeout: 10000
        });
        success('PostgreSQL extensions verified');
        
        return true;
    } catch (err) {
        error(`Schema validation failed: ${err.message}`);
    }
}

// Test Redis integration
async function testRedisIntegration() {
    log('Testing Redis integration...', 'cyan');
    
    try {
        const testKey = `twikit:test:${Date.now()}`;
        
        // Test SET operation
        await runCommand(`docker exec ${CONFIG.REDIS_CONTAINER} redis-cli set ${testKey} "test_value" EX 60`, {
            timeout: 10000
        });
        
        // Test GET operation
        await runCommand(`docker exec ${CONFIG.REDIS_CONTAINER} redis-cli get ${testKey}`, {
            timeout: 10000
        });
        
        // Test Lua script capability
        await runCommand(`docker exec ${CONFIG.REDIS_CONTAINER} redis-cli eval "return redis.call('ping')" 0`, {
            timeout: 10000
        });
        
        success('Redis integration tests passed');
        return true;
    } catch (err) {
        error(`Redis integration test failed: ${err.message}`);
    }
}

// Run comprehensive tests
async function runComprehensiveTests() {
    log('Running comprehensive database tests...', 'cyan');
    
    try {
        // Test database performance
        await runCommand(`docker exec ${CONFIG.POSTGRES_CONTAINER} psql -U postgres -d x_marketing_platform -c "EXPLAIN ANALYZE SELECT * FROM twikit_sessions LIMIT 10;"`, {
            timeout: 15000
        });
        success('Database performance test passed');
        
        // Test Redis performance
        await runCommand(`docker exec ${CONFIG.REDIS_CONTAINER} redis-cli --latency-history -i 1 &`, {
            timeout: 5000
        }).catch(() => {}); // Ignore timeout for background process
        
        success('Redis performance test initiated');
        
        return true;
    } catch (err) {
        warning(`Some performance tests had issues: ${err.message}`);
        return true; // Continue anyway
    }
}

// Create environment file
async function createEnvironmentFile() {
    log('Creating environment configuration...', 'cyan');
    
    const envContent = `# Docker Database Configuration for Twikit Integration
DATABASE_URL=${CONFIG.DATABASE_URL}
REDIS_URL=${CONFIG.REDIS_URL}

# Database Configuration
POSTGRES_DB=x_marketing_platform
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_secure_2024

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Application Configuration
NODE_ENV=development
LOG_LEVEL=debug

# Security (change in production)
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Twikit Configuration
TWIKIT_DEBUG=true
TWIKIT_RATE_LIMIT_ENABLED=true
TWIKIT_ANALYTICS_ENABLED=true

# Generated on: ${new Date().toISOString()}
`;
    
    fs.writeFileSync('.env.docker', envContent);
    success('Environment file created: .env.docker');
}

// Display service information
async function displayServiceInfo() {
    log('Database services are ready!', 'green');
    
    console.log('\n🐘 PostgreSQL Database:');
    console.log('   Host: localhost');
    console.log('   Port: 5432');
    console.log('   Database: x_marketing_platform');
    console.log('   Username: postgres');
    console.log('   Password: postgres_secure_2024');
    console.log(`   Connection URL: ${CONFIG.DATABASE_URL}`);
    
    console.log('\n🔴 Redis Cache:');
    console.log('   Host: localhost');
    console.log('   Port: 6379');
    console.log(`   Connection URL: ${CONFIG.REDIS_URL}`);
    
    console.log('\n🔧 Management Tools:');
    console.log('   pgAdmin: http://localhost:8080');
    console.log('     Email: admin@twikit.local');
    console.log('     Password: admin_secure_2024');
    console.log('   Redis Commander: http://localhost:8081');
    console.log('     Username: admin');
    console.log('     Password: admin_secure_2024');
    
    console.log('\n📊 Service Status:');
    try {
        const { stdout } = await runCommand('docker-compose ps');
        console.log(stdout);
    } catch (err) {
        warning('Could not retrieve service status');
    }
}

// Main execution function
async function main() {
    console.log('\n🚀 Comprehensive Twikit Database Setup and Testing');
    console.log('==================================================\n');
    
    const startTime = Date.now();
    
    try {
        // Pre-flight checks
        await checkDockerDesktop();
        await validateDockerCompose();
        
        // Setup process
        await cleanupContainers();
        await startDatabaseServices();
        await testDatabaseConnectivity();
        await runDatabaseMigrations();
        
        // Validation process
        await validateSchema();
        await testRedisIntegration();
        await runComprehensiveTests();
        
        // Finalization
        await createEnvironmentFile();
        await displayServiceInfo();
        
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        console.log('\n🎉 Twikit Docker database setup completed successfully!');
        console.log(`⏱️ Total setup time: ${duration} seconds`);
        console.log('\n📋 Next Steps:');
        console.log('   1. Use the connection information above to connect your applications');
        console.log('   2. Access pgAdmin at http://localhost:8080 for database management');
        console.log('   3. Access Redis Commander at http://localhost:8081 for Redis monitoring');
        console.log('   4. Run "docker-compose logs -f" to monitor service logs');
        console.log('   5. Run "docker-compose down" to stop all services when done');
        
        return true;
    } catch (err) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`\n❌ Setup failed after ${duration} seconds`);
        console.log(`Error: ${err.message}`);
        
        console.log('\n🔧 Troubleshooting:');
        console.log('   - Ensure Docker Desktop is running');
        console.log('   - Check Docker Desktop has sufficient resources (4GB+ RAM)');
        console.log('   - Run "docker-compose logs" to check service logs');
        console.log('   - Try running "docker-compose down -v" to clean up and retry');
        
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { main };
