#!/usr/bin/env python3
"""
Enterprise-Grade Rate Limiter for Gemini API
Provides intelligent rate limiting, queuing, and request prioritization
"""

import os
import asyncio
import logging
import time
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import heapq
import threading
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

class RequestPriority(Enum):
    """Request priority levels"""
    CRITICAL = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4

@dataclass
class QueuedRequest:
    """Queued request with priority and metadata"""
    priority: RequestPriority
    request_id: str
    callback: Callable
    args: tuple
    kwargs: dict
    created_at: datetime = field(default_factory=datetime.now)
    retries: int = 0
    max_retries: int = 3
    
    def __lt__(self, other):
        """For priority queue ordering"""
        if self.priority.value != other.priority.value:
            return self.priority.value < other.priority.value
        return self.created_at < other.created_at

class RateLimitWindow:
    """Sliding window rate limiter"""
    
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window_seconds = window_seconds
        self.requests = deque()
        self.lock = threading.Lock()
    
    def can_proceed(self) -> bool:
        """Check if request can proceed within rate limit"""
        with self.lock:
            now = time.time()
            
            # Remove old requests outside the window
            while self.requests and self.requests[0] <= now - self.window_seconds:
                self.requests.popleft()
            
            return len(self.requests) < self.limit
    
    def add_request(self):
        """Add a request to the window"""
        with self.lock:
            self.requests.append(time.time())
    
    def get_wait_time(self) -> float:
        """Get time to wait before next request can be made"""
        with self.lock:
            if len(self.requests) < self.limit:
                return 0.0
            
            oldest_request = self.requests[0]
            wait_time = oldest_request + self.window_seconds - time.time()
            return max(0.0, wait_time)

class TokenBucket:
    """Token bucket algorithm for smooth rate limiting"""
    
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.last_refill = time.time()
        self.lock = threading.Lock()
    
    def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens from the bucket"""
        with self.lock:
            self._refill()
            
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False
    
    def _refill(self):
        """Refill tokens based on time elapsed"""
        now = time.time()
        elapsed = now - self.last_refill
        tokens_to_add = elapsed * self.refill_rate
        
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now
    
    def get_wait_time(self, tokens: int = 1) -> float:
        """Get time to wait for tokens to be available"""
        with self.lock:
            self._refill()
            
            if self.tokens >= tokens:
                return 0.0
            
            needed_tokens = tokens - self.tokens
            return needed_tokens / self.refill_rate

class CircuitBreaker:
    """Circuit breaker pattern for handling failures"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.lock = threading.Lock()
    
    def can_proceed(self) -> bool:
        """Check if requests can proceed through the circuit breaker"""
        with self.lock:
            if self.state == "CLOSED":
                return True
            elif self.state == "OPEN":
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = "HALF_OPEN"
                    return True
                return False
            else:  # HALF_OPEN
                return True
    
    def record_success(self):
        """Record a successful request"""
        with self.lock:
            self.failure_count = 0
            self.state = "CLOSED"
    
    def record_failure(self):
        """Record a failed request"""
        with self.lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"

class GeminiRateLimiter:
    """Enterprise-grade rate limiter for Gemini API"""
    
    def __init__(self):
        # Rate limit configurations from environment
        self.rpm_limit = int(os.getenv('GEMINI_RPM_LIMIT', 15))
        self.rpd_limit = int(os.getenv('GEMINI_RPD_LIMIT', 1500))
        self.tpm_limit = int(os.getenv('GEMINI_TPM_LIMIT', 1000000))
        
        # Rate limiters
        self.rpm_limiter = RateLimitWindow(self.rpm_limit, 60)
        self.rpd_limiter = RateLimitWindow(self.rpd_limit, 86400)  # 24 hours
        self.token_bucket = TokenBucket(self.tpm_limit, self.tpm_limit / 60)  # Tokens per second
        
        # Circuit breaker
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=int(os.getenv('FALLBACK_THRESHOLD_ERRORS', 5)),
            recovery_timeout=int(os.getenv('FALLBACK_COOLDOWN_MINUTES', 10)) * 60
        )
        
        # Priority queue for requests
        self.request_queue = []
        self.queue_lock = asyncio.Lock()
        self.max_queue_size = int(os.getenv('QUEUE_MAX_SIZE', 1000))
        
        # Processing state
        self.is_processing = False
        self.processing_task = None
        
        # Metrics
        self.metrics = {
            'queued_requests': 0,
            'processed_requests': 0,
            'dropped_requests': 0,
            'rate_limited_requests': 0,
            'circuit_breaker_trips': 0,
            'average_queue_time': 0.0
        }
        
        logger.info(f"GeminiRateLimiter initialized with RPM: {self.rpm_limit}, RPD: {self.rpd_limit}, TPM: {self.tpm_limit}")
    
    async def enqueue_request(self, callback: Callable, *args, 
                            priority: RequestPriority = RequestPriority.NORMAL,
                            request_id: Optional[str] = None, **kwargs) -> str:
        """Enqueue a request with priority"""
        if not request_id:
            request_id = f"req_{int(time.time() * 1000)}_{id(callback)}"
        
        async with self.queue_lock:
            if len(self.request_queue) >= self.max_queue_size:
                self.metrics['dropped_requests'] += 1
                raise Exception(f"Queue full: {len(self.request_queue)}/{self.max_queue_size}")
            
            queued_request = QueuedRequest(
                priority=priority,
                request_id=request_id,
                callback=callback,
                args=args,
                kwargs=kwargs
            )
            
            heapq.heappush(self.request_queue, queued_request)
            self.metrics['queued_requests'] += 1
            
            logger.debug(f"Request {request_id} queued with priority {priority.name}")
        
        # Start processing if not already running
        if not self.is_processing:
            await self.start_processing()
        
        return request_id
    
    async def start_processing(self):
        """Start processing queued requests"""
        if self.is_processing:
            return
        
        self.is_processing = True
        self.processing_task = asyncio.create_task(self._process_queue())
        logger.info("Started request queue processing")
    
    async def stop_processing(self):
        """Stop processing queued requests"""
        self.is_processing = False
        if self.processing_task:
            self.processing_task.cancel()
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped request queue processing")
    
    async def _process_queue(self):
        """Process requests from the priority queue"""
        while self.is_processing:
            try:
                async with self.queue_lock:
                    if not self.request_queue:
                        await asyncio.sleep(0.1)
                        continue
                    
                    request = heapq.heappop(self.request_queue)
                
                # Check if we can proceed
                if not await self._can_proceed_with_request():
                    # Re-queue the request
                    async with self.queue_lock:
                        heapq.heappush(self.request_queue, request)
                    
                    await asyncio.sleep(1)  # Wait before retrying
                    continue
                
                # Process the request
                await self._execute_request(request)
                
            except Exception as e:
                logger.error(f"Error in queue processing: {e}")
                await asyncio.sleep(1)
    
    async def _can_proceed_with_request(self) -> bool:
        """Check if a request can proceed based on all rate limits"""
        # Check circuit breaker
        if not self.circuit_breaker.can_proceed():
            return False
        
        # Check rate limits
        if not self.rpm_limiter.can_proceed():
            self.metrics['rate_limited_requests'] += 1
            return False
        
        if not self.rpd_limiter.can_proceed():
            self.metrics['rate_limited_requests'] += 1
            return False
        
        # Check token bucket (assuming 1000 tokens per request average)
        if not self.token_bucket.consume(1000):
            return False
        
        return True
    
    async def _execute_request(self, request: QueuedRequest):
        """Execute a queued request"""
        start_time = time.time()
        
        try:
            # Record request in rate limiters
            self.rpm_limiter.add_request()
            self.rpd_limiter.add_request()
            
            # Execute the callback
            result = await request.callback(*request.args, **request.kwargs)
            
            # Record success
            self.circuit_breaker.record_success()
            self.metrics['processed_requests'] += 1
            
            # Update average queue time
            queue_time = start_time - request.created_at.timestamp()
            self._update_average_queue_time(queue_time)
            
            logger.debug(f"Request {request.request_id} processed successfully")
            
        except Exception as e:
            logger.error(f"Request {request.request_id} failed: {e}")
            
            # Record failure
            self.circuit_breaker.record_failure()
            
            # Retry if possible
            if request.retries < request.max_retries:
                request.retries += 1
                async with self.queue_lock:
                    heapq.heappush(self.request_queue, request)
                logger.info(f"Request {request.request_id} requeued for retry {request.retries}/{request.max_retries}")
            else:
                logger.error(f"Request {request.request_id} failed after {request.max_retries} retries")
    
    def _update_average_queue_time(self, queue_time: float):
        """Update average queue time metric"""
        processed = self.metrics['processed_requests']
        current_avg = self.metrics['average_queue_time']
        
        self.metrics['average_queue_time'] = (
            (current_avg * (processed - 1) + queue_time) / processed
        )
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status"""
        return {
            'queue_size': len(self.request_queue),
            'max_queue_size': self.max_queue_size,
            'is_processing': self.is_processing,
            'circuit_breaker_state': self.circuit_breaker.state,
            'rate_limits': {
                'rpm_available': self.rpm_limiter.limit - len(self.rpm_limiter.requests),
                'rpd_available': self.rpd_limiter.limit - len(self.rpd_limiter.requests),
                'rpm_wait_time': self.rpm_limiter.get_wait_time(),
                'rpd_wait_time': self.rpd_limiter.get_wait_time()
            },
            'metrics': self.metrics.copy()
        }
    
    def reset_metrics(self):
        """Reset rate limiter metrics"""
        self.metrics = {
            'queued_requests': 0,
            'processed_requests': 0,
            'dropped_requests': 0,
            'rate_limited_requests': 0,
            'circuit_breaker_trips': 0,
            'average_queue_time': 0.0
        }
        logger.info("Rate limiter metrics reset")
