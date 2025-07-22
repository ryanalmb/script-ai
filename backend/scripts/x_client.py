#!/usr/bin/env python3
"""
Real X/Twitter API Client using twikit
This script handles actual X/Twitter operations called from Node.js
"""

import asyncio
import json
import sys
import os
import time
import random
from datetime import datetime
from typing import Dict, List, Optional, Any

try:
    from twikit import Client
    TWIKIT_AVAILABLE = True
except ImportError:
    TWIKIT_AVAILABLE = False

class XClient:
    def __init__(self, account_id: str, credentials: Dict[str, str], cookies_file: str):
        self.account_id = account_id
        self.credentials = credentials
        self.cookies_file = cookies_file
        self.client = None
        self.authenticated = False
        
        if not TWIKIT_AVAILABLE:
            raise ImportError("twikit library not available. Install with: pip install twikit")
    
    async def authenticate(self) -> Dict[str, Any]:
        """Authenticate with X using credentials"""
        try:
            # Initialize client with language preference
            self.client = Client('en-US')
            
            # Try to load existing cookies first
            if os.path.exists(self.cookies_file):
                try:
                    await self.client.load_cookies(self.cookies_file)
                    # Test if cookies are still valid
                    await self.client.get_me()
                    self.authenticated = True
                    return {"success": True, "message": "Authenticated using saved cookies"}
                except Exception:
                    # Cookies expired, need to login again
                    pass
            
            # Login with credentials
            await self.client.login(
                auth_info_1=self.credentials['username'],
                auth_info_2=self.credentials['email'],
                password=self.credentials['password'],
                cookies_file=self.cookies_file
            )
            
            self.authenticated = True
            return {"success": True, "message": "Successfully authenticated"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def post_tweet(self, text: str, media_ids: List[str] = None, 
                        reply_to_tweet_id: str = None, quote_tweet_id: str = None) -> Dict[str, Any]:
        """Post a tweet"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            # Add random delay to appear more human-like
            await asyncio.sleep(random.uniform(1, 3))
            
            # Upload media if provided
            uploaded_media_ids = []
            if media_ids:
                for media_path in media_ids:
                    if os.path.exists(media_path):
                        media_id = await self.client.upload_media(media_path)
                        uploaded_media_ids.append(media_id)
            
            # Create tweet
            tweet = await self.client.create_tweet(
                text=text,
                media_ids=uploaded_media_ids if uploaded_media_ids else None,
                reply_to=reply_to_tweet_id,
                quote_tweet_id=quote_tweet_id
            )
            
            return {
                "success": True,
                "tweet": {
                    "id": tweet.id,
                    "text": tweet.text,
                    "author_id": tweet.user.id,
                    "created_at": tweet.created_at,
                    "metrics": {
                        "likes": getattr(tweet, 'favorite_count', 0),
                        "retweets": getattr(tweet, 'retweet_count', 0),
                        "replies": getattr(tweet, 'reply_count', 0),
                        "quotes": getattr(tweet, 'quote_count', 0)
                    }
                }
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def like_tweet(self, tweet_id: str) -> Dict[str, Any]:
        """Like a tweet"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            # Add random delay
            await asyncio.sleep(random.uniform(0.5, 2))
            
            # Get tweet object first
            tweet = await self.client.get_tweet_by_id(tweet_id)
            
            # Like the tweet
            await tweet.like()
            
            return {"success": True, "message": f"Successfully liked tweet {tweet_id}"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def follow_user(self, user_id: str) -> Dict[str, Any]:
        """Follow a user"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            # Add random delay
            await asyncio.sleep(random.uniform(1, 4))
            
            # Get user object
            user = await self.client.get_user_by_id(user_id)
            
            # Follow the user
            await user.follow()
            
            return {"success": True, "message": f"Successfully followed user {user_id}"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_dm(self, user_id: str, text: str) -> Dict[str, Any]:
        """Send a direct message"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            # Add random delay
            await asyncio.sleep(random.uniform(2, 5))
            
            # Send DM
            await self.client.send_dm(user_id, text)
            
            return {"success": True, "message": f"Successfully sent DM to user {user_id}"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def search_tweets(self, query: str, count: int = 20) -> Dict[str, Any]:
        """Search for tweets"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            # Add random delay
            await asyncio.sleep(random.uniform(1, 2))
            
            # Search tweets
            tweets = await self.client.search_tweet(query, 'Latest', count=count)
            
            tweet_data = []
            for tweet in tweets:
                tweet_data.append({
                    "id": tweet.id,
                    "text": tweet.text,
                    "author_id": tweet.user.id,
                    "created_at": tweet.created_at,
                    "metrics": {
                        "likes": getattr(tweet, 'favorite_count', 0),
                        "retweets": getattr(tweet, 'retweet_count', 0),
                        "replies": getattr(tweet, 'reply_count', 0),
                        "quotes": getattr(tweet, 'quote_count', 0)
                    }
                })
            
            return {
                "success": True,
                "tweets": tweet_data,
                "nextToken": None  # twikit doesn't provide pagination tokens
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_user_profile(self, username: str) -> Dict[str, Any]:
        """Get user profile information"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            # Add random delay
            await asyncio.sleep(random.uniform(0.5, 1.5))
            
            # Get user by username
            user = await self.client.get_user_by_screen_name(username)
            
            return {
                "success": True,
                "user": {
                    "id": user.id,
                    "username": user.screen_name,
                    "display_name": user.name,
                    "bio": getattr(user, 'description', ''),
                    "followers_count": getattr(user, 'followers_count', 0),
                    "following_count": getattr(user, 'friends_count', 0),
                    "tweets_count": getattr(user, 'statuses_count', 0),
                    "verified": getattr(user, 'verified', False),
                    "protected": getattr(user, 'protected', False),
                    "profile_image_url": getattr(user, 'profile_image_url_https', '')
                }
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def check_health(self) -> Dict[str, Any]:
        """Check account health status"""
        if not self.authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            # Try to get own profile to check if account is working
            me = await self.client.get_me()
            
            # Check for any restrictions or limitations
            # This is a basic check - in practice you'd want more sophisticated detection
            return {
                "success": True,
                "healthy": True,
                "status": "active",
                "message": "Account appears to be healthy"
            }
            
        except Exception as e:
            error_str = str(e).lower()
            
            if "suspended" in error_str:
                return {
                    "success": True,
                    "healthy": False,
                    "status": "suspended",
                    "message": "Account appears to be suspended"
                }
            elif "limited" in error_str or "restricted" in error_str:
                return {
                    "success": True,
                    "healthy": False,
                    "status": "limited",
                    "message": "Account appears to be limited or restricted"
                }
            else:
                return {
                    "success": False,
                    "healthy": False,
                    "status": "error",
                    "message": f"Error checking account health: {str(e)}"
                }

async def main():
    """Main function to handle command line arguments and execute actions"""
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: python x_client.py <action> <params_json>"}))
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
    
    # Initialize client
    client = XClient(account_id, credentials, cookies_file)
    
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
                    count=params.get('count', 20)
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
        
        else:
            result = {"success": False, "error": f"Unknown action: {action}"}
        
        print(json.dumps(result))
    
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
