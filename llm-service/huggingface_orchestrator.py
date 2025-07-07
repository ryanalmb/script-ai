"""
Hugging Face Multi-Model Orchestrator for X Marketing Platform
Aggressive use of free tier models with intelligent orchestration
"""

import requests
import json
import time
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging
from concurrent.futures import ThreadPoolExecutor
import random

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ModelConfig:
    name: str
    endpoint: str
    max_tokens: int
    rate_limit_per_minute: int
    specialization: str
    priority: int
    last_used: datetime = None
    error_count: int = 0

class HuggingFaceOrchestrator:
    """
    Aggressive multi-model orchestrator using Hugging Face free tier
    Maximizes usage while respecting rate limits
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api-inference.huggingface.co/models"
        self.headers = {"Authorization": f"Bearer {api_key}"}
        
        # Initialize model configurations based on research
        self.models = {
            # Primary Orchestrator - Best for planning and task coordination
            "orchestrator": ModelConfig(
                name="microsoft/DialoGPT-large",
                endpoint=f"{self.base_url}/microsoft/DialoGPT-large",
                max_tokens=1024,
                rate_limit_per_minute=60,
                specialization="conversation_planning",
                priority=1
            ),
            
            # Content Generation Models
            "content_primary": ModelConfig(
                name="microsoft/DialoGPT-medium",
                endpoint=f"{self.base_url}/microsoft/DialoGPT-medium",
                max_tokens=512,
                rate_limit_per_minute=100,
                specialization="content_generation",
                priority=2
            ),
            
            "content_secondary": ModelConfig(
                name="facebook/blenderbot-400M-distill",
                endpoint=f"{self.base_url}/facebook/blenderbot-400M-distill",
                max_tokens=256,
                rate_limit_per_minute=120,
                specialization="social_content",
                priority=3
            ),
            
            # Specialized Models
            "sentiment_analyzer": ModelConfig(
                name="cardiffnlp/twitter-roberta-base-sentiment-latest",
                endpoint=f"{self.base_url}/cardiffnlp/twitter-roberta-base-sentiment-latest",
                max_tokens=128,
                rate_limit_per_minute=200,
                specialization="sentiment_analysis",
                priority=4
            ),
            
            "hashtag_generator": ModelConfig(
                name="cardiffnlp/twitter-roberta-base-hashtag",
                endpoint=f"{self.base_url}/cardiffnlp/twitter-roberta-base-hashtag",
                max_tokens=64,
                rate_limit_per_minute=150,
                specialization="hashtag_generation",
                priority=5
            ),
            
            # Quality Control
            "quality_checker": ModelConfig(
                name="unitary/toxic-bert",
                endpoint=f"{self.base_url}/unitary/toxic-bert",
                max_tokens=128,
                rate_limit_per_minute=180,
                specialization="quality_control",
                priority=6
            ),
            
            # Backup Models
            "backup_content": ModelConfig(
                name="gpt2",
                endpoint=f"{self.base_url}/gpt2",
                max_tokens=256,
                rate_limit_per_minute=80,
                specialization="backup_content",
                priority=7
            ),
            
            "backup_conversation": ModelConfig(
                name="microsoft/DialoGPT-small",
                endpoint=f"{self.base_url}/microsoft/DialoGPT-small",
                max_tokens=256,
                rate_limit_per_minute=150,
                specialization="backup_conversation",
                priority=8
            )
        }
        
        # Rate limiting tracking
        self.request_counts = {model_id: [] for model_id in self.models.keys()}
        self.session = None
        
        # Campaign orchestration state
        self.active_campaigns = {}
        self.task_queue = []
        
    async def initialize_session(self):
        """Initialize async HTTP session"""
        if not self.session:
            self.session = aiohttp.ClientSession(headers=self.headers)
    
    async def close_session(self):
        """Close async HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
    
    def can_make_request(self, model_id: str) -> bool:
        """Check if we can make a request to the model without hitting rate limits"""
        model = self.models[model_id]
        now = datetime.now()
        
        # Clean old requests (older than 1 minute)
        self.request_counts[model_id] = [
            req_time for req_time in self.request_counts[model_id]
            if now - req_time < timedelta(minutes=1)
        ]
        
        # Check if we're under the rate limit
        return len(self.request_counts[model_id]) < model.rate_limit_per_minute
    
    def get_available_model(self, specialization: str = None) -> Optional[str]:
        """Get the best available model for a specialization"""
        candidates = []
        
        for model_id, model in self.models.items():
            if specialization and model.specialization != specialization:
                continue
            
            if self.can_make_request(model_id) and model.error_count < 5:
                candidates.append((model_id, model.priority))
        
        if not candidates:
            return None
        
        # Sort by priority and return the best available
        candidates.sort(key=lambda x: x[1])
        return candidates[0][0]
    
    async def make_request(self, model_id: str, payload: Dict) -> Optional[Dict]:
        """Make a request to a specific model with error handling"""
        if not self.can_make_request(model_id):
            logger.warning(f"Rate limit reached for model {model_id}")
            return None
        
        model = self.models[model_id]
        
        try:
            await self.initialize_session()
            
            async with self.session.post(model.endpoint, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    # Track successful request
                    self.request_counts[model_id].append(datetime.now())
                    model.last_used = datetime.now()
                    model.error_count = max(0, model.error_count - 1)  # Reduce error count on success
                    
                    return result
                elif response.status == 503:
                    # Model is loading, wait and retry
                    logger.info(f"Model {model_id} is loading, waiting...")
                    await asyncio.sleep(20)
                    return await self.make_request(model_id, payload)
                else:
                    logger.error(f"Request failed for {model_id}: {response.status}")
                    model.error_count += 1
                    return None
                    
        except Exception as e:
            logger.error(f"Error making request to {model_id}: {e}")
            model.error_count += 1
            return None
    
    async def orchestrate_campaign(self, user_prompt: str) -> Dict:
        """
        Main orchestration function that processes user prompts and creates campaigns
        This is the core AI orchestrator that handles everything automatically
        """
        logger.info(f"Starting campaign orchestration for prompt: {user_prompt[:100]}...")
        
        # Step 1: Analyze the user prompt with the orchestrator model
        campaign_plan = await self.analyze_and_plan_campaign(user_prompt)
        
        if not campaign_plan:
            return {"error": "Failed to create campaign plan"}
        
        # Step 2: Generate content based on the plan
        content_tasks = await self.generate_campaign_content(campaign_plan)
        
        # Step 3: Quality check all content
        quality_checked_content = await self.quality_check_content(content_tasks)
        
        # Step 4: Create automation schedule
        automation_schedule = await self.create_automation_schedule(quality_checked_content)
        
        # Step 5: Generate campaign summary
        campaign_summary = await self.generate_campaign_summary(campaign_plan, automation_schedule)
        
        # Store active campaign
        campaign_id = f"campaign_{int(time.time())}"
        self.active_campaigns[campaign_id] = {
            "id": campaign_id,
            "user_prompt": user_prompt,
            "plan": campaign_plan,
            "content": quality_checked_content,
            "schedule": automation_schedule,
            "summary": campaign_summary,
            "created_at": datetime.now(),
            "status": "ready"
        }
        
        return {
            "success": True,
            "campaign_id": campaign_id,
            "campaign": self.active_campaigns[campaign_id]
        }
    
    async def analyze_and_plan_campaign(self, user_prompt: str) -> Optional[Dict]:
        """Use orchestrator model to analyze prompt and create campaign plan"""
        orchestrator_id = self.get_available_model("conversation_planning")
        
        if not orchestrator_id:
            # Fallback to any available model
            orchestrator_id = self.get_available_model()
        
        if not orchestrator_id:
            logger.error("No available models for campaign planning")
            return None
        
        planning_prompt = f"""
        Analyze this marketing request and create a detailed campaign plan:
        
        User Request: {user_prompt}
        
        Create a JSON plan with:
        1. Campaign objective
        2. Target audience
        3. Content themes (3-5 themes)
        4. Posting schedule (frequency and timing)
        5. Hashtag strategy
        6. Engagement tactics
        7. Success metrics
        
        Respond with a structured plan for X/Twitter automation.
        """
        
        payload = {
            "inputs": planning_prompt,
            "parameters": {
                "max_new_tokens": 512,
                "temperature": 0.7,
                "do_sample": True
            }
        }
        
        result = await self.make_request(orchestrator_id, payload)
        
        if result and isinstance(result, list) and len(result) > 0:
            plan_text = result[0].get("generated_text", "")
            
            # Extract structured plan (simplified parsing)
            plan = {
                "objective": self.extract_objective(plan_text),
                "target_audience": self.extract_target_audience(plan_text),
                "content_themes": self.extract_content_themes(plan_text),
                "posting_frequency": "3-5 posts per day",
                "hashtag_strategy": self.extract_hashtags(plan_text),
                "engagement_tactics": ["automated_likes", "strategic_comments", "follow_back"],
                "success_metrics": ["engagement_rate", "follower_growth", "reach"]
            }
            
            return plan
        
        return None
    
    async def generate_campaign_content(self, campaign_plan: Dict) -> List[Dict]:
        """Generate multiple pieces of content based on campaign plan"""
        content_tasks = []
        
        # Generate content for each theme
        for theme in campaign_plan.get("content_themes", []):
            # Generate 3-5 posts per theme
            for i in range(3):
                content_task = await self.generate_single_content(theme, campaign_plan)
                if content_task:
                    content_tasks.append(content_task)
        
        return content_tasks
    
    async def generate_single_content(self, theme: str, campaign_plan: Dict) -> Optional[Dict]:
        """Generate a single piece of content"""
        content_model_id = self.get_available_model("content_generation")
        
        if not content_model_id:
            content_model_id = self.get_available_model("social_content")
        
        if not content_model_id:
            content_model_id = self.get_available_model("backup_content")
        
        if not content_model_id:
            return None
        
        content_prompt = f"""
        Create an engaging X/Twitter post about: {theme}
        
        Campaign objective: {campaign_plan.get('objective', '')}
        Target audience: {campaign_plan.get('target_audience', '')}
        
        Requirements:
        - 280 characters or less
        - Include relevant hashtags
        - Engaging and authentic tone
        - Call to action if appropriate
        
        Generate a high-quality post:
        """
        
        payload = {
            "inputs": content_prompt,
            "parameters": {
                "max_new_tokens": 128,
                "temperature": 0.8,
                "do_sample": True
            }
        }
        
        result = await self.make_request(content_model_id, payload)
        
        if result and isinstance(result, list) and len(result) > 0:
            content = result[0].get("generated_text", "").strip()
            
            # Generate hashtags separately
            hashtags = await self.generate_hashtags(theme)
            
            return {
                "content": content,
                "theme": theme,
                "hashtags": hashtags,
                "type": "post",
                "generated_at": datetime.now()
            }
        
        return None
    
    async def generate_hashtags(self, theme: str) -> List[str]:
        """Generate relevant hashtags for content"""
        hashtag_model_id = self.get_available_model("hashtag_generation")
        
        if not hashtag_model_id:
            # Fallback to predefined hashtags based on theme
            theme_hashtags = {
                "crypto": ["#crypto", "#blockchain", "#bitcoin", "#ethereum"],
                "trading": ["#trading", "#forex", "#stocks", "#investment"],
                "technology": ["#tech", "#innovation", "#ai", "#future"],
                "business": ["#business", "#entrepreneur", "#startup", "#success"]
            }
            
            for key, tags in theme_hashtags.items():
                if key.lower() in theme.lower():
                    return tags[:3]
            
            return ["#trending", "#content", "#social"]
        
        hashtag_prompt = f"Generate 3-5 relevant hashtags for: {theme}"
        
        payload = {
            "inputs": hashtag_prompt,
            "parameters": {
                "max_new_tokens": 32,
                "temperature": 0.6
            }
        }
        
        result = await self.make_request(hashtag_model_id, payload)
        
        if result and isinstance(result, list) and len(result) > 0:
            hashtag_text = result[0].get("generated_text", "")
            # Extract hashtags from response
            hashtags = [tag.strip() for tag in hashtag_text.split() if tag.startswith("#")]
            return hashtags[:5]
        
        return ["#content", "#social", "#marketing"]
    
    async def quality_check_content(self, content_tasks: List[Dict]) -> List[Dict]:
        """Quality check all generated content"""
        quality_checked = []
        
        for content_task in content_tasks:
            quality_score = await self.check_content_quality(content_task["content"])
            
            content_task["quality_score"] = quality_score
            content_task["approved"] = quality_score > 0.7
            
            if content_task["approved"]:
                quality_checked.append(content_task)
        
        return quality_checked
    
    async def check_content_quality(self, content: str) -> float:
        """Check content quality using quality control model"""
        quality_model_id = self.get_available_model("quality_control")
        
        if not quality_model_id:
            # Simple quality check without model
            return self.simple_quality_check(content)
        
        payload = {
            "inputs": content,
            "parameters": {
                "max_new_tokens": 16
            }
        }
        
        result = await self.make_request(quality_model_id, payload)
        
        if result and isinstance(result, list) and len(result) > 0:
            # Parse quality score from model response
            score_data = result[0]
            if "score" in score_data:
                return 1.0 - score_data["score"]  # Invert toxic score
        
        return self.simple_quality_check(content)
    
    def simple_quality_check(self, content: str) -> float:
        """Simple quality check without model"""
        score = 0.8
        
        # Check length
        if len(content) < 10:
            score -= 0.3
        elif len(content) > 280:
            score -= 0.2
        
        # Check for spam indicators
        spam_words = ["guaranteed", "free money", "get rich quick", "100% profit"]
        for word in spam_words:
            if word.lower() in content.lower():
                score -= 0.4
        
        # Bonus for hashtags
        if "#" in content:
            score += 0.1
        
        return max(0.0, min(1.0, score))
    
    async def create_automation_schedule(self, content_tasks: List[Dict]) -> Dict:
        """Create automation schedule for approved content"""
        schedule = {
            "posts": [],
            "engagement_actions": [],
            "monitoring_tasks": []
        }
        
        # Schedule posts with optimal timing
        base_time = datetime.now()
        for i, content_task in enumerate(content_tasks):
            post_time = base_time + timedelta(hours=i * 2)  # Space posts 2 hours apart
            
            schedule["posts"].append({
                "content": content_task["content"],
                "hashtags": content_task["hashtags"],
                "scheduled_time": post_time.isoformat(),
                "type": "automated_post"
            })
        
        # Add engagement actions
        schedule["engagement_actions"] = [
            {"action": "like_trending", "frequency": "every_30_minutes"},
            {"action": "comment_relevant", "frequency": "every_hour"},
            {"action": "follow_targets", "frequency": "every_2_hours"}
        ]
        
        # Add monitoring tasks
        schedule["monitoring_tasks"] = [
            {"task": "track_engagement", "frequency": "every_15_minutes"},
            {"task": "monitor_mentions", "frequency": "every_10_minutes"},
            {"task": "analyze_performance", "frequency": "every_hour"}
        ]
        
        return schedule
    
    async def generate_campaign_summary(self, campaign_plan: Dict, automation_schedule: Dict) -> str:
        """Generate a comprehensive campaign summary"""
        summary_model_id = self.get_available_model("conversation_planning")
        
        if not summary_model_id:
            summary_model_id = self.get_available_model()
        
        if summary_model_id:
            summary_prompt = f"""
            Create a campaign summary:
            
            Objective: {campaign_plan.get('objective', '')}
            Content pieces: {len(automation_schedule.get('posts', []))}
            Posting schedule: {len(automation_schedule.get('posts', []))} posts over next 24 hours
            
            Provide a brief, professional summary of this X/Twitter marketing campaign.
            """
            
            payload = {
                "inputs": summary_prompt,
                "parameters": {
                    "max_new_tokens": 256,
                    "temperature": 0.6
                }
            }
            
            result = await self.make_request(summary_model_id, payload)
            
            if result and isinstance(result, list) and len(result) > 0:
                return result[0].get("generated_text", "").strip()
        
        # Fallback summary
        return f"""
        Campaign Summary:
        - Objective: {campaign_plan.get('objective', 'Marketing campaign')}
        - Content: {len(automation_schedule.get('posts', []))} posts scheduled
        - Engagement: Automated likes, comments, and follows
        - Monitoring: Real-time performance tracking
        - Duration: 24-48 hours
        """
    
    # Helper methods for parsing
    def extract_objective(self, text: str) -> str:
        """Extract campaign objective from text"""
        # Simple extraction logic
        if "objective" in text.lower():
            lines = text.split("\n")
            for line in lines:
                if "objective" in line.lower():
                    return line.split(":")[-1].strip()
        return "Increase brand awareness and engagement"
    
    def extract_target_audience(self, text: str) -> str:
        """Extract target audience from text"""
        if "audience" in text.lower():
            lines = text.split("\n")
            for line in lines:
                if "audience" in line.lower():
                    return line.split(":")[-1].strip()
        return "Crypto enthusiasts and traders"
    
    def extract_content_themes(self, text: str) -> List[str]:
        """Extract content themes from text"""
        # Default themes based on common patterns
        default_themes = [
            "Market analysis and trends",
            "Educational content",
            "Community engagement",
            "Industry news and updates"
        ]
        
        # Try to extract from text
        if "theme" in text.lower():
            themes = []
            lines = text.split("\n")
            for line in lines:
                if "theme" in line.lower() and ":" in line:
                    theme = line.split(":")[-1].strip()
                    if theme:
                        themes.append(theme)
            
            if themes:
                return themes[:5]
        
        return default_themes
    
    def extract_hashtags(self, text: str) -> List[str]:
        """Extract hashtag strategy from text"""
        # Extract hashtags from text
        hashtags = []
        words = text.split()
        for word in words:
            if word.startswith("#"):
                hashtags.append(word)
        
        if hashtags:
            return hashtags[:10]
        
        # Default hashtag strategy
        return ["#crypto", "#blockchain", "#trading", "#investment", "#fintech"]
    
    async def get_campaign_status(self, campaign_id: str) -> Optional[Dict]:
        """Get status of an active campaign"""
        return self.active_campaigns.get(campaign_id)
    
    async def list_active_campaigns(self) -> List[Dict]:
        """List all active campaigns"""
        return list(self.active_campaigns.values())
    
    async def stop_campaign(self, campaign_id: str) -> bool:
        """Stop an active campaign"""
        if campaign_id in self.active_campaigns:
            self.active_campaigns[campaign_id]["status"] = "stopped"
            return True
        return False
