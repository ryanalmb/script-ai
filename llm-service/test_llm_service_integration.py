#!/usr/bin/env python3
"""
LLM Service Integration Test
Tests the integration between your LLM service and Gemini models
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

class LLMServiceIntegrationTester:
    """Test LLM service integration with Gemini"""
    
    def __init__(self):
        self.llm_service_url = "http://localhost:5000"  # Your LLM service
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Working models from previous tests
        self.working_models = [
            "gemini-2.5-pro",
            "gemini-2.5-flash", 
            "gemini-2.5-flash-lite",
            "gemini-1.5-flash",
            "gemini-1.5-flash-002",
            "gemini-2.0-flash-exp"
        ]
        
        # Test scenarios
        self.test_scenarios = [
            {
                "name": "Simple Chat",
                "prompt": "Hello! How are you today?",
                "expected_keywords": ["hello", "good", "fine", "well"]
            },
            {
                "name": "Code Generation",
                "prompt": "Write a Python function to calculate fibonacci numbers",
                "expected_keywords": ["def", "fibonacci", "return", "python"]
            },
            {
                "name": "Creative Writing",
                "prompt": "Write a short poem about artificial intelligence",
                "expected_keywords": ["ai", "artificial", "intelligence", "poem"]
            },
            {
                "name": "Problem Solving",
                "prompt": "How do I optimize a slow database query?",
                "expected_keywords": ["index", "query", "optimize", "database"]
            },
            {
                "name": "Explanation",
                "prompt": "Explain quantum computing in simple terms",
                "expected_keywords": ["quantum", "computing", "qubit", "simple"]
            }
        ]
    
    async def initialize_session(self):
        """Initialize aiohttp session"""
        if not self.session or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=60, connect=10)
            self.session = aiohttp.ClientSession(timeout=timeout)
    
    async def close_session(self):
        """Close aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def test_llm_service_health(self) -> bool:
        """Test if LLM service is running"""
        try:
            await self.initialize_session()
            
            async with self.session.get(f"{self.llm_service_url}/health") as response:
                if response.status == 200:
                    print("✅ LLM Service is running")
                    return True
                else:
                    print(f"❌ LLM Service health check failed: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ LLM Service is not accessible: {e}")
            return False
    
    async def test_gemini_endpoint(self, model: str, prompt: str, scenario_name: str) -> Dict[str, Any]:
        """Test Gemini endpoint through LLM service"""
        start_time = time.time()
        
        try:
            await self.initialize_session()
            
            payload = {
                "prompt": prompt,
                "model": model,
                "temperature": 0.7,
                "max_tokens": 500
            }
            
            print(f"   🧪 Testing {scenario_name} with {model}...")
            
            async with self.session.post(f"{self.llm_service_url}/api/gemini/generate", json=payload) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    
                    result = {
                        'success': True,
                        'model': model,
                        'scenario': scenario_name,
                        'response_time': response_time,
                        'content': data.get('content', ''),
                        'usage': data.get('usage', {}),
                        'quality_score': data.get('quality_score', 0),
                        'confidence_score': data.get('confidence_score', 0)
                    }
                    
                    print(f"      ✅ Success - {response_time:.2f}s")
                    if result['content']:
                        content_preview = result['content'][:80] + "..." if len(result['content']) > 80 else result['content']
                        print(f"      📝 Content: {content_preview}")
                    
                    return result
                    
                else:
                    error_data = await response.json() if response.content_type == 'application/json' else {}
                    result = {
                        'success': False,
                        'model': model,
                        'scenario': scenario_name,
                        'response_time': response_time,
                        'error': error_data.get('error', f'HTTP {response.status}'),
                        'status_code': response.status
                    }
                    
                    print(f"      ❌ Failed - HTTP {response.status}: {result['error']}")
                    return result
                    
        except Exception as e:
            response_time = time.time() - start_time
            result = {
                'success': False,
                'model': model,
                'scenario': scenario_name,
                'response_time': response_time,
                'error': str(e)
            }
            
            print(f"      💥 Exception: {e}")
            return result
    
    async def test_model_router_endpoint(self, prompt: str, complexity: str = "moderate") -> Dict[str, Any]:
        """Test the model router endpoint"""
        start_time = time.time()
        
        try:
            await self.initialize_session()
            
            payload = {
                "prompt": prompt,
                "task_type": "content_generation",
                "complexity": complexity,
                "temperature": 0.7,
                "max_tokens": 500
            }
            
            print(f"   🎯 Testing Model Router (complexity: {complexity})...")
            
            async with self.session.post(f"{self.llm_service_url}/api/gemini/route", json=payload) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    
                    result = {
                        'success': True,
                        'response_time': response_time,
                        'selected_model': data.get('model', 'unknown'),
                        'content': data.get('content', ''),
                        'usage': data.get('usage', {}),
                        'quality_score': data.get('quality_score', 0),
                        'confidence_score': data.get('confidence_score', 0),
                        'reasoning_trace': data.get('reasoning_trace', [])
                    }
                    
                    print(f"      ✅ Success - {response_time:.2f}s")
                    print(f"      🤖 Selected Model: {result['selected_model']}")
                    if result['content']:
                        content_preview = result['content'][:80] + "..." if len(result['content']) > 80 else result['content']
                        print(f"      📝 Content: {content_preview}")
                    
                    return result
                    
                else:
                    error_data = await response.json() if response.content_type == 'application/json' else {}
                    result = {
                        'success': False,
                        'response_time': response_time,
                        'error': error_data.get('error', f'HTTP {response.status}'),
                        'status_code': response.status
                    }
                    
                    print(f"      ❌ Failed - HTTP {response.status}: {result['error']}")
                    return result
                    
        except Exception as e:
            response_time = time.time() - start_time
            result = {
                'success': False,
                'response_time': response_time,
                'error': str(e)
            }
            
            print(f"      💥 Exception: {e}")
            return result
    
    async def run_comprehensive_integration_test(self) -> Dict[str, Any]:
        """Run comprehensive integration test"""
        print("🚀 Starting LLM Service Integration Test")
        print("=" * 80)
        
        # Check if LLM service is running
        service_healthy = await self.test_llm_service_health()
        if not service_healthy:
            return {
                'error': 'LLM Service is not accessible',
                'timestamp': datetime.now().isoformat()
            }
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'service_healthy': service_healthy,
            'model_tests': {},
            'router_tests': {},
            'summary': {
                'total_tests': 0,
                'successful_tests': 0,
                'failed_tests': 0,
                'avg_response_time': 0.0
            }
        }
        
        total_response_time = 0.0
        total_tests = 0
        successful_tests = 0
        
        # Test individual models
        print(f"\n🧪 Testing Individual Models...")
        print("-" * 60)
        
        for model in self.working_models:
            print(f"\n🤖 Testing Model: {model}")
            model_results = []
            
            for scenario in self.test_scenarios:
                result = await self.test_gemini_endpoint(
                    model, 
                    scenario['prompt'], 
                    scenario['name']
                )
                
                model_results.append(result)
                total_tests += 1
                
                if result['success']:
                    successful_tests += 1
                    total_response_time += result['response_time']
                
                # Rate limiting
                await asyncio.sleep(0.5)
            
            results['model_tests'][model] = model_results
            
            # Delay between models
            await asyncio.sleep(1)
        
        # Test model router
        print(f"\n🎯 Testing Model Router...")
        print("-" * 60)
        
        router_scenarios = [
            ("simple", "Hello, how are you?"),
            ("moderate", "Explain machine learning algorithms"),
            ("complex", "Design a distributed system architecture for a social media platform")
        ]
        
        for complexity, prompt in router_scenarios:
            result = await self.test_model_router_endpoint(prompt, complexity)
            
            results['router_tests'][complexity] = result
            total_tests += 1
            
            if result['success']:
                successful_tests += 1
                total_response_time += result['response_time']
            
            await asyncio.sleep(1)
        
        # Calculate summary
        results['summary']['total_tests'] = total_tests
        results['summary']['successful_tests'] = successful_tests
        results['summary']['failed_tests'] = total_tests - successful_tests
        results['summary']['avg_response_time'] = (
            total_response_time / successful_tests if successful_tests > 0 else 0.0
        )
        
        return results
    
    def print_final_summary(self, results: Dict[str, Any]):
        """Print final test summary"""
        if 'error' in results:
            print(f"\n❌ Test failed: {results['error']}")
            return
        
        print("\n" + "=" * 80)
        print("📊 LLM SERVICE INTEGRATION TEST SUMMARY")
        print("=" * 80)
        
        summary = results['summary']
        print(f"🕐 Test completed: {results['timestamp']}")
        print(f"🏥 Service healthy: {'✅' if results['service_healthy'] else '❌'}")
        print(f"🧪 Total tests: {summary['total_tests']}")
        print(f"✅ Successful: {summary['successful_tests']}")
        print(f"❌ Failed: {summary['failed_tests']}")
        print(f"⏱️  Average response time: {summary['avg_response_time']:.2f}s")
        
        # Model performance
        print(f"\n📈 Model Performance:")
        for model, model_results in results['model_tests'].items():
            successful = sum(1 for r in model_results if r['success'])
            total = len(model_results)
            avg_time = sum(r['response_time'] for r in model_results if r['success']) / successful if successful > 0 else 0
            
            model_short = model.replace('models/', '')
            print(f"   🤖 {model_short}: {successful}/{total} success, {avg_time:.2f}s avg")
        
        # Router performance
        print(f"\n🎯 Router Performance:")
        for complexity, result in results['router_tests'].items():
            status = "✅" if result['success'] else "❌"
            model = result.get('selected_model', 'unknown').replace('models/', '') if result['success'] else 'N/A'
            time_str = f"{result['response_time']:.2f}s" if result['success'] else 'N/A'
            print(f"   {status} {complexity}: {model} ({time_str})")

async def main():
    """Main test function"""
    tester = LLMServiceIntegrationTester()
    
    try:
        # Run comprehensive test
        results = await tester.run_comprehensive_integration_test()
        
        # Print summary
        tester.print_final_summary(results)
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = f"llm_service_integration_test_{timestamp}.json"
        
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
