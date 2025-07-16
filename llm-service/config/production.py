"""
Production Configuration for LLM Service
Enterprise-grade configuration with security, monitoring, and performance optimizations
"""

import os
from typing import Dict, Any, List
from pydantic import BaseSettings, validator
from enum import Enum

class LogLevel(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

class ProductionConfig(BaseSettings):
    """Production configuration with comprehensive settings"""
    
    # Application Settings
    app_name: str = "X Marketing Platform LLM Service"
    app_version: str = "2.0.0"
    environment: Environment = Environment.PRODUCTION
    debug: bool = False
    
    # Server Settings
    host: str = "0.0.0.0"
    port: int = 3005
    workers: int = 4
    max_requests: int = 1000
    max_requests_jitter: int = 100
    timeout: int = 120
    keep_alive: int = 5
    
    # Security Settings
    secret_key: str = os.getenv("SECRET_KEY", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "")
    jwt_algorithm: str = "HS256"
    jwt_expiration: int = 86400  # 24 hours
    
    # CORS Settings
    cors_origins: List[str] = ["*"]
    cors_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    cors_headers: List[str] = ["*"]
    cors_credentials: bool = True
    
    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100
    rate_limit_window: int = 3600  # 1 hour
    rate_limit_storage: str = "redis"
    
    # Database Settings
    postgres_host: str = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port: int = int(os.getenv("POSTGRES_PORT", "5432"))
    postgres_db: str = os.getenv("POSTGRES_DB", "x_marketing_platform")
    postgres_user: str = os.getenv("POSTGRES_USER", "postgres")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "")
    postgres_ssl: bool = os.getenv("POSTGRES_SSL", "false").lower() == "true"
    postgres_pool_size: int = 20
    postgres_max_overflow: int = 30
    postgres_pool_timeout: int = 30
    postgres_pool_recycle: int = 3600
    
    # Redis Settings
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_password: str = os.getenv("REDIS_PASSWORD", "")
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    redis_ssl: bool = os.getenv("REDIS_SSL", "false").lower() == "true"
    redis_pool_size: int = 50
    redis_timeout: int = 5
    
    # Gemini API Settings
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_timeout: int = 60
    gemini_max_retries: int = 3
    gemini_retry_delay: float = 1.0
    gemini_rate_limit: int = 60  # requests per minute
    
    # Logging Settings
    log_level: LogLevel = LogLevel.INFO
    log_format: str = "json"
    log_file: str = "/app/logs/application.log"
    log_max_size: str = "100MB"
    log_backup_count: int = 5
    log_rotation: str = "midnight"
    
    # Monitoring Settings
    monitoring_enabled: bool = True
    metrics_port: int = 9090
    metrics_path: str = "/metrics"
    health_check_path: str = "/health"
    
    # Sentry Settings (Error Tracking)
    sentry_dsn: str = os.getenv("SENTRY_DSN", "")
    sentry_environment: str = "production"
    sentry_traces_sample_rate: float = 0.1
    
    # Performance Settings
    async_pool_size: int = 100
    connection_timeout: int = 30
    read_timeout: int = 60
    write_timeout: int = 60
    
    # Cache Settings
    cache_enabled: bool = True
    cache_ttl: int = 3600  # 1 hour
    cache_max_size: int = 1000
    cache_backend: str = "redis"
    
    # Natural Language Orchestrator Settings
    orchestrator_enabled: bool = True
    orchestrator_timeout: int = 120
    orchestrator_max_functions: int = 50
    orchestrator_max_steps: int = 10
    orchestrator_confidence_threshold: float = 0.7
    
    # Circuit Breaker Settings
    circuit_breaker_enabled: bool = True
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_recovery_timeout: int = 60
    circuit_breaker_expected_exception: str = "Exception"
    
    # Backup and Recovery
    backup_enabled: bool = True
    backup_interval: int = 86400  # 24 hours
    backup_retention: int = 30  # days
    backup_location: str = "/app/backups"
    
    # Feature Flags
    features: Dict[str, bool] = {
        "deep_think_mode": True,
        "multimodal_processing": True,
        "advanced_analytics": True,
        "real_time_monitoring": True,
        "auto_scaling": True,
        "intelligent_routing": True,
        "conversation_memory": True,
        "enterprise_orchestration": True
    }
    
    # Resource Limits
    max_memory_usage: int = 4 * 1024 * 1024 * 1024  # 4GB
    max_cpu_usage: float = 0.8  # 80%
    max_concurrent_requests: int = 1000
    max_request_size: int = 10 * 1024 * 1024  # 10MB
    
    # Alerting Thresholds
    alert_thresholds: Dict[str, Any] = {
        "response_time_warning": 1000,  # ms
        "response_time_critical": 5000,  # ms
        "error_rate_warning": 0.05,  # 5%
        "error_rate_critical": 0.1,  # 10%
        "memory_usage_warning": 0.8,  # 80%
        "memory_usage_critical": 0.9,  # 90%
        "cpu_usage_warning": 0.8,  # 80%
        "cpu_usage_critical": 0.9,  # 90%
    }
    
    @validator("gemini_api_key")
    def validate_gemini_api_key(cls, v):
        if not v:
            raise ValueError("GEMINI_API_KEY is required")
        return v
    
    @validator("postgres_password")
    def validate_postgres_password(cls, v):
        if not v:
            raise ValueError("POSTGRES_PASSWORD is required")
        return v
    
    @validator("secret_key")
    def validate_secret_key(cls, v):
        if not v:
            raise ValueError("SECRET_KEY is required")
        return v
    
    @validator("jwt_secret")
    def validate_jwt_secret(cls, v):
        if not v:
            raise ValueError("JWT_SECRET is required")
        return v
    
    @property
    def database_url(self) -> str:
        """Construct database URL"""
        return f"postgresql://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
    
    @property
    def redis_url(self) -> str:
        """Construct Redis URL"""
        auth = f":{self.redis_password}@" if self.redis_password else ""
        protocol = "rediss" if self.redis_ssl else "redis"
        return f"{protocol}://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.environment == Environment.PRODUCTION
    
    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.environment == Environment.DEVELOPMENT
    
    def get_logging_config(self) -> Dict[str, Any]:
        """Get logging configuration"""
        return {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "class": "pythonjsonlogger.jsonlogger.JsonFormatter",
                    "format": "%(asctime)s %(name)s %(levelname)s %(message)s"
                },
                "standard": {
                    "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "level": self.log_level.value.upper(),
                    "formatter": self.log_format,
                    "stream": "ext://sys.stdout"
                },
                "file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "level": self.log_level.value.upper(),
                    "formatter": self.log_format,
                    "filename": self.log_file,
                    "maxBytes": 100 * 1024 * 1024,  # 100MB
                    "backupCount": self.log_backup_count
                }
            },
            "loggers": {
                "": {
                    "handlers": ["console", "file"],
                    "level": self.log_level.value.upper(),
                    "propagate": False
                },
                "uvicorn": {
                    "handlers": ["console", "file"],
                    "level": "INFO",
                    "propagate": False
                },
                "fastapi": {
                    "handlers": ["console", "file"],
                    "level": "INFO",
                    "propagate": False
                }
            }
        }
    
    def get_cors_config(self) -> Dict[str, Any]:
        """Get CORS configuration"""
        return {
            "allow_origins": self.cors_origins,
            "allow_methods": self.cors_methods,
            "allow_headers": self.cors_headers,
            "allow_credentials": self.cors_credentials
        }
    
    def get_rate_limit_config(self) -> Dict[str, Any]:
        """Get rate limiting configuration"""
        return {
            "enabled": self.rate_limit_enabled,
            "requests": self.rate_limit_requests,
            "window": self.rate_limit_window,
            "storage": self.rate_limit_storage,
            "storage_uri": self.redis_url if self.rate_limit_storage == "redis" else None
        }
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

# Create global configuration instance
config = ProductionConfig()

# Export commonly used configurations
DATABASE_URL = config.database_url
REDIS_URL = config.redis_url
LOGGING_CONFIG = config.get_logging_config()
CORS_CONFIG = config.get_cors_config()
RATE_LIMIT_CONFIG = config.get_rate_limit_config()

# Feature flags
FEATURES = config.features

# Alert thresholds
ALERT_THRESHOLDS = config.alert_thresholds
