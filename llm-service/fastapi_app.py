#!/usr/bin/env python3
"""
FastAPI Enterprise LLM Service with Natural Language Orchestrator
Revolutionary async-first architecture for the world's most advanced conversational AI
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Enterprise LLM Service with Natural Language Orchestrator",
    description="Revolutionary AI system that understands natural language and orchestrates ALL X Marketing Platform functions",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for services
gemini_client = None
natural_language_orchestrator = None
enterprise_orchestrator = None
model_router = None
gemini_monitoring = None

# Pydantic models for request/response
class NaturalLanguageRequest(BaseModel):
    user_input: str = Field(..., description="Natural language input from user")
    user_context: Optional[Dict[str, Any]] = Field(default={}, description="User context information")
    conversation_history: Optional[List[str]] = Field(default=[], description="Recent conversation history")

class NaturalLanguageResponse(BaseModel):
    success: bool
    user_intent: Optional[Dict[str, Any]] = None
    execution_plan: Optional[Dict[str, Any]] = None
    execution_result: Optional[Dict[str, Any]] = None
    natural_response: str
    processing_time: float
    orchestrator_metadata: Optional[Dict[str, Any]] = None
    requires_confirmation: Optional[bool] = None
    confirmation_message: Optional[str] = None
    error: Optional[str] = None

class EnterpriseGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Generation prompt")
    model: Optional[str] = Field(default="gemini-2.5-pro", description="Model to use")
    context: Optional[Dict[str, Any]] = Field(default={}, description="Generation context")
    temperature: Optional[float] = Field(default=0.7, description="Generation temperature")
    max_tokens: Optional[int] = Field(default=32768, description="Maximum tokens (up to 65K for Pro, 128K for Flash)")

class EnterpriseOrchestrationRequest(BaseModel):
    prompt: str = Field(..., description="Campaign orchestration prompt")
    complexity: Optional[str] = Field(default="enterprise", description="Campaign complexity")
    context: Optional[Dict[str, Any]] = Field(default={}, description="Campaign context")

@app.on_event("startup")
async def startup_event():
    """Initialize all enterprise services on startup"""
    global gemini_client, natural_language_orchestrator, enterprise_orchestrator, model_router, gemini_monitoring
    
    try:
        logger.info("🚀 Initializing Enterprise LLM Service with FastAPI...")
        
        # Check for API key
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            logger.error("❌ GEMINI_API_KEY environment variable not set")
            return
        
        # Import and initialize services
        from services.gemini import GeminiClient, GeminiOrchestrator, GeminiRateLimiter
        from services.gemini.monitoring import GeminiMonitoringService
        from services.gemini.enterprise_multimodal_orchestrator import EnterpriseMultimodalOrchestrator
        from services.gemini.advanced_model_router import AdvancedModelRouter
        from services.gemini.natural_language_orchestrator import NaturalLanguageOrchestrator
        
        # Initialize core services
        gemini_rate_limiter = GeminiRateLimiter()
        gemini_client = GeminiClient()  # Uses environment variable

        # Initialize session for async operations
        await gemini_client.initialize_session()
        
        # Initialize enterprise components
        enterprise_orchestrator = EnterpriseMultimodalOrchestrator(gemini_client, gemini_rate_limiter)
        model_router = AdvancedModelRouter(gemini_client, gemini_rate_limiter)
        natural_language_orchestrator = NaturalLanguageOrchestrator(gemini_client, gemini_rate_limiter)
        
        # Initialize monitoring
        gemini_monitoring = GeminiMonitoringService()
        await gemini_monitoring.start()
        
        logger.info("✅ Enterprise Gemini 2.5 services initialized successfully")
        logger.info("🧠 Primary Model: gemini-2.5-pro")
        logger.info("⚡ Deep Think: true")
        logger.info("🎭 Multimodal: true")
        logger.info("🤖 Natural Language Orchestrator: ✅ Active")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {e}")
        gemini_client = None
        natural_language_orchestrator = None
        enterprise_orchestrator = None

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global gemini_client, gemini_monitoring
    
    try:
        if gemini_monitoring:
            await gemini_monitoring.stop()
        
        if gemini_client and gemini_client.session:
            await gemini_client.session.close()
            
        logger.info("🔄 Enterprise LLM Service shutdown complete")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Enterprise LLM Service with Natural Language Orchestrator",
        "version": "2.0.0",
        "status": "operational" if natural_language_orchestrator else "initializing",
        "capabilities": {
            "natural_language_understanding": True,
            "multi_step_execution": True,
            "ai_enhanced_functions": True,
            "conversation_memory": True,
            "intelligent_routing": True,
            "enterprise_orchestration": True
        },
        "endpoints": {
            "natural_language": "/api/gemini/natural-language",
            "enterprise_generation": "/api/gemini/enterprise/generate",
            "enterprise_orchestration": "/api/gemini/enterprise/orchestrate",
            "status": "/api/gemini/enterprise/status",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy" if natural_language_orchestrator else "unhealthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "gemini_client": gemini_client is not None,
            "natural_language_orchestrator": natural_language_orchestrator is not None,
            "enterprise_orchestrator": enterprise_orchestrator is not None,
            "model_router": model_router is not None,
            "monitoring": gemini_monitoring is not None
        }
    }

@app.post("/api/gemini/natural-language", response_model=NaturalLanguageResponse)
async def natural_language_orchestration(request: NaturalLanguageRequest):
    """
    Revolutionary Natural Language Orchestration Endpoint
    Understands ANY user input and orchestrates ALL X Marketing Platform functions
    """
    if not natural_language_orchestrator:
        raise HTTPException(status_code=503, detail="Natural Language Orchestrator not available")

    try:
        # Execute natural language orchestration
        result = await natural_language_orchestrator.understand_and_orchestrate(
            user_input=request.user_input,
            user_context=request.user_context,
            conversation_history=request.conversation_history
        )

        return NaturalLanguageResponse(**result)

    except Exception as e:
        logger.error(f"Natural language orchestration error: {e}")
        return NaturalLanguageResponse(
            success=False,
            error=str(e),
            natural_response="I apologize, but I encountered an issue processing your request. Please try again or contact support if the problem persists.",
            processing_time=0.0
        )

@app.get("/api/gemini/natural-language/status")
async def natural_language_status():
    """Get Natural Language Orchestrator status"""
    if not natural_language_orchestrator:
        raise HTTPException(status_code=503, detail="Natural Language Orchestrator not available")

    try:
        status = natural_language_orchestrator.get_orchestrator_status()
        return status

    except Exception as e:
        logger.error(f"Natural language status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/gemini/enterprise/generate")
async def enterprise_generation(request: EnterpriseGenerationRequest):
    """Enterprise content generation with Gemini 2.5"""
    if not gemini_client:
        raise HTTPException(status_code=503, detail="Gemini client not available")

    try:
        from services.gemini.gemini_client import GeminiRequest, GeminiModel
        
        # Map string model to enum
        model_map = {
            "gemini-2.5-pro": GeminiModel.PRO_2_5,
            "gemini-2.5-flash": GeminiModel.FLASH_2_5,
            "gemini-2.5-pro-preview": GeminiModel.PRO_2_5_PREVIEW,
            "gemini-2.5-flash-preview": GeminiModel.FLASH_2_5_PREVIEW
        }
        
        model = model_map.get(request.model, GeminiModel.PRO_2_5)
        
        gemini_request = GeminiRequest(
            prompt=request.prompt,
            model=model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            system_instruction="You are an enterprise AI assistant for the X Marketing Platform."
        )

        response = await gemini_client.generate_content(gemini_request)
        
        return {
            "content": response.content,
            "model": response.model,
            "usage": response.usage,
            "response_time": response.response_time,
            "quality_score": response.quality_score,
            "confidence_score": response.confidence_score,
            "reasoning_trace": response.reasoning_trace,
            "deep_think_steps": response.deep_think_steps
        }

    except Exception as e:
        logger.error(f"Enterprise generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/gemini/enterprise/orchestrate")
async def enterprise_orchestration(request: EnterpriseOrchestrationRequest):
    """Enterprise campaign orchestration"""
    if not enterprise_orchestrator:
        raise HTTPException(status_code=503, detail="Enterprise orchestrator not available")

    try:
        from services.gemini.enterprise_multimodal_orchestrator import CampaignComplexity
        
        # Map string complexity to enum
        complexity_map = {
            "simple": CampaignComplexity.SIMPLE,
            "moderate": CampaignComplexity.MODERATE,
            "complex": CampaignComplexity.COMPLEX,
            "enterprise": CampaignComplexity.ENTERPRISE
        }
        
        complexity = complexity_map.get(request.complexity, CampaignComplexity.ENTERPRISE)
        
        result = await enterprise_orchestrator.orchestrate_campaign(
            prompt=request.prompt,
            complexity=complexity,
            context=request.context
        )

        return result

    except Exception as e:
        logger.error(f"Enterprise orchestration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/gemini/enterprise/status")
async def enterprise_status():
    """Get comprehensive enterprise service status"""
    try:
        status = {
            "service_status": "operational" if all([gemini_client, natural_language_orchestrator, enterprise_orchestrator]) else "degraded",
            "service_tier": "enterprise",
            "timestamp": datetime.utcnow().isoformat(),
            "models_available": {
                "gemini_2_5_pro": True,
                "gemini_2_5_flash": True,
                "gemini_2_5_pro_preview": True,
                "gemini_2_5_flash_preview": True
            },
            "enterprise_features": {
                "deep_think_mode": True,
                "intelligent_routing": True,
                "multimodal_processing": True,
                "predictive_analytics": True,
                "real_time_optimization": True,
                "natural_language_orchestration": True,
                "multi_account_coordination": True
            },
            "natural_language_orchestrator": {
                "status": "operational" if natural_language_orchestrator else "unavailable",
                "capabilities": natural_language_orchestrator.get_orchestrator_status() if natural_language_orchestrator else {}
            }
        }

        if model_router:
            status["routing_analytics"] = model_router.get_routing_analytics()

        return status

    except Exception as e:
        logger.error(f"Enterprise status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run the FastAPI server
    uvicorn.run(
        "fastapi_app:app",
        host="0.0.0.0",
        port=3005,  # Different port from Flask
        reload=True,
        log_level="info"
    )
