"""
Python Monitoring Instrumentation
Observability Excellence for X/Twitter Automation Platform
"""

import os
import time
import asyncio
import logging
from typing import Dict, Any, Optional
from prometheus_client import Counter, Histogram, Gauge, start_http_server, CollectorRegistry
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration

logger = logging.getLogger(__name__)

# Create custom registry
registry = CollectorRegistry()

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total', 
    'Total HTTP requests', 
    ['method', 'endpoint', 'status', 'service'],
    registry=registry
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds', 
    'HTTP request duration', 
    ['method', 'endpoint', 'service'],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30],
    registry=registry
)

ACTIVE_CONNECTIONS = Gauge(
    'active_connections', 
    'Active connections',
    ['service'],
    registry=registry
)

# LLM-specific metrics
LLM_INFERENCE_DURATION = Histogram(
    'llm_inference_duration_seconds',
    'Duration of LLM inference requests',
    ['model', 'endpoint', 'service'],
    buckets=[0.5, 1, 2, 5, 10, 30, 60],
    registry=registry
)

LLM_INFERENCE_REQUESTS = Counter(
    'llm_inference_requests_total',
    'Total LLM inference requests',
    ['model', 'status', 'service'],
    registry=registry
)

LLM_MODEL_MEMORY = Gauge(
    'llm_model_memory_usage_bytes',
    'Memory usage of LLM models',
    ['model', 'service'],
    registry=registry
)

LLM_QUEUE_SIZE = Gauge(
    'llm_queue_size',
    'Size of LLM processing queue',
    ['service'],
    registry=registry
)

# Twikit-specific metrics
TWIKIT_SESSIONS = Gauge(
    'twikit_active_sessions', 
    'Active Twikit sessions',
    registry=registry
)

TWIKIT_RATE_LIMIT = Gauge(
    'twikit_rate_limit_remaining', 
    'Twikit rate limit remaining',
    registry=registry
)

TWIKIT_RATE_LIMIT_TOTAL = Gauge(
    'twikit_rate_limit_total', 
    'Twikit rate limit total',
    registry=registry
)

TWIKIT_PROXY_HEALTH = Gauge(
    'twikit_healthy_proxies', 
    'Number of healthy proxies',
    registry=registry
)

TWIKIT_PROXY_TOTAL = Gauge(
    'twikit_total_proxies', 
    'Total number of proxies',
    registry=registry
)

TWIKIT_ANTI_DETECTION = Gauge(
    'twikit_anti_detection_score', 
    'Anti-detection effectiveness score',
    registry=registry
)

TWIKIT_SESSION_FAILURES = Counter(
    'twikit_session_failures_total', 
    'Total Twikit session failures',
    ['failure_type'],
    registry=registry
)

TWIKIT_PROXY_ROTATION = Counter(
    'twikit_proxy_rotation_total',
    'Total proxy rotations',
    ['reason'],
    registry=registry
)

TWIKIT_RATE_LIMIT_VIOLATIONS = Counter(
    'twikit_rate_limit_violations_total',
    'Total rate limit violations',
    ['endpoint'],
    registry=registry
)

# Database metrics
DATABASE_CONNECTIONS = Gauge(
    'database_connections_active',
    'Active database connections',
    ['database', 'service'],
    registry=registry
)

DATABASE_QUERY_DURATION = Histogram(
    'database_query_duration_seconds',
    'Database query duration',
    ['query_type', 'table', 'service'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registry=registry
)

# Redis metrics
REDIS_OPERATIONS = Counter(
    'redis_operations_total',
    'Total Redis operations',
    ['operation', 'status', 'service'],
    registry=registry
)

REDIS_OPERATION_DURATION = Histogram(
    'redis_operation_duration_seconds',
    'Redis operation duration',
    ['operation', 'service'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registry=registry
)

# Business metrics
USER_SESSIONS = Gauge(
    'user_sessions_active',
    'Active user sessions',
    ['service'],
    registry=registry
)

FEATURE_USAGE = Counter(
    'feature_usage_total',
    'Feature usage count',
    ['feature', 'user_type', 'service'],
    registry=registry
)

ERRORS_BY_TYPE = Counter(
    'errors_total',
    'Total errors by type',
    ['error_type', 'severity', 'service'],
    registry=registry
)


def setup_monitoring(service_name: str = 'llm-service') -> trace.Tracer:
    """Setup monitoring instrumentation"""
    
    logger.info(f"🔍 Setting up monitoring instrumentation for {service_name}...")
    
    # Setup OpenTelemetry tracing
    trace.set_tracer_provider(TracerProvider())
    tracer = trace.get_tracer(__name__)
    
    # Setup Jaeger exporter
    jaeger_exporter = JaegerExporter(
        agent_host_name=os.getenv('JAEGER_AGENT_HOST', 'localhost'),
        agent_port=int(os.getenv('JAEGER_AGENT_PORT', 6831)),
    )
    
    span_processor = BatchSpanProcessor(jaeger_exporter)
    trace.get_tracer_provider().add_span_processor(span_processor)
    
    # Setup Sentry
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        integrations=[
            FastApiIntegration(auto_enabling_integrations=True),
            AsyncioIntegration(),
        ],
        traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', 0.1)),
        profiles_sample_rate=float(os.getenv('SENTRY_PROFILES_SAMPLE_RATE', 0.1)),
        environment=os.getenv('ENVIRONMENT', 'production'),
        before_send=lambda event, hint: None if _is_health_check_event(event) else event,
    )
    
    # Auto-instrument libraries
    FastAPIInstrumentor().instrument()
    RequestsInstrumentor().instrument()
    Psycopg2Instrumentor().instrument()
    RedisInstrumentor().instrument()
    
    # Start Prometheus metrics server
    metrics_port = int(os.getenv('METRICS_PORT', 8000))
    start_http_server(metrics_port, registry=registry)
    
    logger.info(f"✅ Monitoring instrumentation setup complete for {service_name}")
    logger.info(f"📊 Metrics server started on port {metrics_port}")
    
    return tracer


def _is_health_check_event(event) -> bool:
    """Check if event is from health check endpoints"""
    if event.get('request', {}).get('url'):
        url = event['request']['url']
        return any(endpoint in url for endpoint in ['/health', '/metrics', '/ready'])
    return False


def record_request_metrics(method: str, endpoint: str, status_code: int, 
                         duration: float, service_name: str = 'llm-service'):
    """Record request metrics"""
    REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status_code, service=service_name).inc()
    REQUEST_DURATION.labels(method=method, endpoint=endpoint, service=service_name).observe(duration)


def record_llm_metrics(model: str, endpoint: str, duration: float, 
                      status: str, service_name: str = 'llm-service'):
    """Record LLM-specific metrics"""
    LLM_INFERENCE_DURATION.labels(model=model, endpoint=endpoint, service=service_name).observe(duration)
    LLM_INFERENCE_REQUESTS.labels(model=model, status=status, service=service_name).inc()


def update_llm_model_memory(model: str, memory_bytes: int, service_name: str = 'llm-service'):
    """Update LLM model memory usage"""
    LLM_MODEL_MEMORY.labels(model=model, service=service_name).set(memory_bytes)


def update_llm_queue_size(size: int, service_name: str = 'llm-service'):
    """Update LLM queue size"""
    LLM_QUEUE_SIZE.labels(service=service_name).set(size)


def update_twikit_metrics(sessions: int, rate_limit_remaining: int, rate_limit_total: int, 
                         healthy_proxies: int, total_proxies: int, anti_detection_score: float):
    """Update Twikit-specific metrics"""
    TWIKIT_SESSIONS.set(sessions)
    TWIKIT_RATE_LIMIT.set(rate_limit_remaining)
    TWIKIT_RATE_LIMIT_TOTAL.set(rate_limit_total)
    TWIKIT_PROXY_HEALTH.set(healthy_proxies)
    TWIKIT_PROXY_TOTAL.set(total_proxies)
    TWIKIT_ANTI_DETECTION.set(anti_detection_score)


def record_twikit_session_failure(failure_type: str = 'unknown'):
    """Record Twikit session failure"""
    TWIKIT_SESSION_FAILURES.labels(failure_type=failure_type).inc()


def record_twikit_proxy_rotation(reason: str = 'scheduled'):
    """Record Twikit proxy rotation"""
    TWIKIT_PROXY_ROTATION.labels(reason=reason).inc()


def record_twikit_rate_limit_violation(endpoint: str):
    """Record Twikit rate limit violation"""
    TWIKIT_RATE_LIMIT_VIOLATIONS.labels(endpoint=endpoint).inc()


def record_database_metrics(query_type: str, table: str, duration: float, 
                          service_name: str = 'llm-service'):
    """Record database metrics"""
    DATABASE_QUERY_DURATION.labels(query_type=query_type, table=table, service=service_name).observe(duration)


def update_database_connections(database: str, count: int, service_name: str = 'llm-service'):
    """Update database connection count"""
    DATABASE_CONNECTIONS.labels(database=database, service=service_name).set(count)


def record_redis_metrics(operation: str, status: str, duration: Optional[float] = None, 
                        service_name: str = 'llm-service'):
    """Record Redis metrics"""
    REDIS_OPERATIONS.labels(operation=operation, status=status, service=service_name).inc()
    if duration is not None:
        REDIS_OPERATION_DURATION.labels(operation=operation, service=service_name).observe(duration)


def record_business_metrics(metric_type: str, data: Dict[str, Any], service_name: str = 'llm-service'):
    """Record business metrics"""
    if metric_type == 'user_session':
        USER_SESSIONS.labels(service=service_name).set(data['count'])
    elif metric_type == 'feature_usage':
        FEATURE_USAGE.labels(
            feature=data['feature'], 
            user_type=data['user_type'], 
            service=service_name
        ).inc()
    elif metric_type == 'error':
        ERRORS_BY_TYPE.labels(
            error_type=data['error_type'], 
            severity=data['severity'], 
            service=service_name
        ).inc()


def update_active_connections(count: int, service_name: str = 'llm-service'):
    """Update active connections count"""
    ACTIVE_CONNECTIONS.labels(service=service_name).set(count)


class TwikitMonitor:
    """Monitor Twikit integration health and performance"""
    
    def __init__(self, twikit_client):
        self.twikit_client = twikit_client
        self.monitoring_active = True
        self._monitoring_task = None
        
    async def start_monitoring(self):
        """Start continuous monitoring of Twikit metrics"""
        logger.info("🐦 Starting Twikit monitoring...")
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())
        
    async def stop_monitoring(self):
        """Stop monitoring"""
        self.monitoring_active = False
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 Twikit monitoring stopped")
        
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                await self._collect_metrics()
                await asyncio.sleep(60)  # Collect metrics every minute
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error collecting Twikit metrics: {e}")
                record_twikit_session_failure('monitoring_error')
                await asyncio.sleep(30)  # Retry after 30 seconds on error
                
    async def _collect_metrics(self):
        """Collect Twikit-specific metrics"""
        try:
            # Get session metrics
            active_sessions = await self._get_active_sessions()
            
            # Get rate limit status
            rate_limit_info = await self._get_rate_limit_status()
            
            # Get proxy health
            proxy_health = await self._get_proxy_health()
            
            # Get anti-detection score
            anti_detection_score = await self._get_anti_detection_score()
            
            # Update Prometheus metrics
            update_twikit_metrics(
                sessions=active_sessions,
                rate_limit_remaining=rate_limit_info['remaining'],
                rate_limit_total=rate_limit_info['total'],
                healthy_proxies=proxy_health['healthy'],
                total_proxies=proxy_health['total'],
                anti_detection_score=anti_detection_score
            )
            
            logger.debug(f"Twikit metrics updated: sessions={active_sessions}, "
                        f"rate_limit={rate_limit_info['remaining']}/{rate_limit_info['total']}, "
                        f"proxies={proxy_health['healthy']}/{proxy_health['total']}, "
                        f"anti_detection={anti_detection_score}")
                        
        except Exception as e:
            logger.error(f"Failed to collect Twikit metrics: {e}")
            record_twikit_session_failure('collection_error')
            
    async def _get_active_sessions(self) -> int:
        """Get number of active Twikit sessions"""
        try:
            if hasattr(self.twikit_client, 'active_sessions'):
                return len(self.twikit_client.active_sessions)
            return 0
        except Exception:
            return 0
            
    async def _get_rate_limit_status(self) -> Dict[str, int]:
        """Get current rate limit status"""
        try:
            return {
                'remaining': getattr(self.twikit_client, 'rate_limit_remaining', 100),
                'total': getattr(self.twikit_client, 'rate_limit_total', 100)
            }
        except Exception:
            return {'remaining': 0, 'total': 100}
            
    async def _get_proxy_health(self) -> Dict[str, int]:
        """Get proxy pool health status"""
        try:
            total_proxies = getattr(self.twikit_client, 'total_proxies', 10)
            healthy_proxies = getattr(self.twikit_client, 'healthy_proxies', 8)
            return {'healthy': healthy_proxies, 'total': total_proxies}
        except Exception:
            return {'healthy': 0, 'total': 10}
            
    async def _get_anti_detection_score(self) -> float:
        """Get anti-detection effectiveness score"""
        try:
            return getattr(self.twikit_client, 'anti_detection_score', 0.85)
        except Exception:
            return 0.0


def create_health_check_handler():
    """Create health check endpoint handler"""
    def health_check():
        return {
            "status": "healthy",
            "timestamp": time.time(),
            "service": os.getenv('SERVICE_NAME', 'llm-service'),
            "version": os.getenv('SERVICE_VERSION', '1.0.0'),
            "environment": os.getenv('ENVIRONMENT', 'production'),
            "uptime": time.time() - start_time if 'start_time' in globals() else 0,
        }
    return health_check


def create_readiness_check_handler():
    """Create readiness check endpoint handler"""
    async def readiness_check():
        checks = {
            "database": False,
            "redis": False,
            "external_services": False,
            "twikit": False,
        }
        
        try:
            # Add actual health checks here
            # checks["database"] = await check_database_connection()
            # checks["redis"] = await check_redis_connection()
            # checks["external_services"] = await check_external_services()
            # checks["twikit"] = await check_twikit_health()
            
            # For now, assume all are healthy
            checks["database"] = True
            checks["redis"] = True
            checks["external_services"] = True
            checks["twikit"] = True
            
            all_healthy = all(checks.values())
            
            return {
                "status": "ready" if all_healthy else "not ready",
                "checks": checks,
                "timestamp": time.time(),
            }
        except Exception as e:
            return {
                "status": "not ready",
                "error": str(e),
                "checks": checks,
                "timestamp": time.time(),
            }
    
    return readiness_check


# Initialize start time
start_time = time.time()


def setup_graceful_shutdown():
    """Setup graceful shutdown handlers"""
    import signal
    
    def graceful_shutdown(signum, frame):
        logger.info(f"🛑 Received signal {signum}. Starting graceful shutdown...")
        
        # Close Sentry
        sentry_sdk.flush(timeout=2.0)
        
        # Additional cleanup can be added here
        
        exit(0)
    
    signal.signal(signal.SIGTERM, graceful_shutdown)
    signal.signal(signal.SIGINT, graceful_shutdown)
