#!/usr/bin/env python3
"""
Content Generator Service
Provides AI-powered content generation for social media
"""

import os
import logging
import requests
import json
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class ContentGenerator:
    """AI-powered content generation service"""
    
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
    
    def generate_text(self, prompt: str, content_type: str = 'general', 
                     tone: str = 'professional', max_length: int = 280,
                     include_hashtags: bool = True, include_emojis: bool = False,
                     target_audience: str = 'general') -> Dict[str, Any]:
        """Generate text content using Hugging Face models"""
        try:
            # Enhance prompt based on parameters
            enhanced_prompt = self._enhance_prompt(
                prompt, content_type, tone, target_audience, max_length
            )
            
            # Use Hugging Face text generation model
            model_url = f"{self.api_base_url}/microsoft/DialoGPT-medium"
            
            payload = {
                "inputs": enhanced_prompt,
                "parameters": {
                    "max_length": max_length,
                    "temperature": 0.7,
                    "do_sample": True,
                    "top_p": 0.9
                }
            }
            
            response = requests.post(model_url, headers=self.headers, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                generated_text = result[0]['generated_text'] if result else enhanced_prompt
                
                # Clean and format the generated text
                content = self._clean_generated_text(generated_text, enhanced_prompt)
                
                # Add hashtags if requested
                if include_hashtags:
                    content = self._add_hashtags(content, content_type)
                
                # Add emojis if requested
                if include_emojis:
                    content = self._add_emojis(content, tone)
                
                return {
                    'content': content,
                    'metadata': {
                        'content_type': content_type,
                        'tone': tone,
                        'target_audience': target_audience,
                        'character_count': len(content),
                        'word_count': len(content.split()),
                        'generated_at': datetime.utcnow().isoformat(),
                        'model': 'microsoft/DialoGPT-medium'
                    },
                    'quality_score': self._calculate_quality_score(content),
                    'suggestions': self._generate_suggestions(content)
                }
            else:
                # Fallback to template-based generation
                return self._generate_fallback_content(
                    prompt, content_type, tone, max_length, include_hashtags, include_emojis
                )
                
        except Exception as e:
            logger.error(f"Error generating text: {str(e)}")
            # Fallback to template-based generation
            return self._generate_fallback_content(
                prompt, content_type, tone, max_length, include_hashtags, include_emojis
            )
    
    def optimize_content(self, content: str, platform: str = 'twitter',
                        target_audience: str = 'general', 
                        goals: List[str] = None) -> Dict[str, Any]:
        """Optimize existing content for better engagement"""
        if goals is None:
            goals = ['engagement']
        
        try:
            # Analyze current content
            analysis = self._analyze_content(content)
            
            # Generate optimization suggestions
            suggestions = self._generate_optimization_suggestions(
                content, platform, target_audience, goals, analysis
            )
            
            # Create optimized version
            optimized_content = self._apply_optimizations(content, suggestions)
            
            return {
                'original_content': content,
                'optimized_content': optimized_content,
                'improvements': suggestions,
                'analysis': analysis,
                'optimization_score': self._calculate_optimization_score(content, optimized_content)
            }
            
        except Exception as e:
            logger.error(f"Error optimizing content: {str(e)}")
            return {
                'original_content': content,
                'optimized_content': content,
                'improvements': [],
                'analysis': {},
                'optimization_score': 0.0
            }
    
    def _enhance_prompt(self, prompt: str, content_type: str, tone: str, 
                       target_audience: str, max_length: int) -> str:
        """Enhance the prompt with context and instructions"""
        context = f"Create a {tone} {content_type} post for {target_audience} audience. "
        context += f"Maximum {max_length} characters. Topic: {prompt}"
        return context
    
    def _clean_generated_text(self, generated_text: str, original_prompt: str) -> str:
        """Clean and format generated text"""
        # Remove the original prompt from the generated text
        if generated_text.startswith(original_prompt):
            content = generated_text[len(original_prompt):].strip()
        else:
            content = generated_text.strip()
        
        # Remove any unwanted characters or formatting
        content = content.replace('\n\n', '\n').strip()
        
        # Ensure it's not too long
        if len(content) > 280:
            content = content[:277] + "..."
        
        return content
    
    def _add_hashtags(self, content: str, content_type: str) -> str:
        """Add relevant hashtags to content"""
        hashtag_map = {
            'crypto': ['#Crypto', '#Blockchain', '#Bitcoin'],
            'trading': ['#Trading', '#Forex', '#Investment'],
            'tech': ['#Tech', '#Innovation', '#AI'],
            'business': ['#Business', '#Entrepreneur', '#Success'],
            'general': ['#SocialMedia', '#Content', '#Engagement']
        }
        
        hashtags = hashtag_map.get(content_type, hashtag_map['general'])
        
        # Add 1-3 hashtags
        selected_hashtags = hashtags[:2]
        
        if len(content) + len(' '.join(selected_hashtags)) + 1 <= 280:
            content += ' ' + ' '.join(selected_hashtags)
        
        return content
    
    def _add_emojis(self, content: str, tone: str) -> str:
        """Add relevant emojis to content"""
        emoji_map = {
            'professional': ['📊', '💼', '📈'],
            'casual': ['😊', '👍', '🎉'],
            'bullish': ['🚀', '📈', '💪'],
            'bearish': ['📉', '⚠️', '🔍']
        }
        
        emojis = emoji_map.get(tone, emoji_map['professional'])
        
        # Add 1-2 emojis
        if len(content) + 3 <= 280:
            content = emojis[0] + ' ' + content
        
        return content
    
    def _calculate_quality_score(self, content: str) -> float:
        """Calculate quality score for generated content"""
        score = 0.5  # Base score
        
        # Length optimization
        if 100 <= len(content) <= 250:
            score += 0.2
        
        # Word count
        word_count = len(content.split())
        if 10 <= word_count <= 40:
            score += 0.1
        
        # Has hashtags
        if '#' in content:
            score += 0.1
        
        # No excessive punctuation
        if content.count('!') <= 2 and content.count('?') <= 1:
            score += 0.1
        
        return min(1.0, score)
    
    def _generate_suggestions(self, content: str) -> List[str]:
        """Generate improvement suggestions for content"""
        suggestions = []
        
        if len(content) < 50:
            suggestions.append("Consider expanding the content for better engagement")
        
        if len(content) > 250:
            suggestions.append("Consider shortening the content for better readability")
        
        if '#' not in content:
            suggestions.append("Add relevant hashtags to increase discoverability")
        
        if not any(char in content for char in ['!', '?', '.']):
            suggestions.append("Add punctuation to improve readability")
        
        return suggestions
    
    def _generate_fallback_content(self, prompt: str, content_type: str, tone: str,
                                  max_length: int, include_hashtags: bool, 
                                  include_emojis: bool) -> Dict[str, Any]:
        """Generate fallback content when AI models are unavailable"""
        templates = {
            'crypto': {
                'professional': f"Analysis of {prompt}: Market conditions show interesting developments. Key indicators suggest continued monitoring is recommended.",
                'bullish': f"🚀 {prompt} showing strong momentum! Technical analysis suggests potential breakout ahead.",
                'bearish': f"⚠️ {prompt} facing headwinds. Important to stay cautious and manage risk properly."
            },
            'general': {
                'professional': f"Insights on {prompt}: Current trends indicate significant opportunities for strategic positioning.",
                'casual': f"Thoughts on {prompt}: Really interesting developments happening right now! 🤔",
                'bullish': f"Excited about {prompt}! The fundamentals look solid and momentum is building. 📈"
            }
        }
        
        content_templates = templates.get(content_type, templates['general'])
        content = content_templates.get(tone, content_templates['professional'])
        
        # Add hashtags if requested
        if include_hashtags:
            content = self._add_hashtags(content, content_type)
        
        # Add emojis if requested
        if include_emojis:
            content = self._add_emojis(content, tone)
        
        # Ensure length constraint
        if len(content) > max_length:
            content = content[:max_length-3] + "..."
        
        return {
            'content': content,
            'metadata': {
                'content_type': content_type,
                'tone': tone,
                'character_count': len(content),
                'word_count': len(content.split()),
                'generated_at': datetime.utcnow().isoformat(),
                'model': 'fallback_template'
            },
            'quality_score': self._calculate_quality_score(content),
            'suggestions': self._generate_suggestions(content)
        }
    
    def _analyze_content(self, content: str) -> Dict[str, Any]:
        """Analyze content for optimization"""
        return {
            'character_count': len(content),
            'word_count': len(content.split()),
            'hashtag_count': content.count('#'),
            'mention_count': content.count('@'),
            'emoji_count': len([c for c in content if ord(c) > 127]),
            'readability_score': self._calculate_readability(content)
        }
    
    def _calculate_readability(self, content: str) -> float:
        """Calculate readability score"""
        words = content.split()
        if not words:
            return 0.0
        
        avg_word_length = sum(len(word) for word in words) / len(words)
        
        # Optimal average word length is around 4-6 characters
        if 4 <= avg_word_length <= 6:
            return 0.9
        elif 3 <= avg_word_length <= 7:
            return 0.7
        else:
            return 0.5
    
    def _generate_optimization_suggestions(self, content: str, platform: str,
                                         target_audience: str, goals: List[str],
                                         analysis: Dict[str, Any]) -> List[str]:
        """Generate optimization suggestions"""
        suggestions = []
        
        if 'engagement' in goals:
            if analysis['hashtag_count'] == 0:
                suggestions.append("Add relevant hashtags to increase discoverability")
            if analysis['emoji_count'] == 0:
                suggestions.append("Consider adding emojis to make content more engaging")
        
        if platform == 'twitter' and analysis['character_count'] > 250:
            suggestions.append("Shorten content for better Twitter engagement")
        
        if analysis['readability_score'] < 0.7:
            suggestions.append("Simplify language for better readability")
        
        return suggestions
    
    def _apply_optimizations(self, content: str, suggestions: List[str]) -> str:
        """Apply optimization suggestions to content"""
        optimized = content
        
        # This is a simplified implementation
        # In a real system, this would apply more sophisticated optimizations
        
        if "Add relevant hashtags" in ' '.join(suggestions):
            optimized = self._add_hashtags(optimized, 'general')
        
        if "Consider adding emojis" in ' '.join(suggestions):
            optimized = self._add_emojis(optimized, 'professional')
        
        return optimized
    
    def _calculate_optimization_score(self, original: str, optimized: str) -> float:
        """Calculate optimization improvement score"""
        original_score = self._calculate_quality_score(original)
        optimized_score = self._calculate_quality_score(optimized)
        
        return max(0.0, optimized_score - original_score)
