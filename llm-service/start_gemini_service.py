#!/usr/bin/env python3
"""
Enhanced LLM Service Startup Script with Gemini Integration
Starts the Flask application with comprehensive Gemini AI capabilities
"""

import os
import sys
import asyncio
import signal
import threading
import time
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.production')

def check_environment():
    """Check if all required environment variables are set"""
    print("🔍 Checking environment configuration...")
    
    required_vars = [
        'GEMINI_API_KEY',
        'HUGGINGFACE_API_KEY',
        'PORT'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        return False
    
    # Check API keys format
    gemini_key = os.getenv('GEMINI_API_KEY')
    if not gemini_key.startswith('AIza'):
        print("⚠️ Warning: GEMINI_API_KEY doesn't appear to be in correct format")
    
    hf_key = os.getenv('HUGGINGFACE_API_KEY')
    if not hf_key.startswith('hf_'):
        print("⚠️ Warning: HUGGINGFACE_API_KEY doesn't appear to be in correct format")
    
    print("✅ Environment configuration check passed")
    return True

def check_dependencies():
    """Check if all required Python packages are installed"""
    print("📦 Checking Python dependencies...")
    
    required_packages = [
        'flask',
        'flask_cors',
        'flask_limiter',
        'aiohttp',
        'psutil',
        'requests',
        'python-dotenv'
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing required packages: {', '.join(missing_packages)}")
        print("💡 Install with: pip install " + " ".join(missing_packages))
        return False
    
    print("✅ All required packages are installed")
    return True

def test_gemini_connection():
    """Test connection to Gemini API"""
    print("🤖 Testing Gemini API connection...")
    
    try:
        import aiohttp
        import asyncio
        
        async def test_connection():
            api_key = os.getenv('GEMINI_API_KEY')
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        models = data.get('models', [])
                        print(f"✅ Gemini API connection successful - {len(models)} models available")
                        
                        # List available models
                        for model in models[:3]:  # Show first 3 models
                            model_name = model.get('name', 'Unknown').split('/')[-1]
                            print(f"   📋 {model_name}")
                        
                        return True
                    else:
                        print(f"❌ Gemini API connection failed: HTTP {response.status}")
                        return False
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(test_connection())
        finally:
            loop.close()
            
    except Exception as e:
        print(f"❌ Error testing Gemini connection: {e}")
        return False

def print_service_info():
    """Print service configuration information"""
    print("\n" + "="*60)
    print("🚀 ENHANCED LLM SERVICE WITH GEMINI INTEGRATION")
    print("="*60)
    
    print(f"🔧 Configuration:")
    print(f"   Port: {os.getenv('PORT', 3003)}")
    print(f"   Environment: {os.getenv('FLASK_ENV', 'production')}")
    print(f"   Debug Mode: {os.getenv('FLASK_DEBUG', 'False')}")
    
    print(f"\n🤖 Gemini Configuration:")
    print(f"   Primary Model: {os.getenv('GEMINI_PRIMARY_MODEL', 'gemini-2.0-flash-exp')}")
    print(f"   Secondary Model: {os.getenv('GEMINI_SECONDARY_MODEL', 'gemini-1.5-flash')}")
    print(f"   Reasoning Model: {os.getenv('GEMINI_REASONING_MODEL', 'gemini-1.5-pro')}")
    print(f"   Max Tokens: {os.getenv('GEMINI_MAX_TOKENS', '1000000')}")
    print(f"   Temperature: {os.getenv('GEMINI_TEMPERATURE', '0.7')}")
    
    print(f"\n⚡ Rate Limiting:")
    print(f"   RPM Limit: {os.getenv('GEMINI_RPM_LIMIT', '15')}")
    print(f"   RPD Limit: {os.getenv('GEMINI_RPD_LIMIT', '1500')}")
    print(f"   TPM Limit: {os.getenv('GEMINI_TPM_LIMIT', '1000000')}")
    
    print(f"\n📊 Features Enabled:")
    print(f"   Function Calling: {os.getenv('ENABLE_FUNCTION_CALLING', 'true')}")
    print(f"   Monitoring: {os.getenv('ENABLE_MONITORING', 'true')}")
    print(f"   Caching: {os.getenv('ENABLE_CACHING', 'true')}")
    print(f"   HuggingFace Fallback: {os.getenv('ENABLE_HUGGINGFACE_FALLBACK', 'true')}")
    
    print(f"\n🔗 API Endpoints:")
    port = os.getenv('PORT', 3003)
    print(f"   Health Check: http://localhost:{port}/health")
    print(f"   Gemini Generate: http://localhost:{port}/api/gemini/generate")
    print(f"   Gemini Orchestrate: http://localhost:{port}/api/gemini/orchestrate")
    print(f"   Gemini Status: http://localhost:{port}/api/gemini/status")
    print(f"   Legacy Generate: http://localhost:{port}/generate")
    
    print("\n" + "="*60)

def start_service():
    """Start the Flask application"""
    print("\n🚀 Starting Enhanced LLM Service...")
    
    try:
        # Import and run the Flask app
        from app import app
        
        port = int(os.getenv('PORT', 3003))
        debug = os.getenv('FLASK_ENV') == 'development'
        
        print(f"🌐 Service starting on http://0.0.0.0:{port}")
        print(f"📝 Debug mode: {debug}")
        print(f"⏰ Started at: {datetime.now().isoformat()}")
        print("\n💡 Press Ctrl+C to stop the service")
        
        app.run(
            host='0.0.0.0',
            port=port,
            debug=debug,
            threaded=True,
            use_reloader=False  # Disable reloader to prevent double startup
        )
        
    except KeyboardInterrupt:
        print("\n⚠️ Service interrupted by user")
    except Exception as e:
        print(f"\n❌ Error starting service: {e}")
        sys.exit(1)

def main():
    """Main startup function"""
    print("🎯 Enhanced LLM Service Startup")
    print(f"⏰ Startup initiated at: {datetime.now().isoformat()}")
    
    # Pre-flight checks
    if not check_environment():
        print("\n❌ Environment check failed. Please fix the issues above.")
        sys.exit(1)
    
    if not check_dependencies():
        print("\n❌ Dependency check failed. Please install missing packages.")
        sys.exit(1)
    
    if not test_gemini_connection():
        print("\n⚠️ Gemini API connection test failed. Service will start but Gemini features may not work.")
        print("💡 Check your GEMINI_API_KEY and internet connection.")
        
        # Ask user if they want to continue
        try:
            response = input("\nContinue anyway? (y/N): ").strip().lower()
            if response not in ['y', 'yes']:
                print("❌ Startup cancelled by user.")
                sys.exit(1)
        except KeyboardInterrupt:
            print("\n❌ Startup cancelled by user.")
            sys.exit(1)
    
    # Print service information
    print_service_info()
    
    # Start the service
    start_service()

if __name__ == "__main__":
    main()
