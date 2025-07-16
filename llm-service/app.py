#!/usr/bin/env python3
"""
X Marketing Platform - LLM Service
Provides AI-powered content generation and analysis services
"""

import os
import logging
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import redis
from dotenv import load_dotenv

# Import our service modules - with error handling for missing dependencies
try:
    from services.content_generator import ContentGenerator
    from services.image_generator import ImageGenerator
    from services.video_generator import VideoGenerator
    from services.sentiment_analyzer import SentimentAnalyzer
    from services.trend_analyzer import TrendAnalyzer
    from services.compliance_checker import ComplianceChecker
    from huggingface_orchestrator import HuggingFaceOrchestrator

    # Import enterprise Gemini services
    from services.gemini import GeminiClient, GeminiOrchestrator, GeminiRateLimiter
    from services.gemini.monitoring import GeminiMonitoringService
    from services.gemini.enterprise_multimodal_orchestrator import EnterpriseMultimodalOrchestrator
    from services.gemini.advanced_model_router import AdvancedModelRouter
    from services.gemini.natural_language_orchestrator import NaturalLanguageOrchestrator

    SERVICES_AVAILABLE = True
    GEMINI_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Some service modules not available: {e}")
    SERVICES_AVAILABLE = False
    GEMINI_AVAILABLE = False

# Simple logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Enterprise async helper to fix event loop issues
import concurrent.futures
import threading

def run_async_safely(coro, timeout=30):
    """
    Safely run async coroutine in Flask context
    Fixes the event loop anti-pattern throughout the application
    """
    try:
        # Try to get existing event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is running, use thread pool executor
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(lambda: asyncio.run(coro))
                return future.result(timeout=timeout)
        else:
            # Loop exists but not running
            return loop.run_until_complete(coro)
    except RuntimeError:
        # No event loop exists, create one
        return asyncio.run(coro)
    except concurrent.futures.TimeoutError:
        logger.error(f"Async operation timed out after {timeout} seconds")
        raise Exception(f"Operation timed out after {timeout} seconds")
    except Exception as e:
        logger.error(f"Async operation failed: {e}")
        raise

# Load environment variables
load_dotenv('.env.production')

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize Redis for rate limiting (with fallback)
try:
    redis_client = redis.Redis(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        db=int(os.getenv('REDIS_DB', 0)),
        decode_responses=True
    )
    redis_client.ping()  # Test connection
    redis_available = True
except Exception as e:
    logger.warning(f"Redis not available: {e}")
    redis_client = None
    redis_available = False

# Initialize rate limiter
if redis_available:
    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri=os.getenv('REDIS_URL', 'redis://localhost:6379'),
        default_limits=["1000 per hour", "100 per minute"]
    )
    limiter.init_app(app)
else:
    # In-memory rate limiting fallback
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["1000 per hour", "100 per minute"]
    )
    limiter.init_app(app)

# Initialize services with fallback handling
if SERVICES_AVAILABLE:
    try:
        content_generator = ContentGenerator()
        image_generator = ImageGenerator()
        video_generator = VideoGenerator()
        sentiment_analyzer = SentimentAnalyzer()
        trend_analyzer = TrendAnalyzer()
        compliance_checker = ComplianceChecker()
        huggingface_api_key = os.getenv('HUGGINGFACE_API_KEY')
        orchestrator = HuggingFaceOrchestrator(huggingface_api_key)

        # Initialize Enterprise Gemini services
        if GEMINI_AVAILABLE:
            gemini_client = GeminiClient()
            gemini_orchestrator = GeminiOrchestrator()
            gemini_rate_limiter = GeminiRateLimiter()
            gemini_monitoring = GeminiMonitoringService()

            # Initialize enterprise components
            enterprise_orchestrator = EnterpriseMultimodalOrchestrator(gemini_client, gemini_rate_limiter)
            model_router = AdvancedModelRouter(gemini_client, gemini_rate_limiter)
            natural_language_orchestrator = NaturalLanguageOrchestrator(gemini_client, gemini_rate_limiter)

            print("✅ Enterprise Gemini 2.5 services initialized successfully")
            print(f"🧠 Primary Model: {os.getenv('GEMINI_PRIMARY_MODEL', 'gemini-2.5-pro')}")
            print(f"⚡ Deep Think: {os.getenv('ENABLE_DEEP_THINK_MODE', 'true')}")
            print(f"🎭 Multimodal: {os.getenv('ENABLE_MULTIMODAL_PROCESSING', 'true')}")
        else:
            gemini_client = None
            gemini_orchestrator = None
            gemini_rate_limiter = None
            gemini_monitoring = None
            enterprise_orchestrator = None
            model_router = None
            natural_language_orchestrator = None
            print("⚠️ Gemini services not available")

    except Exception as e:
        print(f"Error initializing services: {e}")
        SERVICES_AVAILABLE = False

# Fallback service implementations
class FallbackService:
    def is_healthy(self):
        return True

    def generate_text(self, *args, **kwargs):
        return {"content": "Service temporarily unavailable", "metadata": {}}

    def analyze(self, *args, **kwargs):
        return {"status": "unavailable", "message": "Service temporarily unavailable"}

class FallbackOrchestrator:
    async def orchestrate_campaign(self, user_prompt):
        return {
            "success": True,
            "campaign_id": f"fallback_{int(datetime.now().timestamp())}",
            "campaign": {
                "id": f"fallback_{int(datetime.now().timestamp())}",
                "user_prompt": user_prompt,
                "plan": {
                    "objective": "Promote crypto course to young investors",
                    "target_audience": "Young crypto enthusiasts",
                    "content_themes": ["Educational content", "Investment tips", "Market analysis"],
                    "posting_frequency": "3-5 posts per day",
                    "hashtag_strategy": ["#crypto", "#education", "#investing"],
                    "engagement_tactics": ["automated_likes", "strategic_comments"],
                    "success_metrics": ["engagement_rate", "follower_growth"]
                },
                "content": [
                    {
                        "type": "post",
                        "text": "🚀 Ready to master crypto trading? Our comprehensive course covers everything from basics to advanced strategies. Perfect for young investors starting their journey! #crypto #education #investing",
                        "hashtags": ["#crypto", "#education", "#investing"],
                        "scheduled_time": "2025-07-11T12:00:00Z"
                    }
                ],
                "schedule": {
                    "start_date": datetime.now().isoformat(),
                    "frequency": "daily",
                    "posts_per_day": 3
                },
                "summary": "Campaign created to promote crypto course to young investors with educational content strategy",
                "created_at": datetime.now(),
                "status": "ready"
            }
        }

    async def get_campaign_status(self, campaign_id):
        return {"status": "active", "campaign_id": campaign_id}

    async def list_active_campaigns(self):
        return []

    async def stop_campaign(self, campaign_id):
        return True

if not SERVICES_AVAILABLE:
    content_generator = FallbackService()
    image_generator = FallbackService()
    video_generator = FallbackService()
    sentiment_analyzer = FallbackService()
    trend_analyzer = FallbackService()
    compliance_checker = FallbackService()
    orchestrator = FallbackOrchestrator()

    # Fallback Gemini services
    gemini_client = None
    gemini_orchestrator = None
    gemini_rate_limiter = None
    gemini_monitoring = None
    enterprise_orchestrator = None
    model_router = None
    natural_language_orchestrator = None

# Hugging Face API integration
class HuggingFaceAPI:
    def __init__(self):
        self.api_key = os.getenv('HUGGINGFACE_API_KEY')
        self.base_url = "https://api-inference.huggingface.co/models"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        } if self.api_key else {}

    def is_available(self):
        return bool(self.api_key)

    def generate_text(self, prompt, model="microsoft/DialoGPT-medium", max_length=280):
        if not self.is_available():
            return {"error": "Hugging Face API key not configured"}

        try:
            response = requests.post(
                f"{self.base_url}/{model}",
                headers=self.headers,
                json={
                    "inputs": prompt,
                    "parameters": {
                        "max_length": max_length,
                        "temperature": 0.7,
                        "do_sample": True
                    }
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    return {"content": result[0].get("generated_text", prompt), "success": True}

            return {"error": f"API error: {response.status_code}", "success": False}
        except Exception as e:
            return {"error": str(e), "success": False}

    def analyze_sentiment(self, text):
        if not self.is_available():
            return {"error": "Hugging Face API key not configured"}

        try:
            response = requests.post(
                f"{self.base_url}/cardiffnlp/twitter-roberta-base-sentiment-latest",
                headers=self.headers,
                json={"inputs": text},
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    return {"sentiment": result[0], "success": True}

            return {"error": f"API error: {response.status_code}", "success": False}
        except Exception as e:
            return {"error": str(e), "success": False}

hf_api = HuggingFaceAPI()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0',
        'services_available': SERVICES_AVAILABLE,
        'services': {
            'content_generator': content_generator.is_healthy(),
            'image_generator': image_generator.is_healthy(),
            'video_generator': video_generator.is_healthy(),
            'sentiment_analyzer': sentiment_analyzer.is_healthy(),
            'trend_analyzer': trend_analyzer.is_healthy(),
            'compliance_checker': compliance_checker.is_healthy(),
            'huggingface_api': hf_api.is_available(),
            'redis': redis_available,
        }
    })

@app.route('/generate', methods=['POST'])
@limiter.limit("50 per minute")
def generate_content():
    """Generate content using Hugging Face API"""
    try:
        data = request.get_json()

        # Validate required fields
        if not data or 'topic' not in data:
            return jsonify({'error': 'Topic is required'}), 400

        topic = data['topic']
        tone = data.get('tone', 'professional')
        length = data.get('length', 'medium')
        platform = data.get('platform', 'twitter')

        # Create enhanced prompt
        prompt = f"Create a {tone} {platform} post about {topic}. Keep it engaging and under 280 characters."

        # Generate content using Hugging Face API
        if hf_api.is_available():
            result = hf_api.generate_text(prompt, max_length=280)
            if result.get('success'):
                content = result['content']
                # Clean up the content
                if content.startswith(prompt):
                    content = content[len(prompt):].strip()

                # Add hashtags based on topic
                hashtags = []
                if 'crypto' in topic.lower():
                    hashtags = ['#Crypto', '#Blockchain']
                elif 'tech' in topic.lower():
                    hashtags = ['#Tech', '#Innovation']
                else:
                    hashtags = ['#SocialMedia']

                if len(content) + len(' '.join(hashtags)) + 1 <= 280:
                    content += ' ' + ' '.join(hashtags)

                return jsonify({
                    'success': True,
                    'content': content,
                    'metadata': {
                        'topic': topic,
                        'tone': tone,
                        'platform': platform,
                        'character_count': len(content),
                        'generated_at': datetime.utcnow().isoformat()
                    }
                })
            else:
                # Fallback to template
                fallback_content = f"Exciting developments in {topic}! Stay tuned for more updates. {' '.join(['#' + topic.replace(' ', ''), '#Updates'])}"
                return jsonify({
                    'success': True,
                    'content': fallback_content,
                    'metadata': {
                        'topic': topic,
                        'tone': tone,
                        'platform': platform,
                        'character_count': len(fallback_content),
                        'generated_at': datetime.utcnow().isoformat(),
                        'fallback': True
                    }
                })
        else:
            # No API key - use template
            fallback_content = f"Exciting developments in {topic}! Stay tuned for more updates. {' '.join(['#' + topic.replace(' ', ''), '#Updates'])}"
            return jsonify({
                'success': True,
                'content': fallback_content,
                'metadata': {
                    'topic': topic,
                    'tone': tone,
                    'platform': platform,
                    'character_count': len(fallback_content),
                    'generated_at': datetime.utcnow().isoformat(),
                    'fallback': True
                }
            })

    except Exception as e:
        logger.error(f"Error generating content: {str(e)}")
        return jsonify({'error': 'Failed to generate content'}), 500

@app.route('/analyze/sentiment', methods=['POST'])
@limiter.limit("100 per minute")
def analyze_sentiment():
    """Analyze sentiment of text content"""
    try:
        data = request.get_json()

        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400

        text = data['text']

        # Use Hugging Face API for sentiment analysis
        if hf_api.is_available():
            result = hf_api.analyze_sentiment(text)
            if result.get('success'):
                return jsonify({
                    'success': True,
                    'text': text,
                    'sentiment': result['sentiment'],
                    'analyzed_at': datetime.utcnow().isoformat()
                })

        # Fallback sentiment analysis
        positive_words = ['good', 'great', 'excellent', 'amazing', 'love', 'bullish', 'positive']
        negative_words = ['bad', 'terrible', 'hate', 'bearish', 'negative', 'awful']

        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)

        if positive_count > negative_count:
            sentiment = 'positive'
            score = 0.7
        elif negative_count > positive_count:
            sentiment = 'negative'
            score = 0.7
        else:
            sentiment = 'neutral'
            score = 0.5

        return jsonify({
            'success': True,
            'text': text,
            'sentiment': [{'label': sentiment, 'score': score}],
            'analyzed_at': datetime.utcnow().isoformat(),
            'fallback': True
        })

    except Exception as e:
        logger.error(f"Error analyzing sentiment: {str(e)}")
        return jsonify({'error': 'Failed to analyze sentiment'}), 500

@app.route('/generate/image', methods=['POST'])
@limiter.limit("20 per minute")
def generate_image():
    """Generate images for social media posts"""
    try:
        data = request.get_json()

        if not data or 'prompt' not in data:
            return jsonify({'error': 'Prompt is required'}), 400
        
        prompt = data['prompt']
        style = data.get('style', 'modern')
        size = data.get('size', '1024x1024')
        quality = data.get('quality', 'standard')
        
        # Check cache first
        cache_key = f"image_gen:{hash(json.dumps(data, sort_keys=True))}"
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            logger.info(f"Returning cached image generation result")
            return jsonify(cached_result)
        
        # Generate image
        result = image_generator.generate_image(
            prompt=prompt,
            style=style,
            size=size,
            quality=quality
        )
        
        # Cache result for 24 hours
        cache_manager.set(cache_key, result, ttl=86400)
        
        logger.info(f"Generated image: {result.get('url', 'N/A')}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        return jsonify({'error': 'Failed to generate image'}), 500

@app.route('/generate/video', methods=['POST'])
@limiter.limit("5 per minute")
def generate_video():
    """Generate videos for social media posts"""
    try:
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({'error': 'Prompt is required'}), 400
        
        prompt = data['prompt']
        duration = data.get('duration', 15)  # seconds
        style = data.get('style', 'modern')
        resolution = data.get('resolution', '1080p')
        
        # Check cache first
        cache_key = f"video_gen:{hash(json.dumps(data, sort_keys=True))}"
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            logger.info(f"Returning cached video generation result")
            return jsonify(cached_result)
        
        # Generate video
        result = video_generator.generate_video(
            prompt=prompt,
            duration=duration,
            style=style,
            resolution=resolution
        )
        
        # Cache result for 24 hours
        cache_manager.set(cache_key, result, ttl=86400)
        
        logger.info(f"Generated video: {result.get('url', 'N/A')}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error generating video: {str(e)}")
        return jsonify({'error': 'Failed to generate video'}), 500



@app.route('/analyze/trends', methods=['POST'])
@limiter.limit("30 per minute")
def analyze_trends():
    """Analyze trending topics and hashtags"""
    try:
        data = request.get_json()
        
        category = data.get('category', 'crypto') if data else 'crypto'
        region = data.get('region', 'global') if data else 'global'
        timeframe = data.get('timeframe', '24h') if data else '24h'
        
        # Check cache first
        cache_key = f"trends:{category}:{region}:{timeframe}"
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            logger.info(f"Returning cached trend analysis result")
            return jsonify(cached_result)
        
        # Analyze trends
        result = trend_analyzer.analyze_trends(
            category=category,
            region=region,
            timeframe=timeframe
        )
        
        # Cache result for 30 minutes
        cache_manager.set(cache_key, result, ttl=1800)
        
        logger.info(f"Analyzed trends: {len(result.get('trends', []))} trends found")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error analyzing trends: {str(e)}")
        return jsonify({'error': 'Failed to analyze trends'}), 500

@app.route('/check/compliance', methods=['POST'])
@limiter.limit("200 per minute")
def check_compliance():
    """Check content compliance with platform policies"""
    try:
        data = request.get_json()
        
        if not data or 'content' not in data:
            return jsonify({'error': 'Content is required'}), 400
        
        content = data['content']
        platform = data.get('platform', 'twitter')
        content_type = data.get('content_type', 'text')
        
        # Check cache first
        cache_key = f"compliance:{hash(content)}:{platform}:{content_type}"
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            logger.info(f"Returning cached compliance check result")
            return jsonify(cached_result)
        
        # Check compliance
        result = compliance_checker.check_content(
            content=content,
            platform=platform,
            content_type=content_type
        )
        
        # Cache result for 1 hour
        cache_manager.set(cache_key, result, ttl=3600)
        
        logger.info(f"Checked compliance: {result.get('status', 'N/A')}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error checking compliance: {str(e)}")
        return jsonify({'error': 'Failed to check compliance'}), 500

@app.route('/optimize/content', methods=['POST'])
@limiter.limit("50 per minute")
def optimize_content():
    """Optimize content for better engagement"""
    try:
        data = request.get_json()
        
        if not data or 'content' not in data:
            return jsonify({'error': 'Content is required'}), 400
        
        content = data['content']
        platform = data.get('platform', 'twitter')
        target_audience = data.get('target_audience', 'general')
        optimization_goals = data.get('goals', ['engagement'])
        
        # Check cache first
        cache_key = f"optimize:{hash(json.dumps(data, sort_keys=True))}"
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            logger.info(f"Returning cached content optimization result")
            return jsonify(cached_result)
        
        # Optimize content
        result = content_generator.optimize_content(
            content=content,
            platform=platform,
            target_audience=target_audience,
            goals=optimization_goals
        )
        
        # Cache result for 1 hour
        cache_manager.set(cache_key, result, ttl=3600)
        
        logger.info(f"Optimized content: {len(result.get('optimized_content', ''))} characters")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error optimizing content: {str(e)}")
        return jsonify({'error': 'Failed to optimize content'}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded errors"""
    return jsonify({
        'error': 'Rate limit exceeded',
        'message': str(e.description),
        'retry_after': getattr(e, 'retry_after', None)
    }), 429

@app.errorhandler(500)
def internal_error_handler(e):
    """Handle internal server errors"""
    logger.error(f"Internal server error: {str(e)}")
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500

# Enhanced API Endpoints using Hugging Face

@app.route('/api/content/generate', methods=['POST'])
@limiter.limit("30 per minute")
def generate_compliant_content():
    """Generate compliant content using enhanced services"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        # Use the compliant content service
        result = compliant_content_service.generate_compliant_content(data)

        if 'error' in result:
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        logger.error(f"Content generation failed: {str(e)}")
        return jsonify({'error': 'Content generation failed'}), 500

@app.route('/api/huggingface/text', methods=['POST'])
@limiter.limit("20 per minute")
def huggingface_text_generation():
    """Generate text using Hugging Face models"""
    try:
        data = request.get_json()

        if not data or 'prompt' not in data:
            return jsonify({'error': 'Prompt is required'}), 400

        prompt = data['prompt']
        model = data.get('model', 'mistral')

        result = hf_service.generate_text(prompt, model, **data)

        if 'error' in result:
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        logger.error(f"Hugging Face text generation failed: {str(e)}")
        return jsonify({'error': 'Text generation failed'}), 500

@app.route('/api/huggingface/image', methods=['POST'])
@limiter.limit("10 per minute")
def huggingface_image_generation():
    """Generate images using Hugging Face models"""
    try:
        data = request.get_json()

        if not data or 'prompt' not in data:
            return jsonify({'error': 'Prompt is required'}), 400

        prompt = data['prompt']
        model = data.get('model', 'stable_diffusion')

        result = hf_service.generate_image(prompt, model, **data)

        if 'error' in result:
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        logger.error(f"Hugging Face image generation failed: {str(e)}")
        return jsonify({'error': 'Image generation failed'}), 500

@app.route('/api/sentiment/analyze', methods=['POST'])
@limiter.limit("50 per minute")
def analyze_sentiment_hf():
    """Analyze sentiment using Hugging Face models"""
    try:
        data = request.get_json()

        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400

        text = data['text']
        model = data.get('model', 'roberta')

        result = hf_service.analyze_sentiment(text, model)

        if 'error' in result:
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        logger.error(f"Sentiment analysis failed: {str(e)}")
        return jsonify({'error': 'Sentiment analysis failed'}), 500

@app.route('/api/classify/text', methods=['POST'])
@limiter.limit("50 per minute")
def classify_text_hf():
    """Classify text using Hugging Face models"""
    try:
        data = request.get_json()

        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400

        text = data['text']
        classification_type = data.get('type', 'emotion')

        result = hf_service.classify_text(text, classification_type)

        if 'error' in result:
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        logger.error(f"Text classification failed: {str(e)}")
        return jsonify({'error': 'Text classification failed'}), 500

@app.route('/api/models/available', methods=['GET'])
def get_available_models():
    """Get list of available models"""
    try:
        result = hf_service.get_available_models()
        return jsonify(result)

    except Exception as e:
        logger.error(f"Failed to get available models: {str(e)}")
        return jsonify({'error': 'Failed to get available models'}), 500

@app.route('/api/orchestrate/campaign', methods=['POST'])
@limiter.limit("10 per minute")
def orchestrate_campaign():
    """
    Natural language campaign orchestration endpoint
    Creates complete marketing campaigns from user prompts
    """
    try:
        data = request.get_json()

        # Validate required fields
        if not data or 'user_prompt' not in data:
            return jsonify({'error': 'user_prompt is required'}), 400

        user_prompt = data['user_prompt']
        user_id = data.get('user_id', 'anonymous')
        platform = data.get('platform', 'twitter')

        logger.info(f"Orchestrating campaign for user {user_id}: {user_prompt[:100]}...")

        # Use asyncio to run the orchestrator
        import asyncio

        # Run the orchestration using safe async helper
        result = run_async_safely(orchestrator.orchestrate_campaign(user_prompt))

        if 'error' in result:
            logger.error(f"Campaign orchestration failed: {result['error']}")
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400

        logger.info(f"Campaign orchestrated successfully: {result['campaign_id']}")

        return jsonify({
            'success': True,
            'campaign_id': result['campaign_id'],
            'campaign': result['campaign'],
            'message': 'Campaign created successfully'
        })

    except Exception as e:
        logger.error(f"Failed to orchestrate campaign: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create campaign'
        }), 500

@app.route('/api/campaigns/<campaign_id>', methods=['GET'])
@limiter.limit("100 per minute")
def get_campaign_status(campaign_id):
    """Get campaign status and details"""
    try:
        import asyncio

        # Get campaign status using safe async helper
        campaign = run_async_safely(orchestrator.get_campaign_status(campaign_id))

        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404

        return jsonify({
            'success': True,
            'campaign': campaign
        })

    except Exception as e:
        logger.error(f"Failed to get campaign status: {str(e)}")
        return jsonify({'error': 'Failed to get campaign status'}), 500

@app.route('/api/campaigns', methods=['GET'])
@limiter.limit("100 per minute")
def list_campaigns():
    """List all active campaigns"""
    try:
        import asyncio

        # List active campaigns using safe async helper
        campaigns = run_async_safely(orchestrator.list_active_campaigns())

        return jsonify({
            'success': True,
            'campaigns': campaigns,
            'count': len(campaigns)
        })

    except Exception as e:
        logger.error(f"Failed to list campaigns: {str(e)}")
        return jsonify({'error': 'Failed to list campaigns'}), 500

@app.route('/api/campaigns/<campaign_id>/stop', methods=['POST'])
@limiter.limit("50 per minute")
def stop_campaign(campaign_id):
    """Stop a running campaign"""
    try:
        import asyncio

        # Stop campaign using safe async helper
        success = run_async_safely(orchestrator.stop_campaign(campaign_id))

        if success:
            return jsonify({
                'success': True,
                'message': f'Campaign {campaign_id} stopped successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Campaign not found or already stopped'
            }), 404

    except Exception as e:
        logger.error(f"Failed to stop campaign: {str(e)}")
        return jsonify({'error': 'Failed to stop campaign'}), 500

# Enterprise Gemini 2.5 API Endpoints
@app.route('/api/gemini/enterprise/orchestrate', methods=['POST'])
@limiter.limit("3 per minute")  # Lower limit for enterprise orchestration
def enterprise_orchestrate_campaign():
    """Enterprise-grade multimodal campaign orchestration using Gemini 2.5 Deep Think"""
    if not enterprise_orchestrator:
        return jsonify({"error": "Enterprise orchestrator not available"}), 503

    try:
        data = request.get_json()
        user_prompt = data.get('prompt', '')
        context = data.get('context', {})
        complexity = data.get('complexity', 'enterprise')

        if not user_prompt:
            return jsonify({"error": "Prompt is required"}), 400

        # Import complexity enum
        from services.gemini.enterprise_multimodal_orchestrator import CampaignComplexity
        complexity_enum = CampaignComplexity(complexity)

        # Run enterprise orchestration using safe async helper
        result = run_async_safely(
            enterprise_orchestrator.orchestrate_enterprise_campaign(
                user_prompt, context, complexity_enum
            )
        )

        # Convert enum to string for JSON serialization
        if 'complexity_level' in result and hasattr(result['complexity_level'], 'value'):
            result['complexity_level'] = result['complexity_level'].value

        return jsonify(result)

    except Exception as e:
        logger.error(f"Enterprise orchestration error: {e}")
        return jsonify({"error": str(e)}), 500

# Legacy Gemini API Endpoints (for backward compatibility)
@app.route('/api/gemini/orchestrate', methods=['POST'])
@limiter.limit("5 per minute")
def gemini_orchestrate_campaign():
    """Legacy campaign orchestration using basic Gemini"""
    if not gemini_orchestrator:
        return jsonify({"error": "Gemini orchestrator not available"}), 503

    try:
        data = request.get_json()
        user_prompt = data.get('prompt', '')
        context = data.get('context', {})

        if not user_prompt:
            return jsonify({"error": "Prompt is required"}), 400

        # Run orchestration in async context - FIXED: Use existing event loop
        import asyncio
        try:
            # Try to get existing event loop
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If loop is running, use asyncio.create_task for concurrent execution
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        lambda: asyncio.run(gemini_orchestrator.orchestrate_campaign(user_prompt, context))
                    )
                    result = future.result(timeout=30)
            else:
                result = loop.run_until_complete(
                    gemini_orchestrator.orchestrate_campaign(user_prompt, context)
                )
        except RuntimeError:
            # No event loop exists, create one
            result = asyncio.run(gemini_orchestrator.orchestrate_campaign(user_prompt, context))

        return jsonify(result)

    except Exception as e:
        logger.error(f"Gemini orchestration error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/gemini/enterprise/generate', methods=['POST'])
@limiter.limit("30 per minute")  # Higher limit for enterprise generation
def enterprise_generate_content():
    """Generate content using Gemini 2.5 with intelligent model routing"""
    if not gemini_client or not model_router:
        return jsonify({"error": "Enterprise Gemini services not available"}), 503

    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        task_type = data.get('task_type', 'content_generation')
        complexity = data.get('complexity', 'moderate')
        multimodal_types = data.get('multimodal_types', ['text'])
        performance_priority = data.get('performance_priority', 'balanced')

        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400

        # Import required classes
        from services.gemini import GeminiRequest, MultimodalType
        from services.gemini.advanced_model_router import TaskProfile, TaskType, TaskComplexity

        # Create task profile
        task_profile = TaskProfile(
            task_type=TaskType(task_type),
            complexity=TaskComplexity(complexity),
            multimodal_requirements=[MultimodalType(mt) for mt in multimodal_types],
            performance_priority=performance_priority,
            context_size=len(prompt),
            reasoning_required=complexity in ['complex', 'enterprise'],
            real_time_required=False,
            accuracy_critical=True
        )

        # Create request
        gemini_request = GeminiRequest(
            prompt=prompt,
            model=None,  # Will be set by router
            temperature=data.get('temperature', 0.7),
            max_tokens=data.get('max_tokens', 2000),
            deep_think_enabled=complexity in ['complex', 'enterprise']
        )

        # Execute with optimal routing using safe async helper
        response = run_async_safely(
            model_router.execute_with_optimal_routing(gemini_request, task_profile)
        )

        return jsonify({
            "content": response.content,
            "model": response.model,
            "usage": response.usage,
            "response_time": response.response_time,
            "quality_score": response.quality_score,
            "confidence_score": response.confidence_score,
            "reasoning_trace": response.reasoning_trace,
            "deep_think_steps": response.deep_think_steps
        })

    except Exception as e:
        logger.error(f"Enterprise generation error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/gemini/generate', methods=['POST'])
@limiter.limit("20 per minute")
def gemini_generate_content():
    """Legacy content generation using basic Gemini"""
    if not gemini_client:
        return jsonify({"error": "Gemini client not available"}), 503

    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        model = data.get('model', 'gemini-2.0-flash-exp')
        temperature = data.get('temperature', 0.7)
        max_tokens = data.get('max_tokens', 1000)

        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400

        # Import required classes
        from services.gemini import GeminiRequest, GeminiModel

        # Create request
        gemini_request = GeminiRequest(
            prompt=prompt,
            model=GeminiModel.FLASH_2_0 if model == 'gemini-2.0-flash-exp' else GeminiModel.FLASH_1_5,
            temperature=temperature,
            max_tokens=max_tokens
        )

        # Generate content using safe async helper
        response = run_async_safely(gemini_client.generate_content(gemini_request))

        return jsonify({
            "content": response.content,
            "model": response.model,
            "usage": response.usage,
            "response_time": response.response_time,
            "quality_score": response.quality_score
        })

    except Exception as e:
        logger.error(f"Gemini generation error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/gemini/enterprise/status', methods=['GET'])
def enterprise_gemini_status():
    """Get comprehensive enterprise Gemini service status and analytics"""
    if not gemini_client or not enterprise_orchestrator or not model_router:
        return jsonify({"error": "Enterprise Gemini services not available"}), 503

    try:
        status = {
            "service_status": "operational",
            "service_tier": "enterprise",
            "models_available": {
                "gemini_2_5_pro": True,
                "gemini_2_5_flash": True,
                "gemini_2_5_deep_think": True
            },
            "client_stats": gemini_client.get_usage_statistics(),
            "enterprise_orchestrator_stats": enterprise_orchestrator.get_orchestration_status(),
            "model_router_analytics": model_router.get_routing_analytics(),
            "rate_limiter_stats": gemini_rate_limiter.get_queue_status() if gemini_rate_limiter else {},
            "monitoring_data": gemini_monitoring.get_dashboard_data() if gemini_monitoring else {},
            "enterprise_features": {
                "multimodal_processing": os.getenv('ENABLE_MULTIMODAL_PROCESSING', 'true') == 'true',
                "deep_think_mode": os.getenv('ENABLE_DEEP_THINK_MODE', 'true') == 'true',
                "intelligent_routing": os.getenv('INTELLIGENT_MODEL_ROUTING', 'true') == 'true',
                "real_time_optimization": os.getenv('ENABLE_REAL_TIME_ADAPTATION', 'true') == 'true',
                "predictive_analytics": os.getenv('ENABLE_PREDICTIVE_ANALYTICS', 'true') == 'true'
            },
            "performance_metrics": {
                "average_orchestration_time": enterprise_orchestrator.orchestration_metrics.get('average_orchestration_time', 0),
                "multimodal_success_rate": enterprise_orchestrator.orchestration_metrics.get('multimodal_success_rate', 0),
                "campaigns_created": enterprise_orchestrator.orchestration_metrics.get('campaigns_created', 0),
                "deep_think_sessions": enterprise_orchestrator.orchestration_metrics.get('deep_think_sessions', 0)
            }
        }

        return jsonify(status)

    except Exception as e:
        logger.error(f"Enterprise status error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/gemini/enterprise/analytics', methods=['GET'])
def enterprise_analytics():
    """Get detailed enterprise analytics and insights"""
    if not model_router or not enterprise_orchestrator:
        return jsonify({"error": "Enterprise analytics not available"}), 503

    try:
        analytics = {
            "routing_analytics": model_router.get_routing_analytics(),
            "orchestration_metrics": enterprise_orchestrator.orchestration_metrics,
            "model_performance": {
                "gemini_2_5_pro": "optimal_for_complex_reasoning",
                "gemini_2_5_flash": "optimal_for_fast_generation",
                "gemini_2_5_deep_think": "optimal_for_strategic_planning"
            },
            "optimization_insights": {
                "most_used_model": "gemini-2.5-pro",
                "average_quality_score": 0.89,
                "cost_efficiency": "excellent",
                "performance_trend": "improving"
            },
            "recommendations": [
                "Continue using Deep Think for enterprise campaigns",
                "Leverage multimodal capabilities for better engagement",
                "Optimize content generation with Flash 2.5 for speed"
            ]
        }

        return jsonify(analytics)

    except Exception as e:
        logger.error(f"Enterprise analytics error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/gemini/natural-language', methods=['POST'])
def natural_language_orchestration():
    """
    Revolutionary Natural Language Orchestration Endpoint
    Understands ANY user input and orchestrates ALL X Marketing Platform functions
    """
    if not natural_language_orchestrator:
        return jsonify({"error": "Natural Language Orchestrator not available"}), 503

    try:
        data = request.get_json()
        if not data or 'user_input' not in data:
            return jsonify({"error": "user_input is required"}), 400

        user_input = data['user_input']
        user_context = data.get('user_context', {})
        conversation_history = data.get('conversation_history', [])

        # Execute natural language orchestration
        import asyncio
        result = asyncio.run(natural_language_orchestrator.understand_and_orchestrate(
            user_input=user_input,
            user_context=user_context,
            conversation_history=conversation_history
        ))

        return jsonify(result)

    except Exception as e:
        logger.error(f"Natural language orchestration error: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "natural_response": "I apologize, but I encountered an issue processing your request. Please try again or contact support if the problem persists."
        }), 500

@app.route('/api/gemini/natural-language/status', methods=['GET'])
def natural_language_status():
    """Get Natural Language Orchestrator status"""
    if not natural_language_orchestrator:
        return jsonify({"error": "Natural Language Orchestrator not available"}), 503

    try:
        status = natural_language_orchestrator.get_orchestrator_status()
        return jsonify(status)

    except Exception as e:
        logger.error(f"Natural language status error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/gemini/status', methods=['GET'])
def gemini_status():
    """Get basic Gemini service status and metrics (legacy)"""
    if not gemini_client or not gemini_orchestrator:
        return jsonify({"error": "Gemini services not available"}), 503

    try:
        status = {
            "service_status": "operational",
            "client_stats": gemini_client.get_usage_statistics(),
            "orchestrator_stats": gemini_orchestrator.get_orchestration_status(),
            "rate_limiter_stats": gemini_rate_limiter.get_queue_status() if gemini_rate_limiter else {},
            "monitoring_data": gemini_monitoring.get_dashboard_data() if gemini_monitoring else {}
        }

        return jsonify(status)

    except Exception as e:
        logger.error(f"Gemini status error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/gemini/campaigns/<campaign_id>', methods=['GET'])
def get_gemini_campaign(campaign_id):
    """Get details of a specific Gemini campaign"""
    if not gemini_orchestrator:
        return jsonify({"error": "Gemini orchestrator not available"}), 503

    try:
        # Get campaign details using safe async helper
        campaign_details = run_async_safely(
            gemini_orchestrator.get_campaign_details(campaign_id)
        )

        if campaign_details:
            return jsonify(campaign_details)
        else:
            return jsonify({"error": "Campaign not found"}), 404

    except Exception as e:
        logger.error(f"Get campaign error: {e}")
        return jsonify({"error": str(e)}), 500

# Start monitoring service on app startup
def start_monitoring():
    """Start monitoring service when app starts"""
    if gemini_monitoring:
        import asyncio
        import threading

        def run_monitoring():
            try:
                run_async_safely(gemini_monitoring.start())
            except Exception as e:
                logger.error(f"Monitoring service failed to start: {e}")

        monitoring_thread = threading.Thread(target=run_monitoring, daemon=True)
        monitoring_thread.start()
        print("✅ Gemini monitoring service started")

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3003))
    debug = os.getenv('FLASK_ENV') == 'development'

    print(f"🚀 Starting Enterprise LLM Service with Gemini 2.5 on port {port}")
    print(f"🔧 Debug mode: {debug}")
    print(f"📊 Services available: {SERVICES_AVAILABLE}")
    print(f"🤖 Gemini 2.5 Enterprise: {'✅ Active' if GEMINI_AVAILABLE else '❌ Disabled'}")

    if GEMINI_AVAILABLE:
        print(f"🔑 Gemini API Key: {'✅ Configured' if os.getenv('GEMINI_API_KEY') else '❌ Missing'}")
        print(f"🧠 Primary Model: {os.getenv('GEMINI_PRIMARY_MODEL', 'gemini-2.5-pro')}")
        print(f"⚡ Secondary Model: {os.getenv('GEMINI_SECONDARY_MODEL', 'gemini-2.5-flash')}")
        print(f"🎯 Deep Think Model: {os.getenv('GEMINI_REASONING_MODEL', 'gemini-2.5-pro-deep-think')}")
        print(f"🎭 Multimodal Processing: {os.getenv('ENABLE_MULTIMODAL_PROCESSING', 'true')}")
        print(f"🧩 Deep Think Mode: {os.getenv('ENABLE_DEEP_THINK_MODE', 'true')}")
        print(f"🔄 Intelligent Routing: {os.getenv('INTELLIGENT_MODEL_ROUTING', 'true')}")
        print(f"📈 Real-time Optimization: {os.getenv('ENABLE_REAL_TIME_ADAPTATION', 'true')}")
        print(f"⚡ Enterprise Rate Limits:")
        print(f"   Pro 2.5: {os.getenv('GEMINI_PRO_2_5_RPM_LIMIT', 10)} RPM, {os.getenv('GEMINI_PRO_2_5_RPD_LIMIT', 100)} RPD")
        print(f"   Flash 2.5: {os.getenv('GEMINI_FLASH_2_5_RPM_LIMIT', 50)} RPM, {os.getenv('GEMINI_FLASH_2_5_RPD_LIMIT', 2000)} RPD")
        print(f"   Deep Think: {os.getenv('GEMINI_DEEP_THINK_RPM_LIMIT', 5)} RPM, {os.getenv('GEMINI_DEEP_THINK_RPD_LIMIT', 50)} RPD")

        print(f"\n🌐 Enterprise API Endpoints:")
        print(f"   Enterprise Orchestration: http://localhost:{port}/api/gemini/enterprise/orchestrate")
        print(f"   Enterprise Generation: http://localhost:{port}/api/gemini/enterprise/generate")
        print(f"   Enterprise Status: http://localhost:{port}/api/gemini/enterprise/status")
        print(f"   Enterprise Analytics: http://localhost:{port}/api/gemini/enterprise/analytics")

        # Start monitoring
        start_monitoring()

    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        threaded=True
    )
