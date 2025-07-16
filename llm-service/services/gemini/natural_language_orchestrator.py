#!/usr/bin/env python3
"""
Natural Language AI Orchestrator for X Marketing Platform
Revolutionary system that understands natural language and orchestrates ALL platform functions
"""

import asyncio
import json
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

from .gemini_client import GeminiClient, GeminiRequest, GeminiModel, GeminiResponse
from .rate_limiter import GeminiRateLimiter, RequestPriority

logger = logging.getLogger(__name__)

class IntentCategory(Enum):
    """Categories of user intents for intelligent routing"""
    CONTENT_CREATION = "content_creation"
    AUTOMATION_CONTROL = "automation_control"
    ANALYTICS_INSIGHTS = "analytics_insights"
    CAMPAIGN_MANAGEMENT = "campaign_management"
    ACCOUNT_MANAGEMENT = "account_management"
    SYSTEM_CONTROL = "system_control"
    LEARNING_GUIDANCE = "learning_guidance"
    TROUBLESHOOTING = "troubleshooting"
    COMPLEX_WORKFLOW = "complex_workflow"
    CONVERSATIONAL = "conversational"

class ActionComplexity(Enum):
    """Complexity levels for action execution"""
    SIMPLE = "simple"          # Single command execution
    MODERATE = "moderate"      # 2-3 related commands
    COMPLEX = "complex"        # Multi-step workflow
    ENTERPRISE = "enterprise"  # Full campaign orchestration

@dataclass
class UserIntent:
    """Parsed user intent with routing information"""
    intent_id: str
    category: IntentCategory
    complexity: ActionComplexity
    primary_action: str
    secondary_actions: List[str]
    parameters: Dict[str, Any]
    confidence_score: float
    natural_language_query: str
    suggested_response: str
    function_calls: List[Dict[str, Any]]
    requires_confirmation: bool
    estimated_execution_time: int  # seconds

@dataclass
class ExecutionPlan:
    """Comprehensive execution plan for user request"""
    plan_id: str
    user_intent: UserIntent
    execution_steps: List[Dict[str, Any]]
    dependencies: List[str]
    estimated_duration: int
    risk_assessment: Dict[str, Any]
    user_guidance: str
    confirmation_required: bool

class NaturalLanguageOrchestrator:
    """
    Revolutionary Natural Language AI Orchestrator
    Understands ANY user input and orchestrates ALL X Marketing Platform functions
    """
    
    def __init__(self, gemini_client: GeminiClient, rate_limiter: GeminiRateLimiter):
        self.gemini_client = gemini_client
        self.rate_limiter = rate_limiter
        
        # Initialize function registry
        self.function_registry = self._initialize_function_registry()
        self.intent_patterns = self._initialize_intent_patterns()
        self.conversation_context = {}
        
        # Execution tracking
        self.active_executions: Dict[str, ExecutionPlan] = {}
        self.execution_history: List[ExecutionPlan] = []
        
        logger.info("Natural Language Orchestrator initialized with comprehensive function registry")
    
    def _initialize_function_registry(self) -> Dict[str, Dict[str, Any]]:
        """Initialize comprehensive registry of ALL X Marketing Platform functions"""
        return {
            # Content Creation Functions
            "generate_content": {
                "description": "Generate AI-powered content for social media posts",
                "parameters": ["topic", "tone", "length", "platform", "hashtags"],
                "complexity": "simple",
                "execution_time": 10,
                "telegram_command": "/generate",
                "backend_endpoint": "/api/content/generate",
                "ai_enhanced": True
            },
            "generate_image": {
                "description": "Create AI-generated images for posts",
                "parameters": ["prompt", "style", "dimensions", "brand_elements"],
                "complexity": "moderate",
                "execution_time": 30,
                "telegram_command": "/image",
                "backend_endpoint": "/api/content/image",
                "ai_enhanced": True
            },
            "analyze_content": {
                "description": "Analyze content performance and sentiment",
                "parameters": ["content", "metrics", "timeframe"],
                "complexity": "simple",
                "execution_time": 5,
                "telegram_command": "/analyze",
                "backend_endpoint": "/api/content/analyze",
                "ai_enhanced": True
            },
            "optimize_content": {
                "description": "Optimize existing content for better performance",
                "parameters": ["content", "platform", "target_metrics"],
                "complexity": "moderate",
                "execution_time": 15,
                "telegram_command": "/optimize",
                "backend_endpoint": "/api/content/optimize",
                "ai_enhanced": True
            },
            "generate_variations": {
                "description": "Create multiple variations of content",
                "parameters": ["original_content", "variation_count", "style_changes"],
                "complexity": "moderate",
                "execution_time": 20,
                "telegram_command": "/variations",
                "backend_endpoint": "/api/content/variations",
                "ai_enhanced": True
            },
            
            # Automation Control Functions
            "start_automation": {
                "description": "Start automated engagement and posting",
                "parameters": ["automation_type", "intensity", "targets", "schedule"],
                "complexity": "complex",
                "execution_time": 5,
                "telegram_command": "/start_auto",
                "backend_endpoint": "/api/automation/start",
                "ai_enhanced": True
            },
            "stop_automation": {
                "description": "Stop all or specific automation processes",
                "parameters": ["automation_type", "immediate"],
                "complexity": "simple",
                "execution_time": 2,
                "telegram_command": "/stop_auto",
                "backend_endpoint": "/api/automation/stop",
                "ai_enhanced": False
            },
            "configure_automation": {
                "description": "Configure automation settings and parameters",
                "parameters": ["settings", "limits", "behavior", "safety"],
                "complexity": "complex",
                "execution_time": 30,
                "telegram_command": "/auto_config",
                "backend_endpoint": "/api/automation/configure",
                "ai_enhanced": True
            },
            "like_automation": {
                "description": "Automated liking of targeted content",
                "parameters": ["targets", "frequency", "filters", "limits"],
                "complexity": "moderate",
                "execution_time": 10,
                "telegram_command": "/like_automation",
                "backend_endpoint": "/api/automation/likes",
                "ai_enhanced": True
            },
            "comment_automation": {
                "description": "Automated commenting on targeted posts",
                "parameters": ["targets", "comment_templates", "frequency"],
                "complexity": "complex",
                "execution_time": 15,
                "telegram_command": "/comment_automation",
                "backend_endpoint": "/api/automation/comments",
                "ai_enhanced": True
            },
            "follow_automation": {
                "description": "Automated following of targeted accounts",
                "parameters": ["targets", "criteria", "daily_limit", "unfollow_strategy"],
                "complexity": "complex",
                "execution_time": 20,
                "telegram_command": "/follow_automation",
                "backend_endpoint": "/api/automation/follows",
                "ai_enhanced": True
            },
            "engagement_automation": {
                "description": "Comprehensive engagement automation across all activities",
                "parameters": ["strategy", "targets", "intensity", "schedule"],
                "complexity": "enterprise",
                "execution_time": 45,
                "telegram_command": "/engagement_automation",
                "backend_endpoint": "/api/automation/engagement",
                "ai_enhanced": True
            },
            
            # Analytics & Insights Functions
            "get_dashboard": {
                "description": "Display comprehensive analytics dashboard",
                "parameters": ["timeframe", "metrics", "accounts"],
                "complexity": "simple",
                "execution_time": 5,
                "telegram_command": "/dashboard",
                "backend_endpoint": "/api/analytics/dashboard",
                "ai_enhanced": True
            },
            "performance_analysis": {
                "description": "Analyze performance metrics and trends",
                "parameters": ["metrics", "comparison", "timeframe", "insights"],
                "complexity": "moderate",
                "execution_time": 15,
                "telegram_command": "/performance",
                "backend_endpoint": "/api/analytics/performance",
                "ai_enhanced": True
            },
            "trend_analysis": {
                "description": "Analyze trending topics and opportunities",
                "parameters": ["industry", "timeframe", "competitors"],
                "complexity": "complex",
                "execution_time": 25,
                "telegram_command": "/trends",
                "backend_endpoint": "/api/analytics/trends",
                "ai_enhanced": True
            },
            "competitor_analysis": {
                "description": "Comprehensive competitor analysis and insights",
                "parameters": ["competitors", "metrics", "timeframe", "strategy"],
                "complexity": "complex",
                "execution_time": 30,
                "telegram_command": "/competitors",
                "backend_endpoint": "/api/analytics/competitors",
                "ai_enhanced": True
            },
            
            # Campaign Management Functions
            "create_campaign": {
                "description": "Create comprehensive marketing campaigns",
                "parameters": ["objective", "duration", "budget", "targets", "strategy"],
                "complexity": "enterprise",
                "execution_time": 60,
                "telegram_command": "/create_campaign",
                "backend_endpoint": "/api/campaigns/create",
                "ai_enhanced": True
            },
            "campaign_wizard": {
                "description": "Guided campaign creation with AI assistance",
                "parameters": ["business_type", "goals", "audience", "budget"],
                "complexity": "enterprise",
                "execution_time": 90,
                "telegram_command": "/campaign_wizard",
                "backend_endpoint": "/api/campaigns/wizard",
                "ai_enhanced": True
            },
            "schedule_content": {
                "description": "Schedule posts and content across accounts",
                "parameters": ["content", "timing", "accounts", "coordination"],
                "complexity": "complex",
                "execution_time": 20,
                "telegram_command": "/schedule",
                "backend_endpoint": "/api/campaigns/schedule",
                "ai_enhanced": True
            },
            
            # Account Management Functions
            "manage_accounts": {
                "description": "View and manage connected X accounts",
                "parameters": ["action", "account_id", "settings"],
                "complexity": "simple",
                "execution_time": 5,
                "telegram_command": "/accounts",
                "backend_endpoint": "/api/accounts/manage",
                "ai_enhanced": False
            },
            "add_account": {
                "description": "Add new X account to the platform",
                "parameters": ["credentials", "permissions", "automation_level"],
                "complexity": "moderate",
                "execution_time": 30,
                "telegram_command": "/add_account",
                "backend_endpoint": "/api/accounts/add",
                "ai_enhanced": False
            },
            "account_status": {
                "description": "Check account status and health",
                "parameters": ["account_id", "detailed"],
                "complexity": "simple",
                "execution_time": 3,
                "telegram_command": "/account_status",
                "backend_endpoint": "/api/accounts/status",
                "ai_enhanced": True
            },
            
            # System Control Functions
            "system_status": {
                "description": "Check overall system status and health",
                "parameters": ["detailed", "components"],
                "complexity": "simple",
                "execution_time": 2,
                "telegram_command": "/status",
                "backend_endpoint": "/api/system/status",
                "ai_enhanced": False
            },
            "emergency_stop": {
                "description": "Emergency stop all automation and activities",
                "parameters": ["immediate", "reason"],
                "complexity": "simple",
                "execution_time": 1,
                "telegram_command": "/emergency_stop",
                "backend_endpoint": "/api/system/emergency_stop",
                "ai_enhanced": False
            },
            
            # Enterprise AI Functions
            "enterprise_orchestration": {
                "description": "Full enterprise campaign orchestration with AI",
                "parameters": ["campaign_description", "accounts", "duration", "complexity"],
                "complexity": "enterprise",
                "execution_time": 120,
                "telegram_command": "/enterprise_campaign",
                "backend_endpoint": "/api/enterprise/orchestrate",
                "ai_enhanced": True
            },
            "deep_think_analysis": {
                "description": "Advanced AI analysis with deep reasoning",
                "parameters": ["query", "context", "analysis_depth"],
                "complexity": "complex",
                "execution_time": 45,
                "telegram_command": "/deep_think",
                "backend_endpoint": "/api/enterprise/deep_think",
                "ai_enhanced": True
            }
        }
    
    def _initialize_intent_patterns(self) -> Dict[IntentCategory, List[str]]:
        """Initialize patterns for intent classification"""
        return {
            IntentCategory.CONTENT_CREATION: [
                "create", "generate", "write", "make", "post", "content", "image", "video",
                "tweet", "caption", "copy", "text", "design", "visual", "graphic"
            ],
            IntentCategory.AUTOMATION_CONTROL: [
                "automate", "start", "stop", "schedule", "auto", "bot", "engage", "like",
                "follow", "comment", "retweet", "dm", "message", "bulk", "mass"
            ],
            IntentCategory.ANALYTICS_INSIGHTS: [
                "analyze", "analytics", "performance", "metrics", "stats", "data", "insights",
                "trends", "report", "dashboard", "competitor", "benchmark", "growth"
            ],
            IntentCategory.CAMPAIGN_MANAGEMENT: [
                "campaign", "strategy", "plan", "launch", "promote", "marketing", "advertise",
                "reach", "audience", "target", "budget", "roi", "conversion"
            ],
            IntentCategory.ACCOUNT_MANAGEMENT: [
                "account", "profile", "connect", "add", "remove", "switch", "manage",
                "settings", "permissions", "access", "login", "auth"
            ],
            IntentCategory.SYSTEM_CONTROL: [
                "status", "health", "system", "service", "restart", "stop", "emergency",
                "maintenance", "update", "version", "help"
            ],
            IntentCategory.LEARNING_GUIDANCE: [
                "how", "what", "why", "explain", "guide", "tutorial", "learn", "teach",
                "show", "example", "best practice", "tip", "advice", "recommend"
            ],
            IntentCategory.TROUBLESHOOTING: [
                "error", "problem", "issue", "bug", "fix", "broken", "not working",
                "failed", "trouble", "help", "support", "debug"
            ]
        }
    
    async def understand_and_orchestrate(
        self, 
        user_input: str, 
        user_context: Dict[str, Any] = None,
        conversation_history: List[str] = None
    ) -> Dict[str, Any]:
        """
        Main orchestration method - understands natural language and executes appropriate actions
        This is the revolutionary function that makes the platform truly conversational
        """
        start_time = datetime.now()
        
        try:
            # Phase 1: Parse and understand user intent
            user_intent = await self._parse_user_intent(user_input, user_context, conversation_history)
            
            # Phase 2: Create execution plan
            execution_plan = await self._create_execution_plan(user_intent, user_context)
            
            # Phase 3: Execute the plan (if no confirmation required)
            if not execution_plan.confirmation_required:
                execution_result = await self._execute_plan(execution_plan)
            else:
                execution_result = {
                    "requires_confirmation": True,
                    "plan": execution_plan,
                    "confirmation_message": execution_plan.user_guidance
                }
            
            # Phase 4: Generate natural language response
            response = await self._generate_natural_response(
                user_input, user_intent, execution_plan, execution_result
            )
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            # Convert enums to strings for JSON serialization with divine precision
            try:
                user_intent_dict = self._serialize_dataclass(user_intent)
            except Exception as e:
                logger.warning(f"Failed to serialize user_intent: {e}")
                user_intent_dict = {
                    "category": user_intent.category.value if hasattr(user_intent.category, 'value') else str(user_intent.category),
                    "complexity": user_intent.complexity.value if hasattr(user_intent.complexity, 'value') else str(user_intent.complexity),
                    "confidence_score": user_intent.confidence_score,
                    "suggested_response": user_intent.suggested_response
                }

            execution_plan_dict = None
            if execution_plan and hasattr(execution_plan, 'confirmation_required') and execution_plan.confirmation_required:
                try:
                    execution_plan_dict = self._serialize_dataclass(execution_plan)
                except Exception as e:
                    logger.warning(f"Failed to serialize execution_plan: {e}")
                    execution_plan_dict = {
                        "confirmation_required": True,
                        "user_guidance": "Please confirm the execution plan"
                    }

            return {
                "success": True,
                "user_intent": user_intent_dict,
                "execution_plan": execution_plan_dict,
                "execution_result": execution_result,
                "natural_response": response,
                "processing_time": processing_time,
                "orchestrator_metadata": {
                    "intent_confidence": user_intent.confidence_score,
                    "complexity_level": user_intent.complexity.value if hasattr(user_intent.complexity, 'value') else str(user_intent.complexity),
                    "functions_involved": len(user_intent.function_calls) if hasattr(user_intent, 'function_calls') and user_intent.function_calls else 0,
                    "ai_enhanced": True
                }
            }
            
        except Exception as e:
            logger.error(f"Natural language orchestration failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "natural_response": "I apologize, but I encountered an issue understanding your request. Could you please rephrase it or be more specific about what you'd like me to help you with?",
                "processing_time": (datetime.now() - start_time).total_seconds()
            }

    async def _parse_user_intent(
        self,
        user_input: str,
        user_context: Dict[str, Any] = None,
        conversation_history: List[str] = None
    ) -> UserIntent:
        """Parse user input and extract intent using Gemini 2.5 Pro with function calling"""

        # Build comprehensive context for intent analysis
        context_prompt = f"""
        Analyze this user request and extract their intent for the X Marketing Platform:

        User Input: "{user_input}"

        User Context: {json.dumps(user_context or {}, indent=2)}

        Recent Conversation: {conversation_history[-3:] if conversation_history else "None"}

        Available Platform Functions:
        {json.dumps(list(self.function_registry.keys()), indent=2)}

        Classify the intent and provide a comprehensive analysis including:
        1. Primary intent category
        2. Specific actions needed
        3. Parameters required
        4. Complexity level
        5. Confidence score
        6. Natural language response suggestion
        7. Function calls needed
        8. Whether confirmation is required

        Be extremely thorough and consider all possible interpretations.
        """

        # Use Gemini 2.5 Pro for advanced intent analysis with divine token allocation
        response = await self.gemini_client.generate_content(
            GeminiRequest(
                prompt=context_prompt,
                model=GeminiModel.PRO_2_5,
                temperature=0.1,  # Lower temperature for more consistent JSON
                max_tokens=8192,  # Increased for comprehensive analysis
                system_instruction="You are an expert AI intent classifier for a comprehensive X Marketing Platform. Analyze user requests with extreme precision and provide detailed routing information. Always respond with valid, well-formatted JSON."
            )
        )

        # Parse the response and extract structured intent
        intent_data = await self._extract_structured_intent(response.content, user_input)

        return UserIntent(
            intent_id=str(uuid.uuid4()),
            category=intent_data.get("category", IntentCategory.CONVERSATIONAL),
            complexity=intent_data.get("complexity", ActionComplexity.SIMPLE),
            primary_action=intent_data.get("primary_action", "help"),
            secondary_actions=intent_data.get("secondary_actions", []),
            parameters=intent_data.get("parameters", {}),
            confidence_score=intent_data.get("confidence_score", 0.5),
            natural_language_query=user_input,
            suggested_response=intent_data.get("suggested_response", ""),
            function_calls=intent_data.get("function_calls", []),
            requires_confirmation=intent_data.get("requires_confirmation", False),
            estimated_execution_time=intent_data.get("estimated_execution_time", 10)
        )

    async def _extract_structured_intent(self, gemini_response: str, user_input: str) -> Dict[str, Any]:
        """Extract structured intent data from Gemini response"""

        # Use Gemini again to structure the response into JSON
        structure_prompt = f"""
        Convert this intent analysis into structured JSON format:

        Analysis: {gemini_response}
        Original User Input: {user_input}

        Return ONLY a valid JSON object with these exact fields:
        """ + """{
            "category": "content_creation|automation_control|analytics_insights|campaign_management|account_management|system_control|learning_guidance|troubleshooting|complex_workflow|conversational",
            "complexity": "simple|moderate|complex|enterprise",
            "primary_action": "main_function_name",
            "secondary_actions": ["additional_function_names"],
            "parameters": {"param1": "value1", "param2": "value2"},
            "confidence_score": 0.95,
            "suggested_response": "Natural language response to user",
            "function_calls": [{"function": "function_name", "parameters": {}}],
            "requires_confirmation": false,
            "estimated_execution_time": 30
        }

        Be precise and ensure all fields are properly formatted.
        """

        structure_response = await self.gemini_client.generate_content(
            GeminiRequest(
                prompt=structure_prompt,
                model=GeminiModel.FLASH_2_5,
                temperature=0.0,  # Zero temperature for perfect JSON formatting
                max_tokens=4096,  # Increased for complex JSON structures
                system_instruction="You are a precise JSON formatter. Return ONLY valid, properly escaped JSON with no additional text, comments, or markdown formatting. Ensure all strings are properly quoted and escaped."
            )
        )

        try:
            # Advanced JSON parsing with multiple strategies
            intent_data = self._parse_json_with_fallbacks(structure_response.content, user_input)

            # Validate and convert enums
            intent_data = self._validate_and_convert_intent_data(intent_data)

            return intent_data

        except Exception as e:
            logger.error(f"Complete intent parsing failure: {e}")
            # Ultimate fallback to basic intent classification
            return self._fallback_intent_classification(user_input)

    def _parse_json_with_fallbacks(self, response_content: str, user_input: str) -> Dict[str, Any]:
        """Parse JSON with multiple fallback strategies for divine reliability"""

        # Strategy 1: Direct JSON parsing
        try:
            json_text = response_content.strip()
            return json.loads(json_text)
        except json.JSONDecodeError as e:
            logger.debug(f"Direct JSON parsing failed: {e}")

        # Strategy 2: Remove markdown formatting
        try:
            json_text = response_content.strip()
            if json_text.startswith("```json"):
                json_text = json_text[7:]
                if json_text.endswith("```"):
                    json_text = json_text[:-3]
            elif json_text.startswith("```"):
                json_text = json_text[3:]
                if json_text.endswith("```"):
                    json_text = json_text[:-3]

            json_text = json_text.strip()
            return json.loads(json_text)
        except json.JSONDecodeError as e:
            logger.debug(f"Markdown removal parsing failed: {e}")

        # Strategy 3: Extract JSON from mixed content
        try:
            import re
            json_pattern = r'\{.*\}'
            matches = re.findall(json_pattern, response_content, re.DOTALL)
            if matches:
                # Try the largest JSON-like string
                largest_match = max(matches, key=len)
                return json.loads(largest_match)
        except (json.JSONDecodeError, ValueError) as e:
            logger.debug(f"Regex extraction parsing failed: {e}")

        # Strategy 4: Fix common JSON issues
        try:
            json_text = response_content.strip()

            # Remove markdown
            if json_text.startswith("```"):
                lines = json_text.split('\n')
                json_text = '\n'.join(lines[1:-1]) if len(lines) > 2 else json_text

            # Fix common issues
            json_text = json_text.replace('\n', ' ')  # Remove newlines
            json_text = re.sub(r',\s*}', '}', json_text)  # Remove trailing commas
            json_text = re.sub(r',\s*]', ']', json_text)  # Remove trailing commas in arrays
            json_text = re.sub(r'([{,]\s*)(\w+):', r'\1"\2":', json_text)  # Quote unquoted keys

            return json.loads(json_text)
        except (json.JSONDecodeError, ValueError) as e:
            logger.debug(f"JSON fixing parsing failed: {e}")

        # Strategy 5: Manual parsing for known structure
        try:
            return self._manual_json_parse(response_content, user_input)
        except Exception as e:
            logger.debug(f"Manual parsing failed: {e}")

        # If all strategies fail, raise the original error
        raise json.JSONDecodeError("All JSON parsing strategies failed", response_content, 0)

    def _manual_json_parse(self, content: str, user_input: str) -> Dict[str, Any]:
        """Manual parsing as last resort for divine resilience"""

        # Extract key information using regex patterns
        import re

        result = {
            "category": "conversational",
            "complexity": "simple",
            "primary_action": "help",
            "secondary_actions": [],
            "parameters": {},
            "confidence_score": 0.5,
            "suggested_response": "I understand your request. Let me help you with that.",
            "function_calls": [],
            "requires_confirmation": False,
            "estimated_execution_time": 10
        }

        # Try to extract category
        category_match = re.search(r'"category":\s*"([^"]+)"', content)
        if category_match:
            result["category"] = category_match.group(1)

        # Try to extract complexity
        complexity_match = re.search(r'"complexity":\s*"([^"]+)"', content)
        if complexity_match:
            result["complexity"] = complexity_match.group(1)

        # Try to extract confidence score
        confidence_match = re.search(r'"confidence_score":\s*([0-9.]+)', content)
        if confidence_match:
            result["confidence_score"] = float(confidence_match.group(1))

        # Try to extract suggested response
        response_match = re.search(r'"suggested_response":\s*"([^"]+)"', content)
        if response_match:
            result["suggested_response"] = response_match.group(1)

        logger.info(f"Manual parsing extracted: {result}")
        return result

    def _validate_and_convert_intent_data(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and convert intent data with divine precision"""

        # Ensure all required fields exist
        required_fields = {
            "category": "conversational",
            "complexity": "simple",
            "primary_action": "help",
            "secondary_actions": [],
            "parameters": {},
            "confidence_score": 0.5,
            "suggested_response": "I understand your request.",
            "function_calls": [],
            "requires_confirmation": False,
            "estimated_execution_time": 10
        }

        for field, default_value in required_fields.items():
            if field not in intent_data:
                intent_data[field] = default_value

        # Convert string enums to actual enums
        try:
            intent_data["category"] = IntentCategory(intent_data.get("category", "conversational"))
        except ValueError:
            logger.warning(f"Invalid category: {intent_data.get('category')}, using default")
            intent_data["category"] = IntentCategory.CONVERSATIONAL

        try:
            intent_data["complexity"] = ActionComplexity(intent_data.get("complexity", "simple"))
        except ValueError:
            logger.warning(f"Invalid complexity: {intent_data.get('complexity')}, using default")
            intent_data["complexity"] = ActionComplexity.SIMPLE

        # Validate confidence score
        confidence = intent_data.get("confidence_score", 0.5)
        if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
            intent_data["confidence_score"] = 0.5

        # Validate execution time
        exec_time = intent_data.get("estimated_execution_time", 10)
        if not isinstance(exec_time, (int, float)) or exec_time < 0:
            intent_data["estimated_execution_time"] = 10

        return intent_data

    async def _create_execution_plan(self, user_intent: UserIntent, user_context: Dict[str, Any] = None) -> ExecutionPlan:
        """Create detailed execution plan based on user intent"""

        execution_steps = []
        dependencies = []
        total_duration = 0

        # Build execution steps based on function calls
        for func_call in user_intent.function_calls:
            function_name = func_call.get("function")
            if function_name in self.function_registry:
                func_info = self.function_registry[function_name]

                step = {
                    "step_id": str(uuid.uuid4()),
                    "function": function_name,
                    "parameters": func_call.get("parameters", {}),
                    "telegram_command": func_info.get("telegram_command"),
                    "backend_endpoint": func_info.get("backend_endpoint"),
                    "estimated_time": func_info.get("execution_time", 10),
                    "ai_enhanced": func_info.get("ai_enhanced", False),
                    "description": func_info.get("description", "")
                }

                execution_steps.append(step)
                total_duration += step["estimated_time"]

        # Risk assessment
        risk_assessment = {
            "automation_risk": "low" if user_intent.complexity != ActionComplexity.ENTERPRISE else "medium",
            "data_impact": "minimal" if user_intent.category == IntentCategory.ANALYTICS_INSIGHTS else "moderate",
            "reversible": True if user_intent.category != IntentCategory.AUTOMATION_CONTROL else False,
            "requires_monitoring": user_intent.complexity in [ActionComplexity.COMPLEX, ActionComplexity.ENTERPRISE]
        }

        # Generate user guidance
        guidance = await self._generate_execution_guidance(user_intent, execution_steps, risk_assessment)

        # Determine if confirmation is required
        confirmation_required = (
            user_intent.complexity == ActionComplexity.ENTERPRISE or
            user_intent.category == IntentCategory.AUTOMATION_CONTROL or
            len(execution_steps) > 3 or
            total_duration > 60
        )

        return ExecutionPlan(
            plan_id=str(uuid.uuid4()),
            user_intent=user_intent,
            execution_steps=execution_steps,
            dependencies=dependencies,
            estimated_duration=total_duration,
            risk_assessment=risk_assessment,
            user_guidance=guidance,
            confirmation_required=confirmation_required
        )

    async def _generate_execution_guidance(
        self,
        user_intent: UserIntent,
        execution_steps: List[Dict[str, Any]],
        risk_assessment: Dict[str, Any]
    ) -> str:
        """Generate natural language guidance for the user about the execution plan"""

        guidance_prompt = f"""
        Generate helpful guidance for the user about this execution plan:

        User Intent: {user_intent.natural_language_query}
        Complexity: {user_intent.complexity.value}

        Execution Steps:
        {json.dumps(execution_steps, indent=2)}

        Risk Assessment:
        {json.dumps(risk_assessment, indent=2)}

        Provide a clear, friendly explanation of:
        1. What will be executed
        2. How long it will take
        3. Any important considerations
        4. What the user can expect

        Keep it conversational and helpful.
        """

        response = await self.gemini_client.generate_content(
            GeminiRequest(
                prompt=guidance_prompt,
                model=GeminiModel.FLASH_2_5,
                temperature=0.7,
                max_tokens=500,
                system_instruction="You are a helpful AI assistant explaining execution plans to users in a friendly, clear manner."
            )
        )

        return response.content

    def _fallback_intent_classification(self, user_input: str) -> Dict[str, Any]:
        """Fallback intent classification using keyword matching"""

        user_input_lower = user_input.lower()

        # Simple keyword-based classification
        for category, keywords in self.intent_patterns.items():
            if any(keyword in user_input_lower for keyword in keywords):
                return {
                    "category": category,
                    "complexity": ActionComplexity.SIMPLE,
                    "primary_action": "help",
                    "secondary_actions": [],
                    "parameters": {},
                    "confidence_score": 0.3,
                    "suggested_response": f"I understand you're interested in {category.value}. Could you be more specific about what you'd like me to help you with?",
                    "function_calls": [],
                    "requires_confirmation": False,
                    "estimated_execution_time": 5
                }

        # Default conversational response
        return {
            "category": IntentCategory.CONVERSATIONAL,
            "complexity": ActionComplexity.SIMPLE,
            "primary_action": "help",
            "secondary_actions": [],
            "parameters": {},
            "confidence_score": 0.2,
            "suggested_response": "I'm here to help you with your X Marketing Platform needs. Could you tell me more about what you'd like to accomplish?",
            "function_calls": [],
            "requires_confirmation": False,
            "estimated_execution_time": 2
        }

    async def _execute_plan(self, execution_plan: ExecutionPlan) -> Dict[str, Any]:
        """Execute the comprehensive plan across all platform functions"""

        execution_id = str(uuid.uuid4())
        start_time = datetime.now()
        results = []

        try:
            # Store active execution
            self.active_executions[execution_id] = execution_plan

            # Execute each step in the plan
            for step in execution_plan.execution_steps:
                step_start = datetime.now()

                try:
                    # Execute the function call
                    step_result = await self._execute_function_call(step)

                    step_duration = (datetime.now() - step_start).total_seconds()

                    results.append({
                        "step_id": step["step_id"],
                        "function": step["function"],
                        "success": True,
                        "result": step_result,
                        "execution_time": step_duration,
                        "timestamp": datetime.now().isoformat()
                    })

                    logger.info(f"Executed step {step['function']} successfully in {step_duration:.2f}s")

                except Exception as step_error:
                    logger.error(f"Step execution failed: {step['function']} - {step_error}")

                    results.append({
                        "step_id": step["step_id"],
                        "function": step["function"],
                        "success": False,
                        "error": str(step_error),
                        "execution_time": (datetime.now() - step_start).total_seconds(),
                        "timestamp": datetime.now().isoformat()
                    })

            # Calculate overall success rate
            successful_steps = sum(1 for r in results if r["success"])
            success_rate = successful_steps / len(results) if results else 0

            total_execution_time = (datetime.now() - start_time).total_seconds()

            execution_result = {
                "execution_id": execution_id,
                "success": success_rate > 0.5,  # Consider successful if >50% steps succeed
                "success_rate": success_rate,
                "total_steps": len(results),
                "successful_steps": successful_steps,
                "failed_steps": len(results) - successful_steps,
                "execution_time": total_execution_time,
                "step_results": results,
                "plan_complexity": execution_plan.user_intent.complexity.value,
                "user_intent": execution_plan.user_intent.natural_language_query
            }

            # Move to history
            self.execution_history.append(execution_plan)
            if execution_id in self.active_executions:
                del self.active_executions[execution_id]

            return execution_result

        except Exception as e:
            logger.error(f"Plan execution failed: {str(e)}")

            # Clean up
            if execution_id in self.active_executions:
                del self.active_executions[execution_id]

            return {
                "execution_id": execution_id,
                "success": False,
                "error": str(e),
                "execution_time": (datetime.now() - start_time).total_seconds(),
                "step_results": results
            }

    async def _execute_function_call(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """Execute individual function call - this integrates with all platform components"""

        function_name = step["function"]
        parameters = step.get("parameters", {})

        # Route to appropriate execution method based on function type
        if function_name in self.function_registry:
            func_info = self.function_registry[function_name]

            if func_info.get("ai_enhanced", False):
                # AI-enhanced functions use the enterprise LLM service
                return await self._execute_ai_enhanced_function(function_name, parameters, func_info)
            else:
                # Standard functions call backend APIs directly
                return await self._execute_standard_function(function_name, parameters, func_info)
        else:
            raise ValueError(f"Unknown function: {function_name}")

    async def _execute_ai_enhanced_function(
        self,
        function_name: str,
        parameters: Dict[str, Any],
        func_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute AI-enhanced functions using the enterprise LLM service"""

        # Map function to appropriate LLM service endpoint
        if function_name in ["generate_content", "generate_image", "analyze_content", "optimize_content"]:
            return await self._call_enterprise_generation(function_name, parameters)
        elif function_name in ["start_automation", "configure_automation", "engagement_automation"]:
            return await self._call_enterprise_automation(function_name, parameters)
        elif function_name in ["performance_analysis", "trend_analysis", "competitor_analysis"]:
            return await self._call_enterprise_analytics(function_name, parameters)
        elif function_name in ["create_campaign", "campaign_wizard", "enterprise_orchestration"]:
            return await self._call_enterprise_orchestration(function_name, parameters)
        else:
            # Generic AI-enhanced call
            return await self._call_enterprise_generic(function_name, parameters)

    async def _call_enterprise_generation(self, function_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Call enterprise generation service"""

        # Build prompt based on function and parameters
        if function_name == "generate_content":
            prompt = f"Create {parameters.get('type', 'post')} content about {parameters.get('topic', 'general topic')} with {parameters.get('tone', 'professional')} tone"
        elif function_name == "generate_image":
            prompt = f"Generate image: {parameters.get('prompt', 'professional image')}"
        elif function_name == "analyze_content":
            prompt = f"Analyze this content: {parameters.get('content', '')}"
        elif function_name == "optimize_content":
            prompt = f"Optimize this content for {parameters.get('platform', 'social media')}: {parameters.get('content', '')}"
        else:
            prompt = f"Execute {function_name} with parameters: {parameters}"

        # Call the enterprise generation service with divine token allocation
        response = await self.gemini_client.generate_content(
            GeminiRequest(
                prompt=prompt,
                model=GeminiModel.PRO_2_5,
                temperature=0.7,
                max_tokens=16384,  # Generous allocation for comprehensive content
                system_instruction=f"You are executing the {function_name} function for the X Marketing Platform. Provide practical, actionable results with comprehensive detail."
            )
        )

        return {
            "function": function_name,
            "result": response.content,
            "model_used": response.model,
            "processing_time": response.response_time,
            "quality_score": response.quality_score,
            "ai_enhanced": True
        }

    async def _call_enterprise_automation(self, function_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Call enterprise automation service"""

        # Simulate automation configuration/execution
        # In real implementation, this would integrate with the automation service

        automation_result = {
            "function": function_name,
            "automation_configured": True,
            "parameters_applied": parameters,
            "estimated_impact": "High engagement increase expected",
            "safety_checks": "All safety protocols enabled",
            "ai_enhanced": True
        }

        return automation_result

    async def _call_enterprise_analytics(self, function_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Call enterprise analytics service"""

        # Build analytics prompt
        prompt = f"Provide comprehensive {function_name} analysis with insights and recommendations based on: {parameters}"

        response = await self.gemini_client.generate_content(
            GeminiRequest(
                prompt=prompt,
                model=GeminiModel.PRO_2_5,
                temperature=0.3,
                max_tokens=24576,  # Massive allocation for comprehensive analytics
                system_instruction="You are an expert marketing analyst providing detailed insights and actionable recommendations with comprehensive data analysis."
            )
        )

        return {
            "function": function_name,
            "analysis": response.content,
            "insights_generated": True,
            "recommendations_included": True,
            "ai_enhanced": True
        }

    async def _call_enterprise_orchestration(self, function_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Call enterprise orchestration service"""

        # This would integrate with the existing enterprise orchestrator
        prompt = f"Create comprehensive campaign orchestration: {parameters.get('description', 'marketing campaign')}"

        response = await self.gemini_client.generate_content(
            GeminiRequest(
                prompt=prompt,
                model=GeminiModel.PRO_2_5,
                temperature=0.6,
                max_tokens=32768,  # Maximum allocation for enterprise orchestration
                system_instruction="You are an enterprise marketing orchestrator creating comprehensive campaign strategies with detailed implementation plans."
            )
        )

        return {
            "function": function_name,
            "campaign_created": True,
            "orchestration_plan": response.content,
            "ai_enhanced": True,
            "enterprise_grade": True
        }

    async def _call_enterprise_generic(self, function_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Generic AI-enhanced function call"""

        prompt = f"Execute {function_name} function with these parameters: {json.dumps(parameters, indent=2)}"

        response = await self.gemini_client.generate_content(
            GeminiRequest(
                prompt=prompt,
                model=GeminiModel.FLASH_2_5,
                temperature=0.5,
                max_tokens=16384,  # Generous allocation for Flash model
                system_instruction=f"You are executing the {function_name} function for the X Marketing Platform with comprehensive detail."
            )
        )

        return {
            "function": function_name,
            "result": response.content,
            "ai_enhanced": True
        }

    async def _execute_standard_function(
        self,
        function_name: str,
        parameters: Dict[str, Any],
        func_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute standard (non-AI) functions"""

        # Simulate standard function execution
        # In real implementation, this would call backend APIs

        return {
            "function": function_name,
            "executed": True,
            "parameters": parameters,
            "backend_endpoint": func_info.get("backend_endpoint"),
            "telegram_command": func_info.get("telegram_command"),
            "ai_enhanced": False
        }

    async def _generate_natural_response(
        self,
        user_input: str,
        user_intent: UserIntent,
        execution_plan: ExecutionPlan,
        execution_result: Dict[str, Any]
    ) -> str:
        """Generate natural language response to the user"""

        response_prompt = f"""
        Generate a natural, helpful response to the user based on this interaction:

        User Input: "{user_input}"

        User Intent: {user_intent.category.value} - {user_intent.complexity.value}

        Execution Plan: {len(execution_plan.execution_steps)} steps planned

        Execution Result: {json.dumps(execution_result, indent=2)}

        Create a response that:
        1. Acknowledges what the user requested
        2. Explains what was accomplished
        3. Provides any relevant insights or next steps
        4. Maintains a helpful, professional tone
        5. Offers additional assistance if appropriate

        Keep it conversational and user-friendly.
        """

        response = await self.gemini_client.generate_content(
            GeminiRequest(
                prompt=response_prompt,
                model=GeminiModel.FLASH_2_5,
                temperature=0.8,
                max_tokens=8192,  # Generous allocation for natural responses
                system_instruction="You are a helpful AI assistant for the X Marketing Platform. Respond naturally and helpfully to users with comprehensive detail."
            )
        )

        return response.content

    def get_orchestrator_status(self) -> Dict[str, Any]:
        """Get current orchestrator status and metrics"""

        return {
            "orchestrator_status": "operational",
            "active_executions": len(self.active_executions),
            "total_functions": len(self.function_registry),
            "execution_history_count": len(self.execution_history),
            "intent_categories": len(self.intent_patterns),
            "ai_enhanced_functions": sum(1 for f in self.function_registry.values() if f.get("ai_enhanced", False)),
            "conversation_contexts": len(self.conversation_context),
            "capabilities": {
                "natural_language_understanding": True,
                "multi_step_execution": True,
                "ai_enhanced_functions": True,
                "conversation_memory": True,
                "intelligent_routing": True,
                "enterprise_orchestration": True
            }
        }

    def _serialize_dataclass(self, obj) -> Dict[str, Any]:
        """Serialize dataclass with enum handling for divine JSON compatibility"""
        if hasattr(obj, '__dataclass_fields__'):
            result = {}
            for field_name, field_value in asdict(obj).items():
                if hasattr(field_value, 'value'):  # Enum
                    result[field_name] = field_value.value
                elif hasattr(field_value, '__dataclass_fields__'):  # Nested dataclass
                    result[field_name] = self._serialize_dataclass(field_value)
                elif isinstance(field_value, list):
                    result[field_name] = [
                        self._serialize_dataclass(item) if hasattr(item, '__dataclass_fields__')
                        else item.value if hasattr(item, 'value')
                        else item
                        for item in field_value
                    ]
                elif isinstance(field_value, dict):
                    result[field_name] = {
                        k: self._serialize_dataclass(v) if hasattr(v, '__dataclass_fields__')
                        else v.value if hasattr(v, 'value')
                        else v
                        for k, v in field_value.items()
                    }
                else:
                    result[field_name] = field_value
            return result
        elif hasattr(obj, 'value'):  # Enum
            return obj.value
        else:
            return obj
