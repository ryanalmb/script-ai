/**
 * Twikit Monitoring Dashboard API Routes - Task 25
 * 
 * RESTful API endpoints for the comprehensive Twikit monitoring dashboard.
 * Provides access to real-time metrics, system health, alerts, and historical data.
 * 
 * Endpoints:
 * - GET /api/monitoring/dashboard - Get comprehensive dashboard data
 * - GET /api/monitoring/metrics - Get current Twikit metrics
 * - GET /api/monitoring/health - Get system health status
 * - GET /api/monitoring/alerts - Get active alerts
 * - GET /api/monitoring/alerts/:id - Get specific alert details
 * - POST /api/monitoring/alerts/:id/acknowledge - Acknowledge an alert
 * - GET /api/monitoring/historical/:metric - Get historical data for a metric
 * - GET /api/monitoring/statistics - Get monitoring service statistics
 * - POST /api/monitoring/alert-rules - Create new alert rule
 * - PUT /api/monitoring/alert-rules/:id - Update alert rule
 * - DELETE /api/monitoring/alert-rules/:id - Delete alert rule
 * - GET /api/monitoring/alert-channels - Get alert channels
 * - POST /api/monitoring/alert-channels - Create alert channel
 * - PUT /api/monitoring/alert-channels/:id - Update alert channel
 * - DELETE /api/monitoring/alert-channels/:id - Delete alert channel
 */

import { Router, Request, Response } from 'express';
// Import express-validator functions
const expressValidator = require('express-validator');
const body = expressValidator.body;
const param = expressValidator.param;
const query = expressValidator.query;
const validationResult = expressValidator.validationResult;
import { logger, generateCorrelationId } from '../utils/logger';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';
import { TwikitMonitoringService } from '../services/twikitMonitoringService';
import { prisma } from '../lib/prisma';

const router = Router();

// Middleware to validate request and handle errors
const validateRequest = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Middleware to ensure monitoring service is available
const ensureMonitoringService = (req: Request, res: Response, next: any) => {
  if (!req.app.locals.monitoringService) {
    return res.status(503).json({
      success: false,
      error: 'Monitoring service not available'
    });
  }
  next();
};

// ============================================================================
// DASHBOARD AND METRICS ENDPOINTS
// ============================================================================

/**
 * GET /api/monitoring/dashboard
 * Get comprehensive dashboard data including metrics, health, alerts, and trends
 */
router.get('/dashboard', ensureMonitoringService, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();
  
  try {
    logger.info('Dashboard data requested', { correlationId });
    
    const monitoringService: TwikitMonitoringService = req.app.locals.monitoringService;
    const dashboardData = await monitoringService.getDashboardData();
    
    res.json({
      success: true,
      data: dashboardData,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get current Twikit metrics
 */
router.get('/metrics', ensureMonitoringService, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();
  
  try {
    logger.debug('Metrics requested', { correlationId });
    
    const monitoringService: TwikitMonitoringService = req.app.locals.monitoringService;
    const metrics = await monitoringService.collectTwikitMetrics();
    
    res.json({
      success: true,
      data: metrics,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/monitoring/health
 * Get system health status
 */
router.get('/health', ensureMonitoringService, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();
  
  try {
    logger.debug('Health status requested', { correlationId });
    
    const monitoringService: TwikitMonitoringService = req.app.locals.monitoringService;
    const health = await monitoringService.collectSystemHealth();
    
    res.json({
      success: true,
      data: health,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get health status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health status',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// ALERTS ENDPOINTS
// ============================================================================

/**
 * GET /api/monitoring/alerts
 * Get active alerts with optional filtering
 */
router.get('/alerts', [
  query('severity').optional().isIn(['info', 'warning', 'error', 'critical']),
  query('status').optional().isIn(['active', 'resolved', 'suppressed']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], validateRequest, ensureMonitoringService, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();
  
  try {
    const { severity, status = 'active', limit = 50, offset = 0 } = req.query;
    
    logger.debug('Alerts requested', { correlationId, severity, status, limit, offset });
    
    const monitoringService: TwikitMonitoringService = req.app.locals.monitoringService;
    const alerts = await monitoringService.getActiveAlerts();
    
    // Apply filtering
    let filteredAlerts = alerts.filter(alert => alert.status === status);
    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }
    
    // Apply pagination
    const paginatedAlerts = filteredAlerts.slice(Number(offset), Number(offset) + Number(limit));
    
    res.json({
      success: true,
      data: {
        alerts: paginatedAlerts,
        total: filteredAlerts.length,
        limit: Number(limit),
        offset: Number(offset)
      },
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/monitoring/alerts/:id
 * Get specific alert details
 */
router.get('/alerts/:id', [
  param('id').isString().notEmpty()
], validateRequest, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();
  
  try {
    const { id } = req.params;
    
    logger.debug('Alert details requested', { correlationId, alertId: id });
    
    const alert = await prisma.twikitAlert.findUnique({
      where: { id },
      include: {
        rule: true
      }
    });
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
        correlationId
      });
    }
    
    res.json({
      success: true,
      data: alert,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get alert details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert details',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/monitoring/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:id/acknowledge', [
  param('id').isString().notEmpty(),
  body('acknowledgedBy').isString().notEmpty()
], validateRequest, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();
  
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;
    
    logger.info('Alert acknowledgment requested', { correlationId, alertId: id, acknowledgedBy });
    
    const alert = await prisma.twikitAlert.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy,
        status: 'suppressed'
      }
    });
    
    res.json({
      success: true,
      data: alert,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to acknowledge alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/monitoring/statistics
 * Get monitoring service statistics
 */
router.get('/statistics', ensureMonitoringService, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();
  
  try {
    logger.debug('Statistics requested', { correlationId });
    
    const monitoringService: TwikitMonitoringService = req.app.locals.monitoringService;
    const statistics = monitoringService.getMonitoringStatistics();
    
    res.json({
      success: true,
      data: statistics,
      correlationId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// HISTORICAL DATA ENDPOINTS
// ============================================================================

/**
 * GET /api/monitoring/historical/:metric
 * Get historical data for a specific metric
 */
router.get('/historical/:metric', [
  param('metric').isString().notEmpty(),
  query('startDate').isISO8601(),
  query('endDate').isISO8601(),
  query('aggregation').optional().isIn(['raw', 'hourly', 'daily'])
], validateRequest, ensureMonitoringService, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();

  try {
    const { metric } = req.params;
    const { startDate, endDate, aggregation = 'hourly' } = req.query;

    logger.debug('Historical data requested', {
      correlationId,
      metric,
      startDate,
      endDate,
      aggregation
    });

    const monitoringService: TwikitMonitoringService = req.app.locals.monitoringService;
    const historicalData = await monitoringService.getHistoricalMetrics(
      metric,
      new Date(startDate as string),
      new Date(endDate as string),
      aggregation as 'raw' | 'hourly' | 'daily'
    );

    res.json({
      success: true,
      data: {
        metric,
        startDate,
        endDate,
        aggregation,
        data: historicalData,
        count: historicalData.length
      },
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get historical data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve historical data',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// ALERT RULES MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/monitoring/alert-rules
 * Get all alert rules
 */
router.get('/alert-rules', async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();

  try {
    logger.debug('Alert rules requested', { correlationId });

    const alertRules = await prisma.twikitAlertRule.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: alertRules,
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get alert rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert rules',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/monitoring/alert-rules
 * Create new alert rule
 */
router.post('/alert-rules', [
  body('name').isString().notEmpty(),
  body('description').isString().notEmpty(),
  body('metric').isString().notEmpty(),
  body('condition').isIn(['gt', 'lt', 'eq', 'ne', 'gte', 'lte']),
  body('threshold').isNumeric(),
  body('severity').isIn(['info', 'warning', 'error', 'critical']),
  body('duration').isInt({ min: 0 }),
  body('enabled').optional().isBoolean(),
  body('tags').optional().isArray(),
  body('channels').optional().isArray()
], validateRequest, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();

  try {
    const alertRuleData = req.body;

    logger.info('Creating alert rule', { correlationId, name: alertRuleData.name });

    const alertRule = await prisma.twikitAlertRule.create({
      data: {
        name: alertRuleData.name,
        description: alertRuleData.description,
        metric: alertRuleData.metric,
        condition: alertRuleData.condition,
        threshold: parseFloat(alertRuleData.threshold),
        severity: alertRuleData.severity,
        duration: parseInt(alertRuleData.duration),
        enabled: alertRuleData.enabled ?? true,
        tags: alertRuleData.tags ?? [],
        channels: alertRuleData.channels ?? []
      }
    });

    res.status(201).json({
      success: true,
      data: alertRule,
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to create alert rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert rule',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/monitoring/alert-rules/:id
 * Update alert rule
 */
router.put('/alert-rules/:id', [
  param('id').isString().notEmpty(),
  body('name').optional().isString().notEmpty(),
  body('description').optional().isString().notEmpty(),
  body('metric').optional().isString().notEmpty(),
  body('condition').optional().isIn(['gt', 'lt', 'eq', 'ne', 'gte', 'lte']),
  body('threshold').optional().isNumeric(),
  body('severity').optional().isIn(['info', 'warning', 'error', 'critical']),
  body('duration').optional().isInt({ min: 0 }),
  body('enabled').optional().isBoolean(),
  body('tags').optional().isArray(),
  body('channels').optional().isArray()
], validateRequest, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();

  try {
    const { id } = req.params;
    const updateData = req.body;

    logger.info('Updating alert rule', { correlationId, alertRuleId: id });

    // Convert numeric fields
    if (updateData.threshold !== undefined) {
      updateData.threshold = parseFloat(updateData.threshold);
    }
    if (updateData.duration !== undefined) {
      updateData.duration = parseInt(updateData.duration);
    }

    const alertRule = await prisma.twikitAlertRule.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: alertRule,
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to update alert rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert rule',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/monitoring/alert-rules/:id
 * Delete alert rule
 */
router.delete('/alert-rules/:id', [
  param('id').isString().notEmpty()
], validateRequest, async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId();

  try {
    const { id } = req.params;

    logger.info('Deleting alert rule', { correlationId, alertRuleId: id });

    await prisma.twikitAlertRule.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Alert rule deleted successfully',
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to delete alert rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert rule',
      correlationId,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
