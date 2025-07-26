#!/usr/bin/env python3
"""
Test Suite for Advanced Behavioral Pattern Simulation (Task 14)

Comprehensive tests for the AdvancedBehavioralPatternEngine and enhanced XClient
behavioral simulation capabilities.
"""

import unittest
import asyncio
import json
import sys
import os
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

# Add the parent directory to the path to import x_client
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from x_client import (
    AdvancedBehavioralPatternEngine, XClient, BehaviorProfile, ContentType,
    InteractionContext, ActionType, BehavioralProfile, ReadingMetrics,
    TypingMetrics, TimingPatterns, InteractionSequence
)

class TestAdvancedBehavioralPatternEngine(unittest.TestCase):
    """Test the AdvancedBehavioralPatternEngine class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.account_id = "test_account_123"
        self.engine = AdvancedBehavioralPatternEngine(self.account_id)
    
    def test_engine_initialization(self):
        """Test that the engine initializes correctly"""
        self.assertEqual(self.engine.account_id, self.account_id)
        self.assertIsNone(self.engine.current_profile)
        self.assertEqual(self.engine.current_fatigue_level, 0.0)
        self.assertEqual(self.engine.current_attention_level, 1.0)
        self.assertIsInstance(self.engine.action_history, list)
        self.assertIsInstance(self.engine.performance_metrics, dict)
    
    async def test_behavioral_profile_generation(self):
        """Test behavioral profile generation for all profile types"""
        for profile_type in BehaviorProfile:
            with self.subTest(profile_type=profile_type):
                profile = await self.engine._generate_behavioral_profile(profile_type)
                
                # Validate profile structure
                self.assertIsInstance(profile, BehavioralProfile)
                self.assertEqual(profile.profile_type, profile_type)
                self.assertIsInstance(profile.reading_metrics, ReadingMetrics)
                self.assertIsInstance(profile.typing_metrics, TypingMetrics)
                self.assertIsInstance(profile.timing_patterns, TimingPatterns)
                self.assertIsInstance(profile.interaction_sequences, InteractionSequence)
                
                # Validate realistic ranges
                self.assertGreaterEqual(profile.reading_metrics.average_reading_speed, 150)
                self.assertLessEqual(profile.reading_metrics.average_reading_speed, 400)
                self.assertGreaterEqual(profile.typing_metrics.average_wpm, 20)
                self.assertLessEqual(profile.typing_metrics.average_wpm, 80)
                self.assertGreaterEqual(profile.realism_score, 0.0)
                self.assertLessEqual(profile.realism_score, 1.0)
    
    async def test_reading_time_simulation(self):
        """Test reading time simulation with different content types"""
        # Load a behavioral profile first
        await self.engine.load_behavioral_profile(BehaviorProfile.CASUAL_BROWSER)
        
        test_content = "This is a test tweet with some content to read."
        
        for content_type in ContentType:
            with self.subTest(content_type=content_type):
                reading_time = await self.engine.simulate_reading_time(
                    content=test_content,
                    content_type=content_type,
                    context=InteractionContext.PERSONAL_INTEREST
                )
                
                # Validate reading time is realistic
                self.assertGreater(reading_time, 0.5)  # At least 0.5 seconds
                self.assertLess(reading_time, 120.0)   # Less than 2 minutes
    
    async def test_interaction_decision_simulation(self):
        """Test interaction decision simulation"""
        # Load a behavioral profile first
        await self.engine.load_behavioral_profile(BehaviorProfile.ENGAGEMENT_FOCUSED)
        
        for action_type in [ActionType.LIKE_TWEET, ActionType.RETWEET, ActionType.REPLY_TWEET]:
            with self.subTest(action_type=action_type):
                should_perform, decision_time = await self.engine.simulate_interaction_decision(
                    action_type=action_type,
                    content="Interesting tweet content",
                    context=InteractionContext.TRENDING_TOPIC
                )
                
                # Validate decision output
                self.assertIsInstance(should_perform, bool)
                self.assertGreater(decision_time, 0.0)
                self.assertLess(decision_time, 60.0)  # Less than 1 minute decision time
    
    async def test_action_delay_calculation(self):
        """Test action delay calculation with behavioral patterns"""
        # Load a behavioral profile first
        await self.engine.load_behavioral_profile(BehaviorProfile.POWER_USER)
        
        for action_type in ActionType:
            with self.subTest(action_type=action_type):
                delay = await self.engine.calculate_action_delay(action_type)
                
                # Validate delay is realistic
                self.assertGreater(delay, 0.1)   # At least 0.1 seconds
                self.assertLess(delay, 300.0)    # Less than 5 minutes
    
    async def test_behavioral_state_updates(self):
        """Test behavioral state updates and adaptation"""
        # Load a behavioral profile first
        await self.engine.load_behavioral_profile(BehaviorProfile.CASUAL_BROWSER)
        
        initial_fatigue = self.engine.current_fatigue_level
        initial_attention = self.engine.current_attention_level
        
        # Simulate several actions
        for i in range(5):
            await self.engine.update_behavioral_state(
                action_type=ActionType.LIKE_TWEET,
                success=True,
                response_time=2.0
            )
        
        # Validate state changes
        self.assertGreaterEqual(self.engine.current_fatigue_level, initial_fatigue)
        self.assertEqual(len(self.engine.action_history), 5)
        self.assertEqual(self.engine.current_profile.usage_count, 5)
    
    async def test_performance_metrics_calculation(self):
        """Test performance metrics calculation"""
        # Load a behavioral profile first
        await self.engine.load_behavioral_profile(BehaviorProfile.CONTENT_CREATOR)
        
        # Simulate some actions
        for i in range(10):
            await self.engine.update_behavioral_state(
                action_type=ActionType.POST_TWEET,
                success=i % 8 != 0,  # 87.5% success rate
                response_time=random.uniform(1.0, 5.0)
            )
        
        # Get performance report
        report = await self.engine.get_performance_report()
        
        # Validate report structure
        self.assertIn('account_id', report)
        self.assertIn('performance_metrics', report)
        self.assertIn('behavioral_quality', report)
        self.assertIn('success_metrics', report)
        
        # Validate metrics ranges
        metrics = report['performance_metrics']
        self.assertGreaterEqual(metrics['human_like_classification'], 0.0)
        self.assertLessEqual(metrics['human_like_classification'], 1.0)

class TestXClientBehavioralIntegration(unittest.TestCase):
    """Test XClient integration with behavioral patterns"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.account_id = "test_account_456"
        self.credentials = {
            'username': 'test_user',
            'password': 'test_pass',
            'email': 'test@example.com'
        }
        self.cookies_file = 'test_cookies.json'
    
    @patch('x_client.TWIKIT_AVAILABLE', True)
    def test_xclient_initialization_with_behavioral_profile(self):
        """Test XClient initialization with behavioral profile"""
        client = XClient(
            account_id=self.account_id,
            credentials=self.credentials,
            cookies_file=self.cookies_file,
            behavioral_profile_type=BehaviorProfile.POWER_USER
        )
        
        # Validate initialization
        self.assertEqual(client.account_id, self.account_id)
        self.assertEqual(client.behavioral_profile_type, BehaviorProfile.POWER_USER)
        self.assertIsInstance(client.behavioral_engine, AdvancedBehavioralPatternEngine)
        self.assertFalse(client.behavioral_profile_loaded)
        
        # Validate enhanced metrics
        self.assertIn('behavioral_realism_score', client.metrics)
        self.assertIn('human_like_classification', client.metrics)
        self.assertIn('detection_avoidance_rate', client.metrics)
        self.assertIn('timing_consistency_score', client.metrics)
    
    @patch('x_client.TWIKIT_AVAILABLE', True)
    async def test_behavioral_profile_initialization(self):
        """Test behavioral profile initialization"""
        client = XClient(
            account_id=self.account_id,
            credentials=self.credentials,
            cookies_file=self.cookies_file,
            behavioral_profile_type=BehaviorProfile.ENGAGEMENT_FOCUSED
        )
        
        # Initialize behavioral profile
        success = await client.initialize_behavioral_profile()
        
        # Validate initialization
        self.assertTrue(success)
        self.assertTrue(client.behavioral_profile_loaded)
        self.assertIsNotNone(client.session_config.behavior_profile)
        self.assertEqual(
            client.session_config.behavior_profile.profile_type,
            BehaviorProfile.ENGAGEMENT_FOCUSED
        )
    
    @patch('x_client.TWIKIT_AVAILABLE', True)
    async def test_content_reading_simulation(self):
        """Test content reading simulation"""
        client = XClient(
            account_id=self.account_id,
            credentials=self.credentials,
            cookies_file=self.cookies_file,
            behavioral_profile_type=BehaviorProfile.LURKER
        )
        
        await client.initialize_behavioral_profile()
        
        # Test reading simulation
        test_content = "This is a longer test tweet with more content to read and analyze."
        reading_time = await client.simulate_content_reading(
            content=test_content,
            content_type=ContentType.TEXT_WITH_IMAGE,
            context=InteractionContext.EDUCATIONAL
        )
        
        # Validate reading time
        self.assertGreater(reading_time, 1.0)  # Should take at least 1 second
        self.assertLess(reading_time, 60.0)    # Should be less than 1 minute
    
    @patch('x_client.TWIKIT_AVAILABLE', True)
    async def test_interaction_decision_making(self):
        """Test interaction decision making"""
        client = XClient(
            account_id=self.account_id,
            credentials=self.credentials,
            cookies_file=self.cookies_file,
            behavioral_profile_type=BehaviorProfile.CONTENT_CREATOR
        )
        
        await client.initialize_behavioral_profile()
        
        # Test interaction decision
        should_perform, decision_time = await client.should_perform_interaction(
            action_type=ActionType.REPLY_TWEET,
            content="Great content! Thanks for sharing.",
            context=InteractionContext.PERSONAL_INTEREST
        )
        
        # Validate decision
        self.assertIsInstance(should_perform, bool)
        self.assertGreater(decision_time, 0.0)
        self.assertLess(decision_time, 30.0)  # Should decide within 30 seconds
    
    @patch('x_client.TWIKIT_AVAILABLE', True)
    async def test_behavioral_performance_report(self):
        """Test behavioral performance report generation"""
        client = XClient(
            account_id=self.account_id,
            credentials=self.credentials,
            cookies_file=self.cookies_file,
            behavioral_profile_type=BehaviorProfile.CASUAL_BROWSER
        )
        
        await client.initialize_behavioral_profile()
        
        # Generate performance report
        report = await client.get_behavioral_performance_report()
        
        # Validate report structure
        self.assertIn('client_metrics', report)
        self.assertIn('behavioral_engine_report', report)
        self.assertIn('session_info', report)
        
        session_info = report['session_info']
        self.assertEqual(session_info['account_id'], self.account_id)
        self.assertEqual(session_info['profile_type'], BehaviorProfile.CASUAL_BROWSER.value)
        self.assertTrue(session_info['profile_loaded'])

class TestBehavioralProfileValidation(unittest.TestCase):
    """Test behavioral profile validation and quality metrics"""
    
    async def test_profile_realism_scores(self):
        """Test that all profile types generate realistic scores"""
        engine = AdvancedBehavioralPatternEngine("test_account")
        
        for profile_type in BehaviorProfile:
            with self.subTest(profile_type=profile_type):
                profile = await engine._generate_behavioral_profile(profile_type)
                
                # Validate quality metrics
                self.assertGreaterEqual(profile.realism_score, 0.7)  # Should be realistic
                self.assertGreaterEqual(profile.consistency_score, 0.7)  # Should be consistent
                self.assertLessEqual(profile.detection_risk, 0.3)  # Low detection risk
                
                # Validate behavioral ranges are human-like
                reading_speed = profile.reading_metrics.average_reading_speed
                self.assertTrue(150 <= reading_speed <= 400, f"Reading speed {reading_speed} out of range")
                
                typing_speed = profile.typing_metrics.average_wpm
                self.assertTrue(20 <= typing_speed <= 80, f"Typing speed {typing_speed} out of range")
                
                # Validate timing patterns
                self.assertTrue(0.1 <= profile.timing_patterns.fatigue_factor <= 0.5)
                self.assertTrue(15 <= profile.timing_patterns.attention_span <= 60)

# Test runner
if __name__ == '__main__':
    # Import required modules for testing
    import random
    
    # Run async tests
    async def run_async_tests():
        """Run all async tests"""
        test_classes = [
            TestAdvancedBehavioralPatternEngine,
            TestXClientBehavioralIntegration,
            TestBehavioralProfileValidation
        ]
        
        for test_class in test_classes:
            suite = unittest.TestLoader().loadTestsFromTestCase(test_class)
            for test in suite:
                if hasattr(test, '_testMethodName') and 'async' in test._testMethodName:
                    # Run async test
                    test_method = getattr(test, test._testMethodName)
                    if asyncio.iscoroutinefunction(test_method):
                        try:
                            await test_method()
                            print(f"✓ {test_class.__name__}.{test._testMethodName}")
                        except Exception as e:
                            print(f"✗ {test_class.__name__}.{test._testMethodName}: {e}")
                else:
                    # Run sync test
                    try:
                        test.debug()
                        print(f"✓ {test_class.__name__}.{test._testMethodName}")
                    except Exception as e:
                        print(f"✗ {test_class.__name__}.{test._testMethodName}: {e}")
    
    # Run tests
    print("Running Advanced Behavioral Pattern Simulation Tests...")
    asyncio.run(run_async_tests())
    print("Test execution completed.")
