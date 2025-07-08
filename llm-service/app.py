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

from services.content_generator import ContentGenerator
from services.image_generator import ImageGenerator
from services.video_generator import VideoGenerator
from services.sentiment_analyzer import SentimentAnalyzer
from services.trend_analyzer import TrendAnalyzer
from services.compliance_checker import ComplianceChecker
from services.huggingface_service import HuggingFaceService
from services.compliant_content_service import CompliantContentService
from huggingface_orchestrator import HuggingFaceOrchestrator
from utils.logger import setup_logger
from utils.cache import CacheManager
from utils.rate_limiter import RateLimiter as CustomRateLimiter

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Setup logging
logger = setup_logger(__name__)

# Initialize Redis for rate limiting
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    db=int(os.getenv('REDIS_DB', 0)),
    decode_responses=True
)

# Initialize rate limiter
limiter = Limiter(
    app,
    key_func=get_remote_address,
    storage_uri=os.getenv('REDIS_URL', 'redis://localhost:6379'),
    default_limits=["1000 per hour", "100 per minute"]
)

# Initialize services
cache_manager = CacheManager(redis_client)
content_generator = ContentGenerator()
image_generator = ImageGenerator()
video_generator = VideoGenerator()
sentiment_analyzer = SentimentAnalyzer()
trend_analyzer = TrendAnalyzer()
compliance_checker = ComplianceChecker()
rate_limiter = CustomRateLimiter(redis_client)

# Initialize enhanced services
hf_service = HuggingFaceService()
compliant_content_service = CompliantContentService()

# Initialize campaign orchestrator
orchestrator = HuggingFaceOrchestrator(
    api_key=os.getenv('HUGGINGFACE_API_KEY', 'demo-key')
)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0',
        'services': {
            'content_generator': content_generator.is_healthy(),
            'image_generator': image_generator.is_healthy(),
            'video_generator': video_generator.is_healthy(),
            'sentiment_analyzer': sentiment_analyzer.is_healthy(),
            'trend_analyzer': trend_analyzer.is_healthy(),
            'compliance_checker': compliance_checker.is_healthy(),
            'huggingface_service': bool(os.getenv('HUGGINGFACE_API_KEY')),
            'compliant_content_service': True,
        }
    })

@app.route('/generate/text', methods=['POST'])
@limiter.limit("50 per minute")
def generate_text():
    """Generate text content for social media posts"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or 'prompt' not in data:
            return jsonify({'error': 'Prompt is required'}), 400
        
        prompt = data['prompt']
        content_type = data.get('content_type', 'general')
        tone = data.get('tone', 'professional')
        max_length = data.get('max_length', 280)
        include_hashtags = data.get('include_hashtags', True)
        include_emojis = data.get('include_emojis', False)
        target_audience = data.get('target_audience', 'general')
        
        # Check cache first
        cache_key = f"text_gen:{hash(json.dumps(data, sort_keys=True))}"
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            logger.info(f"Returning cached text generation result")
            return jsonify(cached_result)
        
        # Generate content
        result = content_generator.generate_text(
            prompt=prompt,
            content_type=content_type,
            tone=tone,
            max_length=max_length,
            include_hashtags=include_hashtags,
            include_emojis=include_emojis,
            target_audience=target_audience
        )
        
        # Check compliance
        compliance_result = compliance_checker.check_text(result['content'])
        result['compliance'] = compliance_result
        
        # Cache result for 1 hour
        cache_manager.set(cache_key, result, ttl=3600)
        
        logger.info(f"Generated text content: {len(result['content'])} characters")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error generating text: {str(e)}")
        return jsonify({'error': 'Failed to generate text content'}), 500

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

@app.route('/analyze/sentiment', methods=['POST'])
@limiter.limit("100 per minute")
def analyze_sentiment():
    """Analyze sentiment of text content"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400
        
        text = data['text']
        
        # Check cache first
        cache_key = f"sentiment:{hash(text)}"
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            logger.info(f"Returning cached sentiment analysis result")
            return jsonify(cached_result)
        
        # Analyze sentiment
        result = sentiment_analyzer.analyze(text)
        
        # Cache result for 1 hour
        cache_manager.set(cache_key, result, ttl=3600)
        
        logger.info(f"Analyzed sentiment: {result.get('sentiment', 'N/A')}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error analyzing sentiment: {str(e)}")
        return jsonify({'error': 'Failed to analyze sentiment'}), 500

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

        async def run_orchestration():
            return await orchestrator.orchestrate_campaign(user_prompt)

        # Run the orchestration
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_orchestration())
        finally:
            loop.close()

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

        async def get_status():
            return await orchestrator.get_campaign_status(campaign_id)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            campaign = loop.run_until_complete(get_status())
        finally:
            loop.close()

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

        async def list_active():
            return await orchestrator.list_active_campaigns()

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            campaigns = loop.run_until_complete(list_active())
        finally:
            loop.close()

        return jsonify({
            'success': True,
            'campaigns': campaigns,
            'count': len(campaigns)
        })

    } except Exception as e:
        logger.error(f"Failed to list campaigns: {str(e)}")
        return jsonify({'error': 'Failed to list campaigns'}), 500

@app.route('/api/campaigns/<campaign_id>/stop', methods=['POST'])
@limiter.limit("50 per minute")
def stop_campaign(campaign_id):
    """Stop a running campaign"""
    try:
        import asyncio

        async def stop():
            return await orchestrator.stop_campaign(campaign_id)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            success = loop.run_until_complete(stop())
        finally:
            loop.close()

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

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3003))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f"Starting LLM service on port {port}")
    logger.info(f"Debug mode: {debug}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        threaded=True
    )
