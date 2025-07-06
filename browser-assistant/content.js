/**
 * X Marketing Assistant - Content Script
 * Provides compliant content assistance on X/Twitter
 */

class XMarketingAssistant {
    constructor() {
        this.apiUrl = 'http://localhost:3003';
        this.isActive = false;
        this.assistantPanel = null;
        this.currentTweetBox = null;
        
        this.init();
    }
    
    init() {
        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    setup() {
        console.log('X Marketing Assistant: Initializing...');
        
        // Create assistant panel
        this.createAssistantPanel();
        
        // Monitor for tweet compose boxes
        this.monitorTweetBoxes();
        
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
        });
        
        console.log('X Marketing Assistant: Ready');
    }
    
    createAssistantPanel() {
        // Create floating assistant panel
        this.assistantPanel = document.createElement('div');
        this.assistantPanel.id = 'x-marketing-assistant';
        this.assistantPanel.className = 'x-assistant-panel hidden';
        
        this.assistantPanel.innerHTML = `
            <div class="x-assistant-header">
                <h3>🚀 Content Assistant</h3>
                <button id="x-assistant-close" class="x-assistant-close">×</button>
            </div>
            <div class="x-assistant-content">
                <div class="x-assistant-section">
                    <label for="x-topic">Topic:</label>
                    <input type="text" id="x-topic" placeholder="Enter topic or keywords">
                </div>
                
                <div class="x-assistant-section">
                    <label for="x-tone">Tone:</label>
                    <select id="x-tone">
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="enthusiastic">Enthusiastic</option>
                        <option value="educational">Educational</option>
                    </select>
                </div>
                
                <div class="x-assistant-section">
                    <label for="x-type">Content Type:</label>
                    <select id="x-type">
                        <option value="general">General</option>
                        <option value="market_analysis">Market Analysis</option>
                        <option value="educational">Educational</option>
                        <option value="news_commentary">News Commentary</option>
                    </select>
                </div>
                
                <div class="x-assistant-actions">
                    <button id="x-generate-content" class="x-btn x-btn-primary">
                        Generate Content
                    </button>
                    <button id="x-analyze-sentiment" class="x-btn x-btn-secondary">
                        Analyze Sentiment
                    </button>
                </div>
                
                <div id="x-assistant-results" class="x-assistant-results hidden">
                    <div class="x-result-section">
                        <h4>Generated Content:</h4>
                        <div id="x-generated-content" class="x-content-preview"></div>
                        <div class="x-content-actions">
                            <button id="x-use-content" class="x-btn x-btn-success">Use This Content</button>
                            <button id="x-regenerate" class="x-btn x-btn-secondary">Regenerate</button>
                        </div>
                    </div>
                    
                    <div id="x-variations-section" class="x-result-section hidden">
                        <h4>Variations:</h4>
                        <div id="x-content-variations"></div>
                    </div>
                    
                    <div id="x-analytics-section" class="x-result-section">
                        <div class="x-analytics-grid">
                            <div class="x-metric">
                                <span class="x-metric-label">Quality Score:</span>
                                <span id="x-quality-score" class="x-metric-value">-</span>
                            </div>
                            <div class="x-metric">
                                <span class="x-metric-label">Compliance:</span>
                                <span id="x-compliance-score" class="x-metric-value">-</span>
                            </div>
                            <div class="x-metric">
                                <span class="x-metric-label">Characters:</span>
                                <span id="x-char-count" class="x-metric-value">-</span>
                            </div>
                        </div>
                    </div>
                    
                    <div id="x-suggestions-section" class="x-result-section hidden">
                        <h4>Suggestions:</h4>
                        <ul id="x-suggestions-list"></ul>
                    </div>
                </div>
                
                <div id="x-assistant-loading" class="x-assistant-loading hidden">
                    <div class="x-spinner"></div>
                    <p>Generating content...</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.assistantPanel);
        
        // Add event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Close button
        document.getElementById('x-assistant-close').addEventListener('click', () => {
            this.hideAssistant();
        });
        
        // Generate content button
        document.getElementById('x-generate-content').addEventListener('click', () => {
            this.generateContent();
        });
        
        // Analyze sentiment button
        document.getElementById('x-analyze-sentiment').addEventListener('click', () => {
            this.analyzeSentiment();
        });
        
        // Use content button
        document.getElementById('x-use-content').addEventListener('click', () => {
            this.useGeneratedContent();
        });
        
        // Regenerate button
        document.getElementById('x-regenerate').addEventListener('click', () => {
            this.generateContent();
        });
        
        // Make panel draggable
        this.makeDraggable();
    }
    
    monitorTweetBoxes() {
        // Monitor for tweet compose boxes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Look for tweet compose areas
                    const tweetBoxes = document.querySelectorAll('[data-testid="tweetTextarea_0"], [contenteditable="true"][data-text="What is happening?!"]');
                    
                    tweetBoxes.forEach((box) => {
                        if (!box.hasAttribute('data-x-assistant')) {
                            this.enhanceTweetBox(box);
                            box.setAttribute('data-x-assistant', 'true');
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Initial check
        setTimeout(() => {
            const tweetBoxes = document.querySelectorAll('[data-testid="tweetTextarea_0"], [contenteditable="true"]');
            tweetBoxes.forEach((box) => {
                if (!box.hasAttribute('data-x-assistant')) {
                    this.enhanceTweetBox(box);
                    box.setAttribute('data-x-assistant', 'true');
                }
            });
        }, 2000);
    }
    
    enhanceTweetBox(tweetBox) {
        // Add assistant button near tweet box
        const assistantBtn = document.createElement('button');
        assistantBtn.className = 'x-assistant-trigger';
        assistantBtn.innerHTML = '🚀 Assistant';
        assistantBtn.title = 'Open Content Assistant';
        
        assistantBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.currentTweetBox = tweetBox;
            this.showAssistant();
        });
        
        // Find a good place to insert the button
        const tweetActions = tweetBox.closest('[data-testid="toolBar"]') || 
                           tweetBox.parentElement.querySelector('[role="group"]') ||
                           tweetBox.parentElement;
        
        if (tweetActions && !tweetActions.querySelector('.x-assistant-trigger')) {
            tweetActions.appendChild(assistantBtn);
        }
    }
    
    showAssistant() {
        this.assistantPanel.classList.remove('hidden');
        this.isActive = true;
        
        // Position near the tweet box if possible
        if (this.currentTweetBox) {
            const rect = this.currentTweetBox.getBoundingClientRect();
            this.assistantPanel.style.top = `${rect.bottom + 10}px`;
            this.assistantPanel.style.left = `${rect.left}px`;
        }
    }
    
    hideAssistant() {
        this.assistantPanel.classList.add('hidden');
        this.isActive = false;
        this.currentTweetBox = null;
    }
    
    async generateContent() {
        const topic = document.getElementById('x-topic').value.trim();
        const tone = document.getElementById('x-tone').value;
        const type = document.getElementById('x-type').value;
        
        if (!topic) {
            alert('Please enter a topic');
            return;
        }
        
        this.showLoading(true);
        this.hideResults();
        
        try {
            const response = await fetch(`${this.apiUrl}/api/content/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    topic: topic,
                    tone: tone,
                    type: type,
                    platform: 'twitter',
                    context: {
                        user_agent: 'browser_assistant',
                        timestamp: new Date().toISOString()
                    }
                })
            });
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            this.displayResults(result);
            
        } catch (error) {
            console.error('Content generation failed:', error);
            alert('Failed to generate content. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }
    
    async analyzeSentiment() {
        if (!this.currentTweetBox) {
            alert('Please select a tweet box first');
            return;
        }
        
        const content = this.currentTweetBox.textContent || this.currentTweetBox.value;
        if (!content.trim()) {
            alert('Please enter some content to analyze');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.apiUrl}/api/sentiment/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: content
                })
            });
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            this.displaySentimentResults(result);
            
        } catch (error) {
            console.error('Sentiment analysis failed:', error);
            alert('Failed to analyze sentiment. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }
    
    displayResults(result) {
        // Show generated content
        document.getElementById('x-generated-content').textContent = result.content;
        
        // Show metrics
        document.getElementById('x-quality-score').textContent = 
            (result.quality_score * 100).toFixed(0) + '%';
        document.getElementById('x-compliance-score').textContent = 
            (result.compliance_score * 100).toFixed(0) + '%';
        document.getElementById('x-char-count').textContent = 
            result.metadata.character_count + '/280';
        
        // Show variations if available
        if (result.variations && result.variations.length > 0) {
            const variationsContainer = document.getElementById('x-content-variations');
            variationsContainer.innerHTML = '';
            
            result.variations.forEach((variation, index) => {
                const variationDiv = document.createElement('div');
                variationDiv.className = 'x-variation';
                variationDiv.innerHTML = `
                    <p>${variation}</p>
                    <button class="x-btn x-btn-small" onclick="this.parentElement.parentElement.parentElement.querySelector('#x-generated-content').textContent = '${variation.replace(/'/g, "\\'")}'"}>
                        Use This
                    </button>
                `;
                variationsContainer.appendChild(variationDiv);
            });
            
            document.getElementById('x-variations-section').classList.remove('hidden');
        }
        
        // Show suggestions if available
        if (result.suggestions && result.suggestions.length > 0) {
            const suggestionsList = document.getElementById('x-suggestions-list');
            suggestionsList.innerHTML = '';
            
            result.suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.textContent = suggestion;
                suggestionsList.appendChild(li);
            });
            
            document.getElementById('x-suggestions-section').classList.remove('hidden');
        }
        
        this.showResults();
    }
    
    displaySentimentResults(result) {
        // Display sentiment analysis results
        const resultsDiv = document.getElementById('x-assistant-results');
        
        const sentimentDiv = document.createElement('div');
        sentimentDiv.className = 'x-result-section';
        sentimentDiv.innerHTML = `
            <h4>Sentiment Analysis:</h4>
            <div class="x-sentiment-results">
                <div class="x-sentiment-primary">
                    Primary: <strong>${result.primary_sentiment.label}</strong> 
                    (${(result.primary_sentiment.score * 100).toFixed(1)}%)
                </div>
                <div class="x-sentiment-breakdown">
                    ${result.sentiments.map(s => 
                        `<span class="x-sentiment-item">${s.label}: ${(s.score * 100).toFixed(1)}%</span>`
                    ).join('')}
                </div>
            </div>
        `;
        
        resultsDiv.appendChild(sentimentDiv);
        this.showResults();
    }
    
    useGeneratedContent() {
        if (!this.currentTweetBox) {
            alert('No tweet box selected');
            return;
        }
        
        const content = document.getElementById('x-generated-content').textContent;
        
        // Insert content into tweet box
        if (this.currentTweetBox.contentEditable === 'true') {
            // For contenteditable elements
            this.currentTweetBox.textContent = content;
            
            // Trigger input event to update character count
            const event = new Event('input', { bubbles: true });
            this.currentTweetBox.dispatchEvent(event);
        } else {
            // For input/textarea elements
            this.currentTweetBox.value = content;
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            this.currentTweetBox.dispatchEvent(event);
        }
        
        // Focus the tweet box
        this.currentTweetBox.focus();
        
        // Hide assistant
        this.hideAssistant();
        
        // Show success message
        this.showNotification('Content inserted successfully!', 'success');
    }
    
    showLoading(show) {
        const loading = document.getElementById('x-assistant-loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }
    
    showResults() {
        document.getElementById('x-assistant-results').classList.remove('hidden');
    }
    
    hideResults() {
        document.getElementById('x-assistant-results').classList.add('hidden');
        document.getElementById('x-variations-section').classList.add('hidden');
        document.getElementById('x-suggestions-section').classList.add('hidden');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `x-notification x-notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    makeDraggable() {
        const header = this.assistantPanel.querySelector('.x-assistant-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        header.addEventListener('mousedown', (e) => {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            
            if (e.target === header || e.target.tagName === 'H3') {
                isDragging = true;
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                xOffset = currentX;
                yOffset = currentY;
                
                this.assistantPanel.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    
    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'toggle_assistant':
                if (this.isActive) {
                    this.hideAssistant();
                } else {
                    this.showAssistant();
                }
                break;
                
            case 'generate_content':
                this.generateContent();
                break;
                
            default:
                console.log('Unknown message:', request);
        }
    }
}

// Initialize the assistant
const xMarketingAssistant = new XMarketingAssistant();
