#!/usr/bin/env python3
"""
Test script for the enhanced X Client
"""

import asyncio
import json
import sys
import os

# Add the current directory to the path so we can import x_client
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from x_client import XClient, ProxyConfig, ProxyType, SessionConfig, RetryConfig

async def test_session_metrics():
    """Test session metrics functionality"""
    print("Testing XClient session metrics...")
    
    # Create a test client
    client = XClient(
        account_id="test_account",
        credentials={
            "username": "test_user",
            "email": "test@example.com",
            "password": "test_password"
        },
        cookies_file="test_cookies.json"
    )
    
    # Get session metrics
    metrics = await client.get_session_metrics()
    print("Session Metrics:")
    print(json.dumps(metrics, indent=2, default=str))
    
    # Test cleanup
    await client.cleanup()
    print("Cleanup completed successfully")

async def test_proxy_configuration():
    """Test proxy configuration"""
    print("\nTesting proxy configuration...")
    
    # Create proxy configs
    proxy_configs = [
        ProxyConfig(
            url="http://proxy1.example.com:8080",
            proxy_type=ProxyType.RESIDENTIAL,
            username="user1",
            password="pass1"
        ),
        ProxyConfig(
            url="http://proxy2.example.com:8080",
            proxy_type=ProxyType.DATACENTER
        )
    ]
    
    # Create session config
    session_config = SessionConfig(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        viewport_size=(1920, 1080),
        timezone="UTC",
        language="en-US",
        behavior_profile="moderate"
    )
    
    # Create retry config
    retry_config = RetryConfig(
        max_retries=3,
        base_delay=1.0,
        max_delay=30.0
    )
    
    # Create client with enterprise features
    client = XClient(
        account_id="test_enterprise",
        credentials={
            "username": "test_user",
            "email": "test@example.com",
            "password": "test_password"
        },
        cookies_file="test_enterprise_cookies.json",
        proxy_configs=proxy_configs,
        session_config=session_config,
        retry_config=retry_config
    )
    
    # Get metrics
    metrics = await client.get_session_metrics()
    print("Enterprise Client Metrics:")
    print(json.dumps(metrics, indent=2, default=str))
    
    # Test proxy manager
    print(f"Available proxy types: {[pt.value for pt in ProxyType]}")
    print(f"Proxy manager initialized with {len(proxy_configs)} proxies")
    
    # Cleanup
    await client.cleanup()
    print("Enterprise client cleanup completed")

async def main():
    """Main test function"""
    print("=== Enhanced X Client Test Suite ===")
    
    try:
        await test_session_metrics()
        await test_proxy_configuration()
        print("\n=== All tests completed successfully! ===")
        
    except Exception as e:
        print(f"\n=== Test failed with error: {e} ===")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
