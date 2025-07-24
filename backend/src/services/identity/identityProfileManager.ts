/**
 * Identity Profile Manager
 * Manages persistent identity profiles for anti-detection
 */

import { PrismaClient } from '@prisma/client';
import Redis, { Redis as RedisType } from 'ioredis';
import { EventEmitter } from 'events';
import { AntiDetectionConfig, ProfileType, DeviceCategory } from '../../config/antiDetection';
import { logger } from '../../utils/logger';

export interface IdentityProfile {
  id: string;
  profileName: string;
  accountId?: string | null;
  profileType: ProfileType;
  deviceCategory: DeviceCategory;
  operatingSystem: string;
  browserType: string;
  browserVersion: string;
  userAgent: string;
  screenResolution: string;
  colorDepth: number;
  timezone: string;
  language: string;
  languages: string[];
  platform: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
  cookieEnabled: boolean;
  doNotTrack?: string | null;
  plugins: any[];
  mimeTypes: any[];
  geolocation?: any;
  connectionType?: string | null;
  effectiveType?: string | null;
  downlink?: number | null;
  rtt?: number | null;
  isActive: boolean;
  lastUsed?: Date | null;
  usageCount: number;
  successRate: number;
  detectionScore: number;
  profileConsistency: number;
  agingFactor: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
}

export class IdentityProfileManager extends EventEmitter {
  private prisma: PrismaClient;
  private redis: RedisType;
  private config: AntiDetectionConfig;
  private profileCache: Map<string, IdentityProfile> = new Map();
  private isInitialized: boolean = false;

  // Profile generation templates
  private browserProfiles = [
    {
      browserType: 'Chrome',
      browserVersion: '120.0.0.0',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      operatingSystem: 'Windows',
    },
    {
      browserType: 'Firefox',
      browserVersion: '121.0',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      platform: 'Win32',
      operatingSystem: 'Windows',
    },
    {
      browserType: 'Safari',
      browserVersion: '17.0',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      operatingSystem: 'macOS',
    },
  ];

  private screenResolutions = [
    '1920x1080', '1366x768', '1536x864', '1440x900', '1280x720',
    '2560x1440', '1600x900', '1024x768', '1280x1024', '1680x1050'
  ];

  private timezones = [
    'America/New_York', 'America/Los_Angeles', 'America/Chicago',
    'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'
  ];

  constructor(prisma: PrismaClient, redis: RedisType, config: AntiDetectionConfig) {
    super();
    this.prisma = prisma;
    this.redis = redis;
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Identity Profile Manager...');

      // Load existing profiles from database
      await this.loadExistingProfiles();

      // Setup Redis subscriptions for profile updates
      await this.setupRedisSubscriptions();

      // Start background cleanup task
      this.startBackgroundTasks();

      this.isInitialized = true;
      logger.info('Identity Profile Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Identity Profile Manager:', error);
      throw error;
    }
  }

  /**
   * Get or create identity profile for account and session
   */
  public async getOrCreateIdentityProfile(
    accountId: string,
    sessionId: string
  ): Promise<IdentityProfile> {
    try {
      // Try to find existing active profile for this account
      let profile = await this.prisma.identityProfile.findFirst({
        where: {
          accountId,
          isActive: true,
          detectionScore: {
            lt: this.config.identityProfiles.detectionScoreThreshold,
          },
        },
        orderBy: {
          detectionScore: 'asc',
        },
      });

      if (profile) {
        // Update usage statistics
        await this.updateProfileUsage(profile.id);
        
        const identityProfile: IdentityProfile = {
          ...profile,
          profileType: profile.profileType as ProfileType,
          deviceCategory: profile.deviceCategory as DeviceCategory,
          plugins: profile.plugins as any[],
          mimeTypes: profile.mimeTypes as any[],
          languages: profile.languages as string[],
        };

        // Cache the profile
        this.profileCache.set(profile.id, identityProfile);
        
        this.emit('profileReused', { profileId: profile.id, accountId });
        return identityProfile;
      }

      // Create new profile if none found or all are compromised
      profile = await this.createNewProfile(accountId);
      
      if (!profile) {
        throw new Error('Failed to create profile');
      }

      const identityProfile: IdentityProfile = {
        ...profile,
        profileType: profile.profileType as ProfileType,
        deviceCategory: profile.deviceCategory as DeviceCategory,
        plugins: profile.plugins as any[],
        mimeTypes: profile.mimeTypes as any[],
        languages: profile.languages as string[],
      };

      this.emit('profileCreated', { profileId: profile.id, accountId });
      return identityProfile;
    } catch (error) {
      logger.error('Failed to get or create identity profile:', error);
      throw error;
    }
  }

  /**
   * Create new identity profile
   */
  private async createNewProfile(accountId: string): Promise<any> {
    try {
      // Select random browser profile
      const browserProfile = this.browserProfiles[
        Math.floor(Math.random() * this.browserProfiles.length)
      ];

      if (!browserProfile) {
        throw new Error('No browser profiles available');
      }

      // Select random screen resolution
      const screenResolution = this.screenResolutions[
        Math.floor(Math.random() * this.screenResolutions.length)
      ] || '1920x1080';

      // Select random timezone
      const timezone = this.timezones[
        Math.floor(Math.random() * this.timezones.length)
      ];

      if (!timezone) {
        throw new Error('No timezones available');
      }

      // Generate profile name
      const profileName = `profile_${accountId}_${Date.now()}`;

      // Determine device category and adjust specs accordingly
      const deviceCategory = this.selectDeviceCategory();
      const specs = this.generateDeviceSpecs(deviceCategory);

      const profileData = {
        profileName,
        accountId,
        profileType: this.selectProfileType(),
        deviceCategory,
        operatingSystem: browserProfile.operatingSystem,
        browserType: browserProfile.browserType,
        browserVersion: browserProfile.browserVersion,
        userAgent: browserProfile.userAgent,
        screenResolution,
        colorDepth: 24,
        timezone,
        language: 'en-US',
        languages: ['en-US', 'en'],
        platform: browserProfile.platform,
        hardwareConcurrency: specs.hardwareConcurrency,
        deviceMemory: specs.deviceMemory,
        maxTouchPoints: deviceCategory === 'MOBILE' ? 5 : 0,
        cookieEnabled: true,
        doNotTrack: Math.random() > 0.5 ? '1' : null,
        plugins: this.generatePlugins(browserProfile.browserType),
        mimeTypes: this.generateMimeTypes(),
        geolocation: this.generateGeolocation(timezone),
        connectionType: this.selectConnectionType(),
        effectiveType: this.selectEffectiveType(),
        downlink: Math.random() * 10 + 1, // 1-11 Mbps
        rtt: Math.floor(Math.random() * 100) + 20, // 20-120ms
        isActive: true,
        usageCount: 0,
        successRate: 100.0,
        detectionScore: 0.0,
        profileConsistency: 100.0,
        agingFactor: 1.0,
        expiresAt: new Date(Date.now() + this.config.identityProfiles.profileExpirationDays * 24 * 60 * 60 * 1000),
      };

      const profile = await this.prisma.identityProfile.create({
        data: profileData,
      });

      logger.info(`Created new identity profile: ${profile.id} for account: ${accountId}`);
      return profile;
    } catch (error) {
      logger.error('Failed to create new profile:', error);
      throw error;
    }
  }

  /**
   * Update profile usage statistics
   */
  private async updateProfileUsage(profileId: string): Promise<void> {
    try {
      await this.prisma.identityProfile.update({
        where: { id: profileId },
        data: {
          usageCount: { increment: 1 },
          lastUsed: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to update profile usage:', error);
    }
  }

  /**
   * Update detection score for profile
   */
  public async updateDetectionScore(
    profileId: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): Promise<void> {
    try {
      const scoreIncrease = {
        LOW: 5,
        MEDIUM: 15,
        HIGH: 30,
        CRITICAL: 50,
      }[severity];

      await this.prisma.identityProfile.update({
        where: { id: profileId },
        data: {
          detectionScore: { increment: scoreIncrease },
        },
      });

      // Remove from cache to force reload
      this.profileCache.delete(profileId);

      logger.info(`Updated detection score for profile ${profileId}: +${scoreIncrease}`);
      this.emit('detectionScoreUpdated', { profileId, severity, scoreIncrease });
    } catch (error) {
      logger.error('Failed to update detection score:', error);
      throw error;
    }
  }

  /**
   * Rotate identity profile for account
   */
  public async rotateIdentityProfile(accountId: string, sessionId: string): Promise<IdentityProfile> {
    try {
      // Deactivate current profile
      await this.prisma.identityProfile.updateMany({
        where: { accountId, isActive: true },
        data: { isActive: false },
      });

      // Create new profile
      const newProfile = await this.createNewProfile(accountId);
      
      logger.info(`Rotated identity profile for account: ${accountId}`);
      this.emit('profileRotated', { accountId, sessionId, newProfileId: newProfile.id });

      return {
        ...newProfile,
        plugins: newProfile.plugins as any[],
        mimeTypes: newProfile.mimeTypes as any[],
        languages: newProfile.languages as string[],
      };
    } catch (error) {
      logger.error('Failed to rotate identity profile:', error);
      throw error;
    }
  }

  /**
   * Clean up expired profiles
   */
  public async cleanupExpiredProfiles(): Promise<void> {
    try {
      const expiredProfiles = await this.prisma.identityProfile.findMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { detectionScore: { gte: 90 } }, // Highly compromised profiles
          ],
        },
      });

      for (const profile of expiredProfiles) {
        await this.prisma.identityProfile.update({
          where: { id: profile.id },
          data: { isActive: false },
        });

        this.profileCache.delete(profile.id);
      }

      if (expiredProfiles.length > 0) {
        logger.info(`Cleaned up ${expiredProfiles.length} expired profiles`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired profiles:', error);
    }
  }

  /**
   * Handle profile update from other instances
   */
  public async handleProfileUpdate(profileData: any): Promise<void> {
    try {
      // Update local cache
      if (this.profileCache.has(profileData.id)) {
        this.profileCache.set(profileData.id, profileData);
      }

      logger.debug(`Handled profile update for: ${profileData.id}`);
    } catch (error) {
      logger.error('Failed to handle profile update:', error);
    }
  }

  /**
   * Get statistics
   */
  public async getStatistics(): Promise<any> {
    try {
      const totalProfiles = await this.prisma.identityProfile.count();
      const activeProfiles = await this.prisma.identityProfile.count({
        where: { isActive: true },
      });
      const compromisedProfiles = await this.prisma.identityProfile.count({
        where: { detectionScore: { gte: this.config.identityProfiles.detectionScoreThreshold } },
      });

      return {
        isInitialized: this.isInitialized,
        totalProfiles,
        activeProfiles,
        compromisedProfiles,
        cachedProfiles: this.profileCache.size,
      };
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      return {};
    }
  }

  /**
   * Update configuration
   */
  public async updateConfiguration(config: AntiDetectionConfig): Promise<void> {
    this.config = config;
    logger.info('Identity Profile Manager configuration updated');
  }

  /**
   * Shutdown
   */
  public async shutdown(): Promise<void> {
    this.profileCache.clear();
    this.isInitialized = false;
    logger.info('Identity Profile Manager shut down');
  }

  // Private helper methods
  private async loadExistingProfiles(): Promise<void> {
    try {
      const profiles = await this.prisma.identityProfile.findMany({
        where: { isActive: true },
        take: 50, // Limit for performance
      });

      profiles.forEach(profile => {
        const identityProfile: IdentityProfile = {
          ...profile,
          profileType: profile.profileType as ProfileType,
          deviceCategory: profile.deviceCategory as DeviceCategory,
          plugins: profile.plugins as any[],
          mimeTypes: profile.mimeTypes as any[],
          languages: profile.languages as string[],
        };
        this.profileCache.set(profile.id, identityProfile);
      });

      logger.debug(`Loaded ${profiles.length} identity profiles`);
    } catch (error) {
      logger.error('Failed to load existing profiles:', error);
    }
  }

  private async setupRedisSubscriptions(): Promise<void> {
    // Setup Redis subscriptions for profile updates
    // Implementation would subscribe to profile update channels
  }

  private startBackgroundTasks(): void {
    // Cleanup expired profiles every hour
    setInterval(() => {
      this.cleanupExpiredProfiles();
    }, 3600000);
  }

  private selectProfileType(): ProfileType {
    const types: ProfileType[] = ['HUMAN_LIKE', 'POWER_USER', 'CASUAL_USER', 'MOBILE_USER'];
    const weights = [0.4, 0.2, 0.3, 0.1]; // Probability weights
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < types.length; i++) {
      const weight = weights[i];
      if (weight !== undefined) {
        cumulative += weight;
        if (random <= cumulative) {
          const selectedType = types[i];
          if (selectedType !== undefined) {
            return selectedType;
          }
        }
      }
    }
    
    return 'HUMAN_LIKE';
  }

  private selectDeviceCategory(): DeviceCategory {
    const categories: DeviceCategory[] = ['DESKTOP', 'MOBILE', 'TABLET'];
    const weights = [0.7, 0.25, 0.05]; // Desktop is most common
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < categories.length; i++) {
      const weight = weights[i];
      if (weight !== undefined) {
        cumulative += weight;
        if (random <= cumulative) {
          const selectedCategory = categories[i];
          if (selectedCategory !== undefined) {
            return selectedCategory;
          }
        }
      }
    }
    
    return 'DESKTOP';
  }

  private generateDeviceSpecs(deviceCategory: DeviceCategory): any {
    switch (deviceCategory) {
      case 'MOBILE':
        return {
          hardwareConcurrency: Math.floor(Math.random() * 4) + 4, // 4-8 cores
          deviceMemory: Math.floor(Math.random() * 4) + 4, // 4-8 GB
        };
      case 'TABLET':
        return {
          hardwareConcurrency: Math.floor(Math.random() * 4) + 6, // 6-10 cores
          deviceMemory: Math.floor(Math.random() * 4) + 6, // 6-10 GB
        };
      default: // DESKTOP
        return {
          hardwareConcurrency: Math.floor(Math.random() * 8) + 8, // 8-16 cores
          deviceMemory: Math.floor(Math.random() * 16) + 8, // 8-24 GB
        };
    }
  }

  private generatePlugins(browserType: string): any[] {
    const commonPlugins = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Native Client', filename: 'internal-nacl-plugin' },
    ];

    if (browserType === 'Chrome') {
      return commonPlugins;
    }

    return [];
  }

  private generateMimeTypes(): any[] {
    return [
      { type: 'application/pdf', suffixes: 'pdf' },
      { type: 'text/plain', suffixes: 'txt' },
      { type: 'text/html', suffixes: 'html,htm' },
    ];
  }

  private generateGeolocation(timezone: string): any {
    // Generate approximate coordinates based on timezone
    const timezoneCoords: Record<string, { lat: number; lng: number }> = {
      'America/New_York': { lat: 40.7128, lng: -74.0060 },
      'America/Los_Angeles': { lat: 34.0522, lng: -118.2437 },
      'Europe/London': { lat: 51.5074, lng: -0.1278 },
      'Asia/Tokyo': { lat: 35.6762, lng: 139.6503 },
    };

    const coords = timezoneCoords[timezone] || { lat: 0, lng: 0 };
    
    return {
      latitude: coords.lat + (Math.random() - 0.5) * 0.1, // Add some variation
      longitude: coords.lng + (Math.random() - 0.5) * 0.1,
      accuracy: Math.floor(Math.random() * 100) + 10,
    };
  }

  private selectConnectionType(): string {
    const types = ['4g', 'wifi', 'ethernet'];
    const weights = [0.3, 0.5, 0.2];
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < types.length; i++) {
      const weight = weights[i];
      if (weight !== undefined) {
        cumulative += weight;
        if (random <= cumulative) {
          const selectedType = types[i];
          if (selectedType !== undefined) {
            return selectedType;
          }
        }
      }
    }
    
    return 'wifi';
  }

  private selectEffectiveType(): string {
    const types = ['slow-2g', '2g', '3g', '4g'];
    const weights = [0.05, 0.1, 0.25, 0.6];
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < types.length; i++) {
      const weight = weights[i];
      if (weight !== undefined) {
        cumulative += weight;
        if (random <= cumulative) {
          const selectedType = types[i];
          if (selectedType !== undefined) {
            return selectedType;
          }
        }
      }
    }
    
    return '4g';
  }
}
