#!/usr/bin/env python3
"""
Test script to check if LLM service is running
"""

import requests
import json

def test_service():
    try:
        # Test health endpoint
        response = requests.get('http://localhost:3003/health', timeout=5)
        if response.status_code == 200:
            print("✅ LLM Service is running!")
            print(f"Health check response: {json.dumps(response.json(), indent=2)}")
            return True
        else:
            print(f"❌ Health check failed with status: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to LLM service on port 3003")
        return False
    except Exception as e:
        print(f"❌ Error testing service: {e}")
        return False

if __name__ == '__main__':
    test_service()
