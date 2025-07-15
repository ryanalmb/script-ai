#!/usr/bin/env python3
"""
Advanced Model Router for Gemini 2.5 Enterprise Integration
Intelligent routing and optimization for multimodal AI tasks with performance monitoring
"""

import os
import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import json

from .gemini_client import GeminiClient, GeminiModel, GeminiRequest, MultimodalType
from .rate_limiter import GeminiRateLimiter, RequestPriority

logger = logging.getLogger(__name__)

class TaskComplexity(Enum):
    """Task complexity levels for model selection"""
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    ENTERPRISE = "enterprise"
    RESEARCH = "research"

class TaskType(Enum):
    """Types of tasks for specialized model routing"""
    CONTENT_GENERATION = "content_generation"
    STRATEGIC_PLANNING = "strategic_planning"
    COMPETITIVE_ANALYSIS = "competitive_analysis"
    MULTIMODAL_CREATION = "multimodal_creation"
    PERFORMANCE_OPTIMIZATION = "performance_optimization"
    COMPLIANCE_CHECKING = "compliance_checking"
    MARKET_ANALYSIS = "market_analysis"
    CREATIVE_IDEATION = "creative_ideation"
    DATA_ANALYSIS = "data_analysis"
    REASONING_TASKS = "reasoning_tasks"

@dataclass
class TaskProfile:
    """Profile for task-based model selection"""
    task_type: TaskType
    complexity: TaskComplexity
    multimodal_requirements: List[MultimodalType]
    performance_priority: str  # "speed", "quality", "cost", "balanced"
    context_size: int
    reasoning_required: bool
    real_time_required: bool
    accuracy_critical: bool

@dataclass
class ModelPerformanceMetrics:
    """Performance metrics for model evaluation"""
    model: GeminiModel
    task_type: TaskType
    average_response_time: float
    success_rate: float
    quality_score: float
    cost_efficiency: float
    user_satisfaction: float
    last_updated: datetime
    sample_size: int

class AdvancedModelRouter:
    """Enterprise-grade model router with intelligent selection and optimization"""
    
    def __init__(self, gemini_client: GeminiClient, rate_limiter: GeminiRateLimiter):
        self.gemini_client = gemini_client
        self.rate_limiter = rate_limiter
        
        # Performance tracking
        self.performance_metrics: Dict[str, ModelPerformanceMetrics] = {}
        self.routing_history: List[Dict] = []
        
        # Model selection strategies
        self.model_strategies = self._initialize_model_strategies()
        
        # Dynamic optimization parameters
        self.optimization_config = {
            "performance_weight": 0.3,
            "speed_weight": 0.25,
            "cost_weight": 0.2,
            "availability_weight": 0.15,
            "quality_weight": 0.1,
            "learning_rate": 0.1,
            "min_samples_for_optimization": 10
        }
        
        # Real-time model availability tracking
        self.model_availability: Dict[GeminiModel, bool] = {
            model: True for model in GeminiModel
        }
        
        logger.info("AdvancedModelRouter initialized with enterprise optimization")
    
    def _initialize_model_strategies(self) -> Dict[TaskType, Dict[TaskComplexity, List[GeminiModel]]]:
        """Initialize intelligent model selection strategies"""
        return {
            TaskType.STRATEGIC_PLANNING: {
                TaskComplexity.SIMPLE: [GeminiModel.FLASH_2_5, GeminiModel.PRO_2_5],
                TaskComplexity.MODERATE: [GeminiModel.PRO_2_5, GeminiModel.FLASH_2_5],
                TaskComplexity.COMPLEX: [GeminiModel.PRO_2_5_DEEP_THINK, GeminiModel.PRO_2_5],
                TaskComplexity.ENTERPRISE: [GeminiModel.PRO_2_5_DEEP_THINK],
                TaskComplexity.RESEARCH: [GeminiModel.PRO_2_5_DEEP_THINK]
            },
            TaskType.CONTENT_GENERATION: {
                TaskComplexity.SIMPLE: [GeminiModel.FLASH_2_5, GeminiModel.FLASH_2_0],
                TaskComplexity.MODERATE: [GeminiModel.FLASH_2_5, GeminiModel.PRO_2_5],
                TaskComplexity.COMPLEX: [GeminiModel.PRO_2_5, GeminiModel.FLASH_2_5],
                TaskComplexity.ENTERPRISE: [GeminiModel.PRO_2_5, GeminiModel.PRO_2_5_DEEP_THINK],
                TaskComplexity.RESEARCH: [GeminiModel.PRO_2_5_DEEP_THINK, GeminiModel.PRO_2_5]
            },
            TaskType.MULTIMODAL_CREATION: {
                TaskComplexity.SIMPLE: [GeminiModel.FLASH_2_5, GeminiModel.PRO_2_5],
                TaskComplexity.MODERATE: [GeminiModel.PRO_2_5, GeminiModel.FLASH_2_5],
                TaskComplexity.COMPLEX: [GeminiModel.PRO_2_5, GeminiModel.PRO_2_5_DEEP_THINK],
                TaskComplexity.ENTERPRISE: [GeminiModel.PRO_2_5_DEEP_THINK, GeminiModel.PRO_2_5],
                TaskComplexity.RESEARCH: [GeminiModel.PRO_2_5_DEEP_THINK]
            },
            TaskType.REASONING_TASKS: {
                TaskComplexity.SIMPLE: [GeminiModel.PRO_2_5, GeminiModel.FLASH_2_5],
                TaskComplexity.MODERATE: [GeminiModel.PRO_2_5, GeminiModel.PRO_2_5_DEEP_THINK],
                TaskComplexity.COMPLEX: [GeminiModel.PRO_2_5_DEEP_THINK, GeminiModel.PRO_2_5],
                TaskComplexity.ENTERPRISE: [GeminiModel.PRO_2_5_DEEP_THINK],
                TaskComplexity.RESEARCH: [GeminiModel.PRO_2_5_DEEP_THINK]
            },
            TaskType.COMPETITIVE_ANALYSIS: {
                TaskComplexity.SIMPLE: [GeminiModel.PRO_2_5, GeminiModel.FLASH_2_5],
                TaskComplexity.MODERATE: [GeminiModel.PRO_2_5, GeminiModel.PRO_2_5_DEEP_THINK],
                TaskComplexity.COMPLEX: [GeminiModel.PRO_2_5_DEEP_THINK, GeminiModel.PRO_2_5],
                TaskComplexity.ENTERPRISE: [GeminiModel.PRO_2_5_DEEP_THINK],
                TaskComplexity.RESEARCH: [GeminiModel.PRO_2_5_DEEP_THINK]
            },
            TaskType.PERFORMANCE_OPTIMIZATION: {
                TaskComplexity.SIMPLE: [GeminiModel.FLASH_2_5, GeminiModel.PRO_2_5],
                TaskComplexity.MODERATE: [GeminiModel.PRO_2_5, GeminiModel.FLASH_2_5],
                TaskComplexity.COMPLEX: [GeminiModel.PRO_2_5_DEEP_THINK, GeminiModel.PRO_2_5],
                TaskComplexity.ENTERPRISE: [GeminiModel.PRO_2_5_DEEP_THINK],
                TaskComplexity.RESEARCH: [GeminiModel.PRO_2_5_DEEP_THINK]
            }
        }
    
    async def select_optimal_model(self, task_profile: TaskProfile) -> Tuple[GeminiModel, float]:
        """
        Select optimal model based on task profile and real-time performance data
        Returns: (selected_model, confidence_score)
        """
        # Get candidate models for this task
        candidates = self._get_candidate_models(task_profile)
        
        # Filter by availability
        available_candidates = [
            model for model in candidates 
            if self.model_availability.get(model, False) and 
            self.gemini_client.can_make_request(model)
        ]
        
        if not available_candidates:
            # Fallback to any available model
            available_candidates = [
                model for model in GeminiModel 
                if self.model_availability.get(model, False) and 
                self.gemini_client.can_make_request(model)
            ]
        
        if not available_candidates:
            raise Exception("No models available for request")
        
        # Score each candidate model
        model_scores = {}
        for model in available_candidates:
            score = await self._calculate_model_score(model, task_profile)
            model_scores[model] = score
        
        # Select best model
        best_model = max(model_scores.keys(), key=lambda m: model_scores[m])
        confidence = model_scores[best_model]
        
        # Log routing decision
        self._log_routing_decision(task_profile, best_model, model_scores, confidence)
        
        return best_model, confidence
    
    def _get_candidate_models(self, task_profile: TaskProfile) -> List[GeminiModel]:
        """Get candidate models for task type and complexity"""
        task_strategies = self.model_strategies.get(task_profile.task_type, {})
        candidates = task_strategies.get(task_profile.complexity, [])
        
        # Filter by multimodal requirements
        if task_profile.multimodal_requirements:
            filtered_candidates = []
            for model in candidates:
                model_config = self.gemini_client.models.get(model)
                if model_config and all(
                    req in model_config.multimodal_support 
                    for req in task_profile.multimodal_requirements
                ):
                    filtered_candidates.append(model)
            candidates = filtered_candidates or candidates  # Fallback to original if none match
        
        # Filter by reasoning requirements
        if task_profile.reasoning_required:
            reasoning_candidates = []
            for model in candidates:
                model_config = self.gemini_client.models.get(model)
                if model_config and (model_config.reasoning_enhanced or model_config.deep_think_capable):
                    reasoning_candidates.append(model)
            candidates = reasoning_candidates or candidates  # Fallback if none match
        
        return candidates or [GeminiModel.PRO_2_5]  # Ultimate fallback
    
    async def _calculate_model_score(self, model: GeminiModel, task_profile: TaskProfile) -> float:
        """Calculate comprehensive score for model selection"""
        score = 0.0
        
        # Base model capabilities score
        model_config = self.gemini_client.models.get(model)
        if model_config:
            # Capability matching
            if task_profile.reasoning_required and model_config.reasoning_enhanced:
                score += 0.3
            if task_profile.multimodal_requirements and model_config.multimodal_support:
                matching_types = len(set(task_profile.multimodal_requirements) & set(model_config.multimodal_support))
                score += 0.2 * (matching_types / len(task_profile.multimodal_requirements))
            
            # Context size matching
            if task_profile.context_size <= model_config.context_window:
                score += 0.2
            
            # Priority-based scoring
            if task_profile.performance_priority == "speed" and model_config.specialization in ["fast_multimodal", "general_fast"]:
                score += 0.3
            elif task_profile.performance_priority == "quality" and model_config.specialization in ["enterprise_orchestration", "complex_reasoning"]:
                score += 0.3
        
        # Historical performance score
        performance_key = f"{model.value}_{task_profile.task_type.value}"
        if performance_key in self.performance_metrics:
            metrics = self.performance_metrics[performance_key]
            performance_score = (
                metrics.success_rate * self.optimization_config["performance_weight"] +
                (1.0 - min(metrics.average_response_time / 10.0, 1.0)) * self.optimization_config["speed_weight"] +
                metrics.quality_score * self.optimization_config["quality_weight"] +
                metrics.cost_efficiency * self.optimization_config["cost_weight"]
            )
            score += performance_score * 0.4  # Weight historical performance
        
        # Real-time availability and load
        if self.gemini_client.can_make_request(model):
            score += 0.1
        
        return min(score, 1.0)  # Cap at 1.0
    
    async def execute_with_optimal_routing(self, request: GeminiRequest, 
                                         task_profile: TaskProfile) -> Any:
        """Execute request with optimal model routing and performance tracking"""
        start_time = time.time()
        
        try:
            # Select optimal model
            optimal_model, confidence = await self.select_optimal_model(task_profile)
            
            # Update request with selected model
            request.model = optimal_model
            
            # Execute request
            response = await self.gemini_client.generate_content(request)
            
            # Track performance
            execution_time = time.time() - start_time
            await self._update_performance_metrics(
                optimal_model, task_profile, execution_time, response, True
            )
            
            return response
            
        except Exception as e:
            execution_time = time.time() - start_time
            await self._update_performance_metrics(
                request.model, task_profile, execution_time, None, False
            )
            raise e
    
    async def _update_performance_metrics(self, model: GeminiModel, task_profile: TaskProfile,
                                        execution_time: float, response: Any, success: bool):
        """Update performance metrics for continuous optimization"""
        performance_key = f"{model.value}_{task_profile.task_type.value}"
        
        if performance_key not in self.performance_metrics:
            self.performance_metrics[performance_key] = ModelPerformanceMetrics(
                model=model,
                task_type=task_profile.task_type,
                average_response_time=execution_time,
                success_rate=1.0 if success else 0.0,
                quality_score=response.quality_score if response and hasattr(response, 'quality_score') else 0.0,
                cost_efficiency=1.0,  # Placeholder
                user_satisfaction=0.8,  # Placeholder
                last_updated=datetime.now(),
                sample_size=1
            )
        else:
            metrics = self.performance_metrics[performance_key]
            
            # Update with exponential moving average
            alpha = self.optimization_config["learning_rate"]
            metrics.average_response_time = (1 - alpha) * metrics.average_response_time + alpha * execution_time
            metrics.success_rate = (1 - alpha) * metrics.success_rate + alpha * (1.0 if success else 0.0)
            
            if response and hasattr(response, 'quality_score'):
                metrics.quality_score = (1 - alpha) * metrics.quality_score + alpha * response.quality_score
            
            metrics.last_updated = datetime.now()
            metrics.sample_size += 1
    
    def _log_routing_decision(self, task_profile: TaskProfile, selected_model: GeminiModel,
                            model_scores: Dict[GeminiModel, float], confidence: float):
        """Log routing decision for analysis and optimization"""
        routing_log = {
            "timestamp": datetime.now().isoformat(),
            "task_type": task_profile.task_type.value,
            "complexity": task_profile.complexity.value,
            "selected_model": selected_model.value,
            "confidence": confidence,
            "model_scores": {model.value: score for model, score in model_scores.items()},
            "multimodal_requirements": [req.value for req in task_profile.multimodal_requirements],
            "performance_priority": task_profile.performance_priority
        }
        
        self.routing_history.append(routing_log)
        
        # Keep only recent history (last 1000 decisions)
        if len(self.routing_history) > 1000:
            self.routing_history = self.routing_history[-1000:]
        
        logger.debug(f"Model routing decision: {selected_model.value} for {task_profile.task_type.value} (confidence: {confidence:.3f})")
    
    async def update_model_availability(self):
        """Update real-time model availability"""
        for model in GeminiModel:
            try:
                available = self.gemini_client.can_make_request(model)
                self.model_availability[model] = available
            except Exception as e:
                logger.warning(f"Error checking availability for {model.value}: {e}")
                self.model_availability[model] = False
    
    def get_routing_analytics(self) -> Dict[str, Any]:
        """Get comprehensive routing analytics"""
        return {
            "performance_metrics": {
                key: {
                    "model": metrics.model.value,
                    "task_type": metrics.task_type.value,
                    "average_response_time": metrics.average_response_time,
                    "success_rate": metrics.success_rate,
                    "quality_score": metrics.quality_score,
                    "sample_size": metrics.sample_size,
                    "last_updated": metrics.last_updated.isoformat()
                }
                for key, metrics in self.performance_metrics.items()
            },
            "model_availability": {
                model.value: available 
                for model, available in self.model_availability.items()
            },
            "routing_statistics": self._calculate_routing_statistics(),
            "optimization_config": self.optimization_config
        }
    
    def _calculate_routing_statistics(self) -> Dict[str, Any]:
        """Calculate routing statistics from history"""
        if not self.routing_history:
            return {}
        
        recent_decisions = self.routing_history[-100:]  # Last 100 decisions
        
        model_usage = {}
        task_distribution = {}
        average_confidence = 0.0
        
        for decision in recent_decisions:
            model = decision["selected_model"]
            task = decision["task_type"]
            
            model_usage[model] = model_usage.get(model, 0) + 1
            task_distribution[task] = task_distribution.get(task, 0) + 1
            average_confidence += decision["confidence"]
        
        return {
            "total_decisions": len(recent_decisions),
            "model_usage_distribution": model_usage,
            "task_type_distribution": task_distribution,
            "average_confidence": average_confidence / len(recent_decisions) if recent_decisions else 0.0,
            "optimization_effectiveness": self._calculate_optimization_effectiveness()
        }
    
    def _calculate_optimization_effectiveness(self) -> float:
        """Calculate how effective the optimization is"""
        if len(self.performance_metrics) < 2:
            return 0.0
        
        # Compare recent performance vs historical average
        recent_performance = []
        for metrics in self.performance_metrics.values():
            if metrics.sample_size >= self.optimization_config["min_samples_for_optimization"]:
                score = (metrics.success_rate + metrics.quality_score) / 2
                recent_performance.append(score)
        
        return sum(recent_performance) / len(recent_performance) if recent_performance else 0.0
