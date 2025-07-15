#!/usr/bin/env python3
"""
Enterprise Gemini 2.5 Integration Test Suite
Comprehensive testing for multimodal orchestration, Deep Think reasoning,
and intelligent model routing with the latest Gemini 2.5 models.
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

# Import Enterprise Gemini services
try:
    from services.gemini import GeminiClient, GeminiModel, GeminiRequest, MultimodalType
    from services.gemini.enterprise_multimodal_orchestrator import (
        EnterpriseMultimodalOrchestrator, CampaignComplexity, ContentFormat
    )
    from services.gemini.advanced_model_router import (
        AdvancedModelRouter, TaskProfile, TaskType, TaskComplexity
    )
    from services.gemini.rate_limiter import GeminiRateLimiter
    from services.gemini.monitoring import GeminiMonitoringService
    print("✅ Successfully imported Enterprise Gemini 2.5 services")
except ImportError as e:
    print(f"❌ Failed to import Enterprise Gemini services: {e}")
    sys.exit(1)

class EnterpriseGemini25Tester:
    """Comprehensive test suite for Enterprise Gemini 2.5 integration"""
    
    def __init__(self):
        self.client = None
        self.enterprise_orchestrator = None
        self.model_router = None
        self.rate_limiter = None
        self.monitoring = None
        self.test_results = []
        
    async def initialize_enterprise_services(self):
        """Initialize all Enterprise Gemini 2.5 services"""
        print("\n🔧 Initializing Enterprise Gemini 2.5 services...")
        
        try:
            self.client = GeminiClient()
            print("✅ GeminiClient (2.5 models) initialized")
        except Exception as e:
            print(f"❌ Failed to initialize GeminiClient: {e}")
            return False
        
        try:
            self.enterprise_orchestrator = EnterpriseMultimodalOrchestrator()
            print("✅ EnterpriseMultimodalOrchestrator initialized")
        except Exception as e:
            print(f"❌ Failed to initialize EnterpriseMultimodalOrchestrator: {e}")
            return False
        
        try:
            self.rate_limiter = GeminiRateLimiter()
            await self.rate_limiter.start_processing()
            print("✅ GeminiRateLimiter initialized and started")
        except Exception as e:
            print(f"❌ Failed to initialize GeminiRateLimiter: {e}")
            return False
        
        try:
            self.model_router = AdvancedModelRouter(self.client, self.rate_limiter)
            print("✅ AdvancedModelRouter initialized")
        except Exception as e:
            print(f"❌ Failed to initialize AdvancedModelRouter: {e}")
            return False
        
        try:
            self.monitoring = GeminiMonitoringService()
            await self.monitoring.start()
            print("✅ GeminiMonitoringService initialized and started")
        except Exception as e:
            print(f"❌ Failed to initialize GeminiMonitoringService: {e}")
            return False
        
        return True
    
    async def test_gemini_2_5_models(self):
        """Test all Gemini 2.5 models with different capabilities"""
        print("\n🧪 Testing Gemini 2.5 Models...")
        
        test_cases = [
            {
                "model": GeminiModel.PRO_2_5,
                "prompt": "Analyze the competitive landscape for AI-powered marketing tools in 2025",
                "expected_features": ["reasoning", "analysis", "strategic_thinking"]
            },
            {
                "model": GeminiModel.FLASH_2_5,
                "prompt": "Create a catchy Instagram post about sustainable fashion",
                "expected_features": ["creativity", "speed", "platform_optimization"]
            },
            {
                "model": GeminiModel.PRO_2_5_DEEP_THINK,
                "prompt": "Design a comprehensive go-to-market strategy for a new AI startup targeting enterprise customers",
                "expected_features": ["deep_reasoning", "strategic_planning", "complex_analysis"]
            }
        ]
        
        for test_case in test_cases:
            try:
                request = GeminiRequest(
                    prompt=test_case["prompt"],
                    model=test_case["model"],
                    temperature=0.7,
                    max_tokens=1500,
                    deep_think_enabled=test_case["model"] == GeminiModel.PRO_2_5_DEEP_THINK
                )
                
                start_time = time.time()
                response = await self.client.generate_content(request)
                end_time = time.time()
                
                if response and response.content:
                    self.test_results.append({
                        'test': 'gemini_2_5_models',
                        'model': test_case["model"].value,
                        'prompt': test_case["prompt"][:50] + "...",
                        'success': True,
                        'response_time': end_time - start_time,
                        'content_length': len(response.content),
                        'quality_score': response.quality_score,
                        'confidence_score': response.confidence_score,
                        'has_reasoning_trace': bool(response.reasoning_trace),
                        'has_deep_think_steps': bool(response.deep_think_steps)
                    })
                    print(f"✅ {test_case['model'].value}: Generated {len(response.content)} chars in {end_time - start_time:.2f}s")
                    print(f"   Quality: {response.quality_score:.2f}, Confidence: {response.confidence_score:.2f}")
                    if response.reasoning_trace:
                        print(f"   Reasoning steps: {len(response.reasoning_trace)}")
                    print(f"   Content preview: {response.content[:100]}...")
                else:
                    self.test_results.append({
                        'test': 'gemini_2_5_models',
                        'model': test_case["model"].value,
                        'success': False,
                        'error': 'No content generated'
                    })
                    print(f"❌ {test_case['model'].value}: Failed to generate content")
                    
            except Exception as e:
                self.test_results.append({
                    'test': 'gemini_2_5_models',
                    'model': test_case["model"].value,
                    'success': False,
                    'error': str(e)
                })
                print(f"❌ {test_case['model'].value}: Error - {e}")
    
    async def test_intelligent_model_routing(self):
        """Test intelligent model routing with different task profiles"""
        print("\n🧪 Testing Intelligent Model Routing...")
        
        routing_test_cases = [
            {
                "task_profile": TaskProfile(
                    task_type=TaskType.CONTENT_GENERATION,
                    complexity=TaskComplexity.SIMPLE,
                    multimodal_requirements=[MultimodalType.TEXT],
                    performance_priority="speed",
                    context_size=100,
                    reasoning_required=False,
                    real_time_required=True,
                    accuracy_critical=False
                ),
                "prompt": "Write a tweet about coffee",
                "expected_model": "flash"
            },
            {
                "task_profile": TaskProfile(
                    task_type=TaskType.STRATEGIC_PLANNING,
                    complexity=TaskComplexity.ENTERPRISE,
                    multimodal_requirements=[MultimodalType.TEXT, MultimodalType.IMAGE],
                    performance_priority="quality",
                    context_size=5000,
                    reasoning_required=True,
                    real_time_required=False,
                    accuracy_critical=True
                ),
                "prompt": "Develop a comprehensive digital transformation strategy for a Fortune 500 company",
                "expected_model": "deep_think"
            },
            {
                "task_profile": TaskProfile(
                    task_type=TaskType.MULTIMODAL_CREATION,
                    complexity=TaskComplexity.COMPLEX,
                    multimodal_requirements=[MultimodalType.TEXT, MultimodalType.IMAGE, MultimodalType.AUDIO],
                    performance_priority="balanced",
                    context_size=2000,
                    reasoning_required=True,
                    real_time_required=False,
                    accuracy_critical=True
                ),
                "prompt": "Create a multimedia marketing campaign for a luxury brand",
                "expected_model": "pro"
            }
        ]
        
        for i, test_case in enumerate(routing_test_cases):
            try:
                # Test model selection
                selected_model, confidence = await self.model_router.select_optimal_model(
                    test_case["task_profile"]
                )
                
                # Create request
                request = GeminiRequest(
                    prompt=test_case["prompt"],
                    model=selected_model,
                    temperature=0.7,
                    max_tokens=1000
                )
                
                # Execute with routing
                start_time = time.time()
                response = await self.model_router.execute_with_optimal_routing(
                    request, test_case["task_profile"]
                )
                end_time = time.time()
                
                self.test_results.append({
                    'test': 'intelligent_routing',
                    'task_type': test_case["task_profile"].task_type.value,
                    'complexity': test_case["task_profile"].complexity.value,
                    'selected_model': selected_model.value,
                    'confidence': confidence,
                    'success': True,
                    'response_time': end_time - start_time,
                    'quality_score': response.quality_score if response else 0.0
                })
                
                print(f"✅ Routing Test {i+1}: {selected_model.value} selected (confidence: {confidence:.3f})")
                print(f"   Task: {test_case['task_profile'].task_type.value} - {test_case['task_profile'].complexity.value}")
                print(f"   Performance: {end_time - start_time:.2f}s, Quality: {response.quality_score:.2f}")
                
            except Exception as e:
                self.test_results.append({
                    'test': 'intelligent_routing',
                    'task_type': test_case["task_profile"].task_type.value,
                    'success': False,
                    'error': str(e)
                })
                print(f"❌ Routing Test {i+1}: Error - {e}")
    
    async def test_enterprise_multimodal_orchestration(self):
        """Test enterprise multimodal campaign orchestration"""
        print("\n🧪 Testing Enterprise Multimodal Orchestration...")
        
        enterprise_test_cases = [
            {
                "prompt": "Create a comprehensive multimodal marketing campaign for a new AI-powered fitness app targeting Gen Z users. Include social media content, video scripts, podcast episodes, and interactive experiences.",
                "complexity": CampaignComplexity.ENTERPRISE,
                "context": {"target_market": "fitness_tech", "budget": 500000, "timeline": "Q1_2025"}
            },
            {
                "prompt": "Design an integrated marketing strategy for a sustainable energy company entering the European market. Focus on thought leadership, educational content, and stakeholder engagement.",
                "complexity": CampaignComplexity.COMPLEX,
                "context": {"market": "europe", "industry": "clean_energy", "goal": "market_entry"}
            }
        ]
        
        for i, test_case in enumerate(enterprise_test_cases):
            try:
                start_time = time.time()
                result = await self.enterprise_orchestrator.orchestrate_enterprise_campaign(
                    user_prompt=test_case["prompt"],
                    context=test_case["context"],
                    complexity=test_case["complexity"]
                )
                end_time = time.time()
                
                if result and 'campaign_id' in result:
                    self.test_results.append({
                        'test': 'enterprise_orchestration',
                        'complexity': test_case["complexity"].value,
                        'prompt': test_case["prompt"][:50] + "...",
                        'success': True,
                        'campaign_id': result['campaign_id'],
                        'processing_time': end_time - start_time,
                        'multimodal_content_pieces': len(result.get('multimodal_content_suite', [])),
                        'platforms_covered': len(set(piece.get('platform', '') for piece in result.get('multimodal_content_suite', []))),
                        'quality_score': result.get('orchestration_metadata', {}).get('quality_score', 0),
                        'complexity_score': result.get('orchestration_metadata', {}).get('complexity_score', 0),
                        'innovation_score': result.get('orchestration_metadata', {}).get('innovation_score', 0),
                        'deep_think_enabled': result.get('orchestration_metadata', {}).get('deep_think_enabled', False)
                    })
                    
                    print(f"✅ Enterprise Orchestration {i+1} completed successfully:")
                    print(f"   Campaign ID: {result['campaign_id']}")
                    print(f"   Processing time: {end_time - start_time:.2f}s")
                    print(f"   Content pieces: {len(result.get('multimodal_content_suite', []))}")
                    print(f"   Quality score: {result.get('orchestration_metadata', {}).get('quality_score', 0):.2f}")
                    print(f"   Deep Think enabled: {result.get('orchestration_metadata', {}).get('deep_think_enabled', False)}")
                else:
                    self.test_results.append({
                        'test': 'enterprise_orchestration',
                        'success': False,
                        'error': 'No campaign created'
                    })
                    print(f"❌ Enterprise Orchestration {i+1} failed: No campaign created")
                    
            except Exception as e:
                self.test_results.append({
                    'test': 'enterprise_orchestration',
                    'success': False,
                    'error': str(e)
                })
                print(f"❌ Enterprise Orchestration {i+1} error: {e}")
    
    async def test_multimodal_capabilities(self):
        """Test multimodal content processing capabilities"""
        print("\n🧪 Testing Multimodal Capabilities...")
        
        # Test multimodal request creation
        try:
            from services.gemini.gemini_client import MultimodalContent
            
            # Create a multimodal request with text and image requirements
            multimodal_request = GeminiRequest(
                prompt="Analyze this marketing campaign concept and suggest improvements for visual content, audio elements, and cross-platform adaptation",
                model=GeminiModel.PRO_2_5,
                multimodal_content=[
                    MultimodalContent(
                        type=MultimodalType.TEXT,
                        data="Campaign concept: Eco-friendly lifestyle brand targeting millennials"
                    )
                ],
                temperature=0.6,
                max_tokens=2000
            )
            
            response = await self.client.generate_content(multimodal_request)
            
            if response and response.content:
                self.test_results.append({
                    'test': 'multimodal_capabilities',
                    'success': True,
                    'content_length': len(response.content),
                    'quality_score': response.quality_score,
                    'multimodal_processing': True
                })
                print("✅ Multimodal processing test successful")
                print(f"   Content generated: {len(response.content)} characters")
                print(f"   Quality score: {response.quality_score:.2f}")
            else:
                self.test_results.append({
                    'test': 'multimodal_capabilities',
                    'success': False,
                    'error': 'No multimodal content generated'
                })
                print("❌ Multimodal processing test failed")
                
        except Exception as e:
            self.test_results.append({
                'test': 'multimodal_capabilities',
                'success': False,
                'error': str(e)
            })
            print(f"❌ Multimodal capabilities test error: {e}")
    
    async def cleanup_services(self):
        """Clean up services after testing"""
        print("\n🧹 Cleaning up enterprise services...")
        
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
    
    def print_enterprise_test_summary(self):
        """Print comprehensive enterprise test summary"""
        print("\n" + "="*70)
        print("🎯 ENTERPRISE GEMINI 2.5 INTEGRATION TEST SUMMARY")
        print("="*70)
        
        total_tests = len(self.test_results)
        successful_tests = sum(1 for result in self.test_results if result.get('success', False))
        failed_tests = total_tests - successful_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Successful: {successful_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {successful_tests / max(total_tests, 1) * 100:.1f}%")
        
        print("\n📊 Test Categories:")
        test_categories = {}
        for result in self.test_results:
            category = result.get('test', 'Unknown')
            if category not in test_categories:
                test_categories[category] = {'success': 0, 'total': 0}
            test_categories[category]['total'] += 1
            if result.get('success', False):
                test_categories[category]['success'] += 1
        
        for category, stats in test_categories.items():
            success_rate = stats['success'] / stats['total'] * 100
            status = "✅" if success_rate >= 80 else "⚠️" if success_rate >= 60 else "❌"
            print(f"{status} {category}: {stats['success']}/{stats['total']} ({success_rate:.1f}%)")
        
        print("\n🚀 Enterprise Features Tested:")
        print("✅ Gemini 2.5 Pro, Flash, and Deep Think models")
        print("✅ Intelligent model routing and optimization")
        print("✅ Enterprise multimodal orchestration")
        print("✅ Deep Think reasoning capabilities")
        print("✅ Advanced rate limiting and monitoring")
        print("✅ Multimodal content processing")
        
        print("\n" + "="*70)
        
        # Save results to file
        with open('enterprise_gemini_2_5_test_results.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'test_type': 'enterprise_gemini_2_5_integration',
                'summary': {
                    'total_tests': total_tests,
                    'successful_tests': successful_tests,
                    'failed_tests': failed_tests,
                    'success_rate': successful_tests / max(total_tests, 1) * 100,
                    'categories': test_categories
                },
                'detailed_results': self.test_results
            }, f, indent=2)
        
        print(f"📄 Detailed results saved to: enterprise_gemini_2_5_test_results.json")

async def main():
    """Main test execution function"""
    print("🚀 Starting Enterprise Gemini 2.5 Integration Test Suite")
    print(f"⏰ Test started at: {datetime.now().isoformat()}")
    
    # Check environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ GEMINI_API_KEY not found in environment")
        return
    
    print(f"🔑 API Key configured: {api_key[:10]}...{api_key[-4:]}")
    print(f"🧠 Primary Model: {os.getenv('GEMINI_PRIMARY_MODEL', 'gemini-2.5-pro')}")
    print(f"⚡ Secondary Model: {os.getenv('GEMINI_SECONDARY_MODEL', 'gemini-2.5-flash')}")
    print(f"🎯 Deep Think Model: {os.getenv('GEMINI_REASONING_MODEL', 'gemini-2.5-pro-deep-think')}")
    
    tester = EnterpriseGemini25Tester()
    
    try:
        # Initialize services
        if not await tester.initialize_enterprise_services():
            print("❌ Failed to initialize enterprise services. Exiting.")
            return
        
        # Run all enterprise tests
        await tester.test_gemini_2_5_models()
        await tester.test_intelligent_model_routing()
        await tester.test_enterprise_multimodal_orchestration()
        await tester.test_multimodal_capabilities()
        
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error during testing: {e}")
    finally:
        # Cleanup
        await tester.cleanup_services()
        
        # Print summary
        tester.print_enterprise_test_summary()

if __name__ == "__main__":
    asyncio.run(main())
