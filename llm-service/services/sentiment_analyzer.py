#!/usr/bin/env python3
"""
Sentiment Analyzer Service
Provides AI-powered sentiment analysis for content
"""

import os
import logging
import requests
import re
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class SentimentAnalyzer:
    """AI-powered sentiment analysis service"""
    
    def __init__(self):
        self.huggingface_api_key = os.getenv('HUGGINGFACE_API_KEY')
        self.api_base_url = "https://api-inference.huggingface.co/models"
        self.headers = {
            "Authorization": f"Bearer {self.huggingface_api_key}",
            "Content-Type": "application/json"
        }
        
    def is_healthy(self) -> bool:
        """Check if the service is healthy"""
        return bool(self.huggingface_api_key)
    
    def analyze(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment of text using Hugging Face models"""
        try:
            # Use RoBERTa sentiment analysis model
            model_url = f"{self.api_base_url}/cardiffnlp/twitter-roberta-base-sentiment-latest"
            
            payload = {
                "inputs": text
            }
            
            response = requests.post(model_url, headers=self.headers, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                
                # Process the result
                if isinstance(result, list) and len(result) > 0:
                    sentiments = result[0]
                    
                    # Find the highest scoring sentiment
                    primary_sentiment = max(sentiments, key=lambda x: x['score'])
                    
                    # Map labels to more readable format
                    label_mapping = {
                        'LABEL_0': 'negative',
                        'LABEL_1': 'neutral', 
                        'LABEL_2': 'positive'
                    }
                    
                    mapped_sentiments = []
                    for sentiment in sentiments:
                        mapped_label = label_mapping.get(sentiment['label'], sentiment['label'].lower())
                        mapped_sentiments.append({
                            'label': mapped_label,
                            'score': sentiment['score'],
                            'confidence': sentiment['score']
                        })
                    
                    primary_mapped = label_mapping.get(primary_sentiment['label'], primary_sentiment['label'].lower())
                    
                    return {
                        'text': text,
                        'primary_sentiment': {
                            'label': primary_mapped,
                            'score': primary_sentiment['score'],
                            'confidence': primary_sentiment['score']
                        },
                        'sentiments': mapped_sentiments,
                        'analysis': self._generate_analysis(text, primary_mapped, primary_sentiment['score']),
                        'metadata': {
                            'analyzed_at': datetime.utcnow().isoformat(),
                            'model': 'cardiffnlp/twitter-roberta-base-sentiment-latest',
                            'text_length': len(text),
                            'word_count': len(text.split())
                        }
                    }
            
            # Fallback to rule-based sentiment analysis
            return self._fallback_sentiment_analysis(text)
                
        except Exception as e:
            logger.error(f"Error analyzing sentiment: {str(e)}")
            # Fallback to rule-based sentiment analysis
            return self._fallback_sentiment_analysis(text)
    
    def _fallback_sentiment_analysis(self, text: str) -> Dict[str, Any]:
        """Fallback rule-based sentiment analysis"""
        try:
            # Simple rule-based sentiment analysis
            positive_words = [
                'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful',
                'love', 'like', 'enjoy', 'happy', 'excited', 'bullish', 'positive', 'gain',
                'profit', 'success', 'win', 'growth', 'increase', 'rise', 'up', 'high',
                'strong', 'solid', 'robust', 'promising', 'opportunity', 'breakthrough'
            ]
            
            negative_words = [
                'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'sad', 'angry',
                'disappointed', 'frustrated', 'bearish', 'negative', 'loss', 'fail', 'decline',
                'decrease', 'fall', 'down', 'low', 'weak', 'poor', 'risk', 'danger', 'crash',
                'dump', 'scam', 'fraud', 'problem', 'issue', 'concern', 'worry'
            ]
            
            neutral_words = [
                'okay', 'fine', 'normal', 'average', 'standard', 'regular', 'typical',
                'analysis', 'data', 'information', 'report', 'update', 'news', 'market',
                'price', 'value', 'trading', 'investment', 'strategy', 'plan'
            ]
            
            # Clean and tokenize text
            clean_text = re.sub(r'[^\w\s]', '', text.lower())
            words = clean_text.split()
            
            # Count sentiment words
            positive_count = sum(1 for word in words if word in positive_words)
            negative_count = sum(1 for word in words if word in negative_words)
            neutral_count = sum(1 for word in words if word in neutral_words)
            
            total_sentiment_words = positive_count + negative_count + neutral_count
            
            if total_sentiment_words == 0:
                # No sentiment words found, default to neutral
                primary_sentiment = 'neutral'
                confidence = 0.5
            else:
                # Calculate sentiment scores
                positive_score = positive_count / len(words) if words else 0
                negative_score = negative_count / len(words) if words else 0
                neutral_score = neutral_count / len(words) if words else 0
                
                # Determine primary sentiment
                if positive_score > negative_score and positive_score > neutral_score:
                    primary_sentiment = 'positive'
                    confidence = min(0.9, 0.5 + positive_score)
                elif negative_score > positive_score and negative_score > neutral_score:
                    primary_sentiment = 'negative'
                    confidence = min(0.9, 0.5 + negative_score)
                else:
                    primary_sentiment = 'neutral'
                    confidence = min(0.9, 0.5 + neutral_score)
            
            # Create sentiment distribution
            sentiments = [
                {'label': 'positive', 'score': positive_count / max(1, total_sentiment_words), 'confidence': confidence if primary_sentiment == 'positive' else 0.3},
                {'label': 'negative', 'score': negative_count / max(1, total_sentiment_words), 'confidence': confidence if primary_sentiment == 'negative' else 0.3},
                {'label': 'neutral', 'score': neutral_count / max(1, total_sentiment_words), 'confidence': confidence if primary_sentiment == 'neutral' else 0.4}
            ]
            
            return {
                'text': text,
                'primary_sentiment': {
                    'label': primary_sentiment,
                    'score': confidence,
                    'confidence': confidence
                },
                'sentiments': sentiments,
                'analysis': self._generate_analysis(text, primary_sentiment, confidence),
                'metadata': {
                    'analyzed_at': datetime.utcnow().isoformat(),
                    'model': 'rule_based_fallback',
                    'text_length': len(text),
                    'word_count': len(text.split()),
                    'sentiment_words_found': total_sentiment_words
                }
            }
            
        except Exception as e:
            logger.error(f"Error in fallback sentiment analysis: {str(e)}")
            return {
                'text': text,
                'primary_sentiment': {
                    'label': 'neutral',
                    'score': 0.5,
                    'confidence': 0.5
                },
                'sentiments': [
                    {'label': 'positive', 'score': 0.33, 'confidence': 0.33},
                    {'label': 'negative', 'score': 0.33, 'confidence': 0.33},
                    {'label': 'neutral', 'score': 0.34, 'confidence': 0.34}
                ],
                'analysis': {
                    'summary': 'Unable to analyze sentiment',
                    'confidence_level': 'low',
                    'recommendations': ['Manual review recommended']
                },
                'metadata': {
                    'analyzed_at': datetime.utcnow().isoformat(),
                    'model': 'error_fallback',
                    'text_length': len(text),
                    'word_count': len(text.split())
                }
            }
    
    def _generate_analysis(self, text: str, sentiment: str, confidence: float) -> Dict[str, Any]:
        """Generate detailed analysis of the sentiment"""
        confidence_level = 'high' if confidence > 0.8 else 'medium' if confidence > 0.6 else 'low'
        
        analysis = {
            'summary': f"The text expresses {sentiment} sentiment with {confidence_level} confidence.",
            'confidence_level': confidence_level,
            'recommendations': []
        }
        
        # Add recommendations based on sentiment and confidence
        if sentiment == 'positive' and confidence > 0.7:
            analysis['recommendations'].append("Great for engagement - consider amplifying this content")
        elif sentiment == 'negative' and confidence > 0.7:
            analysis['recommendations'].append("Consider revising to improve sentiment")
        elif confidence < 0.6:
            analysis['recommendations'].append("Sentiment unclear - consider manual review")
        
        # Add length-based recommendations
        if len(text) < 50:
            analysis['recommendations'].append("Text is quite short - sentiment analysis may be less accurate")
        elif len(text) > 500:
            analysis['recommendations'].append("Long text - consider analyzing in segments")
        
        return analysis
