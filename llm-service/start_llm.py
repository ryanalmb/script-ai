#!/usr/bin/env python3
"""
LLM Service Startup Script with Real Hugging Face API Key
"""
import os
import sys

# Set environment variables
os.environ['HUGGINGFACE_API_KEY'] = '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'
os.environ['LLM_PORT'] = '3003'
os.environ['DEBUG_MODE'] = 'true'
os.environ['FLASK_ENV'] = 'development'

print("🔧 Setting up LLM Service with real Hugging Face API key...")
print(f"🔑 Hugging Face API Key: {os.environ['HUGGINGFACE_API_KEY'][:20]}...")
print(f"🚀 Starting on port: {os.environ['LLM_PORT']}")

# Import and run the Flask app
if __name__ == '__main__':
    try:
        # Import the Flask app from simple-app.py
        exec(open('simple-app.py').read())
    except Exception as e:
        print(f"❌ Error starting LLM service: {e}")
        sys.exit(1)
