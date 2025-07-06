#!/usr/bin/env python3
"""
Compliant Content Service
Generates high-quality content for manual posting with compliance safeguards
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import hashlib
import re

from .huggingface_service import HuggingFaceService

logger = logging.getLogger(__name__)

class CompliantContentService:
    """Service for generating compliant, high-quality content for manual posting"""
    
    def __init__(self):
        self.hf_service = HuggingFaceService()
        
        # Content guidelines and compliance rules
        self.content_guidelines = {
            "max_hashtags": 5,
            "min_content_length": 10,
            "max_content_length": 280,
            "prohibited_words": [
                "guaranteed", "100%", "risk-free", "get rich quick",
                "pump", "dump", "moon", "lambo", "diamond hands"
            ],
            "required_disclaimers": {
                "financial": "Not financial advice. DYOR.",
                "crypto": "Crypto investments are risky.",
                "trading": "Trading involves risk of loss."
            }
        }
        
        # Content templates for different purposes
        self.content_templates = {
            "market_analysis": [
                "📊 Market Analysis: {analysis}\n\n{disclaimer}\n\n{hashtags}",
                "🔍 Looking at {topic}: {analysis}\n\n{disclaimer}\n\n{hashtags}",
                "📈 {topic} Update: {analysis}\n\n{disclaimer}\n\n{hashtags}"
            ],
            "educational": [
                "💡 Did you know? {content}\n\n{hashtags}",
                "🎓 Learning moment: {content}\n\n{hashtags}",
                "📚 Education thread: {content}\n\n{hashtags}"
            ],
            "news_commentary": [
                "📰 News: {news}\n\nThoughts: {commentary}\n\n{hashtags}",
                "🗞️ Breaking: {news}\n\n💭 {commentary}\n\n{hashtags}"
            ],
            "general": [
                "{content}\n\n{hashtags}",
                "💭 {content}\n\n{hashtags}"
            ]
        }
    
    def generate_compliant_content(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate compliant content with built-in safeguards"""
        
        try:
            # Extract request parameters
            topic = request.get("topic", "")
            content_type = request.get("type", "general")
            tone = request.get("tone", "professional")
            platform = request.get("platform", "twitter")
            context = request.get("context", {})
            
            # Validate request
            validation_result = self._validate_request(request)
            if not validation_result["valid"]:
                return {"error": validation_result["message"]}
            
            # Generate base content
            content_result = self._generate_base_content(topic, content_type, tone, context)
            if "error" in content_result:
                return content_result
            
            # Apply compliance checks and enhancements
            enhanced_content = self._enhance_content(content_result, request)
            
            # Generate variations
            variations = self._generate_variations(enhanced_content, request)
            
            # Calculate quality score
            quality_score = self._calculate_quality_score(enhanced_content)
            
            # Generate hashtags
            hashtags = self._generate_hashtags(topic, content_type, context)
            
            # Format final content
            final_content = self._format_content(enhanced_content, hashtags, content_type)
            
            return {
                "content": final_content,
                "variations": variations,
                "hashtags": hashtags,
                "quality_score": quality_score,
                "compliance_score": self._calculate_compliance_score(final_content),
                "metadata": {
                    "topic": topic,
                    "type": content_type,
                    "tone": tone,
                    "platform": platform,
                    "character_count": len(final_content),
                    "word_count": len(final_content.split()),
                    "generated_at": datetime.now().isoformat(),
                    "model_used": "huggingface_enhanced"
                },
                "suggestions": self._generate_suggestions(final_content, request),
                "posting_recommendations": self._generate_posting_recommendations(context)
            }
            
        except Exception as e:
            logger.error(f"Content generation failed: {str(e)}")
            return {"error": f"Content generation failed: {str(e)}"}
    
    def _validate_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Validate content generation request"""
        
        topic = request.get("topic", "").strip()
        if not topic or len(topic) < 3:
            return {"valid": False, "message": "Topic must be at least 3 characters long"}
        
        content_type = request.get("type", "general")
        if content_type not in self.content_templates:
            return {"valid": False, "message": f"Invalid content type: {content_type}"}
        
        # Check for prohibited content
        prohibited_check = self._check_prohibited_content(topic)
        if not prohibited_check["allowed"]:
            return {"valid": False, "message": prohibited_check["reason"]}
        
        return {"valid": True, "message": "Request is valid"}
    
    def _check_prohibited_content(self, text: str) -> Dict[str, Any]:
        """Check if content contains prohibited elements"""
        
        text_lower = text.lower()
        
        # Check for prohibited words
        for word in self.content_guidelines["prohibited_words"]:
            if word.lower() in text_lower:
                return {
                    "allowed": False,
                    "reason": f"Contains prohibited term: {word}"
                }
        
        # Check for spam patterns
        if len(set(text.split())) / len(text.split()) < 0.5:  # Too repetitive
            return {
                "allowed": False,
                "reason": "Content appears to be spam or too repetitive"
            }
        
        return {"allowed": True, "reason": "Content is acceptable"}
    
    def _generate_base_content(self, topic: str, content_type: str, tone: str, context: Dict) -> Dict[str, Any]:
        """Generate base content using Hugging Face"""
        
        # Craft context-aware prompt
        prompt = self._create_prompt(topic, content_type, tone, context)
        
        # Generate content using Hugging Face
        result = self.hf_service.generate_social_media_content(
            topic=topic,
            platform="twitter",
            tone=tone,
            context=context.get("market_context", ""),
            model="mistral",
            max_tokens=200,
            temperature=0.7
        )
        
        if "error" in result:
            # Fallback to template-based generation
            return self._generate_template_content(topic, content_type, tone, context)
        
        return result
    
    def _create_prompt(self, topic: str, content_type: str, tone: str, context: Dict) -> str:
        """Create context-aware prompt for content generation"""
        
        base_prompts = {
            "market_analysis": f"Analyze the current market situation regarding {topic}. Provide insights in a {tone} tone.",
            "educational": f"Explain {topic} in an educational and informative way. Use a {tone} tone.",
            "news_commentary": f"Provide thoughtful commentary on recent news about {topic}. Use a {tone} tone.",
            "general": f"Create engaging content about {topic}. Use a {tone} tone."
        }
        
        prompt = base_prompts.get(content_type, base_prompts["general"])
        
        # Add context if available
        if context.get("market_sentiment"):
            prompt += f" Current market sentiment is {context['market_sentiment']}."
        
        if context.get("trending_topics"):
            prompt += f" Consider these trending topics: {', '.join(context['trending_topics'][:3])}."
        
        prompt += " Keep it under 200 characters, engaging, and appropriate for social media."
        
        return prompt
    
    def _generate_template_content(self, topic: str, content_type: str, tone: str, context: Dict) -> Dict[str, Any]:
        """Fallback template-based content generation"""
        
        templates = {
            "market_analysis": f"Interesting developments in {topic} today. Market dynamics are shifting.",
            "educational": f"Understanding {topic}: Key concepts and insights for everyone.",
            "news_commentary": f"Latest news on {topic} brings important considerations.",
            "general": f"Thoughts on {topic} and its current relevance."
        }
        
        content = templates.get(content_type, templates["general"])
        
        return {
            "content": content,
            "model": "template",
            "timestamp": datetime.now().isoformat()
        }
    
    def _enhance_content(self, content_result: Dict[str, Any], request: Dict[str, Any]) -> str:
        """Enhance content with compliance and quality improvements"""
        
        content = content_result.get("content", "")
        
        # Clean up content
        content = self._clean_content(content)
        
        # Add appropriate disclaimers
        content = self._add_disclaimers(content, request.get("topic", ""))
        
        # Ensure proper length
        content = self._adjust_length(content, request.get("platform", "twitter"))
        
        return content
    
    def _clean_content(self, content: str) -> str:
        """Clean and format content"""
        
        # Remove excessive whitespace
        content = re.sub(r'\s+', ' ', content).strip()
        
        # Remove prohibited words
        for word in self.content_guidelines["prohibited_words"]:
            content = re.sub(rf'\b{re.escape(word)}\b', '', content, flags=re.IGNORECASE)
        
        # Clean up punctuation
        content = re.sub(r'[.]{2,}', '...', content)
        content = re.sub(r'[!]{2,}', '!', content)
        content = re.sub(r'[?]{2,}', '?', content)
        
        return content.strip()
    
    def _add_disclaimers(self, content: str, topic: str) -> str:
        """Add appropriate disclaimers based on content topic"""
        
        topic_lower = topic.lower()
        
        if any(word in topic_lower for word in ["crypto", "bitcoin", "trading", "investment"]):
            if "not financial advice" not in content.lower():
                content += "\n\n" + self.content_guidelines["required_disclaimers"]["financial"]
        
        return content
    
    def _adjust_length(self, content: str, platform: str) -> str:
        """Adjust content length for platform requirements"""
        
        limits = {"twitter": 280, "linkedin": 3000, "facebook": 2000}
        max_length = limits.get(platform, 280)
        
        if len(content) > max_length:
            # Truncate while preserving word boundaries
            content = content[:max_length-3].rsplit(' ', 1)[0] + "..."
        
        return content
    
    def _generate_variations(self, content: str, request: Dict[str, Any]) -> List[str]:
        """Generate content variations"""
        
        variations = []
        
        # Generate 2-3 variations with different approaches
        for i in range(2):
            # Modify tone slightly
            modified_request = request.copy()
            modified_request["tone"] = ["casual", "professional", "enthusiastic"][i % 3]
            
            variation_result = self.hf_service.generate_social_media_content(
                topic=request.get("topic", ""),
                platform=request.get("platform", "twitter"),
                tone=modified_request["tone"],
                model="zephyr",
                max_tokens=200
            )
            
            if "error" not in variation_result:
                variations.append(variation_result["content"])
        
        return variations[:3]  # Limit to 3 variations
    
    def _generate_hashtags(self, topic: str, content_type: str, context: Dict) -> List[str]:
        """Generate relevant hashtags"""
        
        hashtags = []
        
        # Topic-based hashtags
        topic_words = topic.lower().split()
        for word in topic_words:
            if len(word) > 3:
                hashtags.append(f"#{word.capitalize()}")
        
        # Content type hashtags
        type_hashtags = {
            "market_analysis": ["#MarketAnalysis", "#Trading", "#Crypto"],
            "educational": ["#Education", "#Learning", "#Knowledge"],
            "news_commentary": ["#News", "#Analysis", "#Commentary"],
            "general": ["#Thoughts", "#Insights"]
        }
        
        hashtags.extend(type_hashtags.get(content_type, [])[:2])
        
        # Trending hashtags from context
        if context.get("trending_hashtags"):
            hashtags.extend(context["trending_hashtags"][:2])
        
        # Limit and clean hashtags
        hashtags = list(set(hashtags))[:self.content_guidelines["max_hashtags"]]
        
        return hashtags
    
    def _format_content(self, content: str, hashtags: List[str], content_type: str) -> str:
        """Format final content with template"""
        
        template = self.content_templates[content_type][0]
        
        formatted = template.format(
            content=content,
            analysis=content,
            topic=content,
            news=content,
            commentary=content,
            hashtags=" ".join(hashtags),
            disclaimer=""
        )
        
        return formatted.strip()
    
    def _calculate_quality_score(self, content: str) -> float:
        """Calculate content quality score"""
        
        score = 0.0
        
        # Length score (optimal around 100-200 chars)
        length = len(content)
        if 50 <= length <= 250:
            score += 0.3
        
        # Readability score
        words = content.split()
        avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
        if 4 <= avg_word_length <= 7:
            score += 0.2
        
        # Engagement elements
        if any(char in content for char in "!?"):
            score += 0.1
        if any(emoji in content for emoji in "📊📈💡🔍"):
            score += 0.1
        
        # Structure score
        if "\n" in content:  # Has structure
            score += 0.1
        
        # Uniqueness (no excessive repetition)
        unique_words = len(set(words))
        total_words = len(words)
        if total_words > 0 and unique_words / total_words > 0.7:
            score += 0.2
        
        return min(score, 1.0)
    
    def _calculate_compliance_score(self, content: str) -> float:
        """Calculate compliance score"""
        
        score = 1.0
        
        # Check for prohibited words
        for word in self.content_guidelines["prohibited_words"]:
            if word.lower() in content.lower():
                score -= 0.2
        
        # Check length compliance
        if len(content) > 280:
            score -= 0.1
        
        # Check for appropriate disclaimers
        if any(word in content.lower() for word in ["crypto", "trading", "investment"]):
            if "not financial advice" not in content.lower():
                score -= 0.3
        
        return max(score, 0.0)
    
    def _generate_suggestions(self, content: str, request: Dict[str, Any]) -> List[str]:
        """Generate improvement suggestions"""
        
        suggestions = []
        
        if len(content) < 50:
            suggestions.append("Consider adding more detail to increase engagement")
        
        if not any(char in content for char in "!?"):
            suggestions.append("Add punctuation for better engagement")
        
        if "#" not in content:
            suggestions.append("Consider adding relevant hashtags")
        
        return suggestions
    
    def _generate_posting_recommendations(self, context: Dict) -> Dict[str, Any]:
        """Generate recommendations for optimal posting"""
        
        return {
            "best_times": ["9:00 AM", "3:00 PM", "7:00 PM"],
            "engagement_tips": [
                "Post when your audience is most active",
                "Engage with replies within the first hour",
                "Use relevant hashtags but don't overdo it"
            ],
            "compliance_reminders": [
                "Review content for compliance before posting",
                "Ensure all disclaimers are included",
                "Avoid making financial promises or guarantees"
            ]
        }
