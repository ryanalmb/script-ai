/**
 * @name X/Twitter Automation Security Analysis
 * @description Detects security vulnerabilities specific to X/Twitter automation platform
 * @kind problem
 * @problem.severity warning
 * @security-severity 7.5
 * @precision high
 * @id x-automation/security-analysis
 * @tags security
 *       external/cwe/cwe-200
 *       external/cwe/cwe-312
 *       external/cwe/cwe-798
 */

import javascript
import python

/**
 * Detects hardcoded credentials in X/Twitter automation code
 */
class HardcodedCredential extends StringLiteral {
  HardcodedCredential() {
    // X/Twitter API credentials
    this.getValue().regexpMatch("(?i).*(api[_-]?key|api[_-]?secret|bearer[_-]?token|access[_-]?token).*") or
    
    // Telegram Bot credentials  
    this.getValue().regexpMatch("(?i).*telegram.*bot.*token.*") or
    
    // Database credentials
    this.getValue().regexpMatch("(?i).*(password|pwd|secret).*") or
    
    // Generic API keys
    this.getValue().regexpMatch("(?i).*[a-zA-Z0-9]{32,}.*") and
    this.getValue().regexpMatch("(?i).*(key|token|secret).*")
  }
}

/**
 * Detects insecure session management in Twikit integration
 */
class InsecureSessionManagement extends CallExpr {
  InsecureSessionManagement() {
    // Twikit session without proper encryption
    this.getCalleeName() = "save_cookies" and
    not exists(CallExpr encrypt | 
      encrypt.getCalleeName().regexpMatch("(?i).*(encrypt|cipher|secure).*") and
      encrypt.getParent*() = this.getParent*()
    ) or
    
    // Session data stored in plain text
    this.getCalleeName().regexpMatch("(?i).*(save|store|write).*") and
    exists(StringLiteral path | 
      path.getValue().regexpMatch(".*\\.(txt|json|log)$") and
      path.getParent*() = this.getParent*()
    )
  }
}

/**
 * Detects missing rate limiting in X/Twitter automation
 */
class MissingRateLimit extends CallExpr {
  MissingRateLimit() {
    // X/Twitter API calls without rate limiting
    (this.getCalleeName().regexpMatch("(?i).*(tweet|post|like|follow|retweet).*") or
     this.getCalleeName().regexpMatch("(?i).*(create|update|delete).*")) and
    
    not exists(CallExpr delay |
      delay.getCalleeName().regexpMatch("(?i).*(sleep|delay|wait|throttle|limit).*") and
      delay.getLocation().getStartLine() >= this.getLocation().getStartLine() - 5 and
      delay.getLocation().getStartLine() <= this.getLocation().getStartLine() + 5
    )
  }
}

/**
 * Detects insufficient anti-detection measures
 */
class InsufficientAntiDetection extends CallExpr {
  InsufficientAntiDetection() {
    // HTTP requests without proper headers
    this.getCalleeName().regexpMatch("(?i).*(request|get|post|put|delete).*") and
    
    not exists(AssignExpr headers |
      headers.getLhs().(PropAccess).getPropertyName() = "headers" and
      exists(StringLiteral userAgent |
        userAgent.getValue().regexpMatch("(?i).*user[_-]?agent.*") and
        userAgent.getParent*() = headers.getParent*()
      )
    ) and
    
    not exists(CallExpr proxy |
      proxy.getCalleeName().regexpMatch("(?i).*(proxy|tor|vpn).*") and
      proxy.getParent*() = this.getParent*()
    )
  }
}

/**
 * Detects exposed sensitive configuration
 */
class ExposedConfiguration extends StringLiteral {
  ExposedConfiguration() {
    // Environment variables in code
    this.getValue().regexpMatch("(?i).*process\\.env\\.[A-Z_]+.*") and
    this.getLocation().getFile().getBaseName().regexpMatch(".*\\.(js|ts|py)$") and
    not this.getLocation().getFile().getRelativePath().regexpMatch(".*/test/.*|.*\\.test\\.|.*\\.spec\\..*") or
    
    // Configuration files with sensitive data
    this.getValue().regexpMatch("(?i).*(localhost|127\\.0\\.0\\.1|password|secret).*") and
    this.getLocation().getFile().getBaseName().regexpMatch(".*\\.(json|yml|yaml|env)$")
  }
}

/**
 * Main query to report security issues
 */
from AstNode issue, string message, string category
where
  (issue instanceof HardcodedCredential and 
   message = "Hardcoded credential detected in X/Twitter automation code" and
   category = "credential-exposure") or
   
  (issue instanceof InsecureSessionManagement and
   message = "Insecure session management in Twikit integration" and
   category = "session-security") or
   
  (issue instanceof MissingRateLimit and
   message = "Missing rate limiting for X/Twitter API calls" and
   category = "rate-limiting") or
   
  (issue instanceof InsufficientAntiDetection and
   message = "Insufficient anti-detection measures for automation" and
   category = "anti-detection") or
   
  (issue instanceof ExposedConfiguration and
   message = "Sensitive configuration exposed in code" and
   category = "configuration-security")

select issue, message + " (Category: " + category + ")"
