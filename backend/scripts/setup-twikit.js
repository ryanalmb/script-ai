/**
 * Twikit Setup and Node.js-Python Bridge
 * Provides Node.js interface for Twikit Python library
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class TwikitBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      pythonPath: options.pythonPath || this.getPythonPath(),
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      debug: options.debug || false,
      ...options
    };
    
    this.isInitialized = false;
    this.pythonProcess = null;
    this.messageQueue = [];
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  // Get Python executable path
  getPythonPath() {
    const isWindows = process.platform === 'win32';
    const venvPath = path.join(process.cwd(), 'python_env');
    
    if (isWindows) {
      return path.join(venvPath, 'Scripts', 'python.exe');
    } else {
      return path.join(venvPath, 'bin', 'python');
    }
  }

  // Initialize Twikit bridge
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Verify Python environment
      await this.verifyPythonEnvironment();
      
      // Create Python bridge script
      await this.createPythonBridge();
      
      // Start Python process
      await this.startPythonProcess();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      if (this.options.debug) {
        console.log('✅ Twikit bridge initialized successfully');
      }
      
      return true;
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize Twikit bridge: ${error.message}`);
    }
  }

  // Verify Python environment
  async verifyPythonEnvironment() {
    return new Promise((resolve, reject) => {
      const process = spawn(this.options.pythonPath, ['-c', 'import twikit; print("OK")'], {
        stdio: 'pipe'
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.includes('OK')) {
          resolve(true);
        } else {
          reject(new Error('Twikit not available in Python environment'));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Python process error: ${error.message}`));
      });
    });
  }

  // Create Python bridge script
  async createPythonBridge() {
    const bridgeScript = `#!/usr/bin/env python3
"""
Twikit Bridge Script
Provides JSON-based communication interface for Node.js
"""

import sys
import json
import asyncio
import traceback
from twikit import Client

class TwikitBridge:
    def __init__(self):
        self.client = None
        self.is_authenticated = False
    
    async def authenticate(self, username, email, password):
        """Authenticate with X/Twitter"""
        try:
            self.client = Client('en-US')
            await self.client.login(
                auth_info_1=username,
                auth_info_2=email,
                password=password
            )
            self.is_authenticated = True
            return {"success": True, "message": "Authentication successful"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def post_tweet(self, text, media_ids=None):
        """Post a tweet"""
        try:
            if not self.is_authenticated:
                return {"success": False, "error": "Not authenticated"}
            
            tweet = await self.client.create_tweet(
                text=text,
                media_ids=media_ids
            )
            
            return {
                "success": True,
                "tweet_id": tweet.id,
                "text": tweet.text
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_user_info(self, username):
        """Get user information"""
        try:
            if not self.is_authenticated:
                return {"success": False, "error": "Not authenticated"}
            
            user = await self.client.get_user_by_screen_name(username)
            
            return {
                "success": True,
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "screen_name": user.screen_name,
                    "followers_count": user.followers_count,
                    "following_count": user.following_count,
                    "tweet_count": user.statuses_count
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def like_tweet(self, tweet_id):
        """Like a tweet"""
        try:
            if not self.is_authenticated:
                return {"success": False, "error": "Not authenticated"}
            
            await self.client.favorite_tweet(tweet_id)
            return {"success": True, "message": "Tweet liked"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def retweet(self, tweet_id):
        """Retweet a tweet"""
        try:
            if not self.is_authenticated:
                return {"success": False, "error": "Not authenticated"}
            
            await self.client.retweet(tweet_id)
            return {"success": True, "message": "Tweet retweeted"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def follow_user(self, user_id):
        """Follow a user"""
        try:
            if not self.is_authenticated:
                return {"success": False, "error": "Not authenticated"}
            
            await self.client.follow_user(user_id)
            return {"success": True, "message": "User followed"}
        except Exception as e:
            return {"success": False, "error": str(e)}

async def handle_request(bridge, request):
    """Handle incoming request"""
    try:
        method = request.get('method')
        params = request.get('params', {})
        
        if method == 'authenticate':
            return await bridge.authenticate(**params)
        elif method == 'post_tweet':
            return await bridge.post_tweet(**params)
        elif method == 'get_user_info':
            return await bridge.get_user_info(**params)
        elif method == 'like_tweet':
            return await bridge.like_tweet(**params)
        elif method == 'retweet':
            return await bridge.retweet(**params)
        elif method == 'follow_user':
            return await bridge.follow_user(**params)
        else:
            return {"success": False, "error": f"Unknown method: {method}"}
    
    except Exception as e:
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

async def main():
    """Main communication loop"""
    bridge = TwikitBridge()
    
    # Send ready signal
    print(json.dumps({"type": "ready"}))
    sys.stdout.flush()
    
    # Process requests
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            request_id = request.get('id')
            
            result = await handle_request(bridge, request)
            
            response = {
                "type": "response",
                "id": request_id,
                "result": result
            }
            
            print(json.dumps(response))
            sys.stdout.flush()
            
        except json.JSONDecodeError:
            error_response = {
                "type": "error",
                "error": "Invalid JSON"
            }
            print(json.dumps(error_response))
            sys.stdout.flush()
        except Exception as e:
            error_response = {
                "type": "error",
                "error": str(e),
                "traceback": traceback.format_exc()
            }
            print(json.dumps(error_response))
            sys.stdout.flush()

if __name__ == "__main__":
    asyncio.run(main())
`;

    const bridgePath = path.join(process.cwd(), 'twikit_bridge.py');
    fs.writeFileSync(bridgePath, bridgeScript);
    
    if (this.options.debug) {
      console.log(`✅ Python bridge script created: ${bridgePath}`);
    }
  }

  // Start Python process
  async startPythonProcess() {
    return new Promise((resolve, reject) => {
      const bridgePath = path.join(process.cwd(), 'twikit_bridge.py');
      
      this.pythonProcess = spawn(this.options.pythonPath, [bridgePath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let isReady = false;

      // Handle stdout (responses)
      this.pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const message = JSON.parse(line);
            
            if (message.type === 'ready' && !isReady) {
              isReady = true;
              resolve(true);
            } else if (message.type === 'response') {
              this.handleResponse(message);
            } else if (message.type === 'error') {
              this.emit('error', new Error(message.error));
            }
          } catch (error) {
            if (this.options.debug) {
              console.log('Non-JSON output:', line);
            }
          }
        }
      });

      // Handle stderr
      this.pythonProcess.stderr.on('data', (data) => {
        if (this.options.debug) {
          console.error('Python stderr:', data.toString());
        }
      });

      // Handle process exit
      this.pythonProcess.on('close', (code) => {
        if (this.options.debug) {
          console.log(`Python process exited with code ${code}`);
        }
        this.isInitialized = false;
        this.emit('disconnected');
      });

      // Handle process error
      this.pythonProcess.on('error', (error) => {
        if (!isReady) {
          reject(error);
        } else {
          this.emit('error', error);
        }
      });

      // Timeout
      setTimeout(() => {
        if (!isReady) {
          reject(new Error('Python process startup timeout'));
        }
      }, this.options.timeout);
    });
  }

  // Handle response from Python
  handleResponse(message) {
    const requestId = message.id;
    const pending = this.pendingRequests.get(requestId);
    
    if (pending) {
      this.pendingRequests.delete(requestId);
      pending.resolve(message.result);
    }
  }

  // Send request to Python
  async sendRequest(method, params = {}) {
    if (!this.isInitialized) {
      throw new Error('Twikit bridge not initialized');
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      
      const request = {
        id: requestId,
        method,
        params
      };

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject });

      // Send request
      this.pythonProcess.stdin.write(JSON.stringify(request) + '\n');

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, this.options.timeout);
    });
  }

  // Public API methods
  async authenticate(username, email, password) {
    return this.sendRequest('authenticate', { username, email, password });
  }

  async postTweet(text, mediaIds = null) {
    return this.sendRequest('post_tweet', { text, media_ids: mediaIds });
  }

  async getUserInfo(username) {
    return this.sendRequest('get_user_info', { username });
  }

  async likeTweet(tweetId) {
    return this.sendRequest('like_tweet', { tweet_id: tweetId });
  }

  async retweet(tweetId) {
    return this.sendRequest('retweet', { tweet_id: tweetId });
  }

  async followUser(userId) {
    return this.sendRequest('follow_user', { user_id: userId });
  }

  // Cleanup
  async shutdown() {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
    
    this.isInitialized = false;
    this.pendingRequests.clear();
    
    // Clean up bridge script
    const bridgePath = path.join(process.cwd(), 'twikit_bridge.py');
    if (fs.existsSync(bridgePath)) {
      fs.unlinkSync(bridgePath);
    }
    
    this.emit('shutdown');
  }
}

// Test function
async function testTwikitBridge() {
  console.log('🧪 Testing Twikit Bridge...');

  const bridge = new TwikitBridge({ debug: true });

  try {
    // Initialize bridge
    console.log('1️⃣ Initializing bridge...');
    await bridge.initialize();
    console.log('✅ Bridge initialized');

    // Test without authentication (should fail)
    console.log('2️⃣ Testing unauthenticated request...');
    const unauthResult = await bridge.getUserInfo('twitter');
    console.log('Result:', unauthResult);

    console.log('✅ Twikit bridge test completed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await bridge.shutdown();
  }
}

// Run test if called directly
if (require.main === module) {
  testTwikitBridge();
}

module.exports = TwikitBridge;
