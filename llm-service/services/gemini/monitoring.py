#!/usr/bin/env python3
"""
Enterprise Monitoring and Analytics for Gemini Integration
Provides comprehensive monitoring, metrics collection, and performance analytics
"""

import os
import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from collections import defaultdict, deque
import threading
import psutil

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetric:
    """Individual performance metric"""
    timestamp: datetime
    metric_name: str
    value: float
    metadata: Dict[str, Any]

@dataclass
class AlertRule:
    """Alert rule configuration"""
    name: str
    metric: str
    threshold: float
    comparison: str  # 'gt', 'lt', 'eq'
    duration: int  # seconds
    enabled: bool = True

class MetricsCollector:
    """Collects and aggregates performance metrics"""
    
    def __init__(self):
        self.metrics_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.aggregated_metrics: Dict[str, Dict] = {}
        self.collection_interval = int(os.getenv('METRICS_COLLECTION_INTERVAL', 30))
        self.is_collecting = False
        self.collection_task = None
        
        # System metrics
        self.system_metrics = {
            'cpu_usage': 0.0,
            'memory_usage': 0.0,
            'disk_usage': 0.0,
            'network_io': {'bytes_sent': 0, 'bytes_recv': 0}
        }
        
        logger.info("MetricsCollector initialized")
    
    def record_metric(self, name: str, value: float, metadata: Optional[Dict] = None):
        """Record a single metric"""
        metric = PerformanceMetric(
            timestamp=datetime.now(),
            metric_name=name,
            value=value,
            metadata=metadata or {}
        )
        
        self.metrics_history[name].append(metric)
        self._update_aggregated_metrics(name, value)
    
    def _update_aggregated_metrics(self, name: str, value: float):
        """Update aggregated metrics"""
        if name not in self.aggregated_metrics:
            self.aggregated_metrics[name] = {
                'count': 0,
                'sum': 0.0,
                'min': float('inf'),
                'max': float('-inf'),
                'avg': 0.0,
                'last_value': 0.0
            }
        
        agg = self.aggregated_metrics[name]
        agg['count'] += 1
        agg['sum'] += value
        agg['min'] = min(agg['min'], value)
        agg['max'] = max(agg['max'], value)
        agg['avg'] = agg['sum'] / agg['count']
        agg['last_value'] = value
    
    async def start_collection(self):
        """Start automatic metrics collection"""
        if self.is_collecting:
            return
        
        self.is_collecting = True
        self.collection_task = asyncio.create_task(self._collection_loop())
        logger.info("Started metrics collection")
    
    async def stop_collection(self):
        """Stop automatic metrics collection"""
        self.is_collecting = False
        if self.collection_task:
            self.collection_task.cancel()
            try:
                await self.collection_task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped metrics collection")
    
    async def _collection_loop(self):
        """Main collection loop"""
        while self.is_collecting:
            try:
                await self._collect_system_metrics()
                await asyncio.sleep(self.collection_interval)
            except Exception as e:
                logger.error(f"Error in metrics collection: {e}")
                await asyncio.sleep(5)
    
    async def _collect_system_metrics(self):
        """Collect system performance metrics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            self.record_metric('system.cpu_usage', cpu_percent)
            
            # Memory usage
            memory = psutil.virtual_memory()
            self.record_metric('system.memory_usage', memory.percent)
            self.record_metric('system.memory_available', memory.available)
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            self.record_metric('system.disk_usage', disk_percent)
            
            # Network I/O
            network = psutil.net_io_counters()
            self.record_metric('system.network_bytes_sent', network.bytes_sent)
            self.record_metric('system.network_bytes_recv', network.bytes_recv)
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
    
    def get_metrics_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get metrics summary for the specified time period"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        summary = {}
        
        for metric_name, metrics in self.metrics_history.items():
            recent_metrics = [
                m for m in metrics 
                if m.timestamp > cutoff_time
            ]
            
            if recent_metrics:
                values = [m.value for m in recent_metrics]
                summary[metric_name] = {
                    'count': len(values),
                    'min': min(values),
                    'max': max(values),
                    'avg': sum(values) / len(values),
                    'latest': values[-1],
                    'trend': self._calculate_trend(values)
                }
        
        return summary
    
    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend direction"""
        if len(values) < 2:
            return 'stable'
        
        first_half = values[:len(values)//2]
        second_half = values[len(values)//2:]
        
        first_avg = sum(first_half) / len(first_half)
        second_avg = sum(second_half) / len(second_half)
        
        if second_avg > first_avg * 1.1:
            return 'increasing'
        elif second_avg < first_avg * 0.9:
            return 'decreasing'
        else:
            return 'stable'

class AlertManager:
    """Manages alerts and notifications"""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector
        self.alert_rules: List[AlertRule] = []
        self.active_alerts: Dict[str, datetime] = {}
        self.alert_history: List[Dict] = []
        self.is_monitoring = False
        self.monitoring_task = None
        
        # Load default alert rules
        self._load_default_alert_rules()
        
        logger.info("AlertManager initialized")
    
    def _load_default_alert_rules(self):
        """Load default alert rules"""
        self.alert_rules = [
            AlertRule(
                name="high_cpu_usage",
                metric="system.cpu_usage",
                threshold=80.0,
                comparison="gt",
                duration=300  # 5 minutes
            ),
            AlertRule(
                name="high_memory_usage",
                metric="system.memory_usage",
                threshold=85.0,
                comparison="gt",
                duration=300
            ),
            AlertRule(
                name="high_error_rate",
                metric="gemini.error_rate",
                threshold=0.1,  # 10%
                comparison="gt",
                duration=60
            ),
            AlertRule(
                name="low_success_rate",
                metric="gemini.success_rate",
                threshold=0.9,  # 90%
                comparison="lt",
                duration=300
            )
        ]
    
    async def start_monitoring(self):
        """Start alert monitoring"""
        if self.is_monitoring:
            return
        
        self.is_monitoring = True
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Started alert monitoring")
    
    async def stop_monitoring(self):
        """Stop alert monitoring"""
        self.is_monitoring = False
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped alert monitoring")
    
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_monitoring:
            try:
                await self._check_alert_rules()
                await asyncio.sleep(30)  # Check every 30 seconds
            except Exception as e:
                logger.error(f"Error in alert monitoring: {e}")
                await asyncio.sleep(5)
    
    async def _check_alert_rules(self):
        """Check all alert rules"""
        for rule in self.alert_rules:
            if not rule.enabled:
                continue
            
            await self._check_single_rule(rule)
    
    async def _check_single_rule(self, rule: AlertRule):
        """Check a single alert rule"""
        if rule.metric not in self.metrics_collector.aggregated_metrics:
            return
        
        current_value = self.metrics_collector.aggregated_metrics[rule.metric]['last_value']
        
        # Check threshold
        threshold_breached = False
        if rule.comparison == 'gt' and current_value > rule.threshold:
            threshold_breached = True
        elif rule.comparison == 'lt' and current_value < rule.threshold:
            threshold_breached = True
        elif rule.comparison == 'eq' and abs(current_value - rule.threshold) < 0.001:
            threshold_breached = True
        
        if threshold_breached:
            if rule.name not in self.active_alerts:
                self.active_alerts[rule.name] = datetime.now()
            elif datetime.now() - self.active_alerts[rule.name] > timedelta(seconds=rule.duration):
                await self._trigger_alert(rule, current_value)
        else:
            if rule.name in self.active_alerts:
                await self._resolve_alert(rule.name)
                del self.active_alerts[rule.name]
    
    async def _trigger_alert(self, rule: AlertRule, value: float):
        """Trigger an alert"""
        alert = {
            'rule_name': rule.name,
            'metric': rule.metric,
            'threshold': rule.threshold,
            'current_value': value,
            'triggered_at': datetime.now().isoformat(),
            'status': 'active'
        }
        
        self.alert_history.append(alert)
        logger.warning(f"ALERT TRIGGERED: {rule.name} - {rule.metric} = {value} (threshold: {rule.threshold})")
        
        # Here you would integrate with notification systems (email, Slack, etc.)
        await self._send_notification(alert)
    
    async def _resolve_alert(self, rule_name: str):
        """Resolve an alert"""
        logger.info(f"ALERT RESOLVED: {rule_name}")
        
        # Update alert history
        for alert in reversed(self.alert_history):
            if alert['rule_name'] == rule_name and alert['status'] == 'active':
                alert['status'] = 'resolved'
                alert['resolved_at'] = datetime.now().isoformat()
                break
    
    async def _send_notification(self, alert: Dict):
        """Send alert notification"""
        # Placeholder for notification integration
        # In production, integrate with email, Slack, PagerDuty, etc.
        pass
    
    def get_active_alerts(self) -> List[Dict]:
        """Get all active alerts"""
        return [
            alert for alert in self.alert_history
            if alert['status'] == 'active'
        ]
    
    def get_alert_history(self, hours: int = 24) -> List[Dict]:
        """Get alert history for specified time period"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        return [
            alert for alert in self.alert_history
            if datetime.fromisoformat(alert['triggered_at']) > cutoff_time
        ]

class GeminiMonitoringService:
    """Main monitoring service for Gemini integration"""
    
    def __init__(self):
        self.metrics_collector = MetricsCollector()
        self.alert_manager = AlertManager(self.metrics_collector)
        self.is_running = False
        
        # Performance tracking
        self.request_times: deque = deque(maxlen=1000)
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.success_counts: Dict[str, int] = defaultdict(int)
        
        logger.info("GeminiMonitoringService initialized")
    
    async def start(self):
        """Start monitoring service"""
        if self.is_running:
            return
        
        self.is_running = True
        await self.metrics_collector.start_collection()
        await self.alert_manager.start_monitoring()
        
        logger.info("GeminiMonitoringService started")
    
    async def stop(self):
        """Stop monitoring service"""
        if not self.is_running:
            return
        
        self.is_running = False
        await self.metrics_collector.stop_collection()
        await self.alert_manager.stop_monitoring()
        
        logger.info("GeminiMonitoringService stopped")
    
    def record_request(self, model: str, response_time: float, success: bool, tokens_used: int = 0):
        """Record a Gemini API request"""
        # Record basic metrics
        self.metrics_collector.record_metric(f'gemini.{model}.response_time', response_time)
        self.metrics_collector.record_metric(f'gemini.{model}.tokens_used', tokens_used)
        
        # Track success/error rates
        if success:
            self.success_counts[model] += 1
            self.metrics_collector.record_metric(f'gemini.{model}.success', 1)
        else:
            self.error_counts[model] += 1
            self.metrics_collector.record_metric(f'gemini.{model}.error', 1)
        
        # Calculate rates
        total_requests = self.success_counts[model] + self.error_counts[model]
        success_rate = self.success_counts[model] / total_requests if total_requests > 0 else 0
        error_rate = self.error_counts[model] / total_requests if total_requests > 0 else 0
        
        self.metrics_collector.record_metric(f'gemini.{model}.success_rate', success_rate)
        self.metrics_collector.record_metric(f'gemini.{model}.error_rate', error_rate)
        
        # Overall metrics
        self.metrics_collector.record_metric('gemini.total_requests', 1)
        self.metrics_collector.record_metric('gemini.success_rate', success_rate)
        self.metrics_collector.record_metric('gemini.error_rate', error_rate)
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get comprehensive dashboard data"""
        return {
            'system_status': 'healthy' if self.is_running else 'stopped',
            'metrics_summary': self.metrics_collector.get_metrics_summary(),
            'active_alerts': self.alert_manager.get_active_alerts(),
            'recent_alerts': self.alert_manager.get_alert_history(hours=24),
            'performance_overview': {
                'total_requests': sum(self.success_counts.values()) + sum(self.error_counts.values()),
                'success_rate': self._calculate_overall_success_rate(),
                'average_response_time': self._calculate_average_response_time(),
                'models_used': list(set(list(self.success_counts.keys()) + list(self.error_counts.keys())))
            },
            'resource_usage': {
                'cpu': self.metrics_collector.aggregated_metrics.get('system.cpu_usage', {}).get('last_value', 0),
                'memory': self.metrics_collector.aggregated_metrics.get('system.memory_usage', {}).get('last_value', 0),
                'disk': self.metrics_collector.aggregated_metrics.get('system.disk_usage', {}).get('last_value', 0)
            }
        }
    
    def _calculate_overall_success_rate(self) -> float:
        """Calculate overall success rate across all models"""
        total_success = sum(self.success_counts.values())
        total_requests = total_success + sum(self.error_counts.values())
        return total_success / total_requests if total_requests > 0 else 0.0
    
    def _calculate_average_response_time(self) -> float:
        """Calculate average response time"""
        if not self.request_times:
            return 0.0
        return sum(self.request_times) / len(self.request_times)
