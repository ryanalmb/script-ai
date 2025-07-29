/**
 * Compliance and Audit Trail API Routes - Task 26
 * 
 * RESTful API endpoints for compliance management, audit trail access,
 * privacy requests, and compliance reporting.
 * 
 * Features:
 * - Privacy request management (GDPR/CCPA)
 * - Compliance report generation and access
 * - Audit trail querying and verification
 * - Compliance violation tracking
 * - Data retention policy management
 * 
 * @author Twikit Development Team
 * @version 1.0.0
 * @since 2024-12-28
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';
import { ComplianceAuditService, ComplianceFramework } from '../services/complianceAuditService';
import { ComplianceIntegrationService } from '../services/complianceIntegrationService';

// Import express-validator functions
const expressValidator = require('express-validator');
const body = expressValidator.body;
const param = expressValidator.param;
const query = expressValidator.query;
const validationResult = expressValidator.validationResult;

const router = Router();
const prisma = new PrismaClient();
const complianceAuditService = new ComplianceAuditService(prisma);
const complianceIntegrationService = new ComplianceIntegrationService(prisma);

// Middleware for request validation
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  next();
};

// Middleware for error handling
const handleError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Compliance API error:', error);

  if (error instanceof TwikitError) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: error.code,
      details: error.details
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
};

/**
 * @route GET /api/compliance/metrics
 * @desc Get compliance metrics for dashboard
 * @access Private
 */
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [complianceMetrics, integrationMetrics] = await Promise.all([
      complianceAuditService.getComplianceMetrics(),
      complianceIntegrationService.getIntegrationMetrics()
    ]);

    res.json({
      success: true,
      data: {
        compliance: complianceMetrics,
        integration: integrationMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/compliance/privacy-requests
 * @desc Create a new privacy request (GDPR/CCPA)
 * @access Private
 */
router.post('/privacy-requests', [
  body('requestType').isIn(['ACCESS', 'DELETE', 'CORRECT', 'OPT_OUT', 'PORTABILITY']),
  body('complianceFramework').isIn(['GDPR', 'CCPA', 'CUSTOM']),
  body('requestorEmail').isEmail(),
  body('requestorName').optional().isString(),
  body('dataSubject').optional().isString(),
  body('requestDetails').isObject(),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      requestType,
      complianceFramework,
      userId,
      requestorEmail,
      requestorName,
      dataSubject,
      requestDetails
    } = req.body;

    // Calculate due date based on compliance framework
    const dueDate = new Date();
    if (complianceFramework === 'GDPR') {
      dueDate.setDate(dueDate.getDate() + 30); // 30 days for GDPR
    } else if (complianceFramework === 'CCPA') {
      dueDate.setDate(dueDate.getDate() + 45); // 45 days for CCPA
    } else {
      dueDate.setDate(dueDate.getDate() + 30); // Default 30 days
    }

    const requestId = await complianceAuditService.createPrivacyRequest({
      requestType,
      complianceFramework: complianceFramework as ComplianceFramework,
      userId,
      requestorEmail,
      requestorName,
      dataSubject,
      requestDetails,
      dueDate
    });

    res.status(201).json({
      success: true,
      data: {
        requestId,
        dueDate,
        message: 'Privacy request created successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/compliance/privacy-requests
 * @desc Get privacy requests with filtering
 * @access Private
 */
router.get('/privacy-requests', [
  query('status').optional().isString(),
  query('complianceFramework').optional().isIn(['GDPR', 'CCPA', 'CUSTOM']),
  query('requestType').optional().isIn(['ACCESS', 'DELETE', 'CORRECT', 'OPT_OUT', 'PORTABILITY']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      status,
      complianceFramework,
      requestType,
      page = 1,
      limit = 20
    } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (complianceFramework) where.complianceFramework = complianceFramework;
    if (requestType) where.requestType = requestType;

    const [requests, total] = await Promise.all([
      prisma.privacyRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
          id: true,
          requestId: true,
          requestType: true,
          complianceFramework: true,
          status: true,
          requestorEmail: true,
          submittedAt: true,
          dueDate: true,
          completedAt: true
        }
      }),
      prisma.privacyRequest.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/compliance/reports
 * @desc Generate a compliance report
 * @access Private
 */
router.post('/reports', [
  body('reportType').isString(),
  body('complianceFramework').isIn(['GDPR', 'CCPA', 'SOX', 'HIPAA', 'CUSTOM']),
  body('reportPeriod').isIn(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']),
  body('periodStart').isISO8601(),
  body('periodEnd').isISO8601(),
  body('includeViolations').optional().isBoolean(),
  body('includeRecommendations').optional().isBoolean(),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      reportType,
      complianceFramework,
      reportPeriod,
      periodStart,
      periodEnd,
      includeViolations = true,
      includeRecommendations = true
    } = req.body;

    const reportId = await complianceAuditService.generateComplianceReport({
      reportType,
      complianceFramework: complianceFramework as ComplianceFramework,
      reportPeriod,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      includeViolations,
      includeRecommendations
    });

    res.status(201).json({
      success: true,
      data: {
        reportId,
        message: 'Compliance report generation started'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/compliance/reports
 * @desc Get compliance reports
 * @access Private
 */
router.get('/reports', [
  query('complianceFramework').optional().isIn(['GDPR', 'CCPA', 'SOX', 'HIPAA', 'CUSTOM']),
  query('status').optional().isIn(['GENERATING', 'COMPLETED', 'FAILED', 'ARCHIVED']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      complianceFramework,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const where: any = {};
    if (complianceFramework) where.complianceFramework = complianceFramework;
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      prisma.complianceReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
          id: true,
          reportType: true,
          complianceFramework: true,
          reportPeriod: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          createdAt: true,
          summary: true
        }
      }),
      prisma.complianceReport.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/compliance/reports/:id
 * @desc Get a specific compliance report
 * @access Private
 */
router.get('/reports/:id', [
  param('id').isString(),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Report ID is required'
      });
      return;
    }

    const report = await prisma.complianceReport.findUnique({
      where: { id }
    });

    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/compliance/violations
 * @desc Record a compliance violation
 * @access Private
 */
router.post('/violations', [
  body('violationType').isString(),
  body('complianceFramework').isIn(['GDPR', 'CCPA', 'SOX', 'HIPAA', 'CUSTOM']),
  body('severity').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  body('title').isString(),
  body('description').isString(),
  body('affectedUsers').optional().isInt({ min: 0 }),
  body('affectedRecords').optional().isInt({ min: 0 }),
  body('dataTypes').optional().isArray(),
  body('reportedBy').optional().isString(),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const violationData = req.body;
    violationData.complianceFramework = violationData.complianceFramework as ComplianceFramework;

    const violationId = await complianceAuditService.recordComplianceViolation(violationData);

    res.status(201).json({
      success: true,
      data: {
        violationId,
        message: 'Compliance violation recorded successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/compliance/audit-trail/verify
 * @desc Verify audit trail integrity
 * @access Private
 */
router.get('/audit-trail/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const verificationResult = await complianceAuditService.verifyAuditTrailIntegrity();

    res.json({
      success: true,
      data: verificationResult
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/compliance/audit-events
 * @desc Get audit events with filtering
 * @access Private
 */
router.get('/audit-events', [
  query('eventType').optional().isString(),
  query('complianceFramework').optional().isIn(['GDPR', 'CCPA', 'SOX', 'HIPAA', 'CUSTOM']),
  query('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('userId').optional().isString(),
  query('accountId').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      eventType,
      complianceFramework,
      riskLevel,
      userId,
      accountId,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const where: any = {};
    if (eventType) where.eventType = eventType;
    if (complianceFramework) where.complianceFramework = complianceFramework;
    if (riskLevel) where.riskLevel = riskLevel;
    if (userId) where.userId = userId;
    if (accountId) where.accountId = accountId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [events, total] = await Promise.all([
      prisma.complianceAuditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
          id: true,
          eventId: true,
          eventType: true,
          eventCategory: true,
          complianceFramework: true,
          action: true,
          outcome: true,
          riskLevel: true,
          userId: true,
          accountId: true,
          createdAt: true
        }
      }),
      prisma.complianceAuditEvent.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Apply error handling middleware
router.use(handleError);

export default router;
