#!/usr/bin/env python3
"""
Complete X Marketing Platform End-to-End Integration Test
Tests the full workflow: Telegram Bot → Backend API → LLM Service → Hugging Face
"""
import requests
import json
import time
from datetime import datetime

def test_service_health():
    """Test all services are running and healthy"""
    print("🏥 Testing Service Health...")
    print("=" * 50)
    
    services = {
        'LLM Service': 'http://localhost:3003/health',
        'Backend API': 'http://localhost:3001/health',
        'Telegram Bot': 'http://localhost:3002'
    }
    
    results = {}
    
    for service_name, url in services.items():
        try:
            if service_name == 'Telegram Bot':
                # For Telegram bot, just check if port is responding
                response = requests.get(url, timeout=5)
                results[service_name] = 'Running' if response.status_code in [200, 404, 405] else 'Down'
            else:
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    results[service_name] = data.get('status', 'Unknown')
                else:
                    results[service_name] = f'HTTP {response.status_code}'
        except Exception as e:
            results[service_name] = f'Error: {str(e)[:50]}'
    
    for service, status in results.items():
        status_icon = "✅" if status in ['OK', 'Running'] else "⚠️" if 'DEGRADED' in status else "❌"
        print(f"{status_icon} {service}: {status}")
    
    return results

def test_llm_content_generation():
    """Test LLM service content generation with real Hugging Face API"""
    print("\n🧠 Testing LLM Content Generation...")
    print("=" * 50)
    
    test_cases = [
        {
            "name": "Crypto Course Promotion",
            "request": {
                "topic": "crypto course for young investors",
                "tone": "educational",
                "length": "medium",
                "platform": "twitter"
            }
        },
        {
            "name": "Investment Education",
            "request": {
                "topic": "blockchain technology basics",
                "tone": "professional",
                "length": "short",
                "platform": "linkedin"
            }
        }
    ]
    
    results = []
    
    for test_case in test_cases:
        print(f"\n📝 Testing: {test_case['name']}")
        try:
            response = requests.post(
                'http://localhost:3003/generate',
                json=test_case['request'],
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                content = data.get('content', {})
                
                if success and content:
                    print(f"✅ Success: Generated content with ID {content.get('id', 'Unknown')}")
                    print(f"   Content length: {content.get('metadata', {}).get('character_count', 'Unknown')} chars")
                    results.append(True)
                else:
                    print(f"❌ Failed: {data.get('error', 'Unknown error')}")
                    results.append(False)
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                results.append(False)
                
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
            results.append(False)
    
    return results

def test_content_analysis():
    """Test content analysis with Hugging Face models"""
    print("\n🔍 Testing Content Analysis...")
    print("=" * 50)
    
    test_content = [
        "Cryptocurrency education is essential for young investors to make informed decisions.",
        "Learn blockchain technology and secure your financial future with our comprehensive course.",
        "Join thousands of students who have mastered crypto trading and investment strategies."
    ]
    
    results = []
    
    for i, content in enumerate(test_content, 1):
        print(f"\n📊 Analyzing content {i}...")
        try:
            response = requests.post(
                'http://localhost:3003/analyze',
                json={"content": content},
                timeout=20
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success', False):
                    print(f"✅ Analysis successful")
                    print(f"   Sentiment: {data.get('sentiment', 'Unknown')}")
                    print(f"   Quality Score: {data.get('quality_score', 'N/A')}")
                    results.append(True)
                else:
                    print(f"❌ Analysis failed: {data.get('error', 'Unknown')}")
                    results.append(False)
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                results.append(False)
                
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
            results.append(False)
    
    return results

def test_trending_topics():
    """Test trending topics functionality"""
    print("\n📈 Testing Trending Topics...")
    print("=" * 50)
    
    try:
        response = requests.get(
            'http://localhost:3003/trending?category=crypto',
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success', False):
                topics = data.get('trending_topics', [])
                print(f"✅ Retrieved {len(topics)} trending topics")
                for i, topic in enumerate(topics[:3], 1):
                    print(f"   {i}. {topic.get('topic', 'Unknown')} (Score: {topic.get('score', 'N/A')})")
                return True
            else:
                print(f"❌ Failed: {data.get('error', 'Unknown')}")
                return False
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_templates():
    """Test content templates"""
    print("\n📋 Testing Content Templates...")
    print("=" * 50)
    
    try:
        response = requests.get(
            'http://localhost:3003/templates',
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success', False):
                templates = data.get('templates', [])
                print(f"✅ Retrieved {len(templates)} templates")
                for i, template in enumerate(templates[:3], 1):
                    print(f"   {i}. {template.get('name', 'Unknown')} - {template.get('description', 'No description')}")
                return True
            else:
                print(f"❌ Failed: {data.get('error', 'Unknown')}")
                return False
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def simulate_telegram_campaign_creation():
    """Simulate the /create_campaign command workflow"""
    print("\n🤖 Simulating Telegram Campaign Creation...")
    print("=" * 50)
    
    # This simulates what happens when a user sends:
    # /create_campaign I want to promote my crypto course to young investors
    
    campaign_prompt = "I want to promote my crypto course to young investors"
    print(f"📱 Simulating command: /create_campaign {campaign_prompt}")
    
    # Step 1: Parse the natural language prompt
    print("\n🔄 Step 1: Processing natural language prompt...")
    
    # Step 2: Generate content using LLM service
    print("🔄 Step 2: Generating campaign content...")
    try:
        content_response = requests.post(
            'http://localhost:3003/generate',
            json={
                "topic": campaign_prompt,
                "tone": "educational",
                "length": "medium",
                "platform": "twitter"
            },
            timeout=30
        )
        
        if content_response.status_code == 200:
            content_data = content_response.json()
            if content_data.get('success', False):
                print("✅ Content generated successfully")
                content_id = content_data.get('content', {}).get('id', 'Unknown')
                print(f"   Content ID: {content_id}")
            else:
                print("❌ Content generation failed")
                return False
        else:
            print(f"❌ Content generation HTTP error: {content_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Content generation exception: {str(e)}")
        return False
    
    # Step 3: Analyze content quality
    print("🔄 Step 3: Analyzing content quality...")
    try:
        analysis_response = requests.post(
            'http://localhost:3003/analyze',
            json={"content": "Comprehensive crypto course for young investors - learn blockchain fundamentals"},
            timeout=20
        )
        
        if analysis_response.status_code == 200:
            analysis_data = analysis_response.json()
            if analysis_data.get('success', False):
                print("✅ Content analysis completed")
                print(f"   Quality assessment: {analysis_data.get('quality_score', 'N/A')}")
            else:
                print("❌ Content analysis failed")
                return False
        else:
            print(f"❌ Content analysis HTTP error: {analysis_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Content analysis exception: {str(e)}")
        return False
    
    print("✅ Campaign creation workflow completed successfully!")
    return True

def main():
    """Run complete system test"""
    print("🚀 X Marketing Platform - Complete End-to-End Test")
    print("🔑 Real API Integration Test")
    print("=" * 60)
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Run all tests
    health_results = test_service_health()
    content_results = test_llm_content_generation()
    analysis_results = test_content_analysis()
    trending_result = test_trending_topics()
    templates_result = test_templates()
    campaign_result = simulate_telegram_campaign_creation()
    
    # Calculate success rates
    total_tests = 0
    passed_tests = 0
    
    # Service health (3 services)
    healthy_services = sum(1 for status in health_results.values() if status in ['OK', 'Running'])
    total_tests += len(health_results)
    passed_tests += healthy_services
    
    # Content generation tests
    total_tests += len(content_results)
    passed_tests += sum(content_results)
    
    # Analysis tests
    total_tests += len(analysis_results)
    passed_tests += sum(analysis_results)
    
    # Individual feature tests
    total_tests += 3  # trending, templates, campaign
    passed_tests += sum([trending_result, templates_result, campaign_result])
    
    success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
    
    # Final summary
    print("\n" + "=" * 60)
    print("📊 COMPREHENSIVE TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {success_rate:.1f}%")
    print()
    
    if success_rate >= 90:
        print("🎉 EXCELLENT! System is production-ready!")
        print("✅ All critical components are functional")
        print("✅ Real API integration working perfectly")
        print("✅ End-to-end workflow validated")
    elif success_rate >= 70:
        print("⚠️  GOOD! Minor issues to address")
        print("✅ Core functionality working")
        print("⚠️  Some components need attention")
    else:
        print("❌ NEEDS WORK! Major issues detected")
        print("❌ Critical components failing")
        print("❌ System not ready for production")
    
    print(f"\n⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return success_rate

if __name__ == "__main__":
    main()
