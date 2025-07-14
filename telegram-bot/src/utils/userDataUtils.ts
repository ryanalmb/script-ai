/**
 * Utility functions for safely handling Telegram user data with TypeScript strict mode
 */

import { User } from 'node-telegram-bot-api';

/**
 * Safely extract user data for API calls, only including defined properties
 */
export function extractUserData(user: User): {
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
} {
  const userData: {
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
  } = {};

  if (user.username) {
    userData.username = user.username;
  }
  if (user.first_name) {
    userData.firstName = user.first_name;
  }
  if (user.last_name) {
    userData.lastName = user.last_name;
  }
  if (user.language_code) {
    userData.languageCode = user.language_code;
  }

  return userData;
}

/**
 * Safely extract user profile data for backend integration
 */
export function extractUserProfile(user: {
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): {
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
} {
  const profileData: {
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } = {};

  if (user.username) {
    profileData.username = user.username;
  }
  if (user.firstName) {
    profileData.firstName = user.firstName;
  }
  if (user.lastName) {
    profileData.lastName = user.lastName;
  }
  if (user.email) {
    profileData.email = user.email;
  }

  return profileData;
}

/**
 * Create auth token request data with only defined properties
 */
export function createAuthTokenRequest(
  telegramUserId: number,
  userData: {
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
  }
): {
  telegramUserId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
} {
  const request: {
    telegramUserId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
  } = {
    telegramUserId
  };

  if (userData.username) {
    request.username = userData.username;
  }
  if (userData.firstName) {
    request.firstName = userData.firstName;
  }
  if (userData.lastName) {
    request.lastName = userData.lastName;
  }
  if (userData.languageCode) {
    request.languageCode = userData.languageCode;
  }

  return request;
}

/**
 * Get display name from user data with fallbacks
 */
export function getDisplayName(user: User): string {
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  if (user.first_name) {
    return user.first_name;
  }
  if (user.username) {
    return `@${user.username}`;
  }
  return `User ${user.id}`;
}

/**
 * Safely handle error objects for logging
 */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Safely handle error objects for detailed logging
 */
export function safeErrorDetails(error: unknown): {
  message: string;
  stack?: string;
  name?: string;
} {
  if (error instanceof Error) {
    const result: { message: string; stack?: string; name?: string } = {
      message: error.message
    };
    if (error.stack) {
      result.stack = error.stack;
    }
    if (error.name) {
      result.name = error.name;
    }
    return result;
  }
  return {
    message: String(error)
  };
}
