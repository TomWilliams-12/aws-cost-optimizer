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
              <p className="text-3xl font-bold text-green-600 mt-2">£0</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Last Analysis</h3>
              <p className="text-sm text-gray-600 mt-2">
                {(accounts?.length || 0) > 0 ? 'Today' : 'No analysis yet'}
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
              <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Analysis Results</h3>
                <div className="space-y-4">
                  {(analysisResult.unattachedVolumes?.length || 0) > 0 ? (
                    <div>
                      <h4 className="font-semibold">Unattached EBS Volumes</h4>
                      <ul className="list-disc list-inside">
                        {(analysisResult.unattachedVolumes || []).map((vol: any) => (
                          <li key={vol.volumeId}>
                            {vol.volumeId} ({vol.size} GB) - Potential savings: £{vol.potentialSavings?.toFixed(2) || '0.00'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p>No unattached EBS volumes found.</p>
                  )}
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