import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Account } from '../types'
import { AccountOnboardingWizard } from '../components/AccountOnboardingWizard'

const API_URL = 'https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev'

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [showAnalysisResult, setShowAnalysisResult] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analyzingAccountId, setAnalyzingAccountId] = useState<string | null>(null)
  const { user, token, logout } = useAuth()

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        setError(null)
        const response = await fetch(`${API_URL}/accounts`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch accounts')
        }

        const data = await response.json()
        setAccounts(data.data?.accounts || [])
      } catch (err: any) {
        setError(err.message)
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
      const response = await fetch(`${API_URL}/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accountId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to start analysis')
      }

      const data = await response.json()
      setAnalysisResult(data.data?.result)
      setShowAnalysisResult(true)
    } catch (err: any) {
      setError(err.message)
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
    } catch (err: any) {
      const errorMessage = err.name === 'TypeError' && err.message === 'Failed to fetch' 
        ? 'Network error: Unable to connect to server. Please check your internet connection.'
        : err.message
      setError(errorMessage)
      throw new Error(errorMessage)
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
      <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Cost Optimization Dashboard</h2>
            <p className="text-gray-600 mt-2 text-lg">Discover savings opportunities across your AWS infrastructure</p>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Connected Accounts Card */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xl">🔗</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Connected Accounts</h3>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{accounts?.length || 0}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">
                  {(accounts?.length || 0) === 0 ? 'Connect your first AWS account' : 'AWS accounts being monitored'}
                </div>
              </div>
            </div>

            {/* Potential Savings Card */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xl">💰</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Monthly Savings</h3>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {analysisResult ? (
                      `£${(
                        (analysisResult.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) +
                        (analysisResult.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0) +
                        (analysisResult.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0) +
                        (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0)
                      ).toFixed(0)}`
                    ) : '£0'}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">
                  {analysisResult ? 'Potential monthly cost reduction' : 'Run analysis to discover savings'}
                </div>
                {analysisResult && (
                  <div className="text-xs text-green-600 font-medium mt-1">
                    £{(
                      (analysisResult.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) * 12 +
                      (analysisResult.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.annual || 0), 0) +
                      (analysisResult.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.annual || 0), 0) +
                      (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) * 12
                    ).toFixed(0)} annually
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Coverage Card */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xl">📊</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Analysis Coverage</h3>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {analysisResult ? '4/4' : '0/4'}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                {analysisResult ? (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex items-center text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      EBS Volumes
                    </div>
                    <div className="flex items-center text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      EC2 Instances
                    </div>
                    <div className="flex items-center text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      S3 Storage
                    </div>
                    <div className="flex items-center text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      Elastic IPs
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    {(accounts?.length || 0) > 0 ? 'Run analysis to see coverage' : 'No analysis yet'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AWS Accounts Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">AWS Accounts</h3>
                  <p className="text-sm text-gray-500 mt-1">Manage and monitor your connected AWS accounts</p>
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

            <div className="px-6 py-6">
              {isLoading && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">Loading your AWS accounts...</p>
                </div>
              )}
              {error && (
                <div className="text-center py-12">
                  <div className="text-red-400 text-4xl mb-4">⚠️</div>
                  <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Accounts</h3>
                  <p className="text-red-600">{error}</p>
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
                            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                              analyzingAccountId === account.id
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md hover:shadow-lg'
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

          {/* Account Onboarding Wizard */}
          <AccountOnboardingWizard
            isOpen={showAddAccount}
            onClose={() => setShowAddAccount(false)}
            onSubmit={handleAddAccount}
            isLoading={isAddingAccount}
          />

          {/* Analysis Result Modal */}
          {showAnalysisResult && analysisResult && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Optimization Analysis Results</h3>
                
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
                            (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0)
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
                            (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) * 12
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
        </div>
      </div>
    </div>
  )
} 