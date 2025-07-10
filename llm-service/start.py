#!/usr/bin/env python3
"""
Simple startup script for LLM service
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and run the app
if __name__ == '__main__':
    try:
        from app import app, logger
        port = int(os.getenv('PORT', 3003))
        logger.info(f"Starting LLM service on port {port}")
        app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
    except Exception as e:
        print(f"Error starting LLM service: {e}")
        sys.exit(1)
