#!/usr/bin/env python3
"""
Comprehensive Gemini API Model Testing Script
Tests all available Gemini models with raw API calls
Based on July 2025 model research
"""

import os
import asyncio
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

@dataclass
class ModelTestResult:
    """Test result for a specific model"""
    model_name: str
    success: bool
    response_time: float
    content: Optional[str] = None
    error: Optional[str] = None
    token_usage: Optional[Dict[str, int]] = None
    model_info: Optional[Dict[str, Any]] = None

class GeminiModelList:
    """Complete list of Gemini models based on July 2025 research"""
    
    # Gemini 2.5 Models (Latest - July 2025)
    GEMINI_2_5_PRO = "models/gemini-2.5-pro"
    GEMINI_2_5_FLASH = "models/gemini-2.5-flash"
    GEMINI_2_5_FLASH_LITE = "models/gemini-2.5-flash-lite"
    
    # Gemini 2.5 Preview Models
    GEMINI_2_5_PRO_PREVIEW = "models/gemini-2.5-pro-preview-06-05"
    GEMINI_2_5_FLASH_PREVIEW = "models/gemini-2.5-flash-preview-05-20"
    
    # Gemini 2.5 TTS Models
    GEMINI_2_5_PRO_TTS = "models/gemini-2.5-pro-preview-tts"
    GEMINI_2_5_FLASH_TTS = "models/gemini-2.5-flash-preview-tts"
    
    # Gemini 1.5 Models (Legacy but still available)
    GEMINI_1_5_PRO = "models/gemini-1.5-pro"
    GEMINI_1_5_FLASH = "models/gemini-1.5-flash"
    GEMINI_1_5_PRO_001 = "models/gemini-1.5-pro-001"
    GEMINI_1_5_FLASH_001 = "models/gemini-1.5-flash-001"
    GEMINI_1_5_PRO_002 = "models/gemini-1.5-pro-002"
    GEMINI_1_5_FLASH_002 = "models/gemini-1.5-flash-002"
    
    # Gemini 2.0 Experimental Models
    GEMINI_2_0_FLASH_EXP = "models/gemini-2.0-flash-exp"
    
    # Embedding Models
    GEMINI_EMBEDDING_001 = "models/embedding-001"
    GEMINI_TEXT_EMBEDDING = "models/text-embedding-004"
    
    @classmethod
    def get_all_models(cls) -> List[str]:
        """Get all available models for testing"""
        return [
            # Priority 1: Latest Stable Models
            cls.GEMINI_2_5_PRO,
            cls.GEMINI_2_5_FLASH,
            cls.GEMINI_2_5_FLASH_LITE,
            
            # Priority 2: Preview Models
            cls.GEMINI_2_5_PRO_PREVIEW,
            cls.GEMINI_2_5_FLASH_PREVIEW,
            
            # Priority 3: Specialized Models
            cls.GEMINI_2_5_PRO_TTS,
            cls.GEMINI_2_5_FLASH_TTS,
            
            # Priority 4: Legacy Models
            cls.GEMINI_1_5_PRO,
            cls.GEMINI_1_5_FLASH,
            cls.GEMINI_1_5_PRO_001,
            cls.GEMINI_1_5_FLASH_001,
            cls.GEMINI_1_5_PRO_002,
            cls.GEMINI_1_5_FLASH_002,
            
            # Priority 5: Experimental
            cls.GEMINI_2_0_FLASH_EXP,
        ]
    
    @classmethod
    def get_embedding_models(cls) -> List[str]:
        """Get embedding models for separate testing"""
        return [
            cls.GEMINI_EMBEDDING_001,
            cls.GEMINI_TEXT_EMBEDDING,
        ]

class GeminiModelTester:
    """Comprehensive Gemini model testing class"""
    
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.session: Optional[aiohttp.ClientSession] = None
        self.test_results: List[ModelTestResult] = []
        
        # Test prompts for different capabilities
        self.test_prompts = {
            "simple": "Hello! Please respond with a brief greeting.",
            "reasoning": "Solve this step by step: If a train travels 120 km in 2 hours, what is its average speed?",
            "creative": "Write a short haiku about artificial intelligence.",
            "code": "Write a simple Python function to calculate the factorial of a number.",
            "multimodal": "Describe what you would expect to see in a typical office environment."
        }
    
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
                    'User-Agent': 'Gemini-Model-Tester/1.0'
                }
            )
    
    async def close_session(self):
        """Close aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def test_model_availability(self, model_name: str) -> ModelTestResult:
        """Test if a specific model is available and working"""
        start_time = time.time()
        
        try:
            await self.initialize_session()
            
            # Use simple prompt for availability test
            payload = {
                "contents": [
                    {
                        "parts": [{"text": self.test_prompts["simple"]}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "topP": 0.9,
                    "topK": 40,
                    "maxOutputTokens": 100
                }
            }
            
            url = f"{self.base_url}/{model_name}:generateContent?key={self.api_key}"
            
            async with self.session.post(url, json=payload) as response:
                response_time = time.time() - start_time
                response_data = await response.json()
                
                if response.status == 200:
                    content = self._extract_content(response_data)
                    usage = self._extract_usage(response_data)
                    
                    return ModelTestResult(
                        model_name=model_name,
                        success=True,
                        response_time=response_time,
                        content=content,
                        token_usage=usage
                    )
                else:
                    error_msg = self._extract_error(response_data)
                    return ModelTestResult(
                        model_name=model_name,
                        success=False,
                        response_time=response_time,
                        error=f"HTTP {response.status}: {error_msg}"
                    )
                    
        except Exception as e:
            response_time = time.time() - start_time
            return ModelTestResult(
                model_name=model_name,
                success=False,
                response_time=response_time,
                error=str(e)
            )
    
    async def test_model_capabilities(self, model_name: str) -> Dict[str, ModelTestResult]:
        """Test different capabilities of a model"""
        results = {}
        
        for capability, prompt in self.test_prompts.items():
            if capability == "simple":  # Already tested in availability
                continue
                
            result = await self._test_single_capability(model_name, capability, prompt)
            results[capability] = result
            
            # Add delay between requests to respect rate limits
            await asyncio.sleep(1)
        
        return results
    
    async def _test_single_capability(self, model_name: str, capability: str, prompt: str) -> ModelTestResult:
        """Test a single capability of a model"""
        start_time = time.time()
        
        try:
            await self.initialize_session()
            
            payload = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7 if capability == "creative" else 0.3,
                    "topP": 0.9,
                    "topK": 40,
                    "maxOutputTokens": 500 if capability == "code" else 200
                }
            }
            
            url = f"{self.base_url}/{model_name}:generateContent?key={self.api_key}"
            
            async with self.session.post(url, json=payload) as response:
                response_time = time.time() - start_time
                response_data = await response.json()
                
                if response.status == 200:
                    content = self._extract_content(response_data)
                    usage = self._extract_usage(response_data)
                    
                    return ModelTestResult(
                        model_name=f"{model_name}_{capability}",
                        success=True,
                        response_time=response_time,
                        content=content,
                        token_usage=usage
                    )
                else:
                    error_msg = self._extract_error(response_data)
                    return ModelTestResult(
                        model_name=f"{model_name}_{capability}",
                        success=False,
                        response_time=response_time,
                        error=f"HTTP {response.status}: {error_msg}"
                    )
                    
        except Exception as e:
            response_time = time.time() - start_time
            return ModelTestResult(
                model_name=f"{model_name}_{capability}",
                success=False,
                response_time=response_time,
                error=str(e)
            )
    
    def _extract_content(self, response_data: Dict[str, Any]) -> Optional[str]:
        """Extract content from Gemini API response"""
        try:
            candidates = response_data.get('candidates', [])
            if candidates:
                content = candidates[0].get('content', {})
                parts = content.get('parts', [])
                if parts:
                    return parts[0].get('text', '')
        except Exception:
            pass
        return None
    
    def _extract_usage(self, response_data: Dict[str, Any]) -> Optional[Dict[str, int]]:
        """Extract token usage from Gemini API response"""
        try:
            usage_metadata = response_data.get('usageMetadata', {})
            if usage_metadata:
                return {
                    'prompt_tokens': usage_metadata.get('promptTokenCount', 0),
                    'completion_tokens': usage_metadata.get('candidatesTokenCount', 0),
                    'total_tokens': usage_metadata.get('totalTokenCount', 0)
                }
        except Exception:
            pass
        return None
    
    def _extract_error(self, response_data: Dict[str, Any]) -> str:
        """Extract error message from Gemini API response"""
        try:
            error = response_data.get('error', {})
            return error.get('message', 'Unknown error')
        except Exception:
            return 'Failed to parse error'

    async def list_available_models(self) -> List[Dict[str, Any]]:
        """List all available models from Gemini API"""
        try:
            await self.initialize_session()

            url = f"{self.base_url}/models?key={self.api_key}"

            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('models', [])
                else:
                    print(f"Failed to list models: HTTP {response.status}")
                    return []

        except Exception as e:
            print(f"Error listing models: {e}")
            return []

    async def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive test of all Gemini models"""
        print("🚀 Starting Comprehensive Gemini Model Testing")
        print("=" * 60)

        # First, list available models from API
        print("\n📋 Fetching available models from Gemini API...")
        api_models = await self.list_available_models()

        if api_models:
            print(f"✅ Found {len(api_models)} models available via API:")
            for model in api_models[:10]:  # Show first 10
                model_name = model.get('name', 'Unknown').split('/')[-1]
                print(f"   • {model_name}")
            if len(api_models) > 10:
                print(f"   ... and {len(api_models) - 10} more models")
        else:
            print("⚠️  Could not fetch models from API, using predefined list")

        # Test predefined models
        print(f"\n🧪 Testing predefined models...")
        models_to_test = GeminiModelList.get_all_models()

        test_results = {
            'timestamp': datetime.now().isoformat(),
            'total_models_tested': len(models_to_test),
            'api_models_found': len(api_models),
            'model_results': {},
            'summary': {
                'successful': 0,
                'failed': 0,
                'avg_response_time': 0.0
            }
        }

        successful_models = []
        failed_models = []
        total_response_time = 0.0

        for i, model_name in enumerate(models_to_test, 1):
            print(f"\n[{i}/{len(models_to_test)}] Testing {model_name}...")

            # Test basic availability
            availability_result = await self.test_model_availability(model_name)

            model_result = {
                'availability': {
                    'success': availability_result.success,
                    'response_time': availability_result.response_time,
                    'content': availability_result.content,
                    'error': availability_result.error,
                    'token_usage': availability_result.token_usage
                },
                'capabilities': {}
            }

            if availability_result.success:
                print(f"   ✅ Available - Response time: {availability_result.response_time:.2f}s")
                successful_models.append(model_name)
                total_response_time += availability_result.response_time

                # Test different capabilities
                print("   🔍 Testing capabilities...")
                capability_results = await self.test_model_capabilities(model_name)

                for capability, result in capability_results.items():
                    model_result['capabilities'][capability] = {
                        'success': result.success,
                        'response_time': result.response_time,
                        'content': result.content[:100] + "..." if result.content and len(result.content) > 100 else result.content,
                        'error': result.error,
                        'token_usage': result.token_usage
                    }

                    status = "✅" if result.success else "❌"
                    print(f"      {status} {capability}: {result.response_time:.2f}s")

            else:
                print(f"   ❌ Failed - {availability_result.error}")
                failed_models.append(model_name)

            test_results['model_results'][model_name] = model_result

            # Add delay between model tests
            await asyncio.sleep(2)

        # Calculate summary
        test_results['summary']['successful'] = len(successful_models)
        test_results['summary']['failed'] = len(failed_models)
        test_results['summary']['avg_response_time'] = (
            total_response_time / len(successful_models) if successful_models else 0.0
        )
        test_results['successful_models'] = successful_models
        test_results['failed_models'] = failed_models

        return test_results

    def print_summary(self, results: Dict[str, Any]):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 GEMINI MODEL TESTING SUMMARY")
        print("=" * 60)

        print(f"🕐 Test completed at: {results['timestamp']}")
        print(f"📋 Total models tested: {results['total_models_tested']}")
        print(f"🌐 API models found: {results['api_models_found']}")
        print(f"✅ Successful models: {results['summary']['successful']}")
        print(f"❌ Failed models: {results['summary']['failed']}")
        print(f"⏱️  Average response time: {results['summary']['avg_response_time']:.2f}s")

        if results['successful_models']:
            print(f"\n🎉 Working Models ({len(results['successful_models'])}):")
            for model in results['successful_models']:
                model_short = model.replace('models/', '')
                print(f"   ✅ {model_short}")

        if results['failed_models']:
            print(f"\n⚠️  Failed Models ({len(results['failed_models'])}):")
            for model in results['failed_models']:
                model_short = model.replace('models/', '')
                error = results['model_results'][model]['availability']['error']
                print(f"   ❌ {model_short}: {error}")

        print("\n" + "=" * 60)

async def main():
    """Main test function"""
    tester = GeminiModelTester()

    try:
        # Run comprehensive test
        results = await tester.run_comprehensive_test()

        # Print summary
        tester.print_summary(results)

        # Save detailed results to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = f"gemini_test_results_{timestamp}.json"

        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        print(f"\n💾 Detailed results saved to: {results_file}")

        # Test embedding models separately
        print(f"\n🔤 Testing embedding models...")
        embedding_models = GeminiModelList.get_embedding_models()

        for model in embedding_models:
            print(f"Testing embedding model: {model}")
            # Note: Embedding models use different endpoint
            # This would require separate implementation

    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")
    finally:
        await tester.close_session()

if __name__ == "__main__":
    asyncio.run(main())
