#!/usr/bin/env python3
"""
Basic Gemini Endpoints Test
Tests the basic Gemini endpoints that should work without async issues
"""

import requests
import json
import time
from datetime import datetime

def test_basic_gemini_generate():
    """Test the basic /api/gemini/generate endpoint"""
    print("🧪 Testing Basic Gemini Generate Endpoint")
    print("=" * 60)
    
    url = "http://localhost:3003/api/gemini/generate"
    
    test_cases = [
        {
            "name": "Simple Chat",
            "payload": {
                "prompt": "Hello! How are you today?",
                "model": "gemini-2.5-flash",
                "temperature": 0.7,
                "max_tokens": 100
            }
        },
        {
            "name": "Math Problem",
            "payload": {
                "prompt": "What is 15% of 240?",
                "model": "gemini-2.5-flash",
                "temperature": 0.3,
                "max_tokens": 200
            }
        },
        {
            "name": "Code Generation",
            "payload": {
                "prompt": "Write a Python function to reverse a string",
                "model": "gemini-2.5-flash",
                "temperature": 0.5,
                "max_tokens": 300
            }
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n[{i}/{len(test_cases)}] Testing: {test_case['name']}")
        
        start_time = time.time()
        
        try:
            response = requests.post(url, json=test_case['payload'], timeout=30)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('content', '')
                
                print(f"   ✅ Success - {response_time:.2f}s")
                if content and not content.startswith('Error:'):
                    content_preview = content[:80] + "..." if len(content) > 80 else content
                    print(f"   📝 Content: {content_preview}")
                else:
                    print(f"   ⚠️  Content: {content}")
                
                results.append({
                    'test': test_case['name'],
                    'success': True,
                    'response_time': response_time,
                    'content': content,
                    'status_code': response.status_code
                })
            else:
                error_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                error_msg = error_data.get('error', f'HTTP {response.status_code}')
                
                print(f"   ❌ Failed - {response_time:.2f}s")
                print(f"   💥 Error: {error_msg}")
                
                results.append({
                    'test': test_case['name'],
                    'success': False,
                    'response_time': response_time,
                    'error': error_msg,
                    'status_code': response.status_code
                })
                
        except Exception as e:
            response_time = time.time() - start_time
            print(f"   💥 Exception - {response_time:.2f}s")
            print(f"   💥 Error: {str(e)}")
            
            results.append({
                'test': test_case['name'],
                'success': False,
                'response_time': response_time,
                'error': str(e),
                'status_code': None
            })
        
        # Rate limiting delay
        time.sleep(2)
    
    return results

def test_service_status():
    """Test service status endpoints"""
    print("\n🏥 Testing Service Status Endpoints")
    print("=" * 60)
    
    endpoints = [
        "/health",
        "/api/gemini/status",
        "/api/gemini/enterprise/status"
    ]
    
    base_url = "http://localhost:3003"
    
    for endpoint in endpoints:
        print(f"\n🔍 Testing {endpoint}")
        
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Success - HTTP {response.status_code}")
                
                # Show key information
                if 'services' in data:
                    services = data['services']
                    active_services = sum(1 for v in services.values() if v)
                    total_services = len(services)
                    print(f"   📊 Services: {active_services}/{total_services} active")
                
                if 'gemini_client' in data:
                    print(f"   🤖 Gemini Client: {'✅' if data['gemini_client'] else '❌'}")
                
                if 'available_models' in data:
                    models = data['available_models']
                    print(f"   📋 Available Models: {len(models)}")
                    
            else:
                print(f"   ❌ Failed - HTTP {response.status_code}")
                
        except Exception as e:
            print(f"   💥 Exception: {str(e)}")

def test_working_models_direct():
    """Test working models directly with the basic endpoint"""
    print("\n🤖 Testing Working Models Directly")
    print("=" * 60)
    
    working_models = [
        "gemini-2.5-pro",
        "gemini-2.5-flash", 
        "gemini-2.5-flash-lite"
    ]
    
    url = "http://localhost:3003/api/gemini/generate"
    prompt = "Hello! Please respond with a brief greeting."
    
    for model in working_models:
        print(f"\n🧪 Testing {model}")
        
        payload = {
            "prompt": prompt,
            "model": model,
            "temperature": 0.7,
            "max_tokens": 100
        }
        
        try:
            start_time = time.time()
            response = requests.post(url, json=payload, timeout=20)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('content', '')
                
                if content and not content.startswith('Error:'):
                    print(f"   ✅ Success - {response_time:.2f}s")
                    content_preview = content[:60] + "..." if len(content) > 60 else content
                    print(f"   📝 Response: {content_preview}")
                else:
                    print(f"   ⚠️  Partial Success - {response_time:.2f}s")
                    print(f"   ⚠️  Issue: {content}")
            else:
                error_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                error_msg = error_data.get('error', f'HTTP {response.status_code}')
                print(f"   ❌ Failed - {response_time:.2f}s")
                print(f"   💥 Error: {error_msg}")
                
        except Exception as e:
            print(f"   💥 Exception: {str(e)}")
        
        # Rate limiting delay
        time.sleep(3)

def main():
    """Main test function"""
    print("🚀 Starting Basic Gemini Endpoints Test")
    print("=" * 80)
    print(f"🕐 Test started at: {datetime.now().isoformat()}")
    
    try:
        # Test service status first
        test_service_status()
        
        # Test basic generate endpoint
        results = test_basic_gemini_generate()
        
        # Test working models directly
        test_working_models_direct()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        successful = sum(1 for r in results if r['success'])
        total = len(results)
        avg_time = sum(r['response_time'] for r in results if r['success']) / successful if successful > 0 else 0
        
        print(f"✅ Successful tests: {successful}/{total}")
        print(f"⏱️  Average response time: {avg_time:.2f}s")
        
        if successful > 0:
            print(f"\n🎉 Working functionality detected!")
            print(f"   • Basic Gemini endpoint is accessible")
            print(f"   • Service is responding to requests")
            print(f"   • At least some models are working")
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = f"basic_gemini_test_{timestamp}.json"
        
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'results': results,
                'summary': {
                    'successful': successful,
                    'total': total,
                    'avg_response_time': avg_time
                }
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Results saved to: {results_file}")
        
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n💥 Test failed: {e}")

if __name__ == "__main__":
    main()
