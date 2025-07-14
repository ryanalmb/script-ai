import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// Telegram OAuth authentication flow
router.get('/telegram-oauth', asyncHandler(async (req: Request, res: Response) => {
  const { session, chat_id } = req.query;

  if (!session || !chat_id) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Error - X Marketing Platform</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .error { color: #e74c3c; text-align: center; }
          .logo { text-align: center; margin-bottom: 30px; font-size: 24px; font-weight: bold; color: #2c3e50; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🚀 X Marketing Platform</div>
          <div class="error">
            <h2>❌ Authentication Error</h2>
            <p>Invalid session parameters. Please return to Telegram and try again.</p>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Generate the authentication form
  const authForm = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Enterprise Authentication - X Marketing Platform</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container { 
          max-width: 450px; width: 100%; background: white; padding: 40px; 
          border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
        }
        .logo { 
          text-align: center; margin-bottom: 30px; font-size: 28px; 
          font-weight: bold; color: #2c3e50; 
        }
        .security-badge {
          background: #e8f5e8; color: #27ae60; padding: 10px; 
          border-radius: 8px; text-align: center; margin-bottom: 25px; 
          font-size: 14px; font-weight: 500;
        }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 500; color: #2c3e50; }
        input[type="email"], input[type="password"], input[type="text"] { 
          width: 100%; padding: 12px; border: 2px solid #e0e0e0; 
          border-radius: 8px; font-size: 16px; transition: border-color 0.3s;
        }
        input[type="email"]:focus, input[type="password"]:focus, input[type="text"]:focus { 
          outline: none; border-color: #667eea; 
        }
        .btn { 
          width: 100%; padding: 14px; background: #667eea; color: white; 
          border: none; border-radius: 8px; font-size: 16px; font-weight: 600; 
          cursor: pointer; transition: background 0.3s;
        }
        .btn:hover { background: #5a6fd8; }
        .btn:disabled { background: #bdc3c7; cursor: not-allowed; }
        .tabs { display: flex; margin-bottom: 25px; }
        .tab { 
          flex: 1; padding: 12px; text-align: center; background: #f8f9fa; 
          border: 1px solid #e0e0e0; cursor: pointer; font-weight: 500;
          transition: all 0.3s;
        }
        .tab:first-child { border-radius: 8px 0 0 8px; }
        .tab:last-child { border-radius: 0 8px 8px 0; border-left: none; }
        .tab.active { background: #667eea; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .mfa-info { 
          background: #fff3cd; color: #856404; padding: 15px; 
          border-radius: 8px; margin-bottom: 20px; font-size: 14px;
        }
        .loading { text-align: center; padding: 20px; }
        .spinner { 
          border: 3px solid #f3f3f3; border-top: 3px solid #667eea; 
          border-radius: 50%; width: 30px; height: 30px; 
          animation: spin 1s linear infinite; margin: 0 auto 15px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .success { 
          background: #d4edda; color: #155724; padding: 15px; 
          border-radius: 8px; text-align: center; margin-bottom: 20px;
        }
        .error { 
          background: #f8d7da; color: #721c24; padding: 15px; 
          border-radius: 8px; text-align: center; margin-bottom: 20px;
        }
        .token-display { 
          background: #f8f9fa; padding: 15px; border-radius: 8px; 
          font-family: monospace; font-size: 14px; word-break: break-all;
          border: 2px dashed #667eea; margin: 15px 0;
        }
        .copy-btn { 
          background: #28a745; color: white; border: none; 
          padding: 8px 16px; border-radius: 5px; cursor: pointer; 
          font-size: 14px; margin-top: 10px;
        }
        .security-features { 
          background: #f8f9fa; padding: 20px; border-radius: 8px; 
          margin-top: 20px; font-size: 14px;
        }
        .feature { margin-bottom: 8px; }
        .feature::before { content: "✅ "; color: #28a745; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🚀 X Marketing Platform</div>
        <div class="security-badge">
          🛡️ Enterprise-Grade Security • Bank-Level Encryption
        </div>

        <div class="tabs">
          <div class="tab active" onclick="switchTab('login')">Login</div>
          <div class="tab" onclick="switchTab('register')">Register</div>
        </div>

        <!-- Login Tab -->
        <div id="login-tab" class="tab-content active">
          <form id="login-form">
            <div class="form-group">
              <label for="login-email">Email Address</label>
              <input type="email" id="login-email" name="email" required>
            </div>
            <div class="form-group">
              <label for="login-password">Password</label>
              <input type="password" id="login-password" name="password" required>
            </div>
            <div class="form-group" id="mfa-group" style="display: none;">
              <label for="mfa-token">MFA Token</label>
              <input type="text" id="mfa-token" name="mfaToken" placeholder="Enter 6-digit code">
              <div class="mfa-info">
                🔐 Enter the 6-digit code from your authenticator app or use a backup code.
              </div>
            </div>
            <button type="submit" class="btn">🔐 Secure Login</button>
          </form>
        </div>

        <!-- Register Tab -->
        <div id="register-tab" class="tab-content">
          <form id="register-form">
            <div class="form-group">
              <label for="register-email">Email Address</label>
              <input type="email" id="register-email" name="email" required>
            </div>
            <div class="form-group">
              <label for="register-username">Username</label>
              <input type="text" id="register-username" name="username" required 
                     pattern="[a-zA-Z0-9_]+" title="Only letters, numbers, and underscores">
            </div>
            <div class="form-group">
              <label for="register-password">Password</label>
              <input type="password" id="register-password" name="password" required
                     pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
                     title="8+ characters with uppercase, lowercase, number, and special character">
            </div>
            <button type="submit" class="btn">🚀 Create Account</button>
          </form>
        </div>

        <!-- Loading State -->
        <div id="loading" style="display: none;">
          <div class="loading">
            <div class="spinner"></div>
            <p>Processing secure authentication...</p>
          </div>
        </div>

        <!-- Success State -->
        <div id="success" style="display: none;">
          <div class="success">
            <h3>✅ Authentication Successful!</h3>
            <p>Your secure authentication token has been generated.</p>
          </div>
          <div class="token-display" id="token-display"></div>
          <button class="copy-btn" onclick="copyToken()">📋 Copy Token</button>
          <p style="text-align: center; margin-top: 20px;">
            <strong>Next Steps:</strong><br>
            1. Copy the token above<br>
            2. Return to Telegram<br>
            3. Use: <code>/auth YOUR_TOKEN</code>
          </p>
        </div>

        <!-- Error State -->
        <div id="error" style="display: none;">
          <div class="error" id="error-message"></div>
          <button class="btn" onclick="location.reload()">🔄 Try Again</button>
        </div>

        <div class="security-features">
          <h4>🛡️ Security Features Active:</h4>
          <div class="feature">End-to-end encryption</div>
          <div class="feature">Multi-factor authentication</div>
          <div class="feature">Risk-based authentication</div>
          <div class="feature">Session management</div>
          <div class="feature">Audit logging</div>
        </div>
      </div>

      <script>
        const sessionId = '${session}';
        const chatId = '${chat_id}';
        let currentToken = '';

        function switchTab(tab) {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
          
          document.querySelector(\`[onclick="switchTab('\${tab}')"]\`).classList.add('active');
          document.getElementById(\`\${tab}-tab\`).classList.add('active');
        }

        function showLoading() {
          document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
          document.getElementById('loading').style.display = 'block';
          document.getElementById('success').style.display = 'none';
          document.getElementById('error').style.display = 'none';
        }

        function showSuccess(token) {
          currentToken = token;
          document.getElementById('loading').style.display = 'none';
          document.getElementById('success').style.display = 'block';
          document.getElementById('token-display').textContent = token;
        }

        function showError(message) {
          document.getElementById('loading').style.display = 'none';
          document.getElementById('error').style.display = 'block';
          document.getElementById('error-message').textContent = message;
        }

        function copyToken() {
          navigator.clipboard.writeText(currentToken).then(() => {
            const btn = document.querySelector('.copy-btn');
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            btn.style.background = '#28a745';
            setTimeout(() => {
              btn.textContent = originalText;
              btn.style.background = '#28a745';
            }, 2000);
          });
        }

        // Login form handler
        document.getElementById('login-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          showLoading();

          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData);

          try {
            const response = await fetch('/api/enterprise-auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
              showSuccess(result.tokens.accessToken);
            } else if (result.requiresMFA) {
              document.getElementById('mfa-group').style.display = 'block';
              document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
              document.getElementById('login-tab').style.display = 'block';
              document.getElementById('loading').style.display = 'none';
              alert('🔐 MFA Required: Please enter your 6-digit authentication code.');
            } else {
              showError(result.error || 'Authentication failed');
            }
          } catch (error) {
            showError('Network error. Please try again.');
          }
        });

        // Register form handler
        document.getElementById('register-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          showLoading();

          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData);

          try {
            const response = await fetch('/api/enterprise-auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
              // Auto-login after registration
              const loginResponse = await fetch('/api/enterprise-auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: data.email,
                  password: data.password
                })
              });

              const loginResult = await loginResponse.json();
              if (loginResult.success) {
                showSuccess(loginResult.tokens.accessToken);
              } else {
                showError('Registration successful, but auto-login failed. Please use the Login tab.');
              }
            } else {
              showError(result.error || 'Registration failed');
            }
          } catch (error) {
            showError('Network error. Please try again.');
          }
        });
      </script>
    </body>
    </html>
  `;

  res.send(authForm);
}));

export default router;
