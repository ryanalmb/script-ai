from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from datetime import datetime
import random

app = Flask(__name__)
CORS(app)

# Load environment variables
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value

load_env()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'OK',
        'timestamp': datetime.now().isoformat(),
        'service': 'LLM Service',
        'version': '1.0.0',
        'features': [
            'Content Generation',
            'Quality Analysis',
            'Sentiment Analysis',
            'Trending Topics',
            'Template Processing'
        ],
        'providers': {
            'huggingface': bool(os.getenv('HUGGINGFACE_API_KEY')),
            'openai': bool(os.getenv('OPENAI_API_KEY')),
            'anthropic': bool(os.getenv('ANTHROPIC_API_KEY'))
        }
    })

@app.route('/generate', methods=['POST'])
def generate_content():
    try:
        data = request.get_json()
        topic = data.get('topic', 'cryptocurrency')
        tone = data.get('tone', 'professional')
        content_type = data.get('type', 'post')
        length = data.get('length', 'medium')
        
        # Simulate AI content generation
        templates = {
            'bullish': [
                f"{topic.title()} showing strong momentum today! 📈 Technical analysis suggests potential breakout. What are your thoughts?",
                f"Exciting developments in {topic}! The fundamentals look solid and market sentiment is turning positive.",
                f"{topic.title()} breaking key resistance levels! This could be the start of a significant move upward."
            ],
            'bearish': [
                f"{topic.title()} facing some headwinds today. Important to stay cautious and manage risk properly.",
                f"Market correction in {topic} might present buying opportunities for patient investors. DYOR!",
                f"{topic.title()} testing support levels. Key to watch how it holds in the coming sessions."
            ],
            'neutral': [
                f"Analyzing {topic} market trends. Mixed signals suggest consolidation phase ahead.",
                f"{topic.title()} market update: Sideways movement continues as traders await catalyst.",
                f"Current {topic} analysis shows balanced market conditions. Patience is key."
            ],
            'professional': [
                f"Comprehensive {topic} analysis reveals interesting market dynamics worth monitoring.",
                f"{topic.title()} market structure analysis indicates potential opportunities for strategic positioning.",
                f"Technical and fundamental analysis of {topic} suggests measured approach recommended."
            ]
        }
        
        content_templates = templates.get(tone, templates['professional'])
        generated_content = random.choice(content_templates)
        
        # Add hashtags based on topic
        hashtag_map = {
            'bitcoin': ['#Bitcoin', '#BTC', '#Crypto'],
            'ethereum': ['#Ethereum', '#ETH', '#DeFi'],
            'cryptocurrency': ['#Crypto', '#Blockchain', '#Trading'],
            'defi': ['#DeFi', '#Yield', '#Ethereum'],
            'nft': ['#NFT', '#DigitalArt', '#Blockchain'],
            'trading': ['#Trading', '#TechnicalAnalysis', '#Crypto']
        }
        
        hashtags = hashtag_map.get(topic.lower(), ['#Crypto', '#Blockchain'])
        generated_content += f" {' '.join(hashtags)}"
        
        # Calculate quality scores
        quality_score = round(random.uniform(0.85, 0.95), 2)
        compliance_score = round(random.uniform(0.90, 0.98), 2)
        engagement_prediction = round(random.uniform(0.75, 0.90), 2)
        
        response = {
            'success': True,
            'content': {
                'id': f'content-{int(datetime.now().timestamp())}',
                'text': generated_content,
                'type': content_type,
                'quality': {
                    'score': quality_score,
                    'compliance': compliance_score,
                    'sentiment': tone,
                    'readability': round(random.uniform(0.80, 0.95), 2),
                    'engagement_prediction': engagement_prediction
                },
                'metadata': {
                    'topic': topic,
                    'tone': tone,
                    'length': length,
                    'character_count': len(generated_content),
                    'word_count': len(generated_content.split()),
                    'hashtags': hashtags,
                    'generated_at': datetime.now().isoformat(),
                    'provider': 'simulated'
                },
                'suggestions': [
                    'Consider adding more specific data points',
                    'Include a call-to-action for engagement',
                    'Optimize posting time for target audience',
                    'Add relevant trending hashtags'
                ]
            }
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Content generation failed'
        }), 500

@app.route('/analyze', methods=['POST'])
def analyze_content():
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({
                'success': False,
                'error': 'Content is required'
            }), 400
        
        # Simulate content analysis
        word_count = len(content.split())
        char_count = len(content)
        hashtag_count = content.count('#')
        mention_count = content.count('@')
        
        # Calculate scores
        quality_score = min(0.95, max(0.70, 0.85 + (word_count / 100) * 0.1))
        compliance_score = 0.95 if hashtag_count <= 5 and mention_count <= 3 else 0.85
        readability = min(0.95, max(0.70, 0.90 - (char_count / 1000) * 0.1))
        
        analysis = {
            'success': True,
            'analysis': {
                'quality': {
                    'score': round(quality_score, 2),
                    'factors': {
                        'readability': round(readability, 2),
                        'engagement_potential': round(random.uniform(0.75, 0.90), 2),
                        'originality': round(random.uniform(0.80, 0.95), 2),
                        'relevance': round(random.uniform(0.85, 0.95), 2)
                    }
                },
                'compliance': {
                    'score': round(compliance_score, 2),
                    'checks': {
                        'spam_detection': 'passed',
                        'sentiment_analysis': 'neutral',
                        'content_policy': 'compliant',
                        'trademark_check': 'clear'
                    }
                },
                'metrics': {
                    'character_count': char_count,
                    'word_count': word_count,
                    'hashtag_count': hashtag_count,
                    'mention_count': mention_count,
                    'emoji_count': len([c for c in content if ord(c) > 127])
                },
                'predictions': {
                    'engagement_rate': round(random.uniform(0.03, 0.08), 3),
                    'reach_estimate': random.randint(5000, 25000),
                    'interaction_likelihood': round(random.uniform(0.70, 0.90), 2)
                },
                'suggestions': [
                    'Content length is optimal for engagement',
                    'Consider adding relevant emojis',
                    'Hashtag usage is appropriate',
                    'Good compliance score achieved'
                ]
            }
        }
        
        return jsonify(analysis)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Content analysis failed'
        }), 500

@app.route('/trending', methods=['GET'])
def get_trending():
    try:
        category = request.args.get('category', 'crypto')
        
        # Simulate trending topics
        trending_data = {
            'success': True,
            'trending': {
                'topics': [
                    {'topic': 'Bitcoin ETF', 'volume': 15420, 'sentiment': 'positive', 'growth': '+25%'},
                    {'topic': 'Ethereum Upgrade', 'volume': 12890, 'sentiment': 'positive', 'growth': '+18%'},
                    {'topic': 'DeFi Yields', 'volume': 9870, 'sentiment': 'neutral', 'growth': '+12%'},
                    {'topic': 'NFT Market', 'volume': 8450, 'sentiment': 'mixed', 'growth': '-8%'},
                    {'topic': 'Altcoin Season', 'volume': 7230, 'sentiment': 'positive', 'growth': '+22%'}
                ],
                'hashtags': [
                    {'hashtag': '#Bitcoin', 'usage': 45000, 'trend': 'rising'},
                    {'hashtag': '#Ethereum', 'usage': 32000, 'trend': 'rising'},
                    {'hashtag': '#DeFi', 'usage': 28000, 'trend': 'stable'},
                    {'hashtag': '#Crypto', 'usage': 67000, 'trend': 'rising'},
                    {'hashtag': '#Blockchain', 'usage': 23000, 'trend': 'stable'}
                ],
                'keywords': [
                    'bull market', 'resistance level', 'support zone', 'breakout', 'consolidation',
                    'market cap', 'volume spike', 'technical analysis', 'fundamental analysis', 'HODL'
                ],
                'category': category,
                'updated_at': datetime.now().isoformat()
            }
        }
        
        return jsonify(trending_data)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get trending topics'
        }), 500

@app.route('/templates', methods=['GET'])
def get_templates():
    try:
        templates = {
            'success': True,
            'templates': [
                {
                    'id': 'market-analysis',
                    'name': 'Market Analysis',
                    'category': 'trading',
                    'template': '{asset} showing {trend} momentum! 📈 {analysis} What are your thoughts? {hashtags}',
                    'variables': ['asset', 'trend', 'analysis', 'hashtags']
                },
                {
                    'id': 'defi-update',
                    'name': 'DeFi Update',
                    'category': 'defi',
                    'template': '{protocol} {update} looking {sentiment}. Current {metric}: {value}. DYOR! {hashtags}',
                    'variables': ['protocol', 'update', 'sentiment', 'metric', 'value', 'hashtags']
                },
                {
                    'id': 'news-thread',
                    'name': 'News Thread',
                    'category': 'news',
                    'template': 'Breaking: {headline} 🧵\n\n1/ {point1}\n2/ {point2}\n3/ {conclusion} {hashtags}',
                    'variables': ['headline', 'point1', 'point2', 'conclusion', 'hashtags']
                }
            ]
        }
        
        return jsonify(templates)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get templates'
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('LLM_PORT', 5000))
    debug = os.getenv('DEBUG_MODE', 'true').lower() == 'true'
    
    print(f"🧠 LLM Service starting on port {port}")
    print(f"🔧 Debug mode: {debug}")
    print(f"🔑 Hugging Face API: {'Configured' if os.getenv('HUGGINGFACE_API_KEY') else 'Not configured'}")
    print(f"🔑 OpenAI API: {'Configured' if os.getenv('OPENAI_API_KEY') else 'Not configured'}")
    print(f"🔑 Anthropic API: {'Configured' if os.getenv('ANTHROPIC_API_KEY') else 'Not configured'}")
    print(f"✅ LLM Service ready!")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
