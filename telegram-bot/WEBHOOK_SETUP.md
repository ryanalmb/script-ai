# 🔗 Telegram Bot Webhook Setup Guide

This guide explains how to set up webhooks for the Telegram bot instead of using polling mode.

## 📋 Prerequisites

### **Required:**
- ✅ **HTTPS URL** (not HTTP)
- ✅ **Valid SSL certificate**
- ✅ **Publicly accessible endpoint**
- ✅ **Domain name or tunneling service**

### **Why Webhooks?**
- 🚀 **Better performance** - Real-time message delivery
- 💰 **Lower costs** - No constant polling requests
- 🔋 **Less resource usage** - Server only responds to actual messages
- 📊 **Better scalability** - Handles high message volumes efficiently

## 🛠️ Setup Options

### **Option 1: ngrok (Development/Testing)**

1. **Install ngrok:**
```bash
# Download from https://ngrok.com/
npm install -g ngrok
# or
brew install ngrok  # macOS
```

2. **Start ngrok tunnel:**
```bash
ngrok http 3002
```

3. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

4. **Update environment:**
```bash
# In telegram-bot/.env.local
TELEGRAM_WEBHOOK_URL=https://abc123.ngrok.io/webhook/telegram
ENABLE_POLLING=false
```

5. **Set webhook:**
```bash
cd telegram-bot
node scripts/setup-webhook.js set https://abc123.ngrok.io/webhook/telegram
```

### **Option 2: Production Server**

1. **Get a domain with SSL:**
   - Domain registrar (GoDaddy, Namecheap, etc.)
   - SSL certificate (Let's Encrypt, Cloudflare, etc.)

2. **Deploy to server:**
   - AWS EC2, DigitalOcean, Google Cloud, etc.
   - Configure reverse proxy (nginx, Apache)

3. **Update environment:**
```bash
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhook/telegram
ENABLE_POLLING=false
```

4. **Set webhook:**
```bash
node scripts/setup-webhook.js set https://yourdomain.com/webhook/telegram
```

### **Option 3: Cloud Platforms**

#### **Vercel:**
```bash
# Deploy to Vercel
vercel --prod

# Get deployment URL
TELEGRAM_WEBHOOK_URL=https://your-app.vercel.app/webhook/telegram
```

#### **Heroku:**
```bash
# Deploy to Heroku
git push heroku main

# Get app URL
TELEGRAM_WEBHOOK_URL=https://your-app.herokuapp.com/webhook/telegram
```

#### **Railway:**
```bash
# Deploy to Railway
railway deploy

# Get deployment URL
TELEGRAM_WEBHOOK_URL=https://your-app.railway.app/webhook/telegram
```

## 🔧 Configuration

### **Environment Variables**
```bash
# telegram-bot/.env.local

# Webhook Configuration
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook/telegram
ENABLE_POLLING=false

# Bot Token
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Server Port
PORT=3002
```

### **Webhook Security**
The webhook endpoint includes several security measures:

1. **Token validation** - Only accepts requests from Telegram
2. **HTTPS requirement** - Encrypted communication
3. **Request validation** - Validates request format
4. **Error handling** - Graceful error recovery

## 📝 Webhook Management Scripts

### **Set Webhook:**
```bash
node scripts/setup-webhook.js set https://your-domain.com/webhook/telegram
```

### **Delete Webhook (switch to polling):**
```bash
node scripts/setup-webhook.js delete
```

### **Check Webhook Status:**
```bash
node scripts/setup-webhook.js info
```

## 🔍 Troubleshooting

### **Common Issues:**

#### **1. "Wrong HTTP URL" Error**
- ❌ Using HTTP instead of HTTPS
- ❌ Using localhost/127.0.0.1
- ✅ Use HTTPS with public domain

#### **2. "Connection Timeout"**
- ❌ Server not accessible from internet
- ❌ Firewall blocking requests
- ✅ Check server accessibility

#### **3. "SSL Certificate Error"**
- ❌ Invalid or expired SSL certificate
- ❌ Self-signed certificate (not trusted)
- ✅ Use valid SSL certificate

#### **4. "Webhook Not Receiving Messages"**
- ❌ Wrong endpoint path
- ❌ Server not processing requests correctly
- ✅ Check logs and endpoint implementation

### **Debug Steps:**

1. **Check webhook status:**
```bash
node scripts/setup-webhook.js info
```

2. **Test endpoint manually:**
```bash
curl -X POST https://your-domain.com/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

3. **Check server logs:**
```bash
# Check bot logs for webhook processing
tail -f logs/app.log
```

4. **Verify SSL certificate:**
```bash
# Check SSL certificate validity
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

## 🚀 Performance Benefits

### **Polling vs Webhook Comparison:**

| Feature | Polling | Webhook |
|---------|---------|---------|
| **Latency** | 1-3 seconds | < 100ms |
| **Resource Usage** | High (constant requests) | Low (event-driven) |
| **Scalability** | Limited | Excellent |
| **Real-time** | No | Yes |
| **Setup Complexity** | Simple | Moderate |

### **Webhook Advantages:**
- ⚡ **Instant message delivery**
- 💰 **Reduced server costs**
- 🔋 **Lower resource consumption**
- 📈 **Better scalability**
- 🎯 **More reliable delivery**

## 🔐 Security Considerations

1. **HTTPS Only** - Never use HTTP for webhooks
2. **Token Protection** - Keep bot token secure
3. **Request Validation** - Validate all incoming requests
4. **Rate Limiting** - Implement rate limiting
5. **Error Handling** - Graceful error recovery
6. **Logging** - Monitor webhook activity

## 📊 Monitoring

### **Health Check Endpoint:**
```bash
curl https://your-domain.com/health
```

### **Webhook Statistics:**
The bot automatically logs webhook performance:
- Request count
- Response times
- Error rates
- Message processing times

## 🎯 Next Steps

1. Choose your deployment method
2. Set up HTTPS domain/tunnel
3. Update environment variables
4. Deploy the bot
5. Set webhook using the script
6. Test message delivery
7. Monitor performance

For production use, webhooks are **strongly recommended** over polling for better performance and reliability.
