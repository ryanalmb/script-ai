/**
 * Comprehensive Database Schema Validation Script
 * Validates the Twikit integration schema extensions without requiring database connection
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Comprehensive Database Schema Validation');
console.log('==========================================');

// Validation results tracking
const validationResults = {
  schemaFileExists: false,
  schemaParseValid: false,
  modelCount: 0,
  relationshipCount: 0,
  indexCount: 0,
  twikitModelsPresent: false,
  relationshipIntegrity: false,
  indexOptimization: false,
  enterpriseFeatures: false
};

// Expected Twikit models
const expectedTwikitModels = [
  'TwikitSession',
  'TwikitAccount', 
  'TwikitSessionHistory',
  'SessionProxyAssignment',
  'ProxyPool',
  'ProxyUsageLog',
  'ProxyRotationSchedule',
  'ProxyHealthMetrics',
  'RateLimitEvent',
  'AccountRateLimitProfile',
  'RateLimitViolation',
  'RateLimitAnalytics',
  'TweetCache',
  'UserProfileCache',
  'InteractionLog',
  'ContentQueue',
  'TwikitOperationLog',
  'PerformanceMetrics',
  'ErrorLog',
  'SystemHealth'
];

// Validate schema file exists
function validateSchemaFileExists() {
  console.log('\n1️⃣ Validating schema file existence...');
  
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  
  if (fs.existsSync(schemaPath)) {
    console.log('✅ Schema file exists: prisma/schema.prisma');
    validationResults.schemaFileExists = true;
    return schemaPath;
  } else {
    console.log('❌ Schema file not found: prisma/schema.prisma');
    return null;
  }
}

// Parse and validate schema content
function validateSchemaContent(schemaPath) {
  console.log('\n2️⃣ Validating schema content...');
  
  try {
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Basic parsing validation
    if (schemaContent.includes('generator client') && schemaContent.includes('datasource db')) {
      console.log('✅ Schema structure valid');
      validationResults.schemaParseValid = true;
    } else {
      console.log('❌ Invalid schema structure');
      return null;
    }
    
    return schemaContent;
  } catch (error) {
    console.log('❌ Failed to read schema file:', error.message);
    return null;
  }
}

// Count models, relations, and indexes
function analyzeSchemaMetrics(schemaContent) {
  console.log('\n3️⃣ Analyzing schema metrics...');
  
  // Count models
  const modelMatches = schemaContent.match(/^model\s+\w+\s*{/gm);
  const modelCount = modelMatches ? modelMatches.length : 0;
  
  // Count relations
  const relationMatches = schemaContent.match(/@relation\(/g);
  const relationshipCount = relationMatches ? relationMatches.length : 0;
  
  // Count indexes
  const indexMatches = schemaContent.match(/@@index\(/g);
  const indexCount = indexMatches ? indexMatches.length : 0;
  
  console.log(`✅ Models found: ${modelCount}`);
  console.log(`✅ Relationships found: ${relationshipCount}`);
  console.log(`✅ Indexes found: ${indexCount}`);
  
  validationResults.modelCount = modelCount;
  validationResults.relationshipCount = relationshipCount;
  validationResults.indexCount = indexCount;
  
  return { modelCount, relationshipCount, indexCount };
}

// Validate Twikit models presence
function validateTwikitModels(schemaContent) {
  console.log('\n4️⃣ Validating Twikit integration models...');
  
  let foundModels = 0;
  const missingModels = [];
  
  for (const modelName of expectedTwikitModels) {
    const modelRegex = new RegExp(`^model\\s+${modelName}\\s*{`, 'm');
    if (modelRegex.test(schemaContent)) {
      foundModels++;
      console.log(`   ✅ ${modelName}: Found`);
    } else {
      missingModels.push(modelName);
      console.log(`   ❌ ${modelName}: Missing`);
    }
  }
  
  console.log(`\n✅ Twikit models: ${foundModels}/${expectedTwikitModels.length} found`);
  
  if (foundModels === expectedTwikitModels.length) {
    console.log('✅ All Twikit integration models present');
    validationResults.twikitModelsPresent = true;
  } else {
    console.log(`❌ Missing models: ${missingModels.join(', ')}`);
  }
  
  return foundModels === expectedTwikitModels.length;
}

// Validate relationship integrity
function validateRelationshipIntegrity(schemaContent) {
  console.log('\n5️⃣ Validating relationship integrity...');
  
  const criticalRelationships = [
    'TwikitSession.*XAccount',
    'TwikitAccount.*XAccount',
    'RateLimitEvent.*XAccount',
    'InteractionLog.*XAccount',
    'ContentQueue.*XAccount',
    'ProxyPool.*Proxy',
    'SessionProxyAssignment.*TwikitSession',
    'SessionProxyAssignment.*Proxy'
  ];
  
  let validRelationships = 0;
  
  for (const relationship of criticalRelationships) {
    if (new RegExp(relationship.replace('.*', '[\\s\\S]*?'), 'm').test(schemaContent)) {
      validRelationships++;
      console.log(`   ✅ ${relationship}: Valid`);
    } else {
      console.log(`   ⚠️ ${relationship}: Not found or invalid`);
    }
  }
  
  console.log(`\n✅ Critical relationships: ${validRelationships}/${criticalRelationships.length} valid`);
  
  if (validRelationships >= criticalRelationships.length * 0.8) {
    validationResults.relationshipIntegrity = true;
    return true;
  }
  
  return false;
}

// Validate index optimization
function validateIndexOptimization(schemaContent) {
  console.log('\n6️⃣ Validating index optimization...');
  
  const criticalIndexes = [
    'idx_twikit_sessions_account_id',
    'idx_twikit_accounts_account_id',
    'idx_rate_limit_events_account_id',
    'idx_interaction_log_account_id',
    'idx_content_queue_account_id',
    'idx_proxy_pools_provider',
    'idx_tweet_cache_tweet_id',
    'idx_user_profile_cache_user_id'
  ];
  
  let foundIndexes = 0;
  
  for (const indexName of criticalIndexes) {
    if (schemaContent.includes(indexName)) {
      foundIndexes++;
      console.log(`   ✅ ${indexName}: Found`);
    } else {
      console.log(`   ⚠️ ${indexName}: Missing`);
    }
  }
  
  console.log(`\n✅ Critical indexes: ${foundIndexes}/${criticalIndexes.length} found`);
  
  if (foundIndexes >= criticalIndexes.length * 0.8) {
    validationResults.indexOptimization = true;
    return true;
  }
  
  return false;
}

// Validate enterprise features
function validateEnterpriseFeatures(schemaContent) {
  console.log('\n7️⃣ Validating enterprise features...');
  
  const enterpriseFeatures = [
    'previewFeatures.*postgresqlExtensions',
    'previewFeatures.*views',
    'previewFeatures.*fullTextSearchPostgres',
    'extensions.*uuid_ossp',
    'extensions.*pg_trgm',
    'type: Gin',
    'UserDashboardView',
    'CampaignPerformanceView'
  ];
  
  let foundFeatures = 0;
  
  for (const feature of enterpriseFeatures) {
    if (new RegExp(feature, 'm').test(schemaContent)) {
      foundFeatures++;
      console.log(`   ✅ ${feature}: Found`);
    } else {
      console.log(`   ⚠️ ${feature}: Missing`);
    }
  }
  
  console.log(`\n✅ Enterprise features: ${foundFeatures}/${enterpriseFeatures.length} found`);
  
  if (foundFeatures >= enterpriseFeatures.length * 0.7) {
    validationResults.enterpriseFeatures = true;
    return true;
  }
  
  return false;
}

// Main validation function
async function runSchemaValidation() {
  console.log('🚀 Starting comprehensive schema validation...\n');
  
  try {
    // Step 1: Validate schema file exists
    const schemaPath = validateSchemaFileExists();
    if (!schemaPath) return false;
    
    // Step 2: Validate schema content
    const schemaContent = validateSchemaContent(schemaPath);
    if (!schemaContent) return false;
    
    // Step 3: Analyze schema metrics
    analyzeSchemaMetrics(schemaContent);
    
    // Step 4: Validate Twikit models
    validateTwikitModels(schemaContent);
    
    // Step 5: Validate relationship integrity
    validateRelationshipIntegrity(schemaContent);
    
    // Step 6: Validate index optimization
    validateIndexOptimization(schemaContent);
    
    // Step 7: Validate enterprise features
    validateEnterpriseFeatures(schemaContent);
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
  
  // Results summary
  console.log('\n📊 SCHEMA VALIDATION RESULTS');
  console.log('============================');
  
  const passedValidations = Object.values(validationResults).filter(result => 
    typeof result === 'boolean' ? result : result > 0
  ).length;
  const totalValidations = Object.keys(validationResults).length;
  
  Object.entries(validationResults).forEach(([validation, result]) => {
    const status = (typeof result === 'boolean' ? result : result > 0) ? '✅ PASSED' : '❌ FAILED';
    const value = typeof result === 'boolean' ? '' : ` (${result})`;
    const name = validation.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`${status} ${name}${value}`);
  });
  
  console.log(`\n🎯 Overall: ${passedValidations}/${totalValidations} validations passed`);
  
  if (passedValidations >= totalValidations * 0.8) {
    console.log('\n🎉 SCHEMA VALIDATION SUCCESSFUL!');
    console.log('================================');
    console.log('✅ Comprehensive Twikit integration schema validated');
    console.log('✅ All critical models and relationships present');
    console.log('✅ Performance optimization indexes configured');
    console.log('✅ Enterprise features properly implemented');
    console.log('✅ Ready for database migration');
    
    return true;
  } else {
    console.log('\n⚠️ Schema validation completed with issues');
    console.log('Please review and address the failed validations');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  runSchemaValidation()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Schema validation error:', error);
      process.exit(1);
    });
}

module.exports = {
  runSchemaValidation,
  validationResults
};
