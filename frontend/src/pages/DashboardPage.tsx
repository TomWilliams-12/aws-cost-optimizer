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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              🚀 {user?.name}'s Dashboard
            </h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-600 mt-1">Manage your AWS accounts and cost optimization</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Connected Accounts</h3>
              <p className="text-3xl font-bold text-indigo-600 mt-2">{accounts?.length || 0}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Potential Savings</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {analysisResult ? (
                  `£${(
                    (analysisResult.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) +
                    (analysisResult.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0) +
                    (analysisResult.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0) +
                    (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0)
                  ).toFixed(0)}/mo`
                ) : '£0'}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Analysis Coverage</h3>
              <p className="text-sm text-gray-600 mt-2">
                {analysisResult ? (
                  <span className="space-y-1">
                    <div>✅ EBS Volumes</div>
                    <div>✅ EC2 Instances</div>
                    <div>✅ S3 Storage</div>
                    <div>✅ Elastic IPs</div>
                  </span>
                ) : (
                  (accounts?.length || 0) > 0 ? 'Run analysis to see coverage' : 'No analysis yet'
                )}
              </p>
            </div>
          </div>

          {/* AWS Accounts */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">AWS Accounts</h3>
                <button
                  onClick={() => setShowAddAccount(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  Add Account
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {isLoading && <div className="text-center py-12">Loading...</div>}
              {error && <div className="text-red-500 text-center py-12">{error}</div>}
              {!isLoading && !error && (accounts?.length || 0) === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-lg mb-4">🔗</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No AWS accounts connected</h3>
                  <p className="text-gray-600 mb-4">
                    Connect your first AWS account to start optimizing costs
                  </p>
                  <button
                    onClick={() => setShowAddAccount(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
                  >
                    Connect AWS Account
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {(accounts || []).map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">{account.accountName}</h4>
                        <p className="text-sm text-gray-600">Status: {account.status}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleAnalyze(account.id)}
                          disabled={analyzingAccountId === account.id}
                          className="text-indigo-600 hover:text-indigo-800 text-sm disabled:opacity-50"
                        >
                          {analyzingAccountId === account.id ? 'Analyzing...' : 'Analyze'}
                        </button>
                        <button className="text-red-600 hover:text-red-800 text-sm">
                          Remove
                        </button>
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