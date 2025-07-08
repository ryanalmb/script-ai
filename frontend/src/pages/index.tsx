import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import DashboardStats from '@/components/Dashboard/DashboardStats'
import AutomationOverview from '@/components/Dashboard/AutomationOverview'
import ContentGeneration from '@/components/Dashboard/ContentGeneration'
import AnalyticsChart from '@/components/Dashboard/AnalyticsChart'
import RecentActivity from '@/components/Dashboard/RecentActivity'
import QuickActions from '@/components/Dashboard/QuickActions'
import Head from 'next/head'

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth()
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d')

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboard', selectedTimeRange],
    queryFn: () => apiClient.get(`/dashboard?timeRange=${selectedTimeRange}`),
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch real-time stats
  const { data: realtimeStats } = useQuery({
    queryKey: ['realtime-stats'],
    queryFn: () => apiClient.get('/analytics/realtime'),
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Welcome to X Marketing Platform
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please sign in to access your dashboard
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Dashboard - X Marketing Platform</title>
        <meta name="description" content="X Marketing Automation Platform Dashboard" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.username || 'User'}!
            </h1>
            <p className="mt-2 text-gray-600">
              Here's what's happening with your X marketing automation today.
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="mb-6">
            <div className="flex space-x-2">
              {['24h', '7d', '30d', '90d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setSelectedTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTimeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  {range === '24h' ? 'Last 24 Hours' : 
                   range === '7d' ? 'Last 7 Days' :
                   range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="mb-8">
            <DashboardStats 
              data={dashboardData?.stats} 
              realtimeData={realtimeStats}
              isLoading={isLoading} 
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Analytics Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Performance Analytics
                </h2>
                <AnalyticsChart 
                  data={dashboardData?.analytics} 
                  timeRange={selectedTimeRange}
                  isLoading={isLoading}
                />
              </div>

              {/* Automation Overview */}
              <AutomationOverview 
                data={dashboardData?.automations}
                isLoading={isLoading}
              />

              {/* Content Generation */}
              <ContentGeneration 
                data={dashboardData?.content}
                isLoading={isLoading}
              />
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <QuickActions />

              {/* Recent Activity */}
              <RecentActivity 
                data={dashboardData?.activity}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
