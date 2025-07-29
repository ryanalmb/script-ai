/**
 * Correlation ID Utility
 * 
 * Generates unique correlation IDs for request tracing and audit trails.
 * Used across the Twikit system for tracking operations and debugging.
 * 
 * @author Twikit Development Team
 * @version 1.0.0
 * @since 2024-12-28
 */

import { randomBytes } from 'crypto';

/**
 * Generate a unique correlation ID
 * Format: timestamp_randomHex (e.g., 1703779200000_a1b2c3d4e5f6)
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now();
  const randomHex = randomBytes(6).toString('hex');
  return `${timestamp}_${randomHex}`;
}

/**
 * Generate a short correlation ID (for space-constrained scenarios)
 * Format: randomHex (e.g., a1b2c3d4)
 */
export function generateShortCorrelationId(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Validate correlation ID format
 */
export function isValidCorrelationId(correlationId: string): boolean {
  // Check for timestamp_hex format
  const timestampHexPattern = /^\d{13}_[a-f0-9]{12}$/;
  // Check for short hex format
  const shortHexPattern = /^[a-f0-9]{8}$/;
  
  return timestampHexPattern.test(correlationId) || shortHexPattern.test(correlationId);
}

/**
 * Extract timestamp from correlation ID (if available)
 */
export function extractTimestamp(correlationId: string): Date | null {
  const parts = correlationId.split('_');
  if (parts.length === 2 && parts[0]) {
    const timestamp = parseInt(parts[0], 10);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
  }
  return null;
}
