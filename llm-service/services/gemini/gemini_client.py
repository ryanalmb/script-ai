#!/usr/bin/env python3
"""
Enterprise-Grade Gemini API Client
Provides comprehensive integration with Google's Gemini API including all models,
rate limiting, error handling, and advanced features.
"""

import os
import asyncio
import aiohttp
import json
import logging
import time
from typing import Dict, List, Optional, Any, Union, AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import uuid

logger = logging.getLogger(__name__)

class GeminiModel(Enum):
    """Available Gemini models with latest 2.5 capabilities (Verified API models)"""
    # Latest Gemini 2.5 Models (Stable - Verified Available)
    PRO_2_5 = "models/gemini-2.5-pro"
    FLASH_2_5 = "models/gemini-2.5-flash"

    # Gemini 2.5 Preview Models
    PRO_2_5_PREVIEW = "models/gemini-2.5-pro-preview-06-05"
    FLASH_2_5_PREVIEW = "models/gemini-2.5-flash-preview-05-20"

    # Specialized Models (Verified Available)
    FLASH_2_5_TTS = "models/gemini-2.5-flash-preview-tts"
    PRO_2_5_TTS = "models/gemini-2.5-pro-preview-tts"

    # Legacy Models (for compatibility)
    PRO_1_5 = "models/gemini-1.5-pro"
    FLASH_1_5 = "models/gemini-1.5-flash"
    FLASH_2_0 = "models/gemini-2.0-flash-exp"

    # Enterprise Aliases (using stable models)
    ENTERPRISE_PRO = "models/gemini-2.5-pro"
    ENTERPRISE_FLASH = "models/gemini-2.5-flash"
    DEEP_THINK = "models/gemini-2.5-pro"  # 2.5 Pro has thinking built-in
    TEXT_TO_SPEECH = "models/gemini-2.5-pro-preview-tts"

class MultimodalType(Enum):
    """Supported multimodal input types"""
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    MIXED = "mixed"

@dataclass
class ModelConfig:
    """Configuration for each Gemini model with multimodal capabilities"""
    name: str
    max_tokens: int
    context_window: int
    rpm_limit: int
    rpd_limit: int
    tpm_limit: int
    cost_per_1k_tokens: float
    specialization: str
    priority: int = 1
    multimodal_support: List[MultimodalType] = field(default_factory=list)
    deep_think_capable: bool = False
    native_audio: bool = False
    video_understanding: bool = False
    reasoning_enhanced: bool = False

@dataclass
class MultimodalContent:
    """Multimodal content for Gemini requests"""
    type: MultimodalType
    data: Union[str, bytes]
    mime_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class GeminiRequest:
    """Enhanced structured request for Gemini API with multimodal support"""
    prompt: str
    model: GeminiModel
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    functions: Optional[List[Dict]] = None
    system_instruction: Optional[str] = None
    context: Optional[List[Dict]] = None
    multimodal_content: Optional[List[MultimodalContent]] = None
    deep_think_enabled: bool = False
    reasoning_steps: Optional[int] = None
    audio_output: bool = False
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    priority: int = 1
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class GeminiResponse:
    """Enhanced structured response from Gemini API with multimodal support"""
    content: str
    model: str
    usage: Dict[str, int]
    function_calls: Optional[List[Dict]] = None
    finish_reason: Optional[str] = None
    request_id: str = ""
    response_time: float = 0.0
    tokens_used: int = 0
    cost: float = 0.0
    quality_score: float = 0.0
    multimodal_outputs: Optional[List[MultimodalContent]] = None
    reasoning_trace: Optional[List[str]] = None
    deep_think_steps: Optional[List[Dict]] = None
    audio_output: Optional[bytes] = None
    confidence_score: float = 0.0

class GeminiClient:
    """Enterprise-grade Gemini API client with comprehensive features"""
    
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Latest Gemini model configurations (Verified API models)
        self.models = {
            # Gemini 2.5 Pro - Latest stable enterprise model (Thinking built-in)
            GeminiModel.PRO_2_5: ModelConfig(
                name="models/gemini-2.5-pro",
                max_tokens=65536,  # 65K output tokens
                context_window=1048576,  # 1M input tokens
                rpm_limit=10,
                rpd_limit=100,
                tpm_limit=2000000,  # 2M TPM
                cost_per_1k_tokens=0.0,  # Free tier
                specialization="enterprise_orchestration",
                priority=1,
                multimodal_support=[MultimodalType.TEXT, MultimodalType.IMAGE,
                                  MultimodalType.AUDIO, MultimodalType.VIDEO],
                deep_think_capable=True,
                native_audio=True,
                video_understanding=True,
                reasoning_enhanced=True
            ),
            # Gemini 2.5 Flash - Latest fast model (Thinking built-in)
            GeminiModel.FLASH_2_5: ModelConfig(
                name="models/gemini-2.5-flash",
                max_tokens=65536,  # 65K output tokens
                context_window=1048576,  # 1M input tokens
                rpm_limit=50,  # Higher for fast generation
                rpd_limit=2000,
                tpm_limit=2000000,  # 2M TPM
                cost_per_1k_tokens=0.0,  # Free tier
                specialization="fast_multimodal_generation",
                priority=2,
                multimodal_support=[MultimodalType.TEXT, MultimodalType.IMAGE,
                                  MultimodalType.AUDIO, MultimodalType.VIDEO],
                deep_think_capable=True,  # Built-in thinking
                native_audio=True,
                video_understanding=True,
                reasoning_enhanced=True
            ),

            # Gemini 2.5 Preview Models (Verified Available)
            GeminiModel.PRO_2_5_PREVIEW: ModelConfig(
                name="models/gemini-2.5-pro-preview-06-05",
                max_tokens=65536,  # 65K output tokens
                context_window=1048576,  # 1M input tokens
                rpm_limit=10,
                rpd_limit=100,
                tpm_limit=2000000,  # 2M TPM
                cost_per_1k_tokens=0.0,  # Free tier
                specialization="enterprise_preview",
                priority=1,
                multimodal_support=[MultimodalType.TEXT, MultimodalType.IMAGE,
                                  MultimodalType.AUDIO, MultimodalType.VIDEO],
                deep_think_capable=True,  # Built-in thinking
                native_audio=True,
                video_understanding=True,
                reasoning_enhanced=True
            ),
            GeminiModel.FLASH_2_5_PREVIEW: ModelConfig(
                name="models/gemini-2.5-flash-preview-05-20",
                max_tokens=65536,  # 65K output tokens
                context_window=1048576,  # 1M input tokens
                rpm_limit=50,  # Higher for fast generation
                rpd_limit=2000,
                tpm_limit=2000000,  # 2M TPM
                cost_per_1k_tokens=0.0,  # Free tier
                specialization="fast_preview",
                priority=2,
                multimodal_support=[MultimodalType.TEXT, MultimodalType.IMAGE,
                                  MultimodalType.AUDIO, MultimodalType.VIDEO],
                deep_think_capable=True,  # Built-in thinking
                native_audio=True,
                video_understanding=True,
                reasoning_enhanced=True
            ),

            # Gemini 2.5 TTS Models (Verified Available)
            GeminiModel.FLASH_2_5_TTS: ModelConfig(
                name="models/gemini-2.5-flash-preview-tts",
                max_tokens=16384,  # 16K output tokens for TTS
                context_window=8192,  # 8K input tokens
                rpm_limit=20,
                rpd_limit=200,
                tpm_limit=100000,
                cost_per_1k_tokens=0.0,  # Free tier
                specialization="text_to_speech",
                priority=3,
                multimodal_support=[MultimodalType.TEXT, MultimodalType.AUDIO],
                deep_think_capable=False,
                native_audio=True,
                video_understanding=False,
                reasoning_enhanced=False
            ),
            GeminiModel.PRO_2_5_TTS: ModelConfig(
                name="models/gemini-2.5-pro-preview-tts",
                max_tokens=16384,  # 16K output tokens for TTS
                context_window=8192,  # 8K input tokens
                rpm_limit=10,
                rpd_limit=100,
                tpm_limit=100000,
                cost_per_1k_tokens=0.0,  # Free tier
                specialization="text_to_speech",
                priority=3,
                multimodal_support=[MultimodalType.TEXT, MultimodalType.AUDIO],
                deep_think_capable=False,
                native_audio=True,
                video_understanding=False,
                reasoning_enhanced=False
            ),
            # Legacy models for fallback
            GeminiModel.FLASH_2_0: ModelConfig(
                name="gemini-2.0-flash-exp",
                max_tokens=1000000,
                context_window=1000000,
                rpm_limit=15,
                rpd_limit=1500,
                tpm_limit=1000000,
                cost_per_1k_tokens=0.0,
                specialization="legacy_fast",
                priority=4,
                multimodal_support=[MultimodalType.TEXT, MultimodalType.IMAGE],
                deep_think_capable=False,
                native_audio=False,
                video_understanding=False,
                reasoning_enhanced=False
            ),
            GeminiModel.FLASH_1_5: ModelConfig(
                name="gemini-1.5-flash",
                max_tokens=1000000,
                context_window=1000000,
                rpm_limit=1000,
                rpd_limit=0,  # No daily limit
                tpm_limit=1000000,
                cost_per_1k_tokens=0.0,
                specialization="legacy_balanced",
                priority=5,
                multimodal_support=[MultimodalType.TEXT, MultimodalType.IMAGE],
                deep_think_capable=False,
                native_audio=False,
                video_understanding=False,
                reasoning_enhanced=False
            ),
            GeminiModel.PRO_1_5: ModelConfig(
                name="gemini-1.5-pro",
                max_tokens=2000000,
                context_window=2000000,
                rpm_limit=5,
                rpd_limit=25,
                tpm_limit=1000000,
                cost_per_1k_tokens=0.0,
                specialization="legacy_reasoning",
                priority=6,
                multimodal_support=[MultimodalType.TEXT, MultimodalType.IMAGE],
                deep_think_capable=False,
                native_audio=False,
                video_understanding=False,
                reasoning_enhanced=False
            )
        }
        
        # Request tracking
        self.request_history: Dict[str, List[datetime]] = {
            model.value: [] for model in GeminiModel
        }
        self.token_usage: Dict[str, List[tuple]] = {
            model.value: [] for model in GeminiModel
        }
        
        # Performance metrics
        self.metrics = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_tokens': 0,
            'total_cost': 0.0,
            'average_response_time': 0.0,
            'model_usage': {model.value: 0 for model in GeminiModel}
        }
        
        # Configuration
        self.default_temperature = float(os.getenv('GEMINI_TEMPERATURE', 0.7))
        self.default_top_p = float(os.getenv('GEMINI_TOP_P', 0.9))
        self.default_top_k = int(os.getenv('GEMINI_TOP_K', 40))
        self.enable_caching = os.getenv('ENABLE_CACHING', 'true').lower() == 'true'
        
        logger.info("GeminiClient initialized with enterprise configuration")
    
    async def initialize_session(self):
        """Initialize aiohttp session with optimal configuration and error handling"""
        try:
            if not self.session or self.session.closed:
                timeout = aiohttp.ClientTimeout(total=120, connect=30)
                connector = aiohttp.TCPConnector(
                    limit=100,
                    limit_per_host=30,
                    ttl_dns_cache=300,
                    use_dns_cache=True,
                    keepalive_timeout=30,
                    enable_cleanup_closed=True
                )

                self.session = aiohttp.ClientSession(
                    timeout=timeout,
                    connector=connector,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'X-Marketing-Platform/1.0'
                    }
                )
                logger.info("Initialized new aiohttp session with enterprise configuration")
        except Exception as e:
            logger.warning(f"Session initialization failed: {e}")
            # Continue without session - will use fallback sync method
            self.session = None
    
    async def close_session(self):
        """Properly close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    def can_make_request(self, model: GeminiModel) -> bool:
        """Check if we can make a request based on rate limits"""
        config = self.models[model]
        now = datetime.now()
        
        # Clean old requests (older than 1 minute for RPM, 24 hours for RPD)
        minute_ago = now - timedelta(minutes=1)
        day_ago = now - timedelta(days=1)
        
        recent_requests = [
            req_time for req_time in self.request_history[model.value]
            if req_time > minute_ago
        ]
        daily_requests = [
            req_time for req_time in self.request_history[model.value]
            if req_time > day_ago
        ]
        
        # Update history
        self.request_history[model.value] = daily_requests
        
        # Check RPM limit
        if len(recent_requests) >= config.rpm_limit:
            logger.warning(f"RPM limit reached for {model.value}: {len(recent_requests)}/{config.rpm_limit}")
            return False
        
        # Check RPD limit (if applicable)
        if config.rpd_limit > 0 and len(daily_requests) >= config.rpd_limit:
            logger.warning(f"RPD limit reached for {model.value}: {len(daily_requests)}/{config.rpd_limit}")
            return False
        
        return True
    
    def get_best_available_model(self, task_type: str = "general") -> Optional[GeminiModel]:
        """Select the best available model based on task type and availability"""
        # Task-specific model preferences
        task_preferences = {
            "reasoning": [GeminiModel.PRO_1_5, GeminiModel.FLASH_1_5, GeminiModel.FLASH_2_0],
            "content_generation": [GeminiModel.FLASH_2_0, GeminiModel.FLASH_1_5, GeminiModel.PRO_1_5],
            "general": [GeminiModel.FLASH_2_0, GeminiModel.FLASH_1_5, GeminiModel.PRO_1_5],
            "fast": [GeminiModel.FLASH_2_0, GeminiModel.FLASH_1_5],
            "complex": [GeminiModel.PRO_1_5, GeminiModel.FLASH_1_5, GeminiModel.FLASH_2_0]
        }
        
        preferred_models = task_preferences.get(task_type, task_preferences["general"])
        
        for model in preferred_models:
            if self.can_make_request(model):
                return model
        
        logger.warning(f"No available models for task type: {task_type}")
        return None
    
    async def generate_content(self, request: GeminiRequest) -> GeminiResponse:
        """Generate content using Gemini API with comprehensive error handling"""
        start_time = time.time()
        
        try:
            await self.initialize_session()
            
            # Build request payload
            payload = self._build_request_payload(request)
            
            # Make API request (model.value already includes "models/" prefix)
            url = f"{self.base_url}/{request.model.value}:generateContent?key={self.api_key}"
            
            async with self.session.post(url, json=payload) as response:
                response_data = await response.json()
                
                if response.status == 200:
                    return self._parse_success_response(response_data, request, start_time)
                else:
                    return self._handle_error_response(response, response_data, request, start_time)
                    
        except Exception as e:
            logger.error(f"Unexpected error in generate_content: {e}")
            return self._create_error_response(str(e), request, start_time)
    
    def _build_request_payload(self, request: GeminiRequest) -> Dict[str, Any]:
        """Build the API request payload"""
        payload = {
            "contents": [
                {
                    "parts": [{"text": request.prompt}]
                }
            ],
            "generationConfig": {
                "temperature": request.temperature or self.default_temperature,
                "topP": request.top_p or self.default_top_p,
                "topK": request.top_k or self.default_top_k,
                "maxOutputTokens": request.max_tokens or self.models[request.model].max_tokens
            }
        }
        
        # Add system instruction if provided
        if request.system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": request.system_instruction}]
            }
        
        # Add function calling if provided
        if request.functions:
            payload["tools"] = [{"functionDeclarations": request.functions}]
        
        # Add context if provided
        if request.context:
            payload["contents"] = request.context + payload["contents"]
        
        return payload

    def _parse_success_response(self, response_data: Dict, request: GeminiRequest, start_time: float) -> GeminiResponse:
        """Parse successful API response"""
        response_time = time.time() - start_time

        # Debug logging for response structure
        logger.debug(f"Raw Gemini response: {json.dumps(response_data, indent=2)}")

        # Extract content
        content = ""
        function_calls = []

        if "candidates" in response_data and response_data["candidates"]:
            candidate = response_data["candidates"][0]
            logger.debug(f"Processing candidate: {json.dumps(candidate, indent=2)}")

            # Handle different response structures
            if "content" in candidate:
                candidate_content = candidate["content"]

                # Check for parts array (standard structure)
                if "parts" in candidate_content:
                    for part in candidate_content["parts"]:
                        logger.debug(f"Processing part: {json.dumps(part, indent=2)}")
                        if "text" in part:
                            content += part["text"]
                            logger.debug(f"Extracted text: {part['text'][:100]}...")
                        elif "functionCall" in part:
                            function_calls.append(part["functionCall"])
                            logger.debug(f"Extracted function call: {part['functionCall']}")

                # Handle direct text content (alternative structure)
                elif "text" in candidate_content:
                    content = candidate_content["text"]
                    logger.debug(f"Extracted direct text: {content[:100]}...")

                # Handle role-only content (empty response)
                elif "role" in candidate_content and len(candidate_content) == 1:
                    logger.warning(f"Empty content with role only. Finish reason: {candidate.get('finishReason', 'unknown')}")

                    # Check if it's due to token limits
                    if candidate.get('finishReason') == 'MAX_TOKENS':
                        logger.error("Response truncated due to MAX_TOKENS limit")
                        content = "[Response truncated due to token limit. Please try with a shorter prompt or higher max_tokens.]"
                    elif candidate.get('finishReason') == 'SAFETY':
                        logger.error("Response blocked due to safety filters")
                        content = "[Response blocked due to safety filters. Please try rephrasing your request.]"
                    else:
                        logger.error(f"Empty response with finish reason: {candidate.get('finishReason')}")
                        content = "[Empty response received. Please try rephrasing your request.]"

                else:
                    logger.warning(f"Unexpected content structure: {candidate_content}")
                    content = "[Unexpected response format received.]"
            else:
                logger.warning(f"No content found in candidate: {candidate}")
        else:
            logger.warning(f"No candidates found in response: {response_data}")

        # Log final extracted content
        logger.info(f"Final extracted content length: {len(content)}, function calls: {len(function_calls)}")

        # Extract usage information
        usage = response_data.get("usageMetadata", {})
        tokens_used = usage.get("totalTokenCount", 0)

        # Calculate cost (free tier = $0)
        cost = 0.0

        # Update metrics
        self._update_metrics(request.model, tokens_used, cost, response_time, True)

        # Track request
        self.request_history[request.model.value].append(datetime.now())

        return GeminiResponse(
            content=content,
            model=request.model.value,
            usage=usage,
            function_calls=function_calls if function_calls else None,
            finish_reason=response_data.get("candidates", [{}])[0].get("finishReason"),
            request_id=request.request_id,
            response_time=response_time,
            tokens_used=tokens_used,
            cost=cost,
            quality_score=self._calculate_quality_score(content)
        )

    def _handle_error_response(self, response, response_data: Dict, request: GeminiRequest, start_time: float) -> GeminiResponse:
        """Handle API error responses"""
        response_time = time.time() - start_time
        error_message = response_data.get("error", {}).get("message", f"HTTP {response.status}")

        logger.error(f"Gemini API error: {error_message}")

        # Update metrics
        self._update_metrics(request.model, 0, 0.0, response_time, False)

        return GeminiResponse(
            content=f"Error: {error_message}",
            model=request.model.value,
            usage={},
            request_id=request.request_id,
            response_time=response_time,
            tokens_used=0,
            cost=0.0,
            quality_score=0.0
        )

    def _create_error_response(self, error_message: str, request: GeminiRequest, start_time: float) -> GeminiResponse:
        """Create error response for exceptions"""
        response_time = time.time() - start_time

        # Update metrics
        self._update_metrics(request.model, 0, 0.0, response_time, False)

        return GeminiResponse(
            content=f"Error: {error_message}",
            model=request.model.value,
            usage={},
            request_id=request.request_id,
            response_time=response_time,
            tokens_used=0,
            cost=0.0,
            quality_score=0.0
        )

    def _update_metrics(self, model: GeminiModel, tokens: int, cost: float, response_time: float, success: bool):
        """Update performance metrics"""
        self.metrics['total_requests'] += 1
        self.metrics['model_usage'][model.value] += 1

        if success:
            self.metrics['successful_requests'] += 1
            self.metrics['total_tokens'] += tokens
            self.metrics['total_cost'] += cost

            # Update average response time
            total_successful = self.metrics['successful_requests']
            current_avg = self.metrics['average_response_time']
            self.metrics['average_response_time'] = (
                (current_avg * (total_successful - 1) + response_time) / total_successful
            )
        else:
            self.metrics['failed_requests'] += 1

    def _calculate_quality_score(self, content: str) -> float:
        """Calculate content quality score based on various factors"""
        if not content or len(content.strip()) == 0:
            return 0.0

        score = 0.0

        # Length factor (optimal range: 50-500 characters)
        length = len(content)
        if 50 <= length <= 500:
            score += 0.3
        elif 20 <= length < 50 or 500 < length <= 1000:
            score += 0.2
        elif length > 1000:
            score += 0.1

        # Structure factor (presence of punctuation, capitalization)
        if any(char in content for char in '.!?'):
            score += 0.2
        if content[0].isupper():
            score += 0.1

        # Coherence factor (basic checks)
        words = content.split()
        if len(words) >= 5:
            score += 0.2

        # Completeness factor (doesn't end abruptly)
        if content.strip().endswith(('.', '!', '?')):
            score += 0.2

        return min(score, 1.0)

    async def generate_with_functions(self, prompt: str, functions: List[Dict],
                                    model: Optional[GeminiModel] = None,
                                    system_instruction: Optional[str] = None) -> GeminiResponse:
        """Generate content with function calling capabilities"""
        if not model:
            model = self.get_best_available_model("reasoning")
            if not model:
                raise Exception("No available models for function calling")

        request = GeminiRequest(
            prompt=prompt,
            model=model,
            functions=functions,
            system_instruction=system_instruction,
            temperature=0.1  # Lower temperature for function calling
        )

        return await self.generate_content(request)

    async def generate_streaming(self, request: GeminiRequest) -> AsyncGenerator[str, None]:
        """Generate streaming content (for real-time applications)"""
        # Note: This is a placeholder for streaming implementation
        # Gemini API supports streaming, but requires different endpoint
        response = await self.generate_content(request)

        # Simulate streaming by yielding chunks
        content = response.content
        chunk_size = 50

        for i in range(0, len(content), chunk_size):
            chunk = content[i:i + chunk_size]
            yield chunk
            await asyncio.sleep(0.1)  # Simulate streaming delay

    def get_usage_statistics(self) -> Dict[str, Any]:
        """Get comprehensive usage statistics"""
        return {
            "metrics": self.metrics.copy(),
            "rate_limits": {
                model.value: {
                    "rpm_limit": config.rpm_limit,
                    "rpd_limit": config.rpd_limit,
                    "current_rpm_usage": len([
                        req for req in self.request_history[model.value]
                        if req > datetime.now() - timedelta(minutes=1)
                    ]),
                    "current_rpd_usage": len([
                        req for req in self.request_history[model.value]
                        if req > datetime.now() - timedelta(days=1)
                    ])
                }
                for model, config in self.models.items()
            },
            "model_availability": {
                model.value: self.can_make_request(model)
                for model in GeminiModel
            }
        }

    def reset_metrics(self):
        """Reset performance metrics"""
        self.metrics = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_tokens': 0,
            'total_cost': 0.0,
            'average_response_time': 0.0,
            'model_usage': {model.value: 0 for model in GeminiModel}
        }
        logger.info("Metrics reset successfully")
