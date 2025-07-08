#!/usr/bin/env python3
"""
Test Natural Language Campaign Creation with Real Hugging Face API
"""
import requests
import json
import time

def test_llm_service():
    """Test the LLM service health and campaign creation"""
    print("🧪 Testing X Marketing Platform with Real API Keys")
    print("=" * 60)
    
    # Test LLM Service Health
    print("1. Testing LLM Service Health...")
    try:
        response = requests.get('http://localhost:3003/health', timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ LLM Service is healthy: {health_data.get('status', 'Unknown')}")
            print(f"   Service: {health_data.get('service', 'Unknown')}")
            print(f"   Version: {health_data.get('version', 'Unknown')}")
            print(f"   Features: {len(health_data.get('features', []))} available")
        else:
            print(f"❌ LLM Service health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to LLM Service: {e}")
        return False
    
    # Test Backend API Health
    print("\n2. Testing Backend API Health...")
    try:
        response = requests.get('http://localhost:3001/health', timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Backend API is running: {health_data.get('status', 'Unknown')}")
            print(f"   Environment: {health_data.get('environment', 'Unknown')}")
            print(f"   Uptime: {health_data.get('uptime', 0):.2f} seconds")
        else:
            print(f"⚠️  Backend API degraded: {response.status_code}")
    except Exception as e:
        print(f"❌ Cannot connect to Backend API: {e}")
    
    # Test Natural Language Campaign Creation
    print("\n3. Testing Natural Language Campaign Creation...")
    campaign_request = {
        "prompt": "I want to promote my crypto course to young investors",
        "campaign_type": "educational",
        "target_audience": "young investors",
        "product": "crypto course"
    }
    
    try:
        print(f"   Sending request: {campaign_request['prompt']}")
        response = requests.post(
            'http://localhost:3003/orchestrate-campaign',
            json=campaign_request,
            timeout=30
        )
        
        if response.status_code == 200:
            campaign_data = response.json()
            print("✅ Campaign created successfully!")
            print(f"   Campaign ID: {campaign_data.get('campaign_id', 'Unknown')}")
            print(f"   Campaign Name: {campaign_data.get('campaign_name', 'Unknown')}")
            print(f"   Content Pieces: {len(campaign_data.get('content', []))}")
            print(f"   Automation Rules: {len(campaign_data.get('automation_rules', []))}")
            
            # Show sample content
            content = campaign_data.get('content', [])
            if content:
                print(f"\n   Sample Content:")
                for i, piece in enumerate(content[:2]):
                    print(f"   {i+1}. {piece.get('text', 'No text')[:100]}...")
            
            return True
        else:
            print(f"❌ Campaign creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Campaign creation error: {e}")
        return False

def test_huggingface_integration():
    """Test direct Hugging Face API integration"""
    print("\n4. Testing Hugging Face API Integration...")
    
    try:
        response = requests.post(
            'http://localhost:3003/generate-content',
            json={
                "prompt": "Create a tweet about cryptocurrency education for young investors",
                "max_length": 280,
                "temperature": 0.7
            },
            timeout=20
        )
        
        if response.status_code == 200:
            content_data = response.json()
            print("✅ Hugging Face content generation successful!")
            print(f"   Generated text: {content_data.get('text', 'No text')[:200]}...")
            return True
        else:
            print(f"❌ Hugging Face integration failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Hugging Face integration error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 X Marketing Platform - Complete System Test")
    print("🔑 Using Real API Keys:")
    print("   - Telegram Bot: 7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0")
    print("   - Hugging Face: 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")
    print()
    
    # Run tests
    llm_test = test_llm_service()
    hf_test = test_huggingface_integration()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"LLM Service & Campaign Creation: {'✅ PASS' if llm_test else '❌ FAIL'}")
    print(f"Hugging Face API Integration: {'✅ PASS' if hf_test else '❌ FAIL'}")
    
    success_rate = (llm_test + hf_test) / 2 * 100
    print(f"\n🎯 Overall Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 90:
        print("🎉 EXCELLENT! System is ready for production!")
    elif success_rate >= 70:
        print("⚠️  GOOD! Minor issues to resolve.")
    else:
        print("❌ NEEDS WORK! Major issues detected.")

if __name__ == "__main__":
    main()
