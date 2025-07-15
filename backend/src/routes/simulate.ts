import express, { Request, Response } from 'express';
// Create a simple async handler since the middleware doesn't exist
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
import { logger } from '../utils/logger';
import { AccountSimulatorService } from '../services/accountSimulatorService';

const router = express.Router();
const simulatorService = new AccountSimulatorService();

/**
 * Create a simulated account
 */
router.post('/create-account', asyncHandler(async (req: Request, res: Response) => {
  const { telegramUserId, accountType, tier, activityLevel, verified } = req.body;

  if (!telegramUserId || !accountType || !tier || !activityLevel) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    logger.info('Creating simulated account', {
      telegramUserId,
      accountType,
      tier,
      activityLevel,
      verified
    });

    const account = await simulatorService.createSimulatedAccount(telegramUserId, {
      accountType,
      tier,
      activityLevel,
      verified
    });

    return res.json({
      success: true,
      account,
      message: 'Simulated account created successfully'
    });

  } catch (error) {
    logger.error('Failed to create simulated account:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create simulated account',
      code: 'CREATION_FAILED'
    });
  }
}));

/**
 * Get simulated accounts for a user
 */
router.get('/accounts/:telegramUserId', asyncHandler(async (req: Request, res: Response) => {
  const { telegramUserId } = req.params;

  if (!telegramUserId) {
    return res.status(400).json({
      success: false,
      error: 'Telegram user ID is required',
      code: 'MISSING_USER_ID'
    });
  }

  try {
    const accounts = await simulatorService.getSimulatedAccounts(parseInt(telegramUserId));

    return res.json({
      success: true,
      accounts,
      count: accounts.length
    });

  } catch (error) {
    logger.error('Failed to get simulated accounts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve simulated accounts',
      code: 'RETRIEVAL_FAILED'
    });
  }
}));

/**
 * Get detailed information about a specific simulated account
 */
router.post('/accounts/:accountId/details', asyncHandler(async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { telegramUserId } = req.body;

  if (!accountId || !telegramUserId) {
    return res.status(400).json({
      success: false,
      error: 'Account ID and Telegram user ID are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const account = await simulatorService.getAccountDetails(accountId, telegramUserId);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or access denied',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      account
    });

  } catch (error) {
    logger.error('Failed to get account details:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve account details',
      code: 'DETAILS_FAILED'
    });
  }
}));

/**
 * Delete a simulated account
 */
router.delete('/accounts/:accountId', asyncHandler(async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { telegramUserId } = req.body;

  if (!accountId || !telegramUserId) {
    return res.status(400).json({
      success: false,
      error: 'Account ID and Telegram user ID are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const deleted = await simulatorService.deleteSimulatedAccount(accountId, telegramUserId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or access denied',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      message: 'Account deleted successfully',
      accountId
    });

  } catch (error) {
    logger.error('Failed to delete simulated account:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete account',
      code: 'DELETION_FAILED'
    });
  }
}));

/**
 * Update simulated account settings
 */
router.patch('/accounts/:accountId/settings', asyncHandler(async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { telegramUserId, settings } = req.body;

  if (!accountId || !telegramUserId || !settings) {
    return res.status(400).json({
      success: false,
      error: 'Account ID, Telegram user ID, and settings are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const updated = await simulatorService.updateAccountSettings(accountId, telegramUserId, settings);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or access denied',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      message: 'Account settings updated successfully',
      accountId
    });

  } catch (error) {
    logger.error('Failed to update account settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      code: 'UPDATE_FAILED'
    });
  }
}));

/**
 * Simulate account activity
 */
router.post('/accounts/:accountId/simulate-activity', asyncHandler(async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { telegramUserId, activityType, parameters } = req.body;

  if (!accountId || !telegramUserId || !activityType) {
    return res.status(400).json({
      success: false,
      error: 'Account ID, Telegram user ID, and activity type are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const result = await simulatorService.simulateActivity(accountId, telegramUserId, activityType, parameters);

    return res.json({
      success: true,
      result,
      message: `${activityType} activity simulated successfully`
    });

  } catch (error) {
    logger.error('Failed to simulate activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to simulate activity',
      code: 'SIMULATION_FAILED'
    });
  }
}));

/**
 * Get account analytics
 */
router.get('/accounts/:accountId/analytics', asyncHandler(async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { telegram_user_id } = req.query;

  if (!accountId || !telegram_user_id) {
    return res.status(400).json({
      success: false,
      error: 'Account ID and Telegram user ID are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const analytics = await simulatorService.getAccountAnalytics(accountId, parseInt(telegram_user_id as string));

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or access denied',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      analytics
    });

  } catch (error) {
    logger.error('Failed to get account analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      code: 'ANALYTICS_FAILED'
    });
  }
}));

/**
 * Reset account data
 */
router.post('/accounts/:accountId/reset', asyncHandler(async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { telegramUserId, resetType } = req.body;

  if (!accountId || !telegramUserId) {
    return res.status(400).json({
      success: false,
      error: 'Account ID and Telegram user ID are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const reset = await simulatorService.resetAccountData(accountId, telegramUserId, resetType || 'full');

    if (!reset) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or access denied',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      message: 'Account data reset successfully',
      resetType: resetType || 'full'
    });

  } catch (error) {
    logger.error('Failed to reset account data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset account data',
      code: 'RESET_FAILED'
    });
  }
}));

/**
 * Get simulator statistics
 */
router.get('/statistics', asyncHandler(async (req: Request, res: Response) => {
  try {
    const statistics = await simulatorService.getSimulatorStatistics();

    return res.json({
      success: true,
      statistics
    });

  } catch (error) {
    logger.error('Failed to get simulator statistics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
      code: 'STATISTICS_FAILED'
    });
  }
}));

export default router;
