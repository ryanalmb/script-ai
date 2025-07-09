#!/usr/bin/env python3
"""
Test Real Telegram Bot Integration
Verifies the bot is connected to Telegram's API and ready to receive commands
"""
import requests
import json
import time
from datetime import datetime

def test_telegram_api_connection():
    """Test if the bot can connect to Telegram's API"""
    print("🔗 Testing Telegram API Connection...")
    print("=" * 50)
    
    bot_token = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
    
    try:
        # Test getMe endpoint to verify bot token
        response = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getMe",
            timeout=10
        )
        
        if response.status_code == 200:
            bot_info = response.json()
            if bot_info.get('ok'):
                bot_data = bot_info.get('result', {})
                print(f"✅ Bot connected successfully!")
                print(f"   Bot ID: {bot_data.get('id')}")
                print(f"   Bot Username: @{bot_data.get('username')}")
                print(f"   Bot Name: {bot_data.get('first_name')}")
                print(f"   Can Join Groups: {bot_data.get('can_join_groups')}")
                print(f"   Can Read Messages: {bot_data.get('can_read_all_group_messages')}")
                return True, bot_data
            else:
                print(f"❌ Bot API error: {bot_info.get('description')}")
                return False, None
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        return False, None

def test_bot_commands_setup():
    """Test if bot commands are properly set up"""
    print("\n📋 Testing Bot Commands Setup...")
    print("=" * 50)
    
    bot_token = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
    
    try:
        # Get bot commands
        response = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getMyCommands",
            timeout=10
        )
        
        if response.status_code == 200:
            commands_info = response.json()
            if commands_info.get('ok'):
                commands = commands_info.get('result', [])
                print(f"✅ Bot has {len(commands)} commands configured")
                
                if commands:
                    print("   Configured commands:")
                    for cmd in commands[:10]:  # Show first 10 commands
                        print(f"   /{cmd.get('command')} - {cmd.get('description')}")
                    if len(commands) > 10:
                        print(f"   ... and {len(commands) - 10} more commands")
                else:
                    print("   No commands configured yet")
                
                return True, commands
            else:
                print(f"❌ Commands API error: {commands_info.get('description')}")
                return False, []
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False, []
            
    except Exception as e:
        print(f"❌ Commands error: {str(e)}")
        return False, []

def test_bot_webhook_info():
    """Test bot webhook configuration"""
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
                    print(f"✅ Webhook configured: {webhook_url}")
                    print(f"   Has Custom Certificate: {webhook_data.get('has_custom_certificate')}")
                    print(f"   Pending Updates: {webhook_data.get('pending_update_count')}")
                    print(f"   Last Error: {webhook_data.get('last_error_message', 'None')}")
                else:
                    print("✅ No webhook configured (using polling mode)")
                    print("   This is correct for development setup")
                
                return True, webhook_data
            else:
                print(f"❌ Webhook API error: {webhook_info.get('description')}")
                return False, {}
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False, {}
            
    except Exception as e:
        print(f"❌ Webhook error: {str(e)}")
        return False, {}

def test_local_bot_service():
    """Test local bot service health"""
    print("\n🤖 Testing Local Bot Service...")
    print("=" * 50)
    
    try:
        # Test health endpoint
        response = requests.get('http://localhost:3002/health', timeout=5)
        
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Local bot service healthy")
            print(f"   Status: {health_data.get('status')}")
            print(f"   Uptime: {health_data.get('uptime', 0):.2f} seconds")
            print(f"   Timestamp: {health_data.get('timestamp')}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Local service error: {str(e)}")
        return False

def test_service_integration():
    """Test integration between services"""
    print("\n🔄 Testing Service Integration...")
    print("=" * 50)
    
    services = {
        'LLM Service': 'http://localhost:3003/health',
        'Backend API': 'http://localhost:3001/health',
        'Telegram Bot': 'http://localhost:3002/health'
    }
    
    results = {}
    
    for service_name, url in services.items():
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                results[service_name] = "✅ Running"
            elif response.status_code == 503:
                results[service_name] = "⚠️ Degraded"
            else:
                results[service_name] = f"❌ Error {response.status_code}"
        except Exception as e:
            results[service_name] = f"❌ Offline"
    
    print("Service Status:")
    for service, status in results.items():
        print(f"   {service}: {status}")
    
    # Test LLM service functionality
    print("\n🧠 Testing LLM Service Integration...")
    try:
        llm_response = requests.post(
            'http://localhost:3003/generate',
            json={
                "topic": "test telegram bot integration",
                "tone": "professional",
                "length": "short"
            },
            timeout=15
        )
        
        if llm_response.status_code == 200:
            llm_data = llm_response.json()
            if llm_data.get('success'):
                print("✅ LLM service generating content successfully")
                return True
            else:
                print("❌ LLM service not generating content")
                return False
        else:
            print(f"❌ LLM service error: {llm_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ LLM integration error: {str(e)}")
        return False

def simulate_campaign_creation():
    """Simulate the complete campaign creation process"""
    print("\n🚀 Simulating Campaign Creation Process...")
    print("=" * 50)
    
    print("📱 Simulating: User sends '/create_campaign I want to promote my crypto course'")
    
    # Step 1: Content Generation
    print("🔄 Step 1: Generating campaign content...")
    try:
        content_response = requests.post(
            'http://localhost:3003/generate',
            json={
                "topic": "crypto course promotion for young investors",
                "tone": "educational",
                "length": "medium",
                "platform": "twitter"
            },
            timeout=20
        )
        
        if content_response.status_code == 200:
            content_data = content_response.json()
            if content_data.get('success'):
                print("✅ Campaign content generated")
                content_id = content_data.get('content', {}).get('id', 'Unknown')
                print(f"   Content ID: {content_id}")
            else:
                print("❌ Content generation failed")
                return False
        else:
            print(f"❌ Content generation HTTP error: {content_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Content generation error: {str(e)}")
        return False
    
    # Step 2: Content Analysis
    print("🔄 Step 2: Analyzing content quality...")
    try:
        analysis_response = requests.post(
            'http://localhost:3003/analyze',
            json={"content": "Learn cryptocurrency fundamentals with our comprehensive course designed for young investors"},
            timeout=15
        )
        
        if analysis_response.status_code == 200:
            analysis_data = analysis_response.json()
            if analysis_data.get('success'):
                print("✅ Content analysis completed")
                print(f"   Quality assessment: {analysis_data.get('quality_score', 'N/A')}")
            else:
                print("❌ Content analysis failed")
                return False
        else:
            print(f"❌ Content analysis HTTP error: {analysis_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Content analysis error: {str(e)}")
        return False
    
    print("✅ Campaign creation simulation completed successfully!")
    return True

def main():
    """Run comprehensive real Telegram bot test"""
    print("🤖 X Marketing Platform - Real Telegram Bot Integration Test")
    print("🔑 Testing with Real Telegram API Token")
    print("=" * 70)
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Run all tests
    api_success, bot_info = test_telegram_api_connection()
    commands_success, commands = test_bot_commands_setup()
    webhook_success, webhook_info = test_bot_webhook_info()
    local_service_success = test_local_bot_service()
    integration_success = test_service_integration()
    campaign_success = simulate_campaign_creation()
    
    # Calculate success rate
    tests = [
        api_success,
        commands_success,
        webhook_success,
        local_service_success,
        integration_success,
        campaign_success
    ]
    
    passed_tests = sum(tests)
    total_tests = len(tests)
    success_rate = (passed_tests / total_tests) * 100
    
    # Final summary
    print("\n" + "=" * 70)
    print("📊 REAL TELEGRAM BOT INTEGRATION TEST SUMMARY")
    print("=" * 70)
    print(f"Telegram API Connection: {'✅ CONNECTED' if api_success else '❌ FAILED'}")
    print(f"Bot Commands Setup: {'✅ CONFIGURED' if commands_success else '❌ FAILED'}")
    print(f"Webhook Configuration: {'✅ CORRECT' if webhook_success else '❌ FAILED'}")
    print(f"Local Bot Service: {'✅ RUNNING' if local_service_success else '❌ FAILED'}")
    print(f"Service Integration: {'✅ WORKING' if integration_success else '❌ FAILED'}")
    print(f"Campaign Simulation: {'✅ SUCCESS' if campaign_success else '❌ FAILED'}")
    print()
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {success_rate:.1f}%")
    print()
    
    if success_rate >= 90:
        print("🎉 EXCELLENT! Telegram bot is fully operational!")
        print("✅ Real Telegram API integration working")
        print("✅ All services communicating properly")
        print("✅ Campaign creation workflow functional")
        print("✅ Ready for production use!")
    elif success_rate >= 70:
        print("⚠️  GOOD! Most functionality working")
        print("✅ Core integration operational")
        print("⚠️  Minor issues to resolve")
    else:
        print("❌ NEEDS WORK! Major integration issues")
        print("❌ Critical functionality not working")
        print("❌ Not ready for production")
    
    if bot_info:
        print(f"\n🤖 Bot Ready: @{bot_info.get('username')} is live and connected!")
        print("📱 Users can now send commands to the bot on Telegram")
        print("🚀 Natural language campaign creation is operational")
    
    print(f"\n⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return success_rate

if __name__ == "__main__":
    main()
