#!/usr/bin/env python3
"""
Enhanced Hugging Face Service
Provides advanced content generation using Hugging Face models
"""

import os
import requests
import json
import time
import random
import base64
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
import logging
from io import BytesIO

logger = logging.getLogger(__name__)

class HuggingFaceService:
    """Enhanced Hugging Face service for content generation and analysis"""
    
    def __init__(self):
        self.api_key = os.getenv('HUGGINGFACE_API_KEY')
        self.api_base = "https://api-inference.huggingface.co"
        
        if not self.api_key:
            logger.warning("Hugging Face API key not found. Some features will be disabled.")
            
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Available models
        self.models = {
            "text_generation": {
                "llama2": "meta-llama/Llama-2-7b-chat-hf",
                "mistral": "mistralai/Mistral-7B-Instruct-v0.1",
                "zephyr": "HuggingFaceH4/zephyr-7b-beta",
                "openchat": "openchat/openchat-3.5-1210",
                "phi": "microsoft/phi-2",
                "flan": "google/flan-t5-large"
            },
            "image_generation": {
                "stable_diffusion": "stabilityai/stable-diffusion-2-1",
                "flux": "black-forest-labs/FLUX.1-schnell",
                "playground": "playgroundai/playground-v2-1024px-aesthetic"
            },
            "sentiment_analysis": {
                "roberta": "cardiffnlp/twitter-roberta-base-sentiment-latest",
                "finbert": "ProsusAI/finbert"
            },
            "text_classification": {
                "emotion": "j-hartmann/emotion-english-distilroberta-base",
                "toxicity": "martin-ha/toxic-comment-model",
                "spam": "madhurjindal/autonlp-Gibberish-Detector-492513457"
            },
            "summarization": {
                "bart": "facebook/bart-large-cnn",
                "pegasus": "google/pegasus-xsum"
            },
            "translation": {
                "marian": "Helsinki-NLP/opus-mt-en-es",
                "t5": "t5-base"
            }
        }
    
    def _make_request(self, model_id: str, payload: Dict[str, Any], max_retries: int = 3) -> Dict[str, Any]:
        """Make request to Hugging Face API with retry logic"""
        url = f"{self.api_base}/models/{model_id}"
        
        for attempt in range(max_retries):
            try:
                response = requests.post(url, headers=self.headers, json=payload, timeout=60)
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 503:
                    # Model is loading, wait and retry
                    wait_time = 2 ** attempt + random.uniform(0, 1)
                    logger.info(f"Model loading, waiting {wait_time:.2f}s before retry {attempt + 1}")
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"API request failed: {response.status_code} - {response.text}")
                    return {"error": f"API request failed: {response.status_code}"}
                    
            except requests.exceptions.RequestException as e:
                logger.error(f"Request exception: {str(e)}")
                if attempt == max_retries - 1:
                    return {"error": f"Request failed: {str(e)}"}
                time.sleep(2 ** attempt)
        
        return {"error": "Max retries exceeded"}
    
    def generate_text(self, prompt: str, model: str = "mistral", **kwargs) -> Dict[str, Any]:
        """Generate text using specified model"""
        if not self.api_key:
            return {"error": "Hugging Face API key not configured"}
        
        model_id = self.models["text_generation"].get(model)
        if not model_id:
            return {"error": f"Unknown text generation model: {model}"}
        
        # Prepare payload
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": kwargs.get("max_tokens", 280),
                "temperature": kwargs.get("temperature", 0.7),
                "top_p": kwargs.get("top_p", 0.9),
                "do_sample": kwargs.get("do_sample", True),
                "return_full_text": False
            }
        }
        
        result = self._make_request(model_id, payload)
        
        if "error" in result:
            return result
        
        # Extract generated text
        if isinstance(result, list) and len(result) > 0:
            generated_text = result[0].get("generated_text", "")
        else:
            generated_text = result.get("generated_text", "")
        
        return {
            "content": generated_text.strip(),
            "model": model,
            "model_id": model_id,
            "timestamp": datetime.now().isoformat(),
            "parameters": payload["parameters"]
        }
    
    def generate_social_media_content(self, topic: str, platform: str = "twitter", 
                                    tone: str = "professional", **kwargs) -> Dict[str, Any]:
        """Generate platform-specific social media content"""
        
        # Platform-specific constraints
        platform_limits = {
            "twitter": 280,
            "linkedin": 3000,
            "facebook": 2000,
            "instagram": 2200
        }
        
        max_length = platform_limits.get(platform, 280)
        
        # Craft platform-specific prompt
        prompts = {
            "twitter": f"Write a {tone} tweet about {topic}. Keep it under {max_length} characters, engaging, and include relevant hashtags.",
            "linkedin": f"Write a {tone} LinkedIn post about {topic}. Make it professional and engaging.",
            "facebook": f"Write a {tone} Facebook post about {topic}. Make it conversational and engaging.",
            "instagram": f"Write a {tone} Instagram caption about {topic}. Make it visual and engaging with hashtags."
        }
        
        prompt = prompts.get(platform, prompts["twitter"])
        
        # Add context if provided
        if "context" in kwargs:
            prompt += f" Context: {kwargs['context']}"
        
        # Add market sentiment if provided
        if "market_sentiment" in kwargs:
            prompt += f" Current market sentiment: {kwargs['market_sentiment']}"
        
        result = self.generate_text(prompt, kwargs.get("model", "mistral"), max_tokens=max_length)
        
        if "error" not in result:
            result["platform"] = platform
            result["tone"] = tone
            result["topic"] = topic
            result["character_count"] = len(result["content"])
            result["within_limit"] = len(result["content"]) <= max_length
        
        return result
    
    def generate_image(self, prompt: str, model: str = "stable_diffusion", **kwargs) -> Dict[str, Any]:
        """Generate image using specified model"""
        if not self.api_key:
            return {"error": "Hugging Face API key not configured"}
        
        model_id = self.models["image_generation"].get(model)
        if not model_id:
            return {"error": f"Unknown image generation model: {model}"}
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "num_inference_steps": kwargs.get("steps", 20),
                "guidance_scale": kwargs.get("guidance_scale", 7.5),
                "width": kwargs.get("width", 512),
                "height": kwargs.get("height", 512)
            }
        }
        
        result = self._make_request(model_id, payload)
        
        if "error" in result:
            return result
        
        # Handle image response
        if isinstance(result, bytes):
            # Convert bytes to base64
            image_b64 = base64.b64encode(result).decode()
            return {
                "image_data": image_b64,
                "format": "base64",
                "model": model,
                "model_id": model_id,
                "prompt": prompt,
                "timestamp": datetime.now().isoformat()
            }
        
        return {"error": "Unexpected response format"}
    
    def analyze_sentiment(self, text: str, model: str = "roberta") -> Dict[str, Any]:
        """Analyze sentiment of text"""
        if not self.api_key:
            return {"error": "Hugging Face API key not configured"}
        
        model_id = self.models["sentiment_analysis"].get(model)
        if not model_id:
            return {"error": f"Unknown sentiment analysis model: {model}"}
        
        payload = {"inputs": text}
        result = self._make_request(model_id, payload)
        
        if "error" in result:
            return result
        
        # Process sentiment results
        if isinstance(result, list) and len(result) > 0:
            sentiments = result[0] if isinstance(result[0], list) else result
            
            # Normalize sentiment labels
            sentiment_map = {
                "LABEL_0": "negative",
                "LABEL_1": "neutral", 
                "LABEL_2": "positive",
                "NEGATIVE": "negative",
                "NEUTRAL": "neutral",
                "POSITIVE": "positive"
            }
            
            processed_sentiments = []
            for sentiment in sentiments:
                label = sentiment_map.get(sentiment["label"], sentiment["label"].lower())
                processed_sentiments.append({
                    "label": label,
                    "score": sentiment["score"]
                })
            
            return {
                "sentiments": processed_sentiments,
                "primary_sentiment": max(processed_sentiments, key=lambda x: x["score"]),
                "model": model,
                "model_id": model_id,
                "timestamp": datetime.now().isoformat()
            }
        
        return {"error": "Unexpected response format"}
    
    def classify_text(self, text: str, classification_type: str = "emotion") -> Dict[str, Any]:
        """Classify text for various attributes"""
        if not self.api_key:
            return {"error": "Hugging Face API key not configured"}
        
        model_id = self.models["text_classification"].get(classification_type)
        if not model_id:
            return {"error": f"Unknown classification type: {classification_type}"}
        
        payload = {"inputs": text}
        result = self._make_request(model_id, payload)
        
        if "error" in result:
            return result
        
        return {
            "classifications": result,
            "type": classification_type,
            "model_id": model_id,
            "timestamp": datetime.now().isoformat()
        }
    
    def summarize_text(self, text: str, model: str = "bart", max_length: int = 150) -> Dict[str, Any]:
        """Summarize text using specified model"""
        if not self.api_key:
            return {"error": "Hugging Face API key not configured"}
        
        model_id = self.models["summarization"].get(model)
        if not model_id:
            return {"error": f"Unknown summarization model: {model}"}
        
        payload = {
            "inputs": text,
            "parameters": {
                "max_length": max_length,
                "min_length": max_length // 4,
                "do_sample": False
            }
        }
        
        result = self._make_request(model_id, payload)
        
        if "error" in result:
            return result
        
        if isinstance(result, list) and len(result) > 0:
            summary = result[0].get("summary_text", "")
        else:
            summary = result.get("summary_text", "")
        
        return {
            "summary": summary,
            "original_length": len(text),
            "summary_length": len(summary),
            "compression_ratio": len(summary) / len(text) if text else 0,
            "model": model,
            "model_id": model_id,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_available_models(self) -> Dict[str, Any]:
        """Get list of available models"""
        return {
            "models": self.models,
            "api_key_configured": bool(self.api_key),
            "total_models": sum(len(category) for category in self.models.values())
        }
