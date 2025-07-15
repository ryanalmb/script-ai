#!/usr/bin/env python3
"""
Enterprise Gemini Integration Package
Provides comprehensive Gemini API integration with advanced features
"""

from .gemini_client import (
    GeminiClient, GeminiModel, GeminiRequest, GeminiResponse,
    MultimodalType, MultimodalContent
)
from .rate_limiter import GeminiRateLimiter, RequestPriority
from .gemini_orchestrator import GeminiOrchestrator, CampaignPlan, ContentPiece

__all__ = [
    'GeminiClient',
    'GeminiModel',
    'GeminiRequest',
    'GeminiResponse',
    'MultimodalType',
    'MultimodalContent',
    'GeminiRateLimiter',
    'RequestPriority',
    'GeminiOrchestrator',
    'CampaignPlan',
    'ContentPiece'
]

__version__ = '1.0.0'
__author__ = 'X Marketing Platform'
__description__ = 'Enterprise-grade Gemini API integration for marketing automation'
