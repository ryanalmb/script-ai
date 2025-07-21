/**
 * Module Alias Configuration
 * Sets up path aliases for both development and production environments
 */

import moduleAlias from 'module-alias';
import path from 'path';

// Determine if we're running from source or compiled
const isProduction = process.env['NODE_ENV'] === 'production';
const rootDir = isProduction ? path.join(__dirname, '..') : __dirname;

// Configure module aliases
moduleAlias.addAliases({
  '@': rootDir,
  '@/config': path.join(rootDir, 'config'),
  '@/services': path.join(rootDir, 'services'),
  '@/utils': path.join(rootDir, 'utils'),
  '@/types': path.join(rootDir, 'types'),
  '@/middleware': path.join(rootDir, 'middleware'),
  '@/routes': path.join(rootDir, 'routes')
});

export default moduleAlias;
