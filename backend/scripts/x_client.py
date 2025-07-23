#!/usr/bin/env python3
"""
Enterprise X/Twitter API Client using twikit
This script handles actual X/Twitter operations with enterprise features:
- Proxy rotation and management
- Advanced error handling and retry logic
- Session persistence and connection pooling
- Anti-detection measures and behavioral patterns
- Comprehensive logging and monitoring
"""

import asyncio
import json
import sys
import os
import time
import random
import logging
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import aiohttp
import aiofiles
from urllib.parse import urlparse

try:
    from twikit import Client
    from twikit.errors import (
        TwitterException, BadRequest, Unauthorized, Forbidden,
        NotFound, TooManyRequests, ServerError, AccountSuspended,
        AccountLocked, UserNotFound
    )
    TWIKIT_AVAILABLE = True
except ImportError:
    TWIKIT_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('x_client.log')
    ]
)
logger = logging.getLogger(__name__)

class ProxyType(Enum):
    """Proxy types for different use cases"""
    RESIDENTIAL = "residential"
    DATACENTER = "datacenter"
    MOBILE = "mobile"

class ActionType(Enum):
    """X/Twitter action types for risk assessment"""
    AUTHENTICATE = "authenticate"
    POST_TWEET = "post_tweet"
    LIKE_TWEET = "like_tweet"
    FOLLOW_USER = "follow_user"
    SEND_DM = "send_dm"
    SEARCH_TWEETS = "search_tweets"
    GET_USER_PROFILE = "get_user_profile"
    CHECK_HEALTH = "check_health"

@dataclass
class ProxyConfig:
    """Proxy configuration with health tracking"""
    url: str
    proxy_type: ProxyType
    username: Optional[str] = None
    password: Optional[str] = None
    health_score: float = 1.0
    last_used: Optional[datetime] = None
    failure_count: int = 0
    success_count: int = 0

    @property
    def is_healthy(self) -> bool:
        return self.health_score > 0.3 and self.failure_count < 5

@dataclass
class SessionConfig:
    """Session configuration for anti-detection"""
    user_agent: str
    viewport_size: tuple
    timezone: str
    language: str
    behavior_profile: str
    session_duration: int = 3600  # seconds

@dataclass
class RetryConfig:
    """Retry configuration for different error types"""
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True

class XClientError(Exception):
    """Base exception for X Client errors"""
    pass

class AuthenticationError(XClientError):
    """Authentication related errors"""
    pass

class ProxyError(XClientError):
    """Proxy related errors"""
    pass

class RateLimitError(XClientError):
    """Rate limit related errors"""
    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message)
        self.retry_after = retry_after

class SuspensionError(XClientError):
    """Account suspension errors"""
    pass

class ConnectionPoolManager:
    """Manages connection pools for different proxy types"""

    def __init__(self):
        self.pools: Dict[str, aiohttp.ClientSession] = {}
        self.pool_configs: Dict[str, Dict] = {}

    async def get_session(self, proxy_config: Optional[ProxyConfig] = None) -> aiohttp.ClientSession:
        """Get or create a session for the given proxy configuration"""
        pool_key = self._get_pool_key(proxy_config)

        if pool_key not in self.pools or self.pools[pool_key].closed:
            connector_kwargs = {
                'limit': 100,
                'limit_per_host': 10,
                'ttl_dns_cache': 300,
                'use_dns_cache': True,
            }

            if proxy_config:
                connector_kwargs['proxy'] = proxy_config.url
                if proxy_config.username and proxy_config.password:
                    connector_kwargs['proxy_auth'] = aiohttp.BasicAuth(
                        proxy_config.username, proxy_config.password
                    )

            connector = aiohttp.TCPConnector(**connector_kwargs)
            timeout = aiohttp.ClientTimeout(total=30, connect=10)

            self.pools[pool_key] = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout
            )

            logger.info(f"Created new connection pool for key: {pool_key}")

        return self.pools[pool_key]

    def _get_pool_key(self, proxy_config: Optional[ProxyConfig]) -> str:
        """Generate a unique key for the proxy configuration"""
        if not proxy_config:
            return "direct"

        proxy_hash = hashlib.md5(
            f"{proxy_config.url}:{proxy_config.username}".encode()
        ).hexdigest()[:8]

        return f"{proxy_config.proxy_type.value}_{proxy_hash}"

    async def close_all(self):
        """Close all connection pools"""
        for session in self.pools.values():
            if not session.closed:
                await session.close()
        self.pools.clear()
        logger.info("Closed all connection pools")

class ProxyRotationManager:
    """Manages proxy rotation and health checking"""

    def __init__(self, proxy_configs: List[ProxyConfig]):
        self.proxies = {proxy_type: [] for proxy_type in ProxyType}
        self.current_indices = {proxy_type: 0 for proxy_type in ProxyType}

        # Organize proxies by type
        for proxy in proxy_configs:
            self.proxies[proxy.proxy_type].append(proxy)

        logger.info(f"Initialized proxy manager with {len(proxy_configs)} proxies")

    async def get_proxy(self, proxy_type: ProxyType, action_type: ActionType) -> Optional[ProxyConfig]:
        """Get the next healthy proxy for the given type and action"""
        available_proxies = [p for p in self.proxies[proxy_type] if p.is_healthy]

        if not available_proxies:
            logger.warning(f"No healthy {proxy_type.value} proxies available")
            return None

        # Select proxy based on action risk level
        if action_type in [ActionType.POST_TWEET, ActionType.FOLLOW_USER, ActionType.SEND_DM]:
            # High-risk actions prefer residential proxies with better health scores
            available_proxies.sort(key=lambda p: p.health_score, reverse=True)

        # Round-robin selection
        current_index = self.current_indices[proxy_type] % len(available_proxies)
        selected_proxy = available_proxies[current_index]

        self.current_indices[proxy_type] = (current_index + 1) % len(available_proxies)
        selected_proxy.last_used = datetime.now()

        logger.debug(f"Selected {proxy_type.value} proxy: {selected_proxy.url}")
        return selected_proxy

    async def update_proxy_health(self, proxy: ProxyConfig, success: bool):
        """Update proxy health based on operation result"""
        if success:
            proxy.success_count += 1
            proxy.failure_count = max(0, proxy.failure_count - 1)
            proxy.health_score = min(1.0, proxy.health_score + 0.1)
        else:
            proxy.failure_count += 1
            proxy.health_score = max(0.0, proxy.health_score - 0.2)

        logger.debug(f"Updated proxy health: {proxy.url} -> {proxy.health_score}")

class XClient:
    """Enterprise X/Twitter client with advanced features"""

    def __init__(self, account_id: str, credentials: Dict[str, str], cookies_file: str,
                 proxy_configs: Optional[List[ProxyConfig]] = None,
                 session_config: Optional[SessionConfig] = None,
                 retry_config: Optional[RetryConfig] = None):
        self.account_id = account_id
        self.credentials = credentials
        self.cookies_file = cookies_file
        self.client = None
        self.authenticated = False
        self.session_id = str(uuid.uuid4())

        # Enterprise features
        self.proxy_manager = ProxyRotationManager(proxy_configs or [])
        self.connection_pool = ConnectionPoolManager()
        self.session_config = session_config or self._default_session_config()
        self.retry_config = retry_config or RetryConfig()

        # Anti-detection state
        self.current_proxy = None
        self.session_start_time = datetime.now()
        self.action_count = 0
        self.last_action_time = None

        # Performance tracking
        self.metrics = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'proxy_switches': 0,
            'authentication_attempts': 0
        }

        if not TWIKIT_AVAILABLE:
            raise ImportError("twikit library not available. Install with: pip install twikit")

        logger.info(f"Initialized XClient for account {account_id} with session {self.session_id}")

    def _default_session_config(self) -> SessionConfig:
        """Generate default session configuration with randomization"""
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ]

        viewports = [(1920, 1080), (1366, 768), (1440, 900), (1536, 864)]
        timezones = ["America/New_York", "America/Los_Angeles", "Europe/London", "UTC"]
        languages = ["en-US", "en-GB", "en-CA"]
        behavior_profiles = ["conservative", "moderate", "active"]

        return SessionConfig(
            user_agent=random.choice(user_agents),
            viewport_size=random.choice(viewports),
            timezone=random.choice(timezones),
            language=random.choice(languages),
            behavior_profile=random.choice(behavior_profiles),
            session_duration=random.randint(1800, 7200)  # 30min to 2h
        )

    async def _get_optimal_proxy(self, action_type: ActionType) -> Optional[ProxyConfig]:
        """Get optimal proxy for the given action type"""
        # Determine proxy type based on action risk
        if action_type in [ActionType.POST_TWEET, ActionType.FOLLOW_USER, ActionType.SEND_DM]:
            proxy_type = ProxyType.RESIDENTIAL
        elif action_type in [ActionType.LIKE_TWEET, ActionType.SEARCH_TWEETS]:
            proxy_type = ProxyType.DATACENTER
        else:
            proxy_type = ProxyType.MOBILE

        return await self.proxy_manager.get_proxy(proxy_type, action_type)

    async def _should_rotate_proxy(self) -> bool:
        """Determine if proxy should be rotated based on usage patterns"""
        if not self.current_proxy:
            return True

        # Rotate after certain number of actions
        if self.action_count > 0 and self.action_count % 50 == 0:
            return True

        # Rotate after session duration
        session_duration = (datetime.now() - self.session_start_time).total_seconds()
        if session_duration > self.session_config.session_duration:
            return True

        # Rotate if proxy health is degraded
        if self.current_proxy.health_score < 0.5:
            return True

        return False
    
    async def authenticate(self) -> Dict[str, Any]:
        """Enhanced authentication with proxy rotation and retry logic"""
        self.metrics['authentication_attempts'] += 1

        for attempt in range(self.retry_config.max_retries):
            try:
                # Get optimal proxy for authentication
                proxy = await self._get_optimal_proxy(ActionType.AUTHENTICATE)
                if proxy != self.current_proxy:
                    self.current_proxy = proxy
                    self.metrics['proxy_switches'] += 1
                    logger.info(f"Switched to proxy: {proxy.url if proxy else 'direct'}")

                # Initialize client with enterprise configuration
                client_kwargs = {
                    'language': self.session_config.language,
                    'user_agent': self.session_config.user_agent
                }

                if self.current_proxy:
                    client_kwargs['proxy'] = self.current_proxy.url

                self.client = Client(**client_kwargs)

                # Try to load existing cookies first
                if os.path.exists(self.cookies_file):
                    try:
                        await self.client.load_cookies(self.cookies_file)

                        # Test if cookies are still valid with health check
                        me = await self.client.get_me()

                        # Validate account is not suspended or limited
                        if hasattr(me, 'suspended') and me.suspended:
                            raise SuspensionError("Account is suspended")

                        self.authenticated = True
                        await self._update_proxy_health(True)

                        logger.info(f"Authenticated using saved cookies for account {self.account_id}")
                        return {
                            "success": True,
                            "message": "Authenticated using saved cookies",
                            "session_id": self.session_id,
                            "proxy_used": self.current_proxy.url if self.current_proxy else "direct"
                        }

                    except Exception as cookie_error:
                        logger.warning(f"Cookie authentication failed: {cookie_error}")
                        # Cookies expired or invalid, continue to login
                        pass

                # Perform fresh login with anti-detection measures
                await self._apply_anti_detection_delay(ActionType.AUTHENTICATE)

                login_result = await self.client.login(
                    auth_info_1=self.credentials['username'],
                    auth_info_2=self.credentials.get('email', ''),
                    password=self.credentials['password'],
                    cookies_file=self.cookies_file,
                    enable_ui_metrics=True  # Reduces suspension risk
                )

                # Verify authentication was successful
                me = await self.client.get_me()
                if hasattr(me, 'suspended') and me.suspended:
                    raise SuspensionError("Account is suspended")

                self.authenticated = True
                await self._update_proxy_health(True)

                logger.info(f"Successfully authenticated account {self.account_id}")
                return {
                    "success": True,
                    "message": "Successfully authenticated",
                    "session_id": self.session_id,
                    "proxy_used": self.current_proxy.url if self.current_proxy else "direct",
                    "user_id": me.id,
                    "username": me.screen_name
                }

            except (AccountSuspended, SuspensionError) as e:
                logger.error(f"Account {self.account_id} is suspended: {e}")
                await self._update_proxy_health(False)
                return {
                    "success": False,
                    "error": "Account is suspended",
                    "error_type": "suspension",
                    "retry_recommended": False
                }

            except (AccountLocked, Unauthorized) as e:
                logger.error(f"Account {self.account_id} authentication failed: {e}")
                await self._update_proxy_health(False)

                if attempt < self.retry_config.max_retries - 1:
                    delay = await self._calculate_retry_delay(attempt)
                    logger.info(f"Retrying authentication in {delay:.2f} seconds...")
                    await asyncio.sleep(delay)
                    continue

                return {
                    "success": False,
                    "error": "Authentication failed - invalid credentials",
                    "error_type": "authentication",
                    "retry_recommended": False
                }

            except TooManyRequests as e:
                logger.warning(f"Rate limited during authentication: {e}")
                await self._update_proxy_health(False)

                if attempt < self.retry_config.max_retries - 1:
                    delay = await self._calculate_retry_delay(attempt, base_delay=60)
                    logger.info(f"Rate limited, retrying in {delay:.2f} seconds...")
                    await asyncio.sleep(delay)
                    continue

                return {
                    "success": False,
                    "error": "Rate limited during authentication",
                    "error_type": "rate_limit",
                    "retry_recommended": True,
                    "retry_after": 300
                }

            except Exception as e:
                logger.error(f"Authentication attempt {attempt + 1} failed: {e}")
                await self._update_proxy_health(False)

                if attempt < self.retry_config.max_retries - 1:
                    delay = await self._calculate_retry_delay(attempt)
                    logger.info(f"Retrying authentication in {delay:.2f} seconds...")
                    await asyncio.sleep(delay)
                    continue

                return {
                    "success": False,
                    "error": str(e),
                    "error_type": "unknown",
                    "retry_recommended": True
                }

        # All retry attempts failed
        logger.error(f"Authentication failed after {self.retry_config.max_retries} attempts")
        return {
            "success": False,
            "error": f"Authentication failed after {self.retry_config.max_retries} attempts",
            "error_type": "max_retries_exceeded",
            "retry_recommended": True
        }
    
    async def _apply_anti_detection_delay(self, action_type: ActionType):
        """Apply intelligent delays based on action type and behavior profile"""
        base_delays = {
            ActionType.AUTHENTICATE: (2, 5),
            ActionType.POST_TWEET: (3, 8),
            ActionType.LIKE_TWEET: (1, 3),
            ActionType.FOLLOW_USER: (2, 6),
            ActionType.SEND_DM: (4, 10),
            ActionType.SEARCH_TWEETS: (1, 2),
            ActionType.GET_USER_PROFILE: (0.5, 1.5),
            ActionType.CHECK_HEALTH: (1, 2)
        }

        min_delay, max_delay = base_delays.get(action_type, (1, 3))

        # Adjust delays based on behavior profile
        if self.session_config.behavior_profile == "conservative":
            min_delay *= 1.5
            max_delay *= 2.0
        elif self.session_config.behavior_profile == "active":
            min_delay *= 0.7
            max_delay *= 0.8

        # Add randomization to avoid detection
        delay = random.uniform(min_delay, max_delay)

        # Consider time since last action
        if self.last_action_time:
            time_since_last = (datetime.now() - self.last_action_time).total_seconds()
            if time_since_last < 1:
                delay += random.uniform(1, 3)  # Extra delay if actions are too frequent

        logger.debug(f"Applying anti-detection delay: {delay:.2f}s for {action_type.value}")
        await asyncio.sleep(delay)

        self.last_action_time = datetime.now()
        self.action_count += 1

    async def _calculate_retry_delay(self, attempt: int, base_delay: Optional[float] = None) -> float:
        """Calculate exponential backoff delay with jitter"""
        if base_delay is None:
            base_delay = self.retry_config.base_delay

        delay = min(
            base_delay * (self.retry_config.exponential_base ** attempt),
            self.retry_config.max_delay
        )

        if self.retry_config.jitter:
            delay *= random.uniform(0.5, 1.5)

        return delay

    async def _update_proxy_health(self, success: bool):
        """Update current proxy health based on operation result"""
        if self.current_proxy:
            await self.proxy_manager.update_proxy_health(self.current_proxy, success)

    async def _execute_with_retry(self, action_type: ActionType, operation_func, *args, **kwargs) -> Dict[str, Any]:
        """Execute operation with retry logic and proxy rotation"""
        self.metrics['total_requests'] += 1

        for attempt in range(self.retry_config.max_retries):
            try:
                # Check if we should rotate proxy
                if await self._should_rotate_proxy():
                    new_proxy = await self._get_optimal_proxy(action_type)
                    if new_proxy != self.current_proxy:
                        self.current_proxy = new_proxy
                        self.metrics['proxy_switches'] += 1
                        logger.info(f"Rotated to new proxy for {action_type.value}")

                # Apply anti-detection delay
                await self._apply_anti_detection_delay(action_type)

                # Execute the operation
                result = await operation_func(*args, **kwargs)

                # Update metrics and proxy health
                self.metrics['successful_requests'] += 1
                await self._update_proxy_health(True)

                return result

            except TooManyRequests as e:
                logger.warning(f"Rate limited during {action_type.value}: {e}")
                await self._update_proxy_health(False)

                if attempt < self.retry_config.max_retries - 1:
                    delay = await self._calculate_retry_delay(attempt, base_delay=60)
                    logger.info(f"Rate limited, retrying in {delay:.2f} seconds...")
                    await asyncio.sleep(delay)
                    continue

                self.metrics['failed_requests'] += 1
                return {
                    "success": False,
                    "error": "Rate limited",
                    "error_type": "rate_limit",
                    "retry_recommended": True,
                    "retry_after": getattr(e, 'retry_after', 300)
                }

            except (AccountSuspended, SuspensionError) as e:
                logger.error(f"Account suspended during {action_type.value}: {e}")
                await self._update_proxy_health(False)
                self.metrics['failed_requests'] += 1

                return {
                    "success": False,
                    "error": "Account is suspended",
                    "error_type": "suspension",
                    "retry_recommended": False
                }

            except Exception as e:
                logger.error(f"Operation {action_type.value} attempt {attempt + 1} failed: {e}")
                await self._update_proxy_health(False)

                if attempt < self.retry_config.max_retries - 1:
                    delay = await self._calculate_retry_delay(attempt)
                    logger.info(f"Retrying {action_type.value} in {delay:.2f} seconds...")
                    await asyncio.sleep(delay)
                    continue

                self.metrics['failed_requests'] += 1
                return {
                    "success": False,
                    "error": str(e),
                    "error_type": "operation_failed",
                    "retry_recommended": True
                }

        # All retry attempts failed
        self.metrics['failed_requests'] += 1
        return {
            "success": False,
            "error": f"Operation failed after {self.retry_config.max_retries} attempts",
            "error_type": "max_retries_exceeded",
            "retry_recommended": True
        }

    async def get_session_metrics(self) -> Dict[str, Any]:
        """Get current session performance metrics"""
        session_duration = (datetime.now() - self.session_start_time).total_seconds()
        success_rate = (
            self.metrics['successful_requests'] / max(1, self.metrics['total_requests'])
        ) * 100

        return {
            "session_id": self.session_id,
            "account_id": self.account_id,
            "session_duration": session_duration,
            "metrics": self.metrics,
            "success_rate": success_rate,
            "current_proxy": self.current_proxy.url if self.current_proxy else "direct",
            "proxy_health": self.current_proxy.health_score if self.current_proxy else 1.0,
            "action_count": self.action_count,
            "authenticated": self.authenticated
        }

    async def cleanup(self):
        """Clean up resources"""
        try:
            await self.connection_pool.close_all()
            logger.info(f"Cleaned up resources for session {self.session_id}")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    async def post_tweet(self, text: str, media_ids: List[str] = None,
                        reply_to_tweet_id: str = None, quote_tweet_id: str = None) -> Dict[str, Any]:
        """Post a tweet with enterprise features"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated", "error_type": "authentication"}

        async def _post_operation():
            # Upload media if provided
            uploaded_media_ids = []
            if media_ids:
                for media_path in media_ids:
                    if os.path.exists(media_path):
                        try:
                            media_id = await self.client.upload_media(media_path)
                            uploaded_media_ids.append(media_id)
                            logger.debug(f"Uploaded media: {media_path} -> {media_id}")
                        except Exception as e:
                            logger.warning(f"Failed to upload media {media_path}: {e}")
                            # Continue without this media file

            # Create tweet with enhanced parameters
            tweet = await self.client.create_tweet(
                text=text,
                media_ids=uploaded_media_ids if uploaded_media_ids else None,
                reply_to=reply_to_tweet_id,
                quote_tweet_id=quote_tweet_id
            )

            # Extract comprehensive tweet data
            tweet_data = {
                "id": tweet.id,
                "text": tweet.text,
                "author_id": tweet.user.id,
                "author_username": tweet.user.screen_name,
                "created_at": tweet.created_at,
                "metrics": {
                    "likes": getattr(tweet, 'favorite_count', 0),
                    "retweets": getattr(tweet, 'retweet_count', 0),
                    "replies": getattr(tweet, 'reply_count', 0),
                    "quotes": getattr(tweet, 'quote_count', 0),
                    "views": getattr(tweet, 'view_count', 0)
                },
                "media_count": len(uploaded_media_ids),
                "is_reply": bool(reply_to_tweet_id),
                "is_quote": bool(quote_tweet_id)
            }

            logger.info(f"Successfully posted tweet {tweet.id} for account {self.account_id}")

            return {
                "success": True,
                "tweet": tweet_data,
                "session_id": self.session_id,
                "proxy_used": self.current_proxy.url if self.current_proxy else "direct"
            }

        return await self._execute_with_retry(ActionType.POST_TWEET, _post_operation)
    
    async def like_tweet(self, tweet_id: str) -> Dict[str, Any]:
        """Like a tweet with enterprise features"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated", "error_type": "authentication"}

        async def _like_operation():
            # Get tweet object first
            tweet = await self.client.get_tweet_by_id(tweet_id)

            # Check if already liked to avoid duplicate actions
            if hasattr(tweet, 'favorited') and tweet.favorited:
                logger.info(f"Tweet {tweet_id} already liked, skipping")
                return {
                    "success": True,
                    "message": f"Tweet {tweet_id} was already liked",
                    "already_liked": True,
                    "session_id": self.session_id
                }

            # Like the tweet
            await tweet.like()

            logger.info(f"Successfully liked tweet {tweet_id} for account {self.account_id}")

            return {
                "success": True,
                "message": f"Successfully liked tweet {tweet_id}",
                "tweet_id": tweet_id,
                "tweet_author": tweet.user.screen_name,
                "session_id": self.session_id,
                "proxy_used": self.current_proxy.url if self.current_proxy else "direct"
            }

        return await self._execute_with_retry(ActionType.LIKE_TWEET, _like_operation)
    
    async def follow_user(self, user_id: str) -> Dict[str, Any]:
        """Follow a user with enterprise features"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated", "error_type": "authentication"}

        async def _follow_operation():
            # Get user object
            user = await self.client.get_user_by_id(user_id)

            # Check if already following to avoid duplicate actions
            if hasattr(user, 'following') and user.following:
                logger.info(f"Already following user {user_id} ({user.screen_name}), skipping")
                return {
                    "success": True,
                    "message": f"Already following user {user.screen_name}",
                    "already_following": True,
                    "user_id": user_id,
                    "username": user.screen_name,
                    "session_id": self.session_id
                }

            # Follow the user
            await user.follow()

            logger.info(f"Successfully followed user {user_id} ({user.screen_name}) for account {self.account_id}")

            return {
                "success": True,
                "message": f"Successfully followed user {user.screen_name}",
                "user_id": user_id,
                "username": user.screen_name,
                "display_name": user.name,
                "followers_count": getattr(user, 'followers_count', 0),
                "session_id": self.session_id,
                "proxy_used": self.current_proxy.url if self.current_proxy else "direct"
            }

        return await self._execute_with_retry(ActionType.FOLLOW_USER, _follow_operation)

    async def send_dm(self, user_id: str, text: str) -> Dict[str, Any]:
        """Send a direct message with enterprise features"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated", "error_type": "authentication"}

        async def _dm_operation():
            # Get user info for logging
            try:
                user = await self.client.get_user_by_id(user_id)
                username = user.screen_name
            except Exception:
                username = user_id

            # Send DM
            await self.client.send_dm(user_id, text)

            logger.info(f"Successfully sent DM to user {user_id} ({username}) for account {self.account_id}")

            return {
                "success": True,
                "message": f"Successfully sent DM to user {username}",
                "user_id": user_id,
                "username": username,
                "message_length": len(text),
                "session_id": self.session_id,
                "proxy_used": self.current_proxy.url if self.current_proxy else "direct"
            }

        return await self._execute_with_retry(ActionType.SEND_DM, _dm_operation)
    
    async def search_tweets(self, query: str, count: int = 20, search_type: str = 'Latest') -> Dict[str, Any]:
        """Search for tweets with enterprise features"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated", "error_type": "authentication"}

        async def _search_operation():
            # Search tweets with specified type
            tweets = await self.client.search_tweet(query, search_type, count=count)

            tweet_data = []
            for tweet in tweets:
                tweet_info = {
                    "id": tweet.id,
                    "text": tweet.text,
                    "author_id": tweet.user.id,
                    "author_username": tweet.user.screen_name,
                    "author_display_name": tweet.user.name,
                    "created_at": tweet.created_at,
                    "metrics": {
                        "likes": getattr(tweet, 'favorite_count', 0),
                        "retweets": getattr(tweet, 'retweet_count', 0),
                        "replies": getattr(tweet, 'reply_count', 0),
                        "quotes": getattr(tweet, 'quote_count', 0),
                        "views": getattr(tweet, 'view_count', 0)
                    },
                    "is_retweet": hasattr(tweet, 'retweeted_tweet') and tweet.retweeted_tweet is not None,
                    "is_reply": hasattr(tweet, 'in_reply_to') and tweet.in_reply_to is not None,
                    "has_media": bool(getattr(tweet, 'media', [])),
                    "language": getattr(tweet, 'lang', 'unknown')
                }
                tweet_data.append(tweet_info)

            logger.info(f"Successfully searched tweets for query '{query}', found {len(tweet_data)} results")

            return {
                "success": True,
                "tweets": tweet_data,
                "query": query,
                "search_type": search_type,
                "count": len(tweet_data),
                "requested_count": count,
                "session_id": self.session_id,
                "proxy_used": self.current_proxy.url if self.current_proxy else "direct"
            }

        return await self._execute_with_retry(ActionType.SEARCH_TWEETS, _search_operation)
    
    async def get_user_profile(self, username: str) -> Dict[str, Any]:
        """Get user profile information with enterprise features"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated", "error_type": "authentication"}

        async def _profile_operation():
            # Get user by username
            user = await self.client.get_user_by_screen_name(username)

            # Extract comprehensive user data
            user_data = {
                "id": user.id,
                "username": user.screen_name,
                "display_name": user.name,
                "bio": getattr(user, 'description', ''),
                "followers_count": getattr(user, 'followers_count', 0),
                "following_count": getattr(user, 'friends_count', 0),
                "tweets_count": getattr(user, 'statuses_count', 0),
                "likes_count": getattr(user, 'favourites_count', 0),
                "verified": getattr(user, 'verified', False),
                "protected": getattr(user, 'protected', False),
                "profile_image_url": getattr(user, 'profile_image_url_https', ''),
                "profile_banner_url": getattr(user, 'profile_banner_url', ''),
                "location": getattr(user, 'location', ''),
                "url": getattr(user, 'url', ''),
                "created_at": getattr(user, 'created_at', ''),
                "is_following": getattr(user, 'following', False),
                "is_followed_by": getattr(user, 'followed_by', False),
                "can_dm": getattr(user, 'can_dm', False)
            }

            logger.info(f"Successfully retrieved profile for user {username} (ID: {user.id})")

            return {
                "success": True,
                "user": user_data,
                "session_id": self.session_id,
                "proxy_used": self.current_proxy.url if self.current_proxy else "direct"
            }

        return await self._execute_with_retry(ActionType.GET_USER_PROFILE, _profile_operation)
    
    async def check_health(self) -> Dict[str, Any]:
        """Check account health status with comprehensive diagnostics"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated", "error_type": "authentication"}

        async def _health_operation():
            # Get own profile to check account status
            me = await self.client.get_me()

            # Perform comprehensive health checks
            health_checks = {
                "profile_accessible": True,
                "can_tweet": False,
                "can_like": False,
                "can_follow": False,
                "can_dm": False,
                "rate_limit_status": "normal"
            }

            # Test basic functionality (non-destructive)
            try:
                # Test search functionality
                await self.client.search_tweet("test", 'Latest', count=1)
                health_checks["can_search"] = True
            except Exception:
                health_checks["can_search"] = False

            # Analyze account status
            account_status = "active"
            health_score = 1.0
            warnings = []

            # Check for suspension indicators
            if hasattr(me, 'suspended') and me.suspended:
                account_status = "suspended"
                health_score = 0.0
            elif hasattr(me, 'protected') and me.protected:
                warnings.append("Account is protected")
                health_score *= 0.9

            # Check follower/following ratios for potential limitations
            followers = getattr(me, 'followers_count', 0)
            following = getattr(me, 'friends_count', 0)

            if following > 0 and followers / max(following, 1) < 0.1 and following > 1000:
                warnings.append("Low follower-to-following ratio may indicate limitations")
                health_score *= 0.8

            # Get session metrics
            session_metrics = await self.get_session_metrics()

            logger.info(f"Health check completed for account {self.account_id}: {account_status}")

            return {
                "success": True,
                "healthy": health_score > 0.5,
                "status": account_status,
                "health_score": health_score,
                "message": f"Account health score: {health_score:.2f}",
                "account_info": {
                    "id": me.id,
                    "username": me.screen_name,
                    "display_name": me.name,
                    "followers_count": followers,
                    "following_count": following,
                    "tweets_count": getattr(me, 'statuses_count', 0),
                    "verified": getattr(me, 'verified', False),
                    "protected": getattr(me, 'protected', False)
                },
                "health_checks": health_checks,
                "warnings": warnings,
                "session_metrics": session_metrics,
                "session_id": self.session_id,
                "proxy_used": self.current_proxy.url if self.current_proxy else "direct"
            }

        try:
            return await self._execute_with_retry(ActionType.CHECK_HEALTH, _health_operation)
        except (AccountSuspended, SuspensionError):
            return {
                "success": True,
                "healthy": False,
                "status": "suspended",
                "health_score": 0.0,
                "message": "Account is suspended",
                "session_id": self.session_id
            }
        except Exception as e:
            error_str = str(e).lower()

            if "suspended" in error_str:
                status = "suspended"
                health_score = 0.0
            elif "limited" in error_str or "restricted" in error_str:
                status = "limited"
                health_score = 0.3
            else:
                status = "error"
                health_score = 0.0

            return {
                "success": False,
                "healthy": False,
                "status": status,
                "health_score": health_score,
                "message": f"Error checking account health: {str(e)}",
                "error_type": "health_check_failed",
                "session_id": self.session_id
            }

async def main():
    """Enhanced main function with enterprise parameter handling"""
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python x_client.py <action> <params_json>",
            "version": "2.0.0-enterprise"
        }))
        sys.exit(1)

    action = sys.argv[1]

    try:
        params = json.loads(sys.argv[2])
    except json.JSONDecodeError:
        print(json.dumps({"success": False, "error": "Invalid JSON parameters"}))
        sys.exit(1)

    # Extract common parameters
    account_id = params.get('accountId')
    credentials = params.get('credentials', {})
    cookies_file = params.get('cookiesFile')

    if not all([account_id, credentials, cookies_file]):
        print(json.dumps({"success": False, "error": "Missing required parameters"}))
        sys.exit(1)

    # Extract enterprise configuration parameters
    proxy_configs = []
    if params.get('proxyConfigs'):
        for proxy_data in params['proxyConfigs']:
            proxy_config = ProxyConfig(
                url=proxy_data['url'],
                proxy_type=ProxyType(proxy_data.get('type', 'datacenter')),
                username=proxy_data.get('username'),
                password=proxy_data.get('password'),
                health_score=proxy_data.get('healthScore', 1.0)
            )
            proxy_configs.append(proxy_config)

    # Session configuration
    session_config = None
    if params.get('sessionConfig'):
        session_data = params['sessionConfig']
        session_config = SessionConfig(
            user_agent=session_data.get('userAgent', ''),
            viewport_size=tuple(session_data.get('viewportSize', [1920, 1080])),
            timezone=session_data.get('timezone', 'UTC'),
            language=session_data.get('language', 'en-US'),
            behavior_profile=session_data.get('behaviorProfile', 'moderate'),
            session_duration=session_data.get('sessionDuration', 3600)
        )

    # Retry configuration
    retry_config = None
    if params.get('retryConfig'):
        retry_data = params['retryConfig']
        retry_config = RetryConfig(
            max_retries=retry_data.get('maxRetries', 3),
            base_delay=retry_data.get('baseDelay', 1.0),
            max_delay=retry_data.get('maxDelay', 60.0),
            exponential_base=retry_data.get('exponentialBase', 2.0),
            jitter=retry_data.get('jitter', True)
        )

    # Initialize enterprise client
    client = XClient(
        account_id=account_id,
        credentials=credentials,
        cookies_file=cookies_file,
        proxy_configs=proxy_configs,
        session_config=session_config,
        retry_config=retry_config
    )
    
    try:
        # Handle different actions
        if action == 'authenticate':
            result = await client.authenticate()
        
        elif action == 'post_tweet':
            # Authenticate first
            auth_result = await client.authenticate()
            if not auth_result['success']:
                result = auth_result
            else:
                result = await client.post_tweet(
                    text=params.get('text', ''),
                    media_ids=params.get('mediaIds', []),
                    reply_to_tweet_id=params.get('replyToTweetId'),
                    quote_tweet_id=params.get('quoteTweetId')
                )
        
        elif action == 'like_tweet':
            auth_result = await client.authenticate()
            if not auth_result['success']:
                result = auth_result
            else:
                result = await client.like_tweet(params.get('tweetId'))
        
        elif action == 'follow_user':
            auth_result = await client.authenticate()
            if not auth_result['success']:
                result = auth_result
            else:
                result = await client.follow_user(params.get('userId'))
        
        elif action == 'send_dm':
            auth_result = await client.authenticate()
            if not auth_result['success']:
                result = auth_result
            else:
                result = await client.send_dm(
                    user_id=params.get('userId'),
                    text=params.get('text')
                )
        
        elif action == 'search_tweets':
            auth_result = await client.authenticate()
            if not auth_result['success']:
                result = auth_result
            else:
                result = await client.search_tweets(
                    query=params.get('query'),
                    count=params.get('count', 20),
                    search_type=params.get('searchType', 'Latest')
                )
        
        elif action == 'get_user_profile':
            auth_result = await client.authenticate()
            if not auth_result['success']:
                result = auth_result
            else:
                result = await client.get_user_profile(params.get('username'))
        
        elif action == 'check_health':
            auth_result = await client.authenticate()
            if not auth_result['success']:
                result = auth_result
            else:
                result = await client.check_health()

        elif action == 'get_session_metrics':
            # Get session metrics without requiring authentication
            result = await client.get_session_metrics()

        elif action == 'cleanup':
            # Clean up resources
            await client.cleanup()
            result = {"success": True, "message": "Resources cleaned up successfully"}

        else:
            result = {
                "success": False,
                "error": f"Unknown action: {action}",
                "available_actions": [
                    "authenticate", "post_tweet", "like_tweet", "follow_user",
                    "send_dm", "search_tweets", "get_user_profile", "check_health",
                    "get_session_metrics", "cleanup"
                ]
            }

        print(json.dumps(result, default=str))  # Handle datetime serialization

    except KeyboardInterrupt:
        logger.info("Operation interrupted by user")
        await client.cleanup()
        print(json.dumps({
            "success": False,
            "error": "Operation interrupted by user",
            "error_type": "interrupted"
        }))
        sys.exit(1)

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        await client.cleanup()
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": "unexpected_error"
        }))
        sys.exit(1)

    finally:
        # Ensure cleanup happens
        try:
            await client.cleanup()
        except Exception as cleanup_error:
            logger.error(f"Error during cleanup: {cleanup_error}")

if __name__ == "__main__":
    asyncio.run(main())
