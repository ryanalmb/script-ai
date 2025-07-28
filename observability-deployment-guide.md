# 🔍 **Observability Stack Deployment Guide**

## **Current Status: Instrumentation vs. Services**

Your workflow provides **application instrumentation** (the code that sends data), but you need to deploy the actual **observability services** that receive and visualize this data.

## **📊 What You Have vs. What You Need**

### **✅ Already Implemented (Application Side)**
```python
# Your code is already instrumented to SEND data to:
- Prometheus (via prometheus_client)
- Jaeger (via opentelemetry)
- Sentry (via sentry_sdk)
- Custom metrics and traces
```

### **❌ Still Need to Deploy (Infrastructure Side)**
```yaml
# You need to deploy these actual services:
- Prometheus Server (collects and stores metrics)
- Grafana (visualizes metrics and creates dashboards)
- Jaeger (collects and visualizes distributed traces)
- Alertmanager (handles alerts from Prometheus)
```

## **🚀 Free Deployment Options**

### **Option 1: Docker Compose (Recommended for Development)**
```yaml
# docker-compose.observability.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "14268:14268"  # Jaeger collector
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  grafana-storage:
```

### **Option 2: Free Cloud Services**

#### **Prometheus + Grafana**
- **Grafana Cloud Free Tier**: 10k metrics, 50GB logs, 50GB traces
- **Prometheus.io**: Self-hosted on free platforms

#### **Jaeger**
- **Jaeger Cloud**: Free tier available
- **Self-hosted**: Deploy on Railway, Render, or Heroku free tiers

#### **Error Tracking**
- **Sentry.io**: 5k errors/month free
- **Bugsnag**: Free tier available

## **⚡ Quick Setup Commands**

### **1. Create Prometheus Configuration**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'your-app'
    static_configs:
      - targets: ['localhost:8000']  # Your app's metrics endpoint
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### **2. Create Alertmanager Configuration**
```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@yourcompany.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'
```

### **3. Start Observability Stack**
```bash
# Start all services
docker-compose -f docker-compose.observability.yml up -d

# Verify services are running
curl http://localhost:9090  # Prometheus
curl http://localhost:3000  # Grafana (admin/admin)
curl http://localhost:16686 # Jaeger UI
```

## **🔗 Integration with Your Application**

### **Your App Configuration**
```python
# Your application already has this instrumentation
# Just ensure these environment variables are set:

PROMETHEUS_PORT=8000  # Port where your app exposes /metrics
JAEGER_ENDPOINT=http://localhost:14268/api/traces
SENTRY_DSN=your_sentry_dsn_here
```

### **Metrics Endpoint**
Your app should expose metrics at: `http://localhost:8000/metrics`

### **Trace Collection**
Your app sends traces to: `http://localhost:14268/api/traces`

## **📈 Grafana Dashboard Setup**

### **1. Add Prometheus Data Source**
- URL: `http://prometheus:9090`
- Access: Server (default)

### **2. Add Jaeger Data Source**
- URL: `http://jaeger:16686`
- Access: Server (default)

### **3. Import Pre-built Dashboards**
```bash
# Download community dashboards
curl -o node-exporter.json https://grafana.com/api/dashboards/1860/revisions/27/download
curl -o application-metrics.json https://grafana.com/api/dashboards/6417/revisions/1/download
```

## **🚨 Alerting Setup**

### **Prometheus Alert Rules**
```yaml
# alerts.yml
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
```

## **💰 Cost-Effective Production Deployment**

### **Free Tier Limits**
- **Grafana Cloud**: 10k metrics, 50GB logs, 50GB traces/month
- **Sentry**: 5k errors/month
- **Railway/Render**: Free hosting for small services

### **Self-Hosted on Free Platforms**
```yaml
# Deploy to Railway, Render, or Heroku
# Use their free tiers for:
- Prometheus (lightweight deployment)
- Grafana (dashboard access)
- Jaeger (trace collection)
```

## **🎯 Next Steps**

1. **Deploy Services**: Use Docker Compose locally or free cloud services
2. **Configure Data Sources**: Connect Grafana to Prometheus and Jaeger
3. **Create Dashboards**: Build visualizations for your metrics
4. **Set Up Alerts**: Configure alerting rules and notification channels
5. **Test Integration**: Verify your app sends data to all services

## **📋 Verification Checklist**

- [ ] Prometheus collecting metrics from your app
- [ ] Grafana displaying dashboards with your data
- [ ] Jaeger receiving and displaying traces
- [ ] Alertmanager configured for notifications
- [ ] Sentry receiving error reports
- [ ] All services accessible and healthy

Your application code is already instrumented! You just need to deploy the infrastructure services to receive and visualize the data.
