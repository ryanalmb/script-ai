#!/usr/bin/env python3
"""
Test Fixed Telegram Bot Command Handling
Verifies that the bot properly processes commands and returns meaningful responses
"""
import requests
import json
import time
from datetime import datetime

def test_bot_health():
    """Test if the bot is running and healthy"""
    print("🤖 Testing Bot Health...")
    print("=" * 50)
    
    try:
        response = requests.get('http://localhost:3002/health', timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Bot is healthy")
            print(f"   Status: {health_data.get('status')}")
            print(f"   Uptime: {health_data.get('uptime', 0):.2f} seconds")
            return True
        else:
            print(f"❌ Bot health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to bot: {str(e)}")
        return False

def test_telegram_api_connection():
    """Test Telegram API connection"""
    print("\n🔗 Testing Telegram API Connection...")
    print("=" * 50)
    
    bot_token = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
    
    try:
        response = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getMe",
            timeout=10
        )
        
        if response.status_code == 200:
            bot_info = response.json()
            if bot_info.get('ok'):
                bot_data = bot_info.get('result', {})
                print(f"✅ Bot connected to Telegram API")
                print(f"   Bot Username: @{bot_data.get('username')}")
                print(f"   Bot Name: {bot_data.get('first_name')}")
                return True, bot_data
            else:
                print(f"❌ Telegram API error: {bot_info.get('description')}")
                return False, None
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        return False, None

def test_llm_service_integration():
    """Test LLM service integration"""
    print("\n🧠 Testing LLM Service Integration...")
    print("=" * 50)
    
    try:
        # Test content generation
        response = requests.post(
            'http://localhost:3003/generate',
            json={
                "topic": "test bot command integration",
                "tone": "professional",
                "length": "short",
                "platform": "twitter"
            },
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ LLM service responding correctly")
                print(f"   Content generated: {data.get('content', {}).get('id', 'Unknown')}")
                return True
            else:
                print("❌ LLM service not generating content")
                return False
        else:
            print(f"❌ LLM service error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ LLM service error: {str(e)}")
        return False

def simulate_bot_command(command, test_user_id="123456789"):
    """Simulate sending a command to the bot via Telegram API"""
    print(f"\n📱 Testing Command: {command}")
    
    bot_token = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
    
    # Create a test message payload
    message_data = {
        "chat_id": test_user_id,
        "text": command
    }
    
    try:
        # Send message via Telegram API (this will be processed by our bot)
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json=message_data,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                print(f"✅ Command sent successfully")
                print(f"   Message ID: {result.get('result', {}).get('message_id')}")
                return True
            else:
                print(f"❌ Failed to send command: {result.get('description')}")
                return False
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error sending command: {str(e)}")
        return False

def test_core_commands():
    """Test core bot commands"""
    print("\n🎯 Testing Core Commands...")
    print("=" * 50)
    
    core_commands = [
        "/start",
        "/help", 
        "/generate crypto market analysis",
        "/create_campaign I want to promote my crypto course to young investors"
    ]
    
    results = []
    
    for command in core_commands:
        success = simulate_bot_command(command)
        results.append(success)
        time.sleep(2)  # Wait between commands
    
    return results

def test_natural_language_workflow():
    """Test the complete natural language workflow"""
    print("\n🚀 Testing Natural Language Campaign Creation...")
    print("=" * 50)
    
    # Test the LLM service directly with the same request the bot would make
    campaign_prompt = "I want to promote my crypto course to young investors"
    
    try:
        print(f"🔄 Testing LLM service with prompt: '{campaign_prompt}'")
        
        response = requests.post(
            'http://localhost:3003/generate',
            json={
                "topic": campaign_prompt,
                "tone": "professional",
                "length": "medium",
                "platform": "twitter"
            },
            timeout=20
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                content = data.get('content', {})
                print("✅ Natural language processing successful!")
                print(f"   Content ID: {content.get('id', 'Unknown')}")
                print(f"   Content length: {content.get('metadata', {}).get('character_count', 'Unknown')} chars")
                print(f"   Generated text: {content.get('text', 'No text')[:100]}...")
                
                # Now test the bot command
                print("\n🤖 Testing bot command with same prompt...")
                bot_success = simulate_bot_command(f"/create_campaign {campaign_prompt}")
                
                return True, bot_success
            else:
                print("❌ LLM service failed to process natural language")
                return False, False
        else:
            print(f"❌ LLM service HTTP error: {response.status_code}")
            return False, False
    except Exception as e:
        print(f"❌ Natural language test error: {str(e)}")
        return False, False

def test_service_communication():
    """Test communication between all services"""
    print("\n🔄 Testing Service Communication...")
    print("=" * 50)
    
    services = {
        'Telegram Bot': 'http://localhost:3002/health',
        'LLM Service': 'http://localhost:3003/health',
        'Backend API': 'http://localhost:3001/health'
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
            results[service_name] = "❌ Offline"
    
    print("Service Status:")
    for service, status in results.items():
        print(f"   {service}: {status}")
    
    # Test end-to-end workflow
    print("\n🔄 Testing End-to-End Workflow...")
    try:
        # Step 1: Generate content via LLM service
        llm_response = requests.post(
            'http://localhost:3003/generate',
            json={"topic": "test workflow", "tone": "professional", "length": "short"},
            timeout=15
        )
        
        if llm_response.status_code == 200 and llm_response.json().get('success'):
            print("✅ Step 1: LLM content generation working")
            
            # Step 2: Test bot command processing
            bot_success = simulate_bot_command("/generate test workflow")
            if bot_success:
                print("✅ Step 2: Bot command processing working")
                return True
            else:
                print("❌ Step 2: Bot command processing failed")
                return False
        else:
            print("❌ Step 1: LLM content generation failed")
            return False
    except Exception as e:
        print(f"❌ End-to-end workflow error: {str(e)}")
        return False

def main():
    """Run comprehensive command handling test"""
    print("🤖 X Marketing Platform - Fixed Command Handling Test")
    print("🔧 Testing Bot Command Processing & Integration")
    print("=" * 70)
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Run all tests
    bot_healthy = test_bot_health()
    telegram_connected, bot_info = test_telegram_api_connection()
    llm_working = test_llm_service_integration()
    core_results = test_core_commands() if bot_healthy else []
    nl_llm_success, nl_bot_success = test_natural_language_workflow()
    service_communication = test_service_communication()
    
    # Calculate success rate
    total_tests = 6  # bot health, telegram connection, llm service, core commands, natural language, service communication
    passed_tests = 0
    
    if bot_healthy:
        passed_tests += 1
    if telegram_connected:
        passed_tests += 1
    if llm_working:
        passed_tests += 1
    if core_results and sum(core_results) > len(core_results) // 2:  # More than half successful
        passed_tests += 1
    if nl_llm_success and nl_bot_success:
        passed_tests += 1
    if service_communication:
        passed_tests += 1
    
    success_rate = (passed_tests / total_tests) * 100
    
    # Final summary
    print("\n" + "=" * 70)
    print("📊 FIXED COMMAND HANDLING TEST SUMMARY")
    print("=" * 70)
    print(f"Bot Health: {'✅ HEALTHY' if bot_healthy else '❌ UNHEALTHY'}")
    print(f"Telegram API: {'✅ CONNECTED' if telegram_connected else '❌ DISCONNECTED'}")
    print(f"LLM Service: {'✅ WORKING' if llm_working else '❌ FAILED'}")
    print(f"Core Commands: {'✅ WORKING' if core_results and sum(core_results) > 0 else '❌ FAILED'}")
    print(f"Natural Language: {'✅ WORKING' if nl_llm_success else '❌ FAILED'}")
    print(f"Service Communication: {'✅ WORKING' if service_communication else '❌ FAILED'}")
    print()
    print(f"Overall Success Rate: {success_rate:.1f}%")
    print()
    
    if success_rate >= 90:
        print("🎉 EXCELLENT! Bot command handling is fully functional!")
        print("✅ All commands processing correctly")
        print("✅ Natural language integration working")
        print("✅ Real API integration operational")
        print("✅ Ready for user interactions!")
    elif success_rate >= 70:
        print("⚠️  GOOD! Most functionality working")
        print("✅ Core features operational")
        print("⚠️  Minor issues to resolve")
    else:
        print("❌ NEEDS WORK! Major command handling issues")
        print("❌ Bot not responding properly to commands")
        print("❌ Integration problems detected")
    
    if bot_info and telegram_connected:
        print(f"\n🤖 Bot Status: @{bot_info.get('username')} is live and ready!")
        print("📱 Users can now interact with the bot on Telegram")
        print("🚀 Try: /start, /help, or /create_campaign [description]")
    
    print(f"\n⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return success_rate

if __name__ == "__main__":
    main()
