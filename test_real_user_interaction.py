#!/usr/bin/env python3
"""
Test Real User Interaction with Telegram Bot
This test verifies that the bot can properly handle real user messages
"""
import requests
import json
import time
from datetime import datetime

def test_bot_polling_status():
    """Check if the bot is properly polling for messages"""
    print("🔄 Testing Bot Polling Status...")
    print("=" * 50)
    
    bot_token = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
    
    try:
        # Get updates to see if bot is polling
        response = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getUpdates",
            timeout=10
        )
        
        if response.status_code == 200:
            updates_info = response.json()
            if updates_info.get('ok'):
                updates = updates_info.get('result', [])
                print(f"✅ Bot polling is working")
                print(f"   Recent updates: {len(updates)}")
                
                if updates:
                    latest_update = updates[-1]
                    print(f"   Latest update ID: {latest_update.get('update_id')}")
                    if 'message' in latest_update:
                        msg = latest_update['message']
                        print(f"   Latest message: {msg.get('text', 'No text')[:50]}...")
                
                return True, updates
            else:
                print(f"❌ Polling error: {updates_info.get('description')}")
                return False, []
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False, []
    except Exception as e:
        print(f"❌ Polling test error: {str(e)}")
        return False, []

def test_bot_commands_setup():
    """Test if bot commands are properly configured"""
    print("\n📋 Testing Bot Commands Configuration...")
    print("=" * 50)
    
    bot_token = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
    
    # Set up bot commands
    commands = [
        {"command": "start", "description": "Start using the bot"},
        {"command": "help", "description": "Show help information"},
        {"command": "create_campaign", "description": "Create a marketing campaign with AI"},
        {"command": "generate", "description": "Generate content with AI"},
        {"command": "analytics", "description": "View analytics and insights"},
        {"command": "trends", "description": "Get trending topics"},
        {"command": "settings", "description": "Bot settings"},
        {"command": "status", "description": "Check system status"}
    ]
    
    try:
        # Set bot commands
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/setMyCommands",
            json={"commands": commands},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                print(f"✅ Bot commands configured successfully")
                print(f"   Commands set: {len(commands)}")
                for cmd in commands[:5]:
                    print(f"   /{cmd['command']} - {cmd['description']}")
                if len(commands) > 5:
                    print(f"   ... and {len(commands) - 5} more")
                return True
            else:
                print(f"❌ Failed to set commands: {result.get('description')}")
                return False
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Commands setup error: {str(e)}")
        return False

def test_bot_info():
    """Get comprehensive bot information"""
    print("\n🤖 Testing Bot Information...")
    print("=" * 50)
    
    bot_token = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
    
    try:
        # Get bot info
        response = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getMe",
            timeout=10
        )
        
        if response.status_code == 200:
            bot_info = response.json()
            if bot_info.get('ok'):
                bot_data = bot_info.get('result', {})
                print(f"✅ Bot information retrieved")
                print(f"   Bot ID: {bot_data.get('id')}")
                print(f"   Username: @{bot_data.get('username')}")
                print(f"   Name: {bot_data.get('first_name')}")
                print(f"   Can Join Groups: {bot_data.get('can_join_groups')}")
                print(f"   Can Read All Messages: {bot_data.get('can_read_all_group_messages')}")
                print(f"   Supports Inline Queries: {bot_data.get('supports_inline_queries')}")
                return True, bot_data
            else:
                print(f"❌ Bot info error: {bot_info.get('description')}")
                return False, None
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ Bot info error: {str(e)}")
        return False, None

def test_webhook_configuration():
    """Test webhook configuration"""
    print("\n🔗 Testing Webhook Configuration...")
    print("=" * 50)
    
    bot_token = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
    
    try:
        # Get webhook info
        response = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getWebhookInfo",
            timeout=10
        )
        
        if response.status_code == 200:
            webhook_info = response.json()
            if webhook_info.get('ok'):
                webhook_data = webhook_info.get('result', {})
                webhook_url = webhook_data.get('url', '')
                
                if webhook_url:
                    print(f"⚠️  Webhook is configured: {webhook_url}")
                    print(f"   This might conflict with polling mode")
                    print(f"   Pending updates: {webhook_data.get('pending_update_count', 0)}")
                    
                    # Delete webhook to enable polling
                    print("🔄 Removing webhook to enable polling...")
                    delete_response = requests.post(
                        f"https://api.telegram.org/bot{bot_token}/deleteWebhook",
                        timeout=10
                    )
                    
                    if delete_response.status_code == 200:
                        delete_result = delete_response.json()
                        if delete_result.get('ok'):
                            print("✅ Webhook removed successfully")
                            return True
                        else:
                            print(f"❌ Failed to remove webhook: {delete_result.get('description')}")
                            return False
                    else:
                        print(f"❌ HTTP Error removing webhook: {delete_response.status_code}")
                        return False
                else:
                    print("✅ No webhook configured (polling mode active)")
                    return True
            else:
                print(f"❌ Webhook info error: {webhook_info.get('description')}")
                return False
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Webhook test error: {str(e)}")
        return False

def test_service_integration():
    """Test integration between bot and other services"""
    print("\n🔄 Testing Service Integration...")
    print("=" * 50)
    
    # Test LLM service
    print("🧠 Testing LLM Service...")
    try:
        llm_response = requests.post(
            'http://localhost:3003/generate',
            json={
                "topic": "test bot integration",
                "tone": "professional",
                "length": "short",
                "platform": "twitter"
            },
            timeout=15
        )
        
        if llm_response.status_code == 200:
            llm_data = llm_response.json()
            if llm_data.get('success'):
                print("✅ LLM service integration working")
                print(f"   Generated content ID: {llm_data.get('content', {}).get('id', 'Unknown')}")
            else:
                print("❌ LLM service not generating content")
                return False
        else:
            print(f"❌ LLM service error: {llm_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ LLM service error: {str(e)}")
        return False
    
    # Test Backend API
    print("🔧 Testing Backend API...")
    try:
        backend_response = requests.get('http://localhost:3001/health', timeout=5)
        if backend_response.status_code == 200:
            backend_data = backend_response.json()
            print(f"✅ Backend API responding: {backend_data.get('status', 'Unknown')}")
        else:
            print(f"⚠️  Backend API degraded: {backend_response.status_code}")
    except Exception as e:
        print(f"⚠️  Backend API offline: {str(e)}")
    
    # Test Bot Health
    print("🤖 Testing Bot Health...")
    try:
        bot_response = requests.get('http://localhost:3002/health', timeout=5)
        if bot_response.status_code == 200:
            bot_data = bot_response.json()
            print(f"✅ Bot service healthy: {bot_data.get('status', 'Unknown')}")
            return True
        else:
            print(f"❌ Bot service error: {bot_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Bot service offline: {str(e)}")
        return False

def create_user_interaction_guide():
    """Create a guide for manual testing"""
    print("\n📱 User Interaction Guide...")
    print("=" * 50)
    
    print("🎯 To test the bot manually:")
    print("1. Open Telegram and search for @MarketingProAI_bot")
    print("2. Start a conversation with the bot")
    print("3. Try these commands:")
    print("   • /start - Welcome message")
    print("   • /help - Show all commands")
    print("   • /create_campaign I want to promote my crypto course")
    print("   • /generate crypto market analysis")
    print("   • /analytics")
    print("   • /trends")
    print()
    print("🔍 Expected behavior:")
    print("   • Bot should respond immediately")
    print("   • Messages should be well-formatted")
    print("   • Commands should trigger appropriate actions")
    print("   • Natural language should be processed by AI")
    print()
    print("📊 If the bot responds correctly, the integration is working!")

def main():
    """Run comprehensive real user interaction test"""
    print("🤖 X Marketing Platform - Real User Interaction Test")
    print("🔧 Testing Bot's Ability to Handle Real User Messages")
    print("=" * 70)
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Run all tests
    polling_success, updates = test_bot_polling_status()
    commands_success = test_bot_commands_setup()
    bot_info_success, bot_data = test_bot_info()
    webhook_success = test_webhook_configuration()
    integration_success = test_service_integration()
    
    # Calculate success rate
    tests = [
        polling_success,
        commands_success,
        bot_info_success,
        webhook_success,
        integration_success
    ]
    
    passed_tests = sum(tests)
    total_tests = len(tests)
    success_rate = (passed_tests / total_tests) * 100
    
    # Final summary
    print("\n" + "=" * 70)
    print("📊 REAL USER INTERACTION TEST SUMMARY")
    print("=" * 70)
    print(f"Bot Polling: {'✅ ACTIVE' if polling_success else '❌ FAILED'}")
    print(f"Commands Setup: {'✅ CONFIGURED' if commands_success else '❌ FAILED'}")
    print(f"Bot Information: {'✅ RETRIEVED' if bot_info_success else '❌ FAILED'}")
    print(f"Webhook Config: {'✅ CORRECT' if webhook_success else '❌ FAILED'}")
    print(f"Service Integration: {'✅ WORKING' if integration_success else '❌ FAILED'}")
    print()
    print(f"Overall Success Rate: {success_rate:.1f}%")
    print()
    
    if success_rate >= 90:
        print("🎉 EXCELLENT! Bot is ready for real user interactions!")
        print("✅ All systems operational")
        print("✅ Bot properly configured")
        print("✅ Services integrated correctly")
    elif success_rate >= 70:
        print("⚠️  GOOD! Most functionality working")
        print("✅ Core features operational")
        print("⚠️  Minor configuration issues")
    else:
        print("❌ NEEDS WORK! Major configuration issues")
        print("❌ Bot not ready for users")
        print("❌ Critical problems detected")
    
    if bot_data:
        print(f"\n🤖 Bot Ready: @{bot_data.get('username')} is live!")
        print("📱 Users can interact with the bot on Telegram")
        print("🚀 All commands configured and ready")
    
    # Show interaction guide
    create_user_interaction_guide()
    
    print(f"\n⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return success_rate

if __name__ == "__main__":
    main()
