"""
Enterprise Event Bus Implementation for LLM Service
Provides reliable, scalable event-driven communication using Kafka
"""

import json
import asyncio
import logging
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime
from uuid import uuid4
from dataclasses import dataclass, asdict
from kafka import KafkaProducer, KafkaConsumer
from kafka.errors import KafkaError
import structlog

logger = structlog.get_logger(__name__)

@dataclass
class BaseEvent:
    id: str
    type: str
    timestamp: datetime
    correlation_id: str
    source: str
    version: str

@dataclass
class LLMEvent(BaseEvent):
    user_id: int
    model: str
    operation: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class ContentEvent(BaseEvent):
    user_id: int
    content_type: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class SystemEvent(BaseEvent):
    service: str
    data: Dict[str, Any]
    severity: str = 'medium'

class LLMEventBus:
    """Enterprise Event Bus for LLM Service"""
    
    TOPICS = {
        'LLM_EVENTS': 'llm-events',
        'CONTENT_EVENTS': 'content-events',
        'SYSTEM_EVENTS': 'system-events',
        'ERROR_EVENTS': 'error-events'
    }
    
    def __init__(self, kafka_config: Optional[Dict[str, Any]] = None):
        self.kafka_config = kafka_config or {
            'bootstrap_servers': ['kafka:29092'],
            'client_id': 'llm-service',
            'value_serializer': lambda v: json.dumps(v, default=str).encode('utf-8'),
            'value_deserializer': lambda m: json.loads(m.decode('utf-8')),
            'acks': 'all',
            'retries': 5,
            'retry_backoff_ms': 1000,
            'max_in_flight_requests_per_connection': 1,
            'enable_idempotence': True
        }
        
        self.producer: Optional[KafkaProducer] = None
        self.consumers: Dict[str, KafkaConsumer] = {}
        self.is_connected = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        
    async def initialize(self):
        """Initialize the event bus"""
        try:
            logger.info("Initializing LLM Event Bus...")
            
            # Initialize producer
            self.producer = KafkaProducer(**self.kafka_config)
            
            # Create topics if they don't exist
            await self._create_topics()
            
            self.is_connected = True
            self.reconnect_attempts = 0
            
            logger.info("LLM Event Bus initialized successfully")
            
        except Exception as error:
            logger.error("Failed to initialize Event Bus", error=str(error))
            await self._handle_reconnection()
            raise error
    
    async def publish(self, event: BaseEvent):
        """Publish an event to the appropriate topic"""
        if not self.is_connected or not self.producer:
            raise Exception("Event Bus not connected")
        
        try:
            topic = self._get_topic_for_event_type(event.type)
            message = asdict(event)
            
            # Convert datetime to string for JSON serialization
            message['timestamp'] = event.timestamp.isoformat()
            
            future = self.producer.send(
                topic,
                key=str(event.user_id if hasattr(event, 'user_id') else event.id),
                value=message,
                headers={
                    'event-type': event.type.encode('utf-8'),
                    'correlation-id': event.correlation_id.encode('utf-8'),
                    'source': event.source.encode('utf-8'),
                    'version': event.version.encode('utf-8')
                }
            )
            
            # Wait for the message to be sent
            record_metadata = future.get(timeout=10)
            
            logger.debug(
                "Event published successfully",
                event_id=event.id,
                event_type=event.type,
                topic=topic,
                partition=record_metadata.partition,
                offset=record_metadata.offset,
                correlation_id=event.correlation_id
            )
            
        except Exception as error:
            logger.error(
                "Failed to publish event",
                error=str(error),
                event_id=event.id,
                event_type=event.type
            )
            
            # Publish error event
            await self.publish_system_event(
                'system.error',
                'llm-service',
                {
                    'error': str(error),
                    'event_id': event.id,
                    'event_type': event.type
                },
                'high'
            )
            
            raise error
    
    async def subscribe(
        self,
        event_type: str,
        handler: Callable[[Dict[str, Any]], None],
        group_id: Optional[str] = None
    ):
        """Subscribe to events of a specific type"""
        group_id = group_id or f"llm-{event_type}-consumer"
        
        try:
            topic = self._get_topic_for_event_type(event_type)
            
            consumer_config = {
                **self.kafka_config,
                'group_id': group_id,
                'auto_offset_reset': 'latest',
                'enable_auto_commit': True,
                'session_timeout_ms': 30000,
                'heartbeat_interval_ms': 3000
            }
            
            # Remove producer-specific configs
            consumer_config.pop('acks', None)
            consumer_config.pop('retries', None)
            consumer_config.pop('enable_idempotence', None)
            consumer_config.pop('max_in_flight_requests_per_connection', None)
            
            consumer = KafkaConsumer(topic, **consumer_config)
            self.consumers[f"{group_id}-{event_type}"] = consumer
            
            # Start consuming in background
            asyncio.create_task(self._consume_messages(consumer, handler, event_type))
            
            logger.info(
                "Subscribed to events",
                event_type=event_type,
                topic=topic,
                group_id=group_id
            )
            
        except Exception as error:
            logger.error(
                "Failed to subscribe to events",
                error=str(error),
                event_type=event_type,
                group_id=group_id
            )
            raise error
    
    async def publish_llm_event(
        self,
        event_type: str,
        user_id: int,
        model: str,
        operation: str,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Publish an LLM-specific event"""
        event = LLMEvent(
            id=str(uuid4()),
            type=event_type,
            user_id=user_id,
            model=model,
            operation=operation,
            data=data,
            metadata=metadata,
            timestamp=datetime.utcnow(),
            correlation_id=str(uuid4()),
            source='llm-service',
            version='1.0.0'
        )
        
        await self.publish(event)
    
    async def publish_content_event(
        self,
        event_type: str,
        user_id: int,
        content_type: str,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Publish a content-specific event"""
        event = ContentEvent(
            id=str(uuid4()),
            type=event_type,
            user_id=user_id,
            content_type=content_type,
            data=data,
            metadata=metadata,
            timestamp=datetime.utcnow(),
            correlation_id=str(uuid4()),
            source='llm-service',
            version='1.0.0'
        )
        
        await self.publish(event)
    
    async def publish_system_event(
        self,
        event_type: str,
        service: str,
        data: Dict[str, Any],
        severity: str = 'medium'
    ):
        """Publish a system event"""
        event = SystemEvent(
            id=str(uuid4()),
            type=event_type,
            service=service,
            data=data,
            severity=severity,
            timestamp=datetime.utcnow(),
            correlation_id=str(uuid4()),
            source='llm-service',
            version='1.0.0'
        )
        
        await self.publish(event)
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get health status of the event bus"""
        return {
            'connected': self.is_connected,
            'reconnect_attempts': self.reconnect_attempts,
            'active_consumers': len(self.consumers),
            'topics': list(self.TOPICS.values())
        }
    
    async def shutdown(self):
        """Gracefully shutdown the event bus"""
        logger.info("Shutting down LLM Event Bus...")
        
        try:
            # Close all consumers
            for key, consumer in self.consumers.items():
                consumer.close()
                logger.debug(f"Consumer {key} closed")
            
            self.consumers.clear()
            
            # Close producer
            if self.producer:
                self.producer.close()
            
            self.is_connected = False
            logger.info("LLM Event Bus shutdown completed")
            
        except Exception as error:
            logger.error("Error during Event Bus shutdown", error=str(error))
            raise error
    
    async def _create_topics(self):
        """Create required topics"""
        # This would typically use Kafka Admin API
        # For now, topics are created automatically by Kafka
        logger.info("Kafka topics will be created automatically")
    
    def _get_topic_for_event_type(self, event_type: str) -> str:
        """Get appropriate topic for event type"""
        if event_type.startswith('llm.'):
            return self.TOPICS['LLM_EVENTS']
        elif event_type.startswith('content.'):
            return self.TOPICS['CONTENT_EVENTS']
        elif event_type.startswith('system.'):
            return self.TOPICS['SYSTEM_EVENTS']
        else:
            return self.TOPICS['ERROR_EVENTS']
    
    async def _consume_messages(
        self,
        consumer: KafkaConsumer,
        handler: Callable[[Dict[str, Any]], None],
        event_type: str
    ):
        """Consume messages from Kafka"""
        try:
            for message in consumer:
                try:
                    event_data = message.value
                    correlation_id = event_data.get('correlation_id', 'unknown')
                    
                    logger.debug(
                        "Processing event",
                        event_id=event_data.get('id'),
                        event_type=event_data.get('type'),
                        partition=message.partition,
                        offset=message.offset,
                        correlation_id=correlation_id
                    )
                    
                    # Execute handler with timeout
                    await asyncio.wait_for(
                        asyncio.create_task(handler(event_data)),
                        timeout=30.0
                    )
                    
                    logger.debug(
                        "Event processed successfully",
                        event_id=event_data.get('id'),
                        event_type=event_data.get('type'),
                        correlation_id=correlation_id
                    )
                    
                except asyncio.TimeoutError:
                    logger.error(
                        "Event handler timeout",
                        event_type=event_type,
                        partition=message.partition,
                        offset=message.offset
                    )
                except Exception as error:
                    logger.error(
                        "Error processing event",
                        error=str(error),
                        event_type=event_type,
                        partition=message.partition,
                        offset=message.offset
                    )
                    
        except Exception as error:
            logger.error(
                "Error in message consumer",
                error=str(error),
                event_type=event_type
            )
    
    async def _handle_reconnection(self):
        """Handle reconnection logic"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.error("Max reconnection attempts reached")
            return
        
        self.reconnect_attempts += 1
        logger.info(f"Attempting to reconnect ({self.reconnect_attempts}/{self.max_reconnect_attempts})...")
        
        await asyncio.sleep(5)  # Wait 5 seconds before retry
        
        try:
            await self.initialize()
        except Exception as error:
            logger.error("Reconnection failed", error=str(error))
            await self._handle_reconnection()

# Singleton instance
event_bus = LLMEventBus()
