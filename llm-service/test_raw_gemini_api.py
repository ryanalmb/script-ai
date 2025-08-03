#!/usr/bin/env python3
"""
Raw Gemini API Testing Script
Tests raw API calls for all available Gemini models
Based on actual API response from July 2025
"""

import os
import asyncio
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

class RawGeminiAPITester:
    """Raw Gemini API testing class"""
    
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Working models from previous test
        self.working_models = [
            "models/gemini-2.5-pro",
            "models/gemini-2.5-flash", 
            "models/gemini-2.5-flash-lite",
            "models/gemini-2.5-flash-preview-05-20",
            "models/gemini-1.5-flash",
            "models/gemini-1.5-flash-002",
            "models/gemini-2.0-flash-exp"
        ]
    
    async def initialize_session(self):
        """Initialize aiohttp session"""
        if not self.session or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=60, connect=10)
            connector = aiohttp.TCPConnector(
                limit=50,
                limit_per_host=10,
                ttl_dns_cache=300,
                use_dns_cache=True
            )
            
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'Raw-Gemini-API-Tester/1.0'
                }
            )
    
    async def close_session(self):
        """Close aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def list_all_models(self) -> List[Dict[str, Any]]:
        """Get complete list of all available models"""
        try:
            await self.initialize_session()
            
            url = f"{self.base_url}/models?key={self.api_key}"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    models = data.get('models', [])
                    
                    print(f"📋 Complete Model List ({len(models)} models):")
                    print("=" * 80)
                    
                    # Categorize models
                    categories = {
                        'Gemini 2.5': [],
                        'Gemini 1.5': [],
                        'Gemini 2.0': [],
                        'Gemini 1.0': [],
                        'Embedding': [],
                        'Other': []
                    }
                    
                    for model in models:
                        name = model.get('name', '')
                        display_name = model.get('displayName', '')
                        description = model.get('description', '')
                        
                        if 'gemini-2.5' in name.lower():
                            categories['Gemini 2.5'].append((name, display_name, description))
                        elif 'gemini-1.5' in name.lower():
                            categories['Gemini 1.5'].append((name, display_name, description))
                        elif 'gemini-2.0' in name.lower():
                            categories['Gemini 2.0'].append((name, display_name, description))
                        elif 'gemini-1.0' in name.lower() or 'gemini-pro' in name.lower():
                            categories['Gemini 1.0'].append((name, display_name, description))
                        elif 'embedding' in name.lower():
                            categories['Embedding'].append((name, display_name, description))
                        else:
                            categories['Other'].append((name, display_name, description))
                    
                    # Print categorized models
                    for category, model_list in categories.items():
                        if model_list:
                            print(f"\n🔹 {category} Models ({len(model_list)}):")
                            for name, display_name, description in model_list:
                                short_name = name.replace('models/', '')
                                print(f"   • {short_name}")
                                if display_name and display_name != short_name:
                                    print(f"     Display: {display_name}")
                                if description:
                                    desc_short = description[:100] + "..." if len(description) > 100 else description
                                    print(f"     Desc: {desc_short}")
                    
                    return models
                else:
                    print(f"❌ Failed to list models: HTTP {response.status}")
                    return []
                    
        except Exception as e:
            print(f"❌ Error listing models: {e}")
            return []
    
    async def test_raw_api_call(self, model_name: str, prompt: str = "Hello! Please tell me about yourself.") -> Dict[str, Any]:
        """Test raw API call to a specific model"""
        start_time = time.time()
        
        try:
            await self.initialize_session()
            
            # Raw API payload
            payload = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "topP": 0.9,
                    "topK": 40,
                    "maxOutputTokens": 1000,
                    "candidateCount": 1
                },
                "safetySettings": [
                    {
                        "category": "HARM_CATEGORY_HARASSMENT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_HATE_SPEECH", 
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            }
            
            url = f"{self.base_url}/{model_name}:generateContent?key={self.api_key}"
            
            print(f"\n🔍 Testing Raw API Call:")
            print(f"   URL: {url}")
            print(f"   Model: {model_name}")
            print(f"   Prompt: {prompt[:50]}...")
            
            async with self.session.post(url, json=payload) as response:
                response_time = time.time() - start_time
                response_data = await response.json()
                
                result = {
                    'model': model_name,
                    'success': response.status == 200,
                    'status_code': response.status,
                    'response_time': response_time,
                    'request_payload': payload,
                    'response_data': response_data
                }
                
                if response.status == 200:
                    # Extract content
                    candidates = response_data.get('candidates', [])
                    if candidates:
                        content = candidates[0].get('content', {})
                        parts = content.get('parts', [])
                        if parts:
                            result['generated_content'] = parts[0].get('text', '')
                    
                    # Extract usage
                    usage = response_data.get('usageMetadata', {})
                    if usage:
                        result['token_usage'] = {
                            'prompt_tokens': usage.get('promptTokenCount', 0),
                            'completion_tokens': usage.get('candidatesTokenCount', 0),
                            'total_tokens': usage.get('totalTokenCount', 0)
                        }
                    
                    print(f"   ✅ Success - {response_time:.2f}s")
                    if result.get('generated_content'):
                        content_preview = result['generated_content'][:100] + "..." if len(result['generated_content']) > 100 else result['generated_content']
                        print(f"   📝 Content: {content_preview}")
                    if result.get('token_usage'):
                        usage = result['token_usage']
                        print(f"   📊 Tokens: {usage['prompt_tokens']} prompt + {usage['completion_tokens']} completion = {usage['total_tokens']} total")
                
                else:
                    error = response_data.get('error', {})
                    result['error'] = error.get('message', 'Unknown error')
                    print(f"   ❌ Failed - HTTP {response.status}: {result['error']}")
                
                return result
                
        except Exception as e:
            response_time = time.time() - start_time
            result = {
                'model': model_name,
                'success': False,
                'response_time': response_time,
                'error': str(e)
            }
            print(f"   💥 Exception: {e}")
            return result
    
    async def test_all_working_models(self) -> Dict[str, Any]:
        """Test all working models with different prompts"""
        print("🚀 Testing Raw API Calls for All Working Models")
        print("=" * 80)
        
        test_prompts = [
            "Hello! Please introduce yourself and tell me about your capabilities.",
            "Solve this math problem step by step: What is 15% of 240?",
            "Write a short creative story about a robot learning to paint.",
            "Explain the concept of machine learning in simple terms.",
            "Generate a Python function to reverse a string."
        ]
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'total_models': len(self.working_models),
            'total_prompts': len(test_prompts),
            'model_results': {},
            'summary': {
                'successful_calls': 0,
                'failed_calls': 0,
                'avg_response_time': 0.0,
                'total_tokens_used': 0
            }
        }
        
        total_response_time = 0.0
        successful_calls = 0
        failed_calls = 0
        total_tokens = 0
        
        for model_name in self.working_models:
            print(f"\n🤖 Testing Model: {model_name.replace('models/', '')}")
            print("-" * 60)
            
            model_results = []
            
            for i, prompt in enumerate(test_prompts, 1):
                print(f"\n[{i}/{len(test_prompts)}] Prompt: {prompt[:50]}...")
                
                result = await self.test_raw_api_call(model_name, prompt)
                model_results.append(result)
                
                if result['success']:
                    successful_calls += 1
                    total_response_time += result['response_time']
                    if result.get('token_usage'):
                        total_tokens += result['token_usage']['total_tokens']
                else:
                    failed_calls += 1
                
                # Rate limiting delay
                await asyncio.sleep(1)
            
            results['model_results'][model_name] = model_results
            
            # Delay between models
            await asyncio.sleep(2)
        
        # Calculate summary
        results['summary']['successful_calls'] = successful_calls
        results['summary']['failed_calls'] = failed_calls
        results['summary']['avg_response_time'] = (
            total_response_time / successful_calls if successful_calls > 0 else 0.0
        )
        results['summary']['total_tokens_used'] = total_tokens
        
        return results
    
    def print_final_summary(self, results: Dict[str, Any]):
        """Print final test summary"""
        print("\n" + "=" * 80)
        print("📊 RAW GEMINI API TESTING FINAL SUMMARY")
        print("=" * 80)
        
        print(f"🕐 Test completed: {results['timestamp']}")
        print(f"🤖 Models tested: {results['total_models']}")
        print(f"💬 Prompts per model: {results['total_prompts']}")
        print(f"✅ Successful calls: {results['summary']['successful_calls']}")
        print(f"❌ Failed calls: {results['summary']['failed_calls']}")
        print(f"⏱️  Average response time: {results['summary']['avg_response_time']:.2f}s")
        print(f"🎯 Total tokens used: {results['summary']['total_tokens_used']}")
        
        # Model performance breakdown
        print(f"\n📈 Model Performance Breakdown:")
        for model_name, model_results in results['model_results'].items():
            model_short = model_name.replace('models/', '')
            successful = sum(1 for r in model_results if r['success'])
            total = len(model_results)
            avg_time = sum(r['response_time'] for r in model_results if r['success']) / successful if successful > 0 else 0
            
            print(f"   🤖 {model_short}: {successful}/{total} success, {avg_time:.2f}s avg")

async def main():
    """Main test function"""
    tester = RawGeminiAPITester()
    
    try:
        # First, list all available models
        print("🔍 Fetching complete model list from Gemini API...")
        await tester.list_all_models()
        
        # Test all working models
        results = await tester.test_all_working_models()
        
        # Print summary
        tester.print_final_summary(results)
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = f"raw_gemini_api_test_{timestamp}.json"
        
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Detailed results saved to: {results_file}")
        
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n💥 Test failed: {e}")
    finally:
        await tester.close_session()

if __name__ == "__main__":
    asyncio.run(main())
