#!/usr/bin/env python3
"""
Image Generator Service
Provides AI-powered image generation for social media
"""

import os
import logging
import requests
import base64
import io
from typing import Dict, List, Optional, Any
from datetime import datetime
from PIL import Image

logger = logging.getLogger(__name__)

class ImageGenerator:
    """AI-powered image generation service"""
    
    def __init__(self):
        self.huggingface_api_key = os.getenv('HUGGINGFACE_API_KEY')
        self.api_base_url = "https://api-inference.huggingface.co/models"
        self.headers = {
            "Authorization": f"Bearer {self.huggingface_api_key}",
            "Content-Type": "application/json"
        }
        
    def is_healthy(self) -> bool:
        """Check if the service is healthy"""
        return bool(self.huggingface_api_key)
    
    def generate_image(self, prompt: str, style: str = 'modern', 
                      size: str = '1024x1024', quality: str = 'standard') -> Dict[str, Any]:
        """Generate image using Hugging Face models"""
        try:
            # Enhance prompt based on style
            enhanced_prompt = self._enhance_prompt(prompt, style)
            
            # Use Stable Diffusion model
            model_url = f"{self.api_base_url}/runwayml/stable-diffusion-v1-5"
            
            payload = {
                "inputs": enhanced_prompt,
                "parameters": {
                    "guidance_scale": 7.5,
                    "num_inference_steps": 50,
                    "width": int(size.split('x')[0]),
                    "height": int(size.split('x')[1])
                }
            }
            
            response = requests.post(model_url, headers=self.headers, json=payload)
            
            if response.status_code == 200:
                # Convert response to base64
                image_bytes = response.content
                image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                
                return {
                    'success': True,
                    'image_data': image_base64,
                    'url': f"data:image/png;base64,{image_base64}",
                    'metadata': {
                        'prompt': enhanced_prompt,
                        'style': style,
                        'size': size,
                        'quality': quality,
                        'generated_at': datetime.utcnow().isoformat(),
                        'model': 'stable-diffusion-v1-5'
                    },
                    'format': 'png'
                }
            else:
                # Fallback to placeholder image
                return self._generate_placeholder_image(prompt, style, size)
                
        except Exception as e:
            logger.error(f"Error generating image: {str(e)}")
            # Fallback to placeholder image
            return self._generate_placeholder_image(prompt, style, size)
    
    def _enhance_prompt(self, prompt: str, style: str) -> str:
        """Enhance the prompt with style-specific instructions"""
        style_modifiers = {
            'modern': 'modern, clean, minimalist, high quality, professional',
            'artistic': 'artistic, creative, expressive, vibrant colors, unique style',
            'professional': 'professional, business, corporate, clean, polished',
            'vintage': 'vintage, retro, classic, aged, nostalgic',
            'futuristic': 'futuristic, sci-fi, high-tech, digital, advanced',
            'natural': 'natural, organic, earth tones, realistic, photography'
        }
        
        modifier = style_modifiers.get(style, style_modifiers['modern'])
        enhanced_prompt = f"{prompt}, {modifier}, 4k, detailed, high resolution"
        
        return enhanced_prompt
    
    def _generate_placeholder_image(self, prompt: str, style: str, size: str) -> Dict[str, Any]:
        """Generate a placeholder image when AI models are unavailable"""
        try:
            # Parse size
            width, height = map(int, size.split('x'))
            
            # Create a simple colored image with text
            img = Image.new('RGB', (width, height), color='#f0f0f0')
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return {
                'success': True,
                'image_data': image_base64,
                'url': f"data:image/png;base64,{image_base64}",
                'metadata': {
                    'prompt': prompt,
                    'style': style,
                    'size': size,
                    'generated_at': datetime.utcnow().isoformat(),
                    'model': 'placeholder_generator'
                },
                'format': 'png',
                'note': 'Placeholder image generated due to service unavailability'
            }
            
        except Exception as e:
            logger.error(f"Error generating placeholder image: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to generate image',
                'metadata': {
                    'prompt': prompt,
                    'style': style,
                    'size': size,
                    'generated_at': datetime.utcnow().isoformat()
                }
            }
