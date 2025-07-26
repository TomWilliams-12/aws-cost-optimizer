import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Account } from '../types'
import { CloudFormationOnboarding } from '../components/CloudFormationOnboarding'
import { CostBreakdownChart } from '../components/CostBreakdownChart'
import { SavingsImpactChart } from '../components/SavingsImpactChart'
import { SkeletonMetricsCard, SkeletonAccountCard, SkeletonText, SkeletonChart } from '../components/Skeleton'
import { ErrorDisplay } from '../components/ErrorDisplay'
import { parseApiError, EnhancedError } from '../utils/errorHandling'
import { ApiClient } from '../utils/retryLogic'
import { ToastContainer, useToast } from '../components/Toast'

const API_URL = 'https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev'

// Create API client with retry logic
const apiClient = new ApiClient(API_URL, {}, {
  maxAttempts: 3,
  delay: 1000,
  backoffMultiplier: 1.5 // Gentler backoff for UX
})

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<EnhancedError | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [showAnalysisResult, setShowAnalysisResult] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analyzingAccountId, setAnalyzingAccountId] = useState<string | null>(null)
  const [analysisFromCache, setAnalysisFromCache] = useState(false)
  const [analysisDate, setAnalysisDate] = useState<string | null>(null)
  const { user, token, logout } = useAuth()
  const { toasts, removeToast, success, error: showError, info } = useToast()

  // Function to fetch latest analysis for an account
  const fetchLatestAnalysis = async (accountId: string) => {
    try {
      const data = await apiClient.get(`/analysis/${accountId}`)
      if (data.data?.result && data.data?.cached) {
        setAnalysisResult(data.data.result)
        setAnalysisFromCache(true)
        setAnalysisDate(data.data.updatedAt || data.data.createdAt)
        return data.data
      }
    } catch (error) {
      console.log('No previous analysis found for account:', accountId)
    }
    return null
  }

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!token) {
        setIsLoading(false)
        return
      }

      // Update API client with current token
      apiClient.setAuthToken(token)

      try {
        setError(null)
        const data = await apiClient.get('/accounts')
        const fetchedAccounts = data.data?.accounts || []
        setAccounts(fetchedAccounts)
        
        // Try to fetch latest analysis for the first connected account
        if (fetchedAccounts.length > 0) {
          const firstAccount = fetchedAccounts[0]
          const previousAnalysis = await fetchLatestAnalysis(firstAccount.id)
          if (previousAnalysis) {
            info('Previous analysis loaded', `Found cached analysis from ${new Date(previousAnalysis.updatedAt || previousAnalysis.createdAt).toLocaleDateString()}`)
          }
        }
      } catch (err: any) {
        const enhancedError = parseApiError(err, err.response)
        setError(enhancedError)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAccounts()
  }, [token])

  const handleLogout = () => {
    logout()
  }

  const handleAnalyze = async (accountId: string) => {
    if (!token) return

    try {
      setAnalyzingAccountId(accountId)
      setError(null)
      // Reset cache flags for new analysis
      setAnalysisFromCache(false)
      setAnalysisDate(null)
      
      info('Analysis started', 'Scanning your AWS account for cost optimization opportunities...')
      
      // Use API client with retry logic for analysis (longer timeout for analysis)
      const data = await apiClient.post('/analysis', { accountId }, {
        retryOptions: {
          maxAttempts: 2, // Fewer retries for long-running analysis
          delay: 2000 // Longer delay between retries
        }
      })

      setAnalysisResult(data.data?.result)
      setAnalysisDate(new Date().toISOString())
      setShowAnalysisResult(true)

      // Calculate total savings for success message
      const result = data.data?.result
      const totalSavings = (
        (result.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) +
        (result.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0) +
        (result.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0) +
        (result.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) +
        (result.loadBalancerAnalysis || []).reduce((sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0)
      )

      const totalRecommendations = (
        (result.ec2Recommendations?.length || 0) +
        (result.s3Analysis?.reduce((sum: number, bucket: any) => sum + (bucket.recommendations?.length || 0), 0) || 0) +
        (result.unusedElasticIPs?.length || 0) +
        (result.unattachedVolumes?.length || 0) +
        (result.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation !== 'keep').length || 0)
      )

      success(
        'Analysis completed successfully!',
        `Found ${totalRecommendations} optimization opportunities with potential savings of £${totalSavings.toFixed(2)}/month`
      )
      
    } catch (err: any) {
      const enhancedError = parseApiError(err, err.response)
      setError(enhancedError)
      showError('Analysis failed', enhancedError.message)
    } finally {
      setAnalyzingAccountId(null)
    }
  }

  const handleAddAccount = async (accountData: {
    accountName: string;
    awsAccountId: string;
    roleArn: string;
    region: string;
  }) => {
    if (!token) return

    try {
      setError(null)
      setIsAddingAccount(true)
      
      const response = await fetch(`${API_URL}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountName: accountData.accountName,
          accountId: accountData.awsAccountId,
          roleArn: accountData.roleArn,
          region: accountData.region,
        }),
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const data = await response.json()
          errorMessage = data.message || errorMessage
        } catch {
          // Response wasn't JSON, use status text
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setAccounts([...accounts, data.data?.account])
      setShowAddAccount(false)
      success('Account connected successfully!', `${accountData.accountName} is now ready for analysis`)
    } catch (err: any) {
      const enhancedError = parseApiError(err, err.response)
      setError(enhancedError)
      showError('Failed to connect account', enhancedError.message)
      throw new Error(enhancedError.message)
    } finally {
      setIsAddingAccount(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">💰</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    AWS Cost Optimizer
                  </h1>
                  <p className="text-sm text-gray-500">Welcome back, {user?.name}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Dashboard Header with Quick Actions */}
          <div className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Cost Optimization Dashboard</h2>
                <p className="text-gray-600 mt-1">Discover savings opportunities across your AWS infrastructure</p>
              </div>
              <div className="flex space-x-3">
                <button className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  📊 View Reports
                </button>
                <button className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  ⚙️ Settings
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className={`transition-opacity duration-500 ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'}`}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SkeletonMetricsCard />
                <SkeletonMetricsCard />
                <SkeletonMetricsCard />
                <SkeletonMetricsCard />
              </div>
            </div>
            <div className={`transition-opacity duration-500 ${!isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${isLoading ? 'hidden' : 'grid grid-cols-1 md:grid-cols-4 gap-4'}`}>
              {!isLoading && (
              <>
                {/* Connected Accounts Card */}
                <div className="bg-white p-4 rounded-lg shadow border border-gray-100 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm">🔗</span>
                      </div>
                      <div className="ml-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Accounts</p>
                        <p className="text-2xl font-bold text-gray-900">{accounts?.length || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs text-gray-600">
                      {(accounts?.length || 0) === 0 ? 'Connect first account' : 'Active connections'}
                    </div>
                    <div className="flex items-center mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div className="bg-blue-600 h-1.5 rounded-full" style={{width: `${Math.min((accounts?.length || 0) * 25, 100)}%`}}></div>
                      </div>
                      <span className="ml-2 text-xs text-gray-500">of 4 max</span>
                    </div>
                  </div>
                </div>

            {/* Monthly Savings Card */}
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">💰</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Monthly Savings</p>
                    <p className="text-2xl font-bold text-green-600">
                      {analysisResult ? (
                        `£${(
                          (analysisResult.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) +
                          (analysisResult.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0) +
                          (analysisResult.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0) +
                          (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) +
                          (analysisResult.loadBalancerAnalysis || []).reduce((sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0)
                        ).toFixed(0)}`
                      ) : '£0'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-gray-600">
                  {analysisResult ? 'Potential reduction' : 'Run analysis'}
                </div>
                {analysisResult && (
                  <div className="text-xs text-green-600 font-medium mt-1">
                    £{(
                      (analysisResult.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) * 12 +
                      (analysisResult.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.annual || 0), 0) +
                      (analysisResult.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.annual || 0), 0) +
                      (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) * 12 +
                      (analysisResult.loadBalancerAnalysis || []).reduce((sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0) * 12
                    ).toFixed(0)} annually
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Coverage Card */}
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">📊</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Resources</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analysisResult ? '5/5' : '0/5'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-gray-600 mb-2">
                  {analysisResult ? 'All services analyzed' : 'Pending analysis'}
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div className={`flex items-center ${analysisResult ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 ${analysisResult ? 'bg-green-500' : 'bg-gray-300'} rounded-full mr-1.5`}></span>
                    EBS
                  </div>
                  <div className={`flex items-center ${analysisResult ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 ${analysisResult ? 'bg-green-500' : 'bg-gray-300'} rounded-full mr-1.5`}></span>
                    EC2
                  </div>
                  <div className={`flex items-center ${analysisResult ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 ${analysisResult ? 'bg-green-500' : 'bg-gray-300'} rounded-full mr-1.5`}></span>
                    S3
                  </div>
                  <div className={`flex items-center ${analysisResult ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 ${analysisResult ? 'bg-green-500' : 'bg-gray-300'} rounded-full mr-1.5`}></span>
                    IPs
                  </div>
                  <div className={`flex items-center ${analysisResult ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 ${analysisResult ? 'bg-green-500' : 'bg-gray-300'} rounded-full mr-1.5`}></span>
                    LBs
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations Card */}
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">💡</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recommendations</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analysisResult ? (
                        (analysisResult.ec2Recommendations?.length || 0) +
                        (analysisResult.s3Analysis?.reduce((sum: number, bucket: any) => sum + (bucket.recommendations?.length || 0), 0) || 0) +
                        (analysisResult.unusedElasticIPs?.length || 0) +
                        (analysisResult.unattachedVolumes?.length || 0) +
                        (analysisResult.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation === 'consider-removal' || lb.recommendation === 'review').length || 0)
                      ) : 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-gray-600 mb-2">
                  {analysisResult ? 'Optimization opportunities' : 'Run analysis'}
                </div>
                {analysisResult && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">High Impact</span>
                      <span className="font-medium">{(analysisResult.ec2Recommendations?.length || 0) + (analysisResult.unusedElasticIPs?.length || 0) + (analysisResult.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation === 'consider-removal').length || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Medium Impact</span>
                      <span className="font-medium">{(analysisResult.s3Analysis?.reduce((sum: number, bucket: any) => sum + (bucket.recommendations?.length || 0), 0) || 0) + (analysisResult.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation === 'review').length || 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
              </>
              )}
            </div>
          </div>

          {/* Quick Insights and Actions Row */}
          <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className={`transition-all duration-700 ease-in-out ${isLoading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute'}`}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-lg shadow border border-gray-100 p-4">
                    <div className="flex justify-between items-center mb-4">
                      <SkeletonText lines={1} className="w-32" />
                      <SkeletonText lines={1} className="w-16" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full mr-3 animate-pulse"></div>
                          <div>
                            <SkeletonText lines={1} className="w-40 mb-1" />
                            <SkeletonText lines={1} className="w-32" />
                          </div>
                        </div>
                        <SkeletonText lines={1} className="w-16" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full mr-3 animate-pulse"></div>
                          <div>
                            <SkeletonText lines={1} className="w-36 mb-1" />
                            <SkeletonText lines={1} className="w-28" />
                          </div>
                        </div>
                        <SkeletonText lines={1} className="w-16" />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="bg-white rounded-lg shadow border border-gray-100 p-4">
                    <SkeletonText lines={1} className="w-24 mb-4" />
                    <div className="space-y-3">
                      <div className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-gray-200 rounded mr-3 animate-pulse"></div>
                          <SkeletonText lines={1} className="w-24" />
                        </div>
                        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                      <div className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-gray-200 rounded mr-3 animate-pulse"></div>
                          <SkeletonText lines={1} className="w-20" />
                        </div>
                        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={`transition-all duration-700 ease-in-out delay-200 ${!isLoading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'} ${isLoading ? 'hidden' : 'grid grid-cols-1 lg:grid-cols-3 gap-6'}`}>
              {!isLoading && (
              <>
                {/* Recent Activity */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-lg shadow border border-gray-100 p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                      <span className="text-xs text-gray-500">Last 7 days</span>
                    </div>
                    <div className="space-y-3">
                  {analysisResult ? (
                    <>
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-green-600 text-sm">{analysisFromCache ? '📁' : '✅'}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {analysisFromCache ? 'Previous analysis loaded' : 'Cost analysis completed'}
                              {analysisFromCache && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">Cached</span>}
                            </p>
                            <p className="text-xs text-gray-500">Found {(analysisResult.ec2Recommendations?.length || 0) + (analysisResult.unusedElasticIPs?.length || 0) + (analysisResult.unattachedVolumes?.length || 0) + (analysisResult.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation !== 'keep').length || 0)} optimization opportunities</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {analysisFromCache && analysisDate ? 
                            new Date(analysisDate).toLocaleDateString() : 
                            'Just now'
                          }
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blue-600 text-sm">🔍</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">AWS account analyzed</p>
                            <p className="text-xs text-gray-500">Scanned EC2, S3, EBS, Elastic IPs, and Load Balancers</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">Just now</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-gray-400 text-sm">🔗</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Welcome to AWS Cost Optimizer</p>
                            <p className="text-xs text-gray-500">Connect your first AWS account to get started</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">Now</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-50">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-gray-400 text-sm">⏳</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Waiting for account connection</p>
                            <p className="text-xs text-gray-500">Connect an AWS account to begin analysis</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">Pending</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <div className="bg-white rounded-lg shadow border border-gray-100 p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowAddAccount(true)}
                    className="w-full flex items-center justify-between p-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200"
                  >
                    <div className="flex items-center">
                      <span className="text-blue-600 mr-3">➕</span>
                      <span className="text-sm font-medium text-gray-900">Add AWS Account</span>
                    </div>
                    <span className="text-xs text-gray-500">→</span>
                  </button>
                  <button className="w-full flex items-center justify-between p-3 text-left bg-green-50 hover:bg-green-100 rounded-lg transition-colors duration-200">
                    <div className="flex items-center">
                      <span className="text-green-600 mr-3">📊</span>
                      <span className="text-sm font-medium text-gray-900">View Reports</span>
                    </div>
                    <span className="text-xs text-gray-500">→</span>
                  </button>
                  <button className="w-full flex items-center justify-between p-3 text-left bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors duration-200">
                    <div className="flex items-center">
                      <span className="text-purple-600 mr-3">💡</span>
                      <span className="text-sm font-medium text-gray-900">Optimization Tips</span>
                    </div>
                    <span className="text-xs text-gray-500">→</span>
                  </button>
                  <button className="w-full flex items-center justify-between p-3 text-left bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors duration-200">
                    <div className="flex items-center">
                      <span className="text-orange-600 mr-3">⚙️</span>
                      <span className="text-sm font-medium text-gray-900">Settings</span>
                    </div>
                    <span className="text-xs text-gray-500">→</span>
                  </button>
                </div>
              </div>
            </div>
              </>
              )}
            </div>
          </div>

          {/* Charts and Visualizations */}
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className={`transition-all duration-700 ease-in-out ${isLoading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute'}`}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SkeletonChart />
                <SkeletonChart />
              </div>
            </div>
            <div className={`transition-all duration-700 ease-in-out delay-300 ${!isLoading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'} ${isLoading ? 'hidden' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}`}>
              {!isLoading && (
                <>
                  <CostBreakdownChart analysisResult={analysisResult} />
                  <SavingsImpactChart analysisResult={analysisResult} />
                </>
              )}
            </div>
          </div>

          {/* AWS Accounts Section */}
          <div className="bg-white rounded-lg shadow border border-gray-100">
            <div className="px-4 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">AWS Accounts</h3>
                  <p className="text-sm text-gray-500">Manage and monitor your connected accounts</p>
                </div>
                <button
                  onClick={() => setShowAddAccount(true)}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <span className="mr-2">+</span>
                  Add Account
                </button>
              </div>
            </div>

            <div className="px-4 py-4">
              {isLoading && (
                <div className="space-y-4">
                  <SkeletonAccountCard />
                  <SkeletonAccountCard />
                </div>
              )}
              {error && (
                <div className="py-8">
                  <ErrorDisplay 
                    error={error} 
                    onRetry={() => {
                      setError(null)
                      setIsLoading(true)
                      // Trigger refetch by setting token (this will retrigger useEffect)
                      window.location.reload()
                    }}
                    onDismiss={() => setError(null)}
                  />
                </div>
              )}
              {!isLoading && !error && (accounts?.length || 0) === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl">🔗</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">No AWS accounts connected</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Connect your first AWS account to start discovering cost optimization opportunities across your infrastructure
                  </p>
                  <button
                    onClick={() => setShowAddAccount(true)}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <span className="mr-2">+</span>
                    Connect AWS Account
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {(accounts || []).map((account) => (
                    <div key={account.id} className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">AWS</span>
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{account.accountName}</h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                account.status === 'active' ? 'bg-green-100 text-green-800' : 
                                account.status === 'error' ? 'bg-red-100 text-red-800' : 
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {account.status === 'active' ? '✅ Active' : 
                                 account.status === 'error' ? '❌ Error' : 
                                 '⏳ Inactive'}
                              </span>
                              {account.lastAnalyzed && (
                                <span className="text-xs text-gray-500">
                                  Last analyzed: {new Date(account.lastAnalyzed).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button 
                            onClick={() => handleAnalyze(account.id)}
                            disabled={analyzingAccountId === account.id}
                            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 transform ${
                              analyzingAccountId === account.id
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed scale-95'
                                : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md hover:shadow-lg'
                            }`}
                          >
                            {analyzingAccountId === account.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <span className="mr-2">🔍</span>
                                Analyze
                              </>
                            )}
                          </button>
                          <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors duration-200">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CloudFormation Onboarding */}
          <CloudFormationOnboarding
            isOpen={showAddAccount}
            onClose={() => setShowAddAccount(false)}
            onSubmit={handleAddAccount}
            isLoading={isAddingAccount}
          />

          {/* Analysis Result Modal */}
          {showAnalysisResult && analysisResult && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Cost Optimization Analysis Results</h3>
                    {analysisFromCache && analysisDate && (
                      <p className="text-sm text-gray-500 mt-1">
                        📁 Previous analysis from {new Date(analysisDate).toLocaleDateString()}
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">Cached</span>
                      </p>
                    )}
                  </div>
                  {analysisFromCache && accounts.length > 0 && (
                    <button
                      onClick={() => {
                        setShowAnalysisResult(false)
                        handleAnalyze(accounts[0].id)
                      }}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                    >
                      Run Fresh Analysis
                    </button>
                  )}
                </div>
                
                <div className="space-y-6">
                  {/* EBS Volumes Section */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      💾 Unattached EBS Volumes
                    </h4>
                    {(analysisResult.unattachedVolumes?.length || 0) > 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 gap-3">
                          {(analysisResult.unattachedVolumes || []).map((vol: any) => (
                            <div key={vol.volumeId} className="flex justify-between items-center p-3 bg-white rounded border">
                              <div>
                                <span className="font-medium text-sm">{vol.volumeId}</span>
                                <span className="text-gray-600 text-sm ml-2">({vol.size} GB)</span>
                              </div>
                              <div className="text-right">
                                <div className="text-green-600 font-medium">£{vol.potentialSavings?.toFixed(2) || '0.00'}/month</div>
                                <div className="text-xs text-gray-500">savings</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-600 bg-green-50 border border-green-200 rounded-lg p-4">
                        ✅ No unattached EBS volumes found - good resource management!
                      </p>
                    )}
                  </div>

                  {/* EC2 Rightsizing Section */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      🖥️ EC2 Rightsizing Recommendations
                    </h4>
                    {(analysisResult.ec2Recommendations?.length || 0) > 0 ? (
                      <div className="space-y-4">
                        {(analysisResult.ec2Recommendations || []).map((rec: any) => (
                          <div key={rec.instanceId} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h5 className="font-medium text-gray-900">{rec.instanceId}</h5>
                                <div className="text-sm text-gray-600">
                                  {rec.currentInstanceType} → {rec.recommendedInstanceType}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-green-600 font-bold">£{rec.potentialSavings?.monthly?.toFixed(2) || '0.00'}/month</div>
                                <div className="text-xs text-gray-500">({rec.potentialSavings?.percentage?.toFixed(1) || '0'}% savings)</div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  rec.confidence === 'high' ? 'bg-green-100 text-green-800' :
                                  rec.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {rec.confidence} confidence
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  rec.performanceImpact === 'none' ? 'bg-green-100 text-green-800' :
                                  rec.performanceImpact === 'minimal' ? 'bg-yellow-100 text-yellow-800' :
                                  rec.performanceImpact === 'moderate' ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {rec.performanceImpact} impact
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  rec.workloadPattern === 'steady' ? 'bg-blue-100 text-blue-800' :
                                  rec.workloadPattern === 'peaky' ? 'bg-purple-100 text-purple-800' :
                                  rec.workloadPattern === 'dev-test' ? 'bg-gray-100 text-gray-800' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {rec.workloadPattern} workload
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-sm text-gray-700 mb-3">
                              <strong>Analysis:</strong> {rec.reasoning}
                            </div>
                            
                            {rec.gravitonWarning && (
                              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                                <div className="flex items-start">
                                  <div className="flex-shrink-0">
                                    <span className="text-amber-400">⚠️</span>
                                  </div>
                                  <div className="ml-2">
                                    <h6 className="text-sm font-medium text-amber-800">Graviton Migration Warning</h6>
                                    <p className="text-sm text-amber-700 mt-1">{rec.gravitonWarning}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 bg-green-50 border border-green-200 rounded-lg p-4">
                        ✅ No EC2 rightsizing opportunities found - instances are well-sized!
                      </p>
                    )}
                  </div>

                  {/* S3 Storage Optimization Section */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      🗄️ S3 Storage Optimization
                    </h4>
                    {(analysisResult.s3Analysis?.length || 0) > 0 ? (
                      <div className="space-y-4">
                        {(analysisResult.s3Analysis || []).map((bucket: any) => (
                          <div key={bucket.bucketName} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h5 className="font-medium text-gray-900">{bucket.bucketName}</h5>
                                <div className="text-sm text-gray-600">
                                  {(bucket.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB • {bucket.objectCount} objects • {bucket.region}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-green-600 font-bold">£{bucket.potentialSavings?.monthly?.toFixed(2) || '0.00'}/month</div>
                                <div className="text-xs text-gray-500">potential savings</div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  bucket.hasLifecyclePolicy ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {bucket.hasLifecyclePolicy ? 'Has lifecycle policy' : 'No lifecycle policy'}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600">
                                Standard: {bucket.storageClassBreakdown?.standard?.size?.toFixed(1) || '0'} GB
                              </div>
                            </div>
                            
                            {bucket.recommendations?.length > 0 && (
                              <div className="space-y-2">
                                {bucket.recommendations.map((rec: any, index: number) => (
                                  <div key={index} className="bg-white border border-purple-200 rounded p-3">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="text-sm font-medium text-gray-900">{rec.description}</div>
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        rec.effort === 'low' ? 'bg-green-100 text-green-800' :
                                        rec.effort === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {rec.effort} effort
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">{rec.details}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 bg-green-50 border border-green-200 rounded-lg p-4">
                        ✅ No S3 storage optimization opportunities found - storage is well-managed!
                      </p>
                    )}
                  </div>

                  {/* Unused Elastic IPs Section */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      🌐 Unused Elastic IPs
                    </h4>
                    {(analysisResult.unusedElasticIPs?.length || 0) > 0 ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 gap-3">
                          {(analysisResult.unusedElasticIPs || []).map((ip: any) => (
                            <div key={ip.allocationId} className="flex justify-between items-center p-3 bg-white rounded border">
                              <div>
                                <span className="font-medium text-sm">{ip.publicIp}</span>
                                <span className="text-gray-600 text-sm ml-2">({ip.allocationId})</span>
                              </div>
                              <div className="text-right">
                                <div className="text-red-600 font-medium">£{ip.monthlyCost?.toFixed(2) || '3.65'}/month</div>
                                <div className="text-xs text-gray-500">wasted cost</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 p-3 bg-red-100 rounded-md">
                          <p className="text-sm text-red-800">
                            💡 <strong>Quick win:</strong> These unassociated Elastic IPs are incurring charges. 
                            Consider releasing them if they're not needed for failover or other purposes.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-600 bg-green-50 border border-green-200 rounded-lg p-4">
                        ✅ No unused Elastic IPs found - good resource management!
                      </p>
                    )}
                  </div>

                  {/* Load Balancer Analysis Section */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      ⚖️ Load Balancer Analysis
                    </h4>
                    {(analysisResult.loadBalancerAnalysis?.length || 0) > 0 ? (
                      <div className="space-y-4">
                        {(analysisResult.loadBalancerAnalysis || []).map((lb: any) => (
                          <div key={lb.loadBalancerArn} className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h5 className="font-medium text-gray-900 flex items-center">
                                  {lb.loadBalancerName}
                                  <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    lb.type === 'application' ? 'bg-blue-100 text-blue-800' :
                                    lb.type === 'network' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {lb.type === 'application' ? 'ALB' : lb.type === 'network' ? 'NLB' : 'Classic'}
                                  </span>
                                </h5>
                                <div className="text-sm text-gray-600 mt-1">
                                  {lb.scheme} • {lb.targetGroups?.reduce((sum: number, tg: any) => sum + tg.totalTargets, 0) || 0} targets • {lb.state}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`font-bold ${lb.potentialSavings > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                  {lb.potentialSavings > 0 ? `£${lb.potentialSavings?.toFixed(2)}/month` : 'In Use'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  £{lb.monthlyCost?.toFixed(2)} monthly cost
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  lb.recommendation === 'keep' ? 'bg-green-100 text-green-800' :
                                  lb.recommendation === 'review' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {lb.recommendation === 'keep' ? '✅ Keep' :
                                   lb.recommendation === 'review' ? '⚠️ Review' :
                                   '❌ Consider Removal'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  lb.confidenceLevel === 'high' ? 'bg-green-100 text-green-800' :
                                  lb.confidenceLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {lb.confidenceLevel} confidence
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-600">
                                  {lb.metrics?.requestCount?.toFixed(0) || 0} requests (7d)
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-sm text-gray-700 mb-3">
                              <strong>Analysis:</strong> {lb.reasoning}
                            </div>
                            
                            {lb.targetGroups && lb.targetGroups.length > 0 && (
                              <div className="bg-white border border-indigo-200 rounded p-3">
                                <h6 className="text-sm font-medium text-gray-900 mb-2">Target Groups</h6>
                                <div className="space-y-2">
                                  {lb.targetGroups.map((tg: any, index: number) => (
                                    <div key={tg.targetGroupArn || index} className="flex justify-between items-center text-xs">
                                      <div>
                                        <span className="font-medium">{tg.targetGroupName || `Target Group ${index + 1}`}</span>
                                      </div>
                                      <div className="flex space-x-4">
                                        <span className="text-green-600">{tg.healthyTargets} healthy</span>
                                        <span className="text-red-600">{tg.unhealthyTargets} unhealthy</span>
                                        <span className="text-gray-500">{tg.totalTargets} total</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {lb.recommendation === 'consider-removal' && (
                              <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3">
                                <div className="flex items-start">
                                  <div className="flex-shrink-0">
                                    <span className="text-red-400">⚠️</span>
                                  </div>
                                  <div className="ml-2">
                                    <h6 className="text-sm font-medium text-red-800">Potential Cost Savings</h6>
                                    <p className="text-sm text-red-700 mt-1">
                                      This load balancer could potentially be removed, saving £{lb.potentialSavings?.toFixed(2)} per month (£{(lb.potentialSavings * 12)?.toFixed(2)} annually).
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 bg-green-50 border border-green-200 rounded-lg p-4">
                        ✅ No idle load balancers found - resources are well-utilized!
                      </p>
                    )}
                  </div>

                  {/* Summary Section */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-3">💰 Total Potential Savings</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          £{(
                            (analysisResult.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) +
                            (analysisResult.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0) +
                            (analysisResult.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0) +
                            (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) +
                            (analysisResult.loadBalancerAnalysis || []).reduce((sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0)
                          ).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">per month</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          £{(
                            (analysisResult.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) * 12 +
                            (analysisResult.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.annual || 0), 0) +
                            (analysisResult.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.annual || 0), 0) +
                            (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) * 12 +
                            (analysisResult.loadBalancerAnalysis || []).reduce((sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0) * 12
                          ).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">per year</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowAnalysisResult(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toast Container */}
          <ToastContainer toasts={toasts} onClose={removeToast} />
        </div>
      </div>
    </div>
  )
} 