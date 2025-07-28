import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Account } from '../types'
import { CloudFormationOnboarding } from '../components/CloudFormationOnboarding'
import DeleteConfirmationModal from '../components/DeleteConfirmationModal'
import { CostBreakdownChart } from '../components/CostBreakdownChart'
import { SavingsImpactChart } from '../components/SavingsImpactChart'
import { SkeletonChart } from '../components/Skeleton'
import { ErrorDisplay } from '../components/ErrorDisplay'
import OrganizationManagement from '../components/OrganizationManagement'
import StackSetOrganizationOnboarding from '../components/StackSetOrganizationOnboarding'
import { parseApiError, EnhancedError } from '../utils/errorHandling'
import { ApiClient } from '../utils/retryLogic'
import { ToastContainer, useToast } from '../components/Toast'
import { CompactThemeToggle } from '../components/ThemeToggle'
import {
  OverviewIcon,
  AccountsIcon,
  AnalysisIcon,
  RecommendationsIcon,
  ReportsIcon,
  SettingsIcon,
  MoneyIcon,
  LinkIcon,
  LightbulbIcon,
  TrendingUpIcon,
  SearchIcon,
  BellIcon,
  HelpCircleIcon,
  PlusIcon,
  CheckCircleIcon,
  RocketIcon,
  HardDriveIcon,
  ServerIcon,
  GlobeIcon,
  CloudIcon,
  LogOutIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  ClipboardDocumentCheckIcon,
  BuildingIcon,
  PlayIcon,
  LoaderIcon,
  TrashIcon
} from '../components/Icons'

const API_URL = 'https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev'

// Create API client with retry logic
const apiClient = new ApiClient(API_URL, {}, {
  maxAttempts: 3,
  delay: 1000,
  backoffMultiplier: 1.5
})

type ViewMode = 'overview' | 'accounts' | 'analysis' | 'recommendations' | 'reports' | 'settings'

interface NavigationItem {
  id: ViewMode
  label: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  badge?: number
  disabled?: boolean
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<EnhancedError | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showUnifiedOrgOnboarding, setShowUnifiedOrgOnboarding] = useState(false)
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analyzingAccountId, setAnalyzingAccountId] = useState<string | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState<Record<string, boolean>>({})
  const [analysisFromCache, setAnalysisFromCache] = useState(false)
  const [analysisDate, setAnalysisDate] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<ViewMode>('overview')
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [organizationView, setOrganizationView] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; account: Account | null }>({ isOpen: false, account: null })
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const { user, token, logout } = useAuth()
  const { toasts, removeToast, success, error: showError, info } = useToast()

  // Calculate summary metrics
  const totalMonthlySavings = analysisResult ? (
    (analysisResult.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) +
    (analysisResult.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0) +
    (analysisResult.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0) +
    (analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) +
    (analysisResult.loadBalancerAnalysis || []).reduce((sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0)
  ) : 0

  const totalRecommendations = analysisResult ? (
    (analysisResult.ec2Recommendations?.length || 0) +
    (analysisResult.s3Analysis?.reduce((sum: number, bucket: any) => sum + (bucket.recommendations?.length || 0), 0) || 0) +
    (analysisResult.unusedElasticIPs?.length || 0) +
    (analysisResult.unattachedVolumes?.length || 0) +
    (analysisResult.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation !== 'keep').length || 0)
  ) : 0

  const navigationItems: NavigationItem[] = [
    { id: 'overview', label: 'Overview', icon: OverviewIcon },
    { id: 'accounts', label: 'AWS Accounts', icon: AccountsIcon, badge: accounts.length },
    { id: 'analysis', label: 'Cost Analysis', icon: AnalysisIcon, badge: totalRecommendations || undefined },
    { id: 'recommendations', label: 'Recommendations', icon: RecommendationsIcon, badge: totalRecommendations || undefined },
    { id: 'reports', label: 'Reports', icon: ReportsIcon, disabled: true },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ]

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

  // Handle URL parameters for organization setup flow
  useEffect(() => {
    const view = searchParams.get('view')
    const setupOrg = searchParams.get('setupOrg')
    
    if (view === 'accounts') {
      setCurrentView('accounts')
    }
    
    if (setupOrg === 'true') {
      info('Organization Setup', 'Detect your organization structure to deploy across all accounts')
    }
  }, [searchParams])

  const fetchAccounts = async () => {
    if (!token) {
      setIsLoading(false)
      return
    }

    apiClient.setAuthToken(token)

    try {
      setError(null)
      const data = await apiClient.get('/accounts')
      const fetchedAccounts = data.data?.accounts || []
      setAccounts(fetchedAccounts)
      
      if (fetchedAccounts.length > 0 && !selectedAccount) {
        const firstAccount = fetchedAccounts[0]
        setSelectedAccount(firstAccount)
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

  useEffect(() => {
    fetchAccounts()
  }, [token])


  const runAnalysisForAccount = async (account: Account) => {
    if (!token) return

    try {
      setLoadingAnalysis(prev => ({ ...prev, [account.accountId]: true }))
      setError(null)
      
      info('Analysis started', `Scanning ${account.accountName} for cost optimization opportunities...`)
      
      const data = await apiClient.post('/analysis', { accountId: account.accountId }, {
        retryOptions: {
          maxAttempts: 2,
          delay: 2000
        }
      })

      const result = data.data?.result
      if (result) {
        const totalSavings = (
          (result.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) +
          (result.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0) +
          (result.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0) +
          (result.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) +
          (result.loadBalancerAnalysis || []).reduce((sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0)
        )

        const totalOpportunities = (
          (result.ec2Recommendations?.length || 0) +
          (result.s3Analysis?.reduce((sum: number, bucket: any) => sum + (bucket.recommendations?.length || 0), 0) || 0) +
          (result.unusedElasticIPs?.length || 0) +
          (result.unattachedVolumes?.length || 0) +
          (result.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation !== 'keep').length || 0)
        )

        success(
          `${account.accountName} analysis complete!`,
          `Found ${totalOpportunities} opportunities with £${totalSavings.toFixed(2)}/month savings`
        )

        // If this account is selected, update the analysis result
        if (selectedAccount?.accountId === account.accountId) {
          setAnalysisResult(result)
          setAnalysisDate(new Date().toISOString())
        }
      }
      
    } catch (err: any) {
      const enhancedError = parseApiError(err, err.response)
      showError(`Analysis failed for ${account.accountName}`, enhancedError.message)
    } finally {
      setLoadingAnalysis(prev => ({ ...prev, [account.accountId]: false }))
    }
  }

  const handleAnalyze = async (accountId: string) => {
    if (!token) return

    try {
      setAnalyzingAccountId(accountId)
      setError(null)
      setAnalysisFromCache(false)
      setAnalysisDate(null)
      
      info('Analysis started', 'Scanning your AWS account for cost optimization opportunities...')
      
      const data = await apiClient.post('/analysis', { accountId }, {
        retryOptions: {
          maxAttempts: 2,
          delay: 2000
        }
      })

      setAnalysisResult(data.data?.result)
      setAnalysisDate(new Date().toISOString())
      setCurrentView('analysis')

      const result = data.data?.result
      const totalSavings = (
        (result.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0) +
        (result.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0) +
        (result.s3Analysis || []).reduce((sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0) +
        (result.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0) +
        (result.loadBalancerAnalysis || []).reduce((sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0)
      )

      const totalOpportunities = (
        (result.ec2Recommendations?.length || 0) +
        (result.s3Analysis?.reduce((sum: number, bucket: any) => sum + (bucket.recommendations?.length || 0), 0) || 0) +
        (result.unusedElasticIPs?.length || 0) +
        (result.unattachedVolumes?.length || 0) +
        (result.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation !== 'keep').length || 0)
      )

      success(
        'Analysis completed successfully!',
        `Found ${totalOpportunities} optimization opportunities with potential savings of £${totalSavings.toFixed(2)}/month`
      )
      
    } catch (err: any) {
      const enhancedError = parseApiError(err, err.response)
      setError(enhancedError)
      showError('Analysis failed', enhancedError.message)
    } finally {
      setAnalyzingAccountId(null)
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!token) return

    setIsDeletingAccount(true)
    try {
      setError(null)
      const response = await fetch(`${API_URL}/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch (e) {
          // Response wasn't JSON
        }
        throw new Error(errorMessage)
      }

      // Remove account from local state
      setAccounts(accounts.filter(acc => acc.id !== accountId))
      
      // Clear selected account if it was deleted
      if (selectedAccount?.id === accountId) {
        setSelectedAccount(null)
        setAnalysisResult(null)
      }

      success('Account deleted', 'The AWS account has been removed successfully.')
      setDeleteModal({ isOpen: false, account: null })
    } catch (err: any) {
      const enhancedError = parseApiError(err, err.response)
      setError(enhancedError)
      showError('Delete failed', err.message)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleAddAccount = async (accountData: {
    accountName: string;
    awsAccountId: string;
    roleArn: string;
    region: string;
    isOrganization?: boolean;
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
          isOrganization: accountData.isOrganization || false,
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
      
      // Refresh the accounts list to ensure proper state
      await fetchAccounts()
      setShowAddAccount(false)
      success('Account connected successfully!', `${accountData.accountName} is now ready for analysis`)
      
      // If this is an organization management account, switch to accounts view
      if (accountData.isOrganization) {
        setCurrentView('accounts')
        info('Organization Setup', 'Now detect your organization structure to deploy across all accounts')
      }
    } catch (err: any) {
      const enhancedError = parseApiError(err, err.response)
      setError(enhancedError)
      showError('Failed to connect account', enhancedError.message)
      throw new Error(enhancedError.message)
    } finally {
      setIsAddingAccount(false)
    }
  }

  const renderOverviewContent = () => (
    <div className="space-y-8">
      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg dark:hover:shadow-gray-900/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Savings</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">£{totalMonthlySavings.toFixed(0)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">per month</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <MoneyIcon className="text-emerald-600 dark:text-emerald-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg dark:hover:shadow-gray-900/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Accounts</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{accounts.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">connected</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <LinkIcon className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg dark:hover:shadow-gray-900/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Recommendations</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{totalRecommendations}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">opportunities</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <LightbulbIcon className="text-orange-600 dark:text-orange-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg dark:hover:shadow-gray-900/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Annual Impact</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">£{(totalMonthlySavings * 12).toFixed(0)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">per year</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <TrendingUpIcon className="text-purple-600 dark:text-purple-400" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cost Breakdown</h3>
              <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">View Details</button>
            </div>
            {isLoading ? <SkeletonChart /> : <CostBreakdownChart analysisResult={analysisResult} />}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Savings Impact</h3>
              <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">View Details</button>
            </div>
            {isLoading ? <SkeletonChart /> : <SavingsImpactChart analysisResult={analysisResult} />}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
          <div className="space-y-4">
            {analysisResult ? (
              <>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircleIcon className="text-green-600 dark:text-green-400" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Analysis completed</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Found {totalRecommendations} optimization opportunities</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {analysisFromCache && analysisDate ? 
                        new Date(analysisDate).toLocaleDateString() : 
                        'Just now'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mt-0.5">
                    <SearchIcon className="text-blue-600 dark:text-blue-400" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Infrastructure scanned</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">EC2, S3, EBS, IPs, and Load Balancers</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Recently</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <RocketIcon className="text-gray-400 dark:text-gray-500" size={24} />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Ready to start</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Connect an account to begin analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderAccountsContent = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AWS Accounts</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage your connected cloud infrastructure</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowUnifiedOrgOnboarding(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
          >
            <CloudIcon className="mr-2" size={16} />
            Add Organization
          </button>
          <button
            onClick={() => setShowAddAccount(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="mr-2" size={16} />
            Add Account
          </button>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <div
            key={account.id}
            className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-6 cursor-pointer transition-all duration-200 hover:shadow-lg dark:hover:shadow-gray-900/20 ${
              selectedAccount?.accountId === account.accountId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => setSelectedAccount(account)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 font-bold">AWS</span>
              </div>
              <div className="flex items-center space-x-2">
                {account.isOrganization && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                    Organization
                  </span>
                )}
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  account.status === 'active' ? 'bg-green-100 text-green-800' : 
                  account.status === 'error' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {account.status === 'active' ? 'Active' : 
                   account.status === 'error' ? 'Error' : 
                   'Inactive'}
                </span>
              </div>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {account.accountName}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Account ID: {account.accountId || 'Not configured'}</p>
            
            {account.isOrganization && (
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BuildingIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-200">Organization Account</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedAccount(account)
                      setOrganizationView(true)
                    }}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    Manage →
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (account.isOrganization) {
                    runAnalysisForAccount(account)
                  } else {
                    handleAnalyze(account.accountId)
                  }
                }}
                disabled={analyzingAccountId === account.accountId || loadingAnalysis[account.accountId]}
                className={`flex-1 inline-flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  analyzingAccountId === account.accountId || loadingAnalysis[account.accountId]
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {analyzingAccountId === account.accountId || loadingAnalysis[account.accountId] ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400 mr-1"></div>
                    Analyzing
                  </>
                ) : (
                  <>
                    <SearchIcon className="mr-1" size={12} />
                    Analyze
                  </>
                )}
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteModal({ isOpen: true, account })
                }}
                className="inline-flex items-center px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <TrashIcon className="mr-1" size={12} />
                Delete
              </button>
            </div>
          </div>
        ))}

        {/* Add Organization Card */}
        <div
          onClick={() => setShowUnifiedOrgOnboarding(true)}
          className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-dashed border-purple-300 dark:border-purple-600 rounded-xl p-6 cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30 transition-all duration-200"
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <CloudIcon className="text-white" size={24} />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Add Organization</h4>
            <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">Enterprise-Scale Onboarding</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Deploy across multiple AWS accounts in your organization</p>
            <div className="mt-3 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded-full">
              One-Click Setup
            </div>
          </div>
        </div>

        {/* Add Account Card */}
        <div
          onClick={() => setShowAddAccount(true)}
          className="bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <PlusIcon className="text-gray-500 dark:text-gray-400" size={24} />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Add Account</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Connect a new AWS account to expand your optimization scope</p>
          </div>
        </div>
      </div>

      {/* Organization Management - Show for any organization account */}
      {accounts.filter(acc => acc.isOrganization).map(orgAccount => (
        <div key={orgAccount.id} className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-purple-50 dark:bg-purple-900/20 px-6 py-4 border-b border-purple-200 dark:border-purple-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <BuildingIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {orgAccount.accountName} - Organization Management
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Deploy and manage cost optimization across your entire organization
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => runAnalysisForAccount(orgAccount)}
                  disabled={loadingAnalysis[orgAccount.accountId]}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center disabled:opacity-50"
                >
                  {loadingAnalysis[orgAccount.accountId] ? (
                    <>
                      <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-4 h-4 mr-2" />
                      Analyze Management Account
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="p-6">
              <OrganizationManagement account={orgAccount} />
            </div>
          </div>
        </div>
      ))}

      {/* Account Details Panel */}
      {selectedAccount && !selectedAccount.isOrganization && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Account Details</h3>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">Edit</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Account Name</p>
              <p className="text-lg text-gray-900 dark:text-white">{selectedAccount.accountName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">AWS Account ID</p>
              <p className="text-lg text-gray-900 dark:text-white font-mono">{selectedAccount.accountId || 'Not configured'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Region</p>
              <p className="text-lg text-gray-900 dark:text-white">{selectedAccount.region || 'Not specified'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderAnalysisContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cost Analysis</h2>
          <p className="text-gray-600">Detailed breakdown of optimization opportunities</p>
        </div>
        {selectedAccount && (
          <button
            onClick={() => handleAnalyze(selectedAccount.accountId)}
            disabled={analyzingAccountId === selectedAccount.accountId}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {analyzingAccountId === selectedAccount.accountId ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Analyzing...
              </>
            ) : (
              <>
                <SearchIcon className="mr-2" size={16} />
                Run Analysis
              </>
            )}
          </button>
        )}
      </div>

      {analysisResult ? (
        <div className="space-y-6">
          {/* Analysis Summary */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-900 mb-2">Analysis Complete</h3>
                <p className="text-green-700">
                  Found {totalRecommendations} optimization opportunities with potential savings of £{totalMonthlySavings.toFixed(2)}/month
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">£{(totalMonthlySavings * 12).toFixed(0)}</p>
                <p className="text-sm text-green-600">annual savings</p>
              </div>
            </div>
          </div>

          {/* Service Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <HardDriveIcon className="text-gray-700" size={20} />
                  <h4 className="text-lg font-semibold text-gray-900">EBS Volumes</h4>
                </div>
                <span className="text-2xl font-bold text-orange-600">{analysisResult.unattachedVolumes?.length || 0}</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">Unattached volumes found</p>
              <p className="text-lg font-medium text-green-600">
                £{(analysisResult.unattachedVolumes || []).reduce((sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0).toFixed(2)}/month savings
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <ServerIcon className="text-gray-700" size={20} />
                  <h4 className="text-lg font-semibold text-gray-900">EC2 Instances</h4>
                </div>
                <span className="text-2xl font-bold text-blue-600">{analysisResult.ec2Recommendations?.length || 0}</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">Rightsizing opportunities</p>
              <p className="text-lg font-medium text-green-600">
                £{(analysisResult.ec2Recommendations || []).reduce((sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0).toFixed(2)}/month savings
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <GlobeIcon className="text-gray-700" size={20} />
                  <h4 className="text-lg font-semibold text-gray-900">Elastic IPs</h4>
                </div>
                <span className="text-2xl font-bold text-red-600">{analysisResult.unusedElasticIPs?.length || 0}</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">Unused IP addresses</p>
              <p className="text-lg font-medium text-green-600">
                £{(analysisResult.unusedElasticIPs || []).reduce((sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0).toFixed(2)}/month savings
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <SearchIcon className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analysis Data</h3>
          <p className="text-gray-600 mb-6">Run an analysis on one of your connected accounts to see optimization opportunities</p>
          {selectedAccount && (
            <button
              onClick={() => handleAnalyze(selectedAccount.accountId)}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <SearchIcon className="mr-2" size={16} />
              Analyze {selectedAccount.accountName}
            </button>
          )}
        </div>
      )}
    </div>
  )

  const renderMainContent = () => {
    switch (currentView) {
      case 'overview':
        return renderOverviewContent()
      case 'accounts':
        return renderAccountsContent()
      case 'analysis':
        return renderAnalysisContent()
      case 'recommendations':
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Recommendations View</h2>
            <p className="text-gray-600">Coming soon - Advanced recommendation management</p>
          </div>
        )
      case 'reports':
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Reports View</h2>
            <p className="text-gray-600">Coming soon - Detailed reporting and exports</p>
          </div>
        )
      case 'settings':
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
            <p className="text-gray-600">Coming soon - Application preferences and configuration</p>
          </div>
        )
      default:
        return renderOverviewContent()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-300">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
        {/* Logo */}
        <div className="px-6 py-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">CostOptimizer</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">AWS Intelligence</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-6 pb-6">
          <div className="space-y-2">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => !item.disabled && setCurrentView(item.id)}
                disabled={item.disabled}
                className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                  currentView === item.id
                    ? 'bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : item.disabled
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <item.icon className={currentView === item.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'} size={20} />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-blue-600 dark:bg-blue-500 rounded-full min-w-[20px]">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* User Menu */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">{user?.name?.charAt(0) || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 transition-colors"
              title="Logout"
            >
              <LogOutIcon size={18} />
            </button>
          </div>
          
          {/* Quick Links */}
          <div className="space-y-1 mb-4">
            <a
              href="/security"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ShieldCheckIcon size={16} />
              <span>Security & Permissions</span>
            </a>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <DocumentCheckIcon size={16} />
              <span>Privacy Policy</span>
            </a>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ClipboardDocumentCheckIcon size={16} />
              <span>Terms of Service</span>
            </a>
          </div>
          
          {/* Theme Toggle */}
          <div className="flex justify-center">
            <CompactThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search accounts, recommendations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-80 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="text-gray-400 dark:text-gray-500" size={18} />
                </div>
              </div>
              <button
                className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                title="Coming soon"
              >
                ⌘K
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/security"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                title="Security & Permissions"
              >
                <ShieldCheckIcon size={20} />
              </a>
              <button className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                <BellIcon size={20} />
              </button>
              <button className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                <HelpCircleIcon size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 p-8 overflow-auto">
          {isLoading ? (
            <div className="space-y-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="h-32 bg-gray-200 rounded"></div>
                  <div className="h-32 bg-gray-200 rounded"></div>
                  <div className="h-32 bg-gray-200 rounded"></div>
                  <div className="h-32 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="max-w-2xl mx-auto">
              <ErrorDisplay 
                error={error} 
                onRetry={() => {
                  setError(null)
                  setIsLoading(true)
                  window.location.reload()
                }}
                onDismiss={() => setError(null)}
              />
            </div>
          ) : (
            renderMainContent()
          )}
        </div>
      </div>

      {/* Modals */}
      <CloudFormationOnboarding
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSubmit={handleAddAccount}
        isLoading={isAddingAccount}
      />

      <StackSetOrganizationOnboarding
        isOpen={showUnifiedOrgOnboarding}
        onClose={() => setShowUnifiedOrgOnboarding(false)}
        onComplete={async () => {
          setShowUnifiedOrgOnboarding(false)
          // Refresh accounts to show the new organization
          await fetchAccounts()
          // Show the accounts view to see the new organization
          setCurrentView('accounts')
          success('Organization connected!', 'You can now manage your AWS Organization')
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, account: null })}
        onConfirm={() => {
          if (deleteModal.account) {
            handleDeleteAccount(deleteModal.account.id)
          }
        }}
        title="Delete AWS Account"
        message="Are you sure you want to remove this AWS account from Cost Optimizer? This action cannot be undone."
        itemName={deleteModal.account?.accountName}
        isDeleting={isDeletingAccount}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}