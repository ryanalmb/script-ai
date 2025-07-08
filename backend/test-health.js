const http = require('http');

// Test health endpoints
const testEndpoints = [
  { path: '/health', name: 'Basic Health Check' },
  { path: '/health/ready', name: 'Readiness Check' },
  { path: '/health/live', name: 'Liveness Check' }
];

async function testHealthEndpoint(path, name) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            name,
            path,
            status: res.statusCode,
            success: res.statusCode === 200,
            response
          });
        } catch (error) {
          resolve({
            name,
            path,
            status: res.statusCode,
            success: false,
            error: 'Invalid JSON response'
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        name,
        path,
        status: 0,
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name,
        path,
        status: 0,
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function runHealthTests() {
  console.log('🏥 Testing Health Check Endpoints...\n');
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    const result = await testHealthEndpoint(endpoint.path, endpoint.name);
    results.push(result);
    
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name} (${result.path})`);
    console.log(`   Status: ${result.status}`);
    
    if (result.success) {
      console.log(`   Response: ${JSON.stringify(result.response, null, 2)}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  }
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`📊 Health Check Summary: ${successCount}/${totalCount} endpoints healthy`);
  
  if (successCount === totalCount) {
    console.log('🎉 All health checks passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some health checks failed');
    process.exit(1);
  }
}

// Run the tests
runHealthTests().catch(console.error);
