#!/usr/bin/env python3
"""
Compliance Checker Service
Provides content compliance checking for social media platforms
"""

import os
import logging
import re
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class ComplianceChecker:
    """Content compliance checking service"""
    
    def __init__(self):
        self.platform_rules = self._load_platform_rules()
        self.prohibited_content = self._load_prohibited_content()
        
    def is_healthy(self) -> bool:
        """Check if the service is healthy"""
        return True
    
    def check_text(self, text: str) -> Dict[str, Any]:
        """Check text content for compliance issues"""
        return self.check_content(text, 'twitter', 'text')
    
    def check_content(self, content: str, platform: str = 'twitter', 
                     content_type: str = 'text') -> Dict[str, Any]:
        """Check content compliance with platform policies"""
        try:
            violations = []
            warnings = []
            score = 100  # Start with perfect score
            
            # Check for prohibited content
            prohibited_check = self._check_prohibited_content(content)
            violations.extend(prohibited_check['violations'])
            warnings.extend(prohibited_check['warnings'])
            score -= prohibited_check['penalty']
            
            # Check platform-specific rules
            platform_check = self._check_platform_rules(content, platform, content_type)
            violations.extend(platform_check['violations'])
            warnings.extend(platform_check['warnings'])
            score -= platform_check['penalty']
            
            # Check for spam indicators
            spam_check = self._check_spam_indicators(content)
            violations.extend(spam_check['violations'])
            warnings.extend(spam_check['warnings'])
            score -= spam_check['penalty']
            
            # Determine overall status
            if violations:
                status = 'rejected'
                risk_level = 'high'
            elif warnings:
                status = 'warning'
                risk_level = 'medium'
            else:
                status = 'approved'
                risk_level = 'low'
            
            return {
                'status': status,
                'score': max(0, score),
                'risk_level': risk_level,
                'violations': violations,
                'warnings': warnings,
                'recommendations': self._generate_recommendations(violations, warnings),
                'metadata': {
                    'platform': platform,
                    'content_type': content_type,
                    'checked_at': datetime.utcnow().isoformat(),
                    'content_length': len(content),
                    'word_count': len(content.split())
                }
            }
            
        except Exception as e:
            logger.error(f"Error checking compliance: {str(e)}")
            return {
                'status': 'error',
                'score': 0,
                'risk_level': 'unknown',
                'violations': [],
                'warnings': ['Compliance check failed'],
                'recommendations': ['Manual review required'],
                'metadata': {
                    'platform': platform,
                    'content_type': content_type,
                    'checked_at': datetime.utcnow().isoformat(),
                    'error': str(e)
                }
            }
    
    def _load_platform_rules(self) -> Dict[str, Dict[str, Any]]:
        """Load platform-specific rules"""
        return {
            'twitter': {
                'max_length': 280,
                'max_hashtags': 10,
                'max_mentions': 10,
                'prohibited_patterns': [
                    r'follow\s+for\s+follow',
                    r'f4f',
                    r'like\s+for\s+like',
                    r'l4l'
                ]
            },
            'facebook': {
                'max_length': 63206,
                'max_hashtags': 30,
                'max_mentions': 50,
                'prohibited_patterns': []
            },
            'instagram': {
                'max_length': 2200,
                'max_hashtags': 30,
                'max_mentions': 20,
                'prohibited_patterns': []
            },
            'linkedin': {
                'max_length': 3000,
                'max_hashtags': 5,
                'max_mentions': 10,
                'prohibited_patterns': []
            }
        }
    
    def _load_prohibited_content(self) -> Dict[str, List[str]]:
        """Load prohibited content patterns"""
        return {
            'spam_keywords': [
                'get rich quick', 'make money fast', 'guaranteed profit',
                'no risk', 'limited time offer', 'act now', 'urgent',
                'free money', 'easy money', 'instant profit'
            ],
            'scam_indicators': [
                'send me', 'dm me', 'private message', 'whatsapp me',
                'telegram me', 'contact me for', 'investment opportunity',
                'double your money', 'guaranteed returns'
            ],
            'inappropriate_content': [
                'hate speech', 'harassment', 'bullying', 'discrimination',
                'violence', 'illegal activities', 'adult content'
            ],
            'financial_advice': [
                'financial advice', 'investment advice', 'buy now',
                'sell now', 'guaranteed profit', 'sure thing',
                'can\'t lose', 'risk free'
            ]
        }
    
    def _check_prohibited_content(self, content: str) -> Dict[str, Any]:
        """Check for prohibited content patterns"""
        violations = []
        warnings = []
        penalty = 0
        
        content_lower = content.lower()
        
        # Check spam keywords
        for keyword in self.prohibited_content['spam_keywords']:
            if keyword in content_lower:
                violations.append(f"Contains spam keyword: '{keyword}'")
                penalty += 30
        
        # Check scam indicators
        for indicator in self.prohibited_content['scam_indicators']:
            if indicator in content_lower:
                violations.append(f"Contains scam indicator: '{indicator}'")
                penalty += 40
        
        # Check for financial advice disclaimers
        financial_terms = self.prohibited_content['financial_advice']
        has_financial_content = any(term in content_lower for term in financial_terms)
        has_disclaimer = any(disclaimer in content_lower for disclaimer in [
            'not financial advice', 'nfa', 'dyor', 'do your own research'
        ])
        
        if has_financial_content and not has_disclaimer:
            warnings.append("Financial content should include disclaimer (NFA/DYOR)")
            penalty += 10
        
        return {
            'violations': violations,
            'warnings': warnings,
            'penalty': penalty
        }
    
    def _check_platform_rules(self, content: str, platform: str, content_type: str) -> Dict[str, Any]:
        """Check platform-specific rules"""
        violations = []
        warnings = []
        penalty = 0
        
        rules = self.platform_rules.get(platform, {})
        
        # Check length limits
        max_length = rules.get('max_length', 280)
        if len(content) > max_length:
            violations.append(f"Content exceeds {platform} length limit ({len(content)}/{max_length})")
            penalty += 20
        
        # Check hashtag limits
        hashtag_count = content.count('#')
        max_hashtags = rules.get('max_hashtags', 10)
        if hashtag_count > max_hashtags:
            violations.append(f"Too many hashtags ({hashtag_count}/{max_hashtags})")
            penalty += 15
        
        # Check mention limits
        mention_count = content.count('@')
        max_mentions = rules.get('max_mentions', 10)
        if mention_count > max_mentions:
            violations.append(f"Too many mentions ({mention_count}/{max_mentions})")
            penalty += 15
        
        # Check prohibited patterns
        for pattern in rules.get('prohibited_patterns', []):
            if re.search(pattern, content, re.IGNORECASE):
                violations.append(f"Contains prohibited pattern: {pattern}")
                penalty += 25
        
        return {
            'violations': violations,
            'warnings': warnings,
            'penalty': penalty
        }
    
    def _check_spam_indicators(self, content: str) -> Dict[str, Any]:
        """Check for spam indicators"""
        violations = []
        warnings = []
        penalty = 0
        
        # Check for excessive capitalization
        caps_ratio = sum(1 for c in content if c.isupper()) / max(1, len(content))
        if caps_ratio > 0.5:
            warnings.append("Excessive use of capital letters")
            penalty += 10
        
        # Check for excessive punctuation
        punct_count = sum(1 for c in content if c in '!?.')
        if punct_count > 5:
            warnings.append("Excessive punctuation usage")
            penalty += 5
        
        # Check for repeated characters
        if re.search(r'(.)\1{3,}', content):
            warnings.append("Contains repeated characters")
            penalty += 5
        
        # Check for excessive emojis
        emoji_count = len([c for c in content if ord(c) > 127])
        if emoji_count > 10:
            warnings.append("Excessive emoji usage")
            penalty += 5
        
        # Check for URL shorteners (potential spam)
        url_shorteners = ['bit.ly', 'tinyurl', 't.co', 'goo.gl', 'ow.ly']
        for shortener in url_shorteners:
            if shortener in content.lower():
                warnings.append(f"Contains URL shortener: {shortener}")
                penalty += 5
        
        return {
            'violations': violations,
            'warnings': warnings,
            'penalty': penalty
        }
    
    def _generate_recommendations(self, violations: List[str], warnings: List[str]) -> List[str]:
        """Generate recommendations based on violations and warnings"""
        recommendations = []
        
        if violations:
            recommendations.append("Content requires revision before posting")
            recommendations.append("Remove prohibited content and spam indicators")
        
        if warnings:
            recommendations.append("Consider addressing warnings to improve content quality")
        
        if not violations and not warnings:
            recommendations.append("Content meets compliance standards")
            recommendations.append("Safe to post on selected platform")
        
        # Add general recommendations
        recommendations.extend([
            "Always include appropriate disclaimers for financial content",
            "Ensure content provides value to your audience",
            "Follow platform community guidelines"
        ])
        
        return recommendations
