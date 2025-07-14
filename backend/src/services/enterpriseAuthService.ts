import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface SecurityEvent {
  userId: string;
  event: string;
  ipAddress: string;
  userAgent: string;
  location?: string | null;
  timestamp: Date;
  success: boolean;
  metadata?: any;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  requiresMFA: boolean;
  requiresAdditionalVerification: boolean;
}

export class EnterpriseAuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
  private readonly REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-super-secret-refresh-key';
  private readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-encryption-key-here';

  // Generate secure tokens
  async generateTokens(userId: string, sessionId: string): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { 
        userId, 
        sessionId,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
      },
      this.JWT_SECRET,
      { 
        expiresIn: '15m',
        issuer: 'x-marketing-platform',
        audience: 'x-marketing-users'
      }
    );

    const refreshToken = jwt.sign(
      { 
        userId, 
        sessionId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
      },
      this.REFRESH_SECRET,
      { 
        expiresIn: '7d',
        issuer: 'x-marketing-platform',
        audience: 'x-marketing-users'
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 minutes
    };
  }

  // Verify tokens
  async verifyToken(token: string, type: 'access' | 'refresh' = 'access'): Promise<any> {
    try {
      const secret = type === 'access' ? this.JWT_SECRET : this.REFRESH_SECRET;
      const decoded = jwt.verify(token, secret) as any;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Setup Multi-Factor Authentication
  async setupMFA(userId: string): Promise<MFASetup> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `X Marketing Platform (${user.email})`,
      issuer: 'X Marketing Platform',
      length: 32
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Store encrypted secret and backup codes
    const encryptedSecret = this.encrypt(secret.base32!);
    const encryptedBackupCodes = backupCodes.map(code => this.encrypt(code));

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: encryptedBackupCodes,
        mfaEnabled: false // Will be enabled after verification
      }
    });

    return {
      secret: secret.base32!,
      qrCode,
      backupCodes
    };
  }

  // Verify MFA token
  async verifyMFA(userId: string, token: string, isBackupCode: boolean = false): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) {
      throw new Error('MFA not set up for this user');
    }

    if (isBackupCode) {
      // Verify backup code
      const decryptedBackupCodes = user.mfaBackupCodes?.map(code => this.decrypt(code)) || [];
      const isValidBackupCode = decryptedBackupCodes.includes(token.toUpperCase());
      
      if (isValidBackupCode) {
        // Remove used backup code
        const remainingCodes = user.mfaBackupCodes?.filter(code => 
          this.decrypt(code) !== token.toUpperCase()
        ) || [];
        
        await prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: remainingCodes }
        });
        
        return true;
      }
      return false;
    } else {
      // Verify TOTP token
      const decryptedSecret = this.decrypt(user.mfaSecret);
      return speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token,
        window: 2 // Allow 2 time steps (60 seconds) tolerance
      });
    }
  }

  // Enable MFA after successful verification
  async enableMFA(userId: string, token: string): Promise<void> {
    const isValid = await this.verifyMFA(userId, token);
    if (!isValid) {
      throw new Error('Invalid MFA token');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true }
    });

    await this.logSecurityEvent({
      userId,
      event: 'MFA_ENABLED',
      ipAddress: '',
      userAgent: '',
      timestamp: new Date(),
      success: true
    });
  }

  // Risk-based authentication
  async assessLoginRisk(userId: string, ipAddress: string, userAgent: string): Promise<RiskAssessment> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { riskLevel: 'high', requiresMFA: true, requiresAdditionalVerification: true };
    }

    // Check recent login history
    const recentLogins = await this.getRecentSecurityEvents(userId, 'LOGIN_SUCCESS', 30);
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let requiresAdditionalVerification = false;

    // Check for new IP address
    const knownIPs = recentLogins.map(event => event.ipAddress);
    if (!knownIPs.includes(ipAddress)) {
      riskLevel = 'medium';
    }

    // Check for new device/browser
    const knownUserAgents = recentLogins.map(event => event.userAgent);
    if (!knownUserAgents.includes(userAgent)) {
      riskLevel = riskLevel === 'medium' ? 'high' : 'medium';
    }

    // Check for suspicious patterns
    const failedAttempts = await this.getRecentSecurityEvents(userId, 'LOGIN_FAILED', 1);
    if (failedAttempts.length > 3) {
      riskLevel = 'high';
      requiresAdditionalVerification = true;
    }

    return {
      riskLevel,
      requiresMFA: user.mfaEnabled || riskLevel !== 'low',
      requiresAdditionalVerification
    };
  }

  // Log security events for audit trail
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          userId: event.userId,
          event: event.event,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          location: event.location || null,
          success: event.success,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
          timestamp: event.timestamp
        }
      });
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  // Get recent security events
  private async getRecentSecurityEvents(userId: string, eventType: string, days: number): Promise<any[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await prisma.securityEvent.findMany({
      where: {
        userId,
        event: eventType,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'desc' }
    });
  }

  // Encryption utilities
  private encrypt(text: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decrypt(encryptedText: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Password utilities
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate secure session ID
  generateSessionId(): string {
    return crypto.randomUUID();
  }
}
