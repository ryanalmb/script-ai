#!/usr/bin/env python3
"""
Simple Bot Configuration Test
"""
import requests
import json

def test_bot_basic():
    """Test basic bot functionality"""
    bot_token = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
    
    print("🤖 Testing Bot Basic Functionality...")
    
    # Test 1: Get bot info
    try:
        response = requests.get(f"https://api.telegram.org/bot{bot_token}/getMe", timeout=10)
        if response.status_code == 200:
            bot_info = response.json()
            if bot_info.get('ok'):
                bot_data = bot_info.get('result', {})
                print(f"✅ Bot connected: @{bot_data.get('username')}")
                print(f"   Bot ID: {bot_data.get('id')}")
                print(f"   Name: {bot_data.get('first_name')}")
            else:
                print(f"❌ Bot error: {bot_info.get('description')}")
                return False
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        return False
    
    # Test 2: Set bot commands
    commands = [
        {"command": "start", "description": "Start using the bot"},
        {"command": "help", "description": "Show help information"},
        {"command": "create_campaign", "description": "Create a marketing campaign with AI"},
        {"command": "generate", "description": "Generate content with AI"},
        {"command": "analytics", "description": "View analytics"},
        {"command": "trends", "description": "Get trending topics"},
        {"command": "settings", "description": "Bot settings"},
        {"command": "status", "description": "System status"}
    ]
    
    try:
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/setMyCommands",
            json={"commands": commands},
            timeout=10
        )
        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                print(f"✅ Commands configured: {len(commands)} commands")
            else:
                print(f"❌ Commands failed: {result.get('description')}")
        else:
            print(f"❌ Commands HTTP error: {response.status_code}")
    except Exception as e:
        print(f"❌ Commands error: {str(e)}")
    
    # Test 3: Check webhook (should be empty for polling)
    try:
        response = requests.get(f"https://api.telegram.org/bot{bot_token}/getWebhookInfo", timeout=10)
        if response.status_code == 200:
            webhook_info = response.json()
            if webhook_info.get('ok'):
                webhook_data = webhook_info.get('result', {})
                webhook_url = webhook_data.get('url', '')
                if webhook_url:
                    print(f"⚠️  Webhook configured: {webhook_url}")
                    print("   Removing webhook for polling mode...")
                    requests.post(f"https://api.telegram.org/bot{bot_token}/deleteWebhook", timeout=10)
                    print("✅ Webhook removed")
                else:
                    print("✅ No webhook (polling mode)")
    except Exception as e:
        print(f"❌ Webhook check error: {str(e)}")
    
    # Test 4: Check local services
    print("\n🔧 Testing Local Services...")
    
    services = {
        'Bot': 'http://localhost:3002/health',
        'LLM': 'http://localhost:3003/health',
        'Backend': 'http://localhost:3001/health'
    }
    
    for name, url in services.items():
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                print(f"✅ {name} service: Running")
            else:
                print(f"⚠️  {name} service: Status {response.status_code}")
        except Exception as e:
            print(f"❌ {name} service: Offline")
    
    print("\n🎯 Manual Test Instructions:")
    print("1. Open Telegram")
    print("2. Search for @MarketingProAI_bot")
    print("3. Send: /start")
    print("4. Try: /create_campaign I want to promote my crypto course")
    print("5. Check if bot responds with generated content")
    
    return True

if __name__ == "__main__":
    test_bot_basic()
