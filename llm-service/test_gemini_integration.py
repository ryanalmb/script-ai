#!/usr/bin/env python3
"""
Comprehensive Test Suite for Gemini Integration
Tests all components of the enterprise-grade Gemini LLM service
"""

import os
import sys
import asyncio
import json
import time
from datetime import datetime
from dotenv import load_dotenv

# Add the services directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'services'))

# Load environment variables
load_dotenv('.env.production')

# Import Gemini services
try:
    from services.gemini import (
        GeminiClient, GeminiOrchestrator, GeminiRateLimiter,
        GeminiModel, GeminiRequest, RequestPriority
    )
    from services.gemini.monitoring import GeminiMonitoringService
    print("✅ Successfully imported Gemini services")
except ImportError as e:
    print(f"❌ Failed to import Gemini services: {e}")
    sys.exit(1)

class GeminiIntegrationTester:
    """Comprehensive test suite for Gemini integration"""
    
    def __init__(self):
        self.client = None
        self.orchestrator = None
        self.rate_limiter = None
        self.monitoring = None
        self.test_results = []
        
    async def initialize_services(self):
        """Initialize all Gemini services"""
        print("\n🔧 Initializing Gemini services...")
        
        try:
            self.client = GeminiClient()
            print("✅ GeminiClient initialized")
        except Exception as e:
            print(f"❌ Failed to initialize GeminiClient: {e}")
            return False
        
        try:
            self.orchestrator = GeminiOrchestrator()
            print("✅ GeminiOrchestrator initialized")
        except Exception as e:
            print(f"❌ Failed to initialize GeminiOrchestrator: {e}")
            return False
        
        try:
            self.rate_limiter = GeminiRateLimiter()
            await self.rate_limiter.start_processing()
            print("✅ GeminiRateLimiter initialized and started")
        except Exception as e:
            print(f"❌ Failed to initialize GeminiRateLimiter: {e}")
            return False
        
        try:
            self.monitoring = GeminiMonitoringService()
            await self.monitoring.start()
            print("✅ GeminiMonitoringService initialized and started")
        except Exception as e:
            print(f"❌ Failed to initialize GeminiMonitoringService: {e}")
            return False
        
        return True
    
    async def test_basic_content_generation(self):
        """Test basic content generation with different models"""
        print("\n🧪 Testing basic content generation...")
        
        test_prompts = [
            "Write a professional tweet about cryptocurrency market trends",
            "Create an engaging Instagram post about AI technology",
            "Generate a LinkedIn post about digital marketing strategies"
        ]
        
        models_to_test = [GeminiModel.FLASH_2_0, GeminiModel.FLASH_1_5, GeminiModel.PRO_1_5]
        
        for i, prompt in enumerate(test_prompts):
            model = models_to_test[i % len(models_to_test)]
            
            try:
                request = GeminiRequest(
                    prompt=prompt,
                    model=model,
                    temperature=0.7,
                    max_tokens=500
                )
                
                start_time = time.time()
                response = await self.client.generate_content(request)
                end_time = time.time()
                
                if response and response.content:
                    self.test_results.append({
                        'test': 'basic_generation',
                        'model': model.value,
                        'prompt': prompt[:50] + "...",
                        'success': True,
                        'response_time': end_time - start_time,
                        'content_length': len(response.content),
                        'quality_score': response.quality_score
                    })
                    print(f"✅ {model.value}: Generated {len(response.content)} chars in {end_time - start_time:.2f}s")
                    print(f"   Content: {response.content[:100]}...")
                else:
                    self.test_results.append({
                        'test': 'basic_generation',
                        'model': model.value,
                        'success': False,
                        'error': 'No content generated'
                    })
                    print(f"❌ {model.value}: Failed to generate content")
                    
            except Exception as e:
                self.test_results.append({
                    'test': 'basic_generation',
                    'model': model.value,
                    'success': False,
                    'error': str(e)
                })
                print(f"❌ {model.value}: Error - {e}")
    
    async def test_function_calling(self):
        """Test function calling capabilities"""
        print("\n🧪 Testing function calling...")
        
        functions = [
            {
                "name": "create_social_post",
                "description": "Create a social media post with specific parameters",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "The post content"},
                        "platform": {"type": "string", "enum": ["twitter", "instagram", "linkedin"]},
                        "hashtags": {"type": "array", "items": {"type": "string"}},
                        "tone": {"type": "string", "enum": ["professional", "casual", "humorous"]}
                    },
                    "required": ["content", "platform"]
                }
            }
        ]
        
        prompt = "Create a professional Twitter post about the benefits of AI in marketing. Include relevant hashtags."
        
        try:
            response = await self.client.generate_with_functions(
                prompt=prompt,
                functions=functions,
                system_instruction="You are a social media marketing expert. Use the provided function to create structured social media posts."
            )
            
            if response and response.function_calls:
                self.test_results.append({
                    'test': 'function_calling',
                    'success': True,
                    'function_calls': len(response.function_calls),
                    'response_time': response.response_time
                })
                print(f"✅ Function calling successful: {len(response.function_calls)} calls made")
                print(f"   Function calls: {response.function_calls}")
            else:
                self.test_results.append({
                    'test': 'function_calling',
                    'success': False,
                    'error': 'No function calls made'
                })
                print("❌ Function calling failed: No function calls made")
                
        except Exception as e:
            self.test_results.append({
                'test': 'function_calling',
                'success': False,
                'error': str(e)
            })
            print(f"❌ Function calling error: {e}")
    
    async def test_campaign_orchestration(self):
        """Test full campaign orchestration"""
        print("\n🧪 Testing campaign orchestration...")
        
        test_prompts = [
            "Create a comprehensive marketing campaign to promote a new cryptocurrency trading course to young investors aged 18-35. Focus on educational content and building trust.",
            "Design a social media campaign for a sustainable fashion brand targeting environmentally conscious millennials. Emphasize authenticity and social impact."
        ]
        
        for prompt in test_prompts:
            try:
                start_time = time.time()
                result = await self.orchestrator.orchestrate_campaign(
                    user_prompt=prompt,
                    context={'test_mode': True}
                )
                end_time = time.time()
                
                if result and 'campaign_id' in result:
                    self.test_results.append({
                        'test': 'campaign_orchestration',
                        'prompt': prompt[:50] + "...",
                        'success': True,
                        'campaign_id': result['campaign_id'],
                        'processing_time': end_time - start_time,
                        'content_pieces': len(result.get('content_pieces', [])),
                        'quality_score': result.get('orchestration_metadata', {}).get('quality_score', 0)
                    })
                    print(f"✅ Campaign orchestrated successfully:")
                    print(f"   Campaign ID: {result['campaign_id']}")
                    print(f"   Processing time: {end_time - start_time:.2f}s")
                    print(f"   Content pieces: {len(result.get('content_pieces', []))}")
                    print(f"   Quality score: {result.get('orchestration_metadata', {}).get('quality_score', 0):.2f}")
                else:
                    self.test_results.append({
                        'test': 'campaign_orchestration',
                        'success': False,
                        'error': 'No campaign created'
                    })
                    print("❌ Campaign orchestration failed: No campaign created")
                    
            except Exception as e:
                self.test_results.append({
                    'test': 'campaign_orchestration',
                    'success': False,
                    'error': str(e)
                })
                print(f"❌ Campaign orchestration error: {e}")
    
    async def test_rate_limiting(self):
        """Test rate limiting functionality"""
        print("\n🧪 Testing rate limiting...")
        
        async def test_request():
            request = GeminiRequest(
                prompt="Generate a short marketing message",
                model=GeminiModel.FLASH_2_0,
                max_tokens=100
            )
            return await self.client.generate_content(request)
        
        # Test rapid requests to trigger rate limiting
        tasks = []
        for i in range(20):  # More than the 15 RPM limit
            tasks.append(test_request())
        
        try:
            start_time = time.time()
            results = await asyncio.gather(*tasks, return_exceptions=True)
            end_time = time.time()
            
            successful = sum(1 for r in results if not isinstance(r, Exception) and r is not None)
            failed = len(results) - successful
            
            self.test_results.append({
                'test': 'rate_limiting',
                'success': True,
                'total_requests': len(tasks),
                'successful_requests': successful,
                'failed_requests': failed,
                'total_time': end_time - start_time,
                'rate_limiting_triggered': failed > 0
            })
            
            print(f"✅ Rate limiting test completed:")
            print(f"   Total requests: {len(tasks)}")
            print(f"   Successful: {successful}")
            print(f"   Failed/Rate limited: {failed}")
            print(f"   Total time: {end_time - start_time:.2f}s")
            print(f"   Rate limiting triggered: {'Yes' if failed > 0 else 'No'}")
            
        except Exception as e:
            self.test_results.append({
                'test': 'rate_limiting',
                'success': False,
                'error': str(e)
            })
            print(f"❌ Rate limiting test error: {e}")
    
    async def test_monitoring_and_metrics(self):
        """Test monitoring and metrics collection"""
        print("\n🧪 Testing monitoring and metrics...")
        
        try:
            # Get service status
            status = self.client.get_usage_statistics()
            orchestrator_status = self.orchestrator.get_orchestration_status()
            monitoring_data = self.monitoring.get_dashboard_data()
            
            self.test_results.append({
                'test': 'monitoring_metrics',
                'success': True,
                'client_metrics': status['metrics'],
                'orchestrator_metrics': orchestrator_status['metrics'],
                'monitoring_status': monitoring_data['system_status']
            })
            
            print("✅ Monitoring and metrics test successful:")
            print(f"   Client total requests: {status['metrics']['total_requests']}")
            print(f"   Client success rate: {status['metrics']['successful_requests'] / max(status['metrics']['total_requests'], 1) * 100:.1f}%")
            print(f"   Orchestrator campaigns: {orchestrator_status['active_campaigns']}")
            print(f"   Monitoring status: {monitoring_data['system_status']}")
            
        except Exception as e:
            self.test_results.append({
                'test': 'monitoring_metrics',
                'success': False,
                'error': str(e)
            })
            print(f"❌ Monitoring and metrics test error: {e}")
    
    async def cleanup_services(self):
        """Clean up services after testing"""
        print("\n🧹 Cleaning up services...")
        
        try:
            if self.rate_limiter:
                await self.rate_limiter.stop_processing()
                print("✅ Rate limiter stopped")
        except Exception as e:
            print(f"⚠️ Error stopping rate limiter: {e}")
        
        try:
            if self.monitoring:
                await self.monitoring.stop()
                print("✅ Monitoring service stopped")
        except Exception as e:
            print(f"⚠️ Error stopping monitoring: {e}")
        
        try:
            if self.client:
                await self.client.close_session()
                print("✅ Client session closed")
        except Exception as e:
            print(f"⚠️ Error closing client session: {e}")
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "="*60)
        print("🎯 GEMINI INTEGRATION TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        successful_tests = sum(1 for result in self.test_results if result.get('success', False))
        failed_tests = total_tests - successful_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Successful: {successful_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {successful_tests / max(total_tests, 1) * 100:.1f}%")
        
        print("\n📊 Detailed Results:")
        for result in self.test_results:
            status = "✅" if result.get('success', False) else "❌"
            test_name = result.get('test', 'Unknown')
            print(f"{status} {test_name}")
            
            if not result.get('success', False) and 'error' in result:
                print(f"   Error: {result['error']}")
        
        print("\n" + "="*60)
        
        # Save results to file
        with open('gemini_test_results.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'summary': {
                    'total_tests': total_tests,
                    'successful_tests': successful_tests,
                    'failed_tests': failed_tests,
                    'success_rate': successful_tests / max(total_tests, 1) * 100
                },
                'detailed_results': self.test_results
            }, f, indent=2)
        
        print(f"📄 Detailed results saved to: gemini_test_results.json")

async def main():
    """Main test execution function"""
    print("🚀 Starting Gemini Integration Test Suite")
    print(f"⏰ Test started at: {datetime.now().isoformat()}")
    
    # Check environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ GEMINI_API_KEY not found in environment")
        return
    
    print(f"🔑 API Key configured: {api_key[:10]}...{api_key[-4:]}")
    
    tester = GeminiIntegrationTester()
    
    try:
        # Initialize services
        if not await tester.initialize_services():
            print("❌ Failed to initialize services. Exiting.")
            return
        
        # Run all tests
        await tester.test_basic_content_generation()
        await tester.test_function_calling()
        await tester.test_campaign_orchestration()
        await tester.test_rate_limiting()
        await tester.test_monitoring_and_metrics()
        
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error during testing: {e}")
    finally:
        # Cleanup
        await tester.cleanup_services()
        
        # Print summary
        tester.print_test_summary()

if __name__ == "__main__":
    asyncio.run(main())
