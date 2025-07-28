import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import OrganizationManagement from './OrganizationManagement'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  ArrowRightIcon,
  CloudIcon,
  ShieldCheckIcon,
  RocketIcon,
  ServerIcon,
  MoneyIcon,
  BuildingIcon,
  LoaderIcon,
  UserIcon,
  FolderIcon,
  PlayIcon
} from './Icons'

const API_URL = 'https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev'

interface UnifiedOrganizationOnboardingProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

interface OrganizationalUnit {
  id: string
  name: string
  parentId: string
  accounts: Array<{
    id: string
    name: string
    email: string
    status: string
  }>
}

interface OrganizationInfo {
  organizationId: string
  managementAccountId: string
  organizationalUnits: OrganizationalUnit[]
  totalAccounts: number
  pricingTier: string
  monthlyCost: number
}

export default function UnifiedOrganizationOnboarding({ isOpen, onClose, onComplete }: UnifiedOrganizationOnboardingProps) {
  const { token } = useAuth()
  const [currentStep, setCurrentStep] = useState<'setup' | 'deploy' | 'detect' | 'stackset' | 'complete'>('setup')
  const [selectedRegion, setSelectedRegion] = useState('us-east-1')
  const [externalId] = useState(() => {
    const timestamp = Date.now().toString(36)
    const random = crypto.getRandomValues(new Uint8Array(8))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
    return `cost-saver-${timestamp}-${random}`
  })
  const [roleArn, setRoleArn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectedAccount, setConnectedAccount] = useState<any>(null)
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null)
  const [deploymentMode, setDeploymentMode] = useState<'ENTIRE_ORG' | 'SPECIFIC_OUS'>('ENTIRE_ORG')
  const [selectedOUs, setSelectedOUs] = useState<string[]>([])
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null)

  if (!isOpen) return null

  // Generate CloudFormation URL
  const getCloudFormationUrl = () => {
    const templateUrl = 'https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-organization-role.yaml'
    const stackName = 'AWSCostOptimizerOrganizationRole'
    
    const params = new URLSearchParams({
      templateURL: templateUrl,
      stackName: stackName,
      param_ExternalId: externalId,
      param_TrustedAccountId: '504264909935'
    })
    
    return `https://console.aws.amazon.com/cloudformation/home?region=${selectedRegion}#/stacks/create/review?${params.toString()}`
  }

  // Add organization account to the system
  const addOrganizationAccount = async () => {
    if (!roleArn) {
      setError('Please enter the Role ARN from CloudFormation outputs')
      return false
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          accountName: 'AWS Organization Management',
          roleArn,
          externalId,
          region: selectedRegion,
          isOrganization: true
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add organization')
      }

      const accountData = await response.json()
      const newAccount = accountData.data?.account
      setConnectedAccount(newAccount)
      
      return true
    } catch (error) {
      console.error('Add organization error:', error)
      setError(error instanceof Error ? error.message : 'Failed to add organization')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Detect organization structure
  const detectOrganization = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_URL}/organizations/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          roleArn,
          region: selectedRegion,
          externalId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to detect organization')
      }

      const data = await response.json()
      setOrganization(data)
      // Select root OU by default for entire org deployment
      if (deploymentMode === 'ENTIRE_ORG') {
        const allOUs = data.organizationalUnits.map((ou: OrganizationalUnit) => ou.id)
        setSelectedOUs(allOUs)
      }
      return true
    } catch (error) {
      console.error('Organization detection error:', error)
      setError(error instanceof Error ? error.message : 'Failed to detect organization')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Deploy StackSet
  const deployStackSet = async () => {
    if (!organization) return false

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_URL}/organizations/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: organization.organizationId,
          deploymentMode,
          targetOUs: deploymentMode === 'SPECIFIC_OUS' ? selectedOUs : [],
          managementAccountId: organization.managementAccountId,
          excludeAccounts: [],
          region: selectedRegion,
          roleArn,
          externalId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || 'Failed to deploy StackSet')
      }

      const deploymentData = await response.json()
      
      // Build status message with warnings
      let statusMessage = deploymentData.message || 'StackSet deployment initiated successfully!'
      
      if (deploymentData.warning) {
        statusMessage += `\n\n⚠️ Warning: ${deploymentData.warning}`
        if (deploymentData.excludedAccounts && deploymentData.excludedAccounts.length > 0) {
          statusMessage += '\n\nExcluded accounts:'
          deploymentData.excludedAccounts.forEach((acc: any) => {
            statusMessage += `\n• ${acc.name} (${acc.id})`
          })
        }
        if (deploymentData.suggestion) {
          statusMessage += `\n\n${deploymentData.suggestion}`
        }
      }
      
      setDeploymentStatus(statusMessage)
      
      return true
    } catch (error) {
      console.error('StackSet deployment error:', error)
      setError(error instanceof Error ? error.message : 'Failed to deploy StackSet')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Handle step progression
  const handleDeployClick = () => {
    setCurrentStep('deploy')
  }

  const handleAddAccount = async () => {
    const success = await addOrganizationAccount()
    if (success) {
      setCurrentStep('detect')
      // Auto-detect organization
      const detected = await detectOrganization()
      if (detected) {
        setCurrentStep('stackset')
      }
    }
  }

  const handleDeployStackSet = async () => {
    const success = await deployStackSet()
    if (success) {
      setCurrentStep('complete')
    }
  }

  // Toggle OU selection
  const toggleOUSelection = (ouId: string) => {
    setSelectedOUs(prev => 
      prev.includes(ouId) 
        ? prev.filter(id => id !== ouId)
        : [...prev, ouId]
    )
  }

  // Calculate selected accounts count
  const getSelectedAccountsCount = () => {
    if (!organization) return 0
    
    if (deploymentMode === 'ENTIRE_ORG') {
      return organization.totalAccounts - 1 // Exclude management account
    }
    
    return organization.organizationalUnits
      .filter(ou => selectedOUs.includes(ou.id))
      .reduce((total, ou) => {
        const nonManagementAccounts = ou.accounts.filter(
          account => account.id !== organization.managementAccountId
        )
        return total + nonManagementAccounts.length
      }, 0)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <BuildingIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AWS Organization Setup</h2>
              <p className="text-gray-600 dark:text-gray-400">Complete setup in one seamless flow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[
              { key: 'setup', label: 'Setup', active: currentStep === 'setup' },
              { key: 'deploy', label: 'Deploy Role', active: currentStep === 'deploy' },
              { key: 'detect', label: 'Detect Org', active: currentStep === 'detect' },
              { key: 'stackset', label: 'Deploy StackSet', active: currentStep === 'stackset' },
              { key: 'complete', label: 'Complete', active: currentStep === 'complete' }
            ].map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                  step.active ? 'border-blue-600 bg-blue-600 text-white' : 
                  index < ['setup', 'deploy', 'detect', 'stackset', 'complete'].indexOf(currentStep) 
                    ? 'border-green-600 bg-green-600 text-white' 
                    : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                }`}>
                  {index < ['setup', 'deploy', 'detect', 'stackset', 'complete'].indexOf(currentStep) ? (
                    <CheckCircleIcon className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 4 && (
                  <div className={`w-16 h-1 mx-2 ${
                    index < ['setup', 'deploy', 'detect', 'stackset', 'complete'].indexOf(currentStep) - 1
                      ? 'bg-green-600' 
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="space-y-6">
          {/* Step 1: Setup */}
          {currentStep === 'setup' && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Configure Your AWS Organization
              </h3>

              {/* Region Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  AWS Region
                </label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">Europe (Ireland)</option>
                  <option value="eu-west-2">Europe (London)</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                  <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                </select>
              </div>

              {/* Organization Benefits */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">What You'll Get</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <ServerIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Multi-Account Analysis</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Analyze all accounts at once</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <MoneyIcon className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Consolidated Savings</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Organization-wide optimization</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-4">
                  <ShieldCheckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">Security Information</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      External ID for secure access: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">{externalId}</code>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleDeployClick}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-semibold transition-colors duration-200"
                >
                  Start Setup
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Deploy */}
          {currentStep === 'deploy' && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Deploy IAM Role to Management Account
              </h3>

              <div className="space-y-6">
                {/* Deploy Button */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Step 1: Deploy CloudFormation Stack
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Click below to deploy the IAM role in your AWS management account.
                  </p>
                  <button
                    onClick={() => window.open(getCloudFormationUrl(), '_blank')}
                    className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium transition-colors duration-200"
                  >
                    <CloudIcon className="mr-2" size={20} />
                    Deploy to AWS
                  </button>
                </div>

                {/* Role ARN Input */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Step 2: Enter Role ARN
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    After deployment completes, copy the Role ARN from CloudFormation outputs.
                  </p>
                  <input
                    type="text"
                    value={roleArn}
                    onChange={(e) => setRoleArn(e.target.value)}
                    placeholder="arn:aws:iam::123456789012:role/OrganizationCostOptimizerRole"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setCurrentStep('setup')}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  Back
                </button>
                <button
                  onClick={handleAddAccount}
                  disabled={!roleArn || loading}
                  className="px-8 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors duration-200 flex items-center"
                >
                  {loading ? (
                    <>
                      <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect & Detect Organization'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Detect */}
          {currentStep === 'detect' && (
            <div className="text-center py-8">
              <LoaderIcon className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Detecting Your AWS Organization
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Analyzing organization structure and member accounts...
              </p>
            </div>
          )}

          {/* Step 4: StackSet Deployment */}
          {currentStep === 'stackset' && organization && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Deploy to Organization
              </h3>

              {/* Organization Overview */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Organization ID</p>
                    <p className="font-mono text-sm">{organization.organizationId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Accounts</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{organization.totalAccounts}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Deployment Mode</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {deploymentMode === 'ENTIRE_ORG' ? 'Entire Org' : 'Specific OUs'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Target Accounts</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {getSelectedAccountsCount()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Deployment Mode Selection */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Choose Deployment Mode
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    deploymentMode === 'ENTIRE_ORG' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}>
                    <input
                      type="radio"
                      name="deploymentMode"
                      value="ENTIRE_ORG"
                      checked={deploymentMode === 'ENTIRE_ORG'}
                      onChange={(e) => setDeploymentMode(e.target.value as 'ENTIRE_ORG')}
                      className="sr-only"
                    />
                    <div className="flex items-center space-x-3">
                      <BuildingIcon className={`w-6 h-6 ${
                        deploymentMode === 'ENTIRE_ORG' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
                      }`} />
                      <span className="font-medium text-gray-900 dark:text-white">Entire Organization</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Deploy to all accounts (recommended)
                    </p>
                  </label>

                  <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    deploymentMode === 'SPECIFIC_OUS' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}>
                    <input
                      type="radio"
                      name="deploymentMode"
                      value="SPECIFIC_OUS"
                      checked={deploymentMode === 'SPECIFIC_OUS'}
                      onChange={(e) => setDeploymentMode(e.target.value as 'SPECIFIC_OUS')}
                      className="sr-only"
                    />
                    <div className="flex items-center space-x-3">
                      <FolderIcon className={`w-6 h-6 ${
                        deploymentMode === 'SPECIFIC_OUS' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
                      }`} />
                      <span className="font-medium text-gray-900 dark:text-white">Specific OUs</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Choose specific organizational units
                    </p>
                  </label>
                </div>
              </div>

              {/* OU Selection for SPECIFIC_OUS mode */}
              {deploymentMode === 'SPECIFIC_OUS' && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Select Organizational Units
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {organization.organizationalUnits.map(ou => (
                      <label 
                        key={ou.id}
                        className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOUs.includes(ou.id)}
                          onChange={() => toggleOUSelection(ou.id)}
                          className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <FolderIcon className="w-5 h-5 text-gray-500" />
                            <span className="font-medium text-gray-900 dark:text-white">{ou.name}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              ({ou.accounts.length} accounts)
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Deployment Summary */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">
                  Deployment Summary
                </h4>
                <p className="text-sm text-green-800 dark:text-green-200">
                  AWS Cost Optimizer will be deployed to {getSelectedAccountsCount()} accounts in your organization.
                </p>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep('deploy')}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  Back
                </button>
                <button
                  onClick={handleDeployStackSet}
                  disabled={loading || (deploymentMode === 'SPECIFIC_OUS' && selectedOUs.length === 0)}
                  className="px-8 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors duration-200 flex items-center"
                >
                  {loading ? (
                    <>
                      <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-4 h-4 mr-2" />
                      Deploy to Organization
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Organization Setup Complete!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Your AWS Organization is now connected and deployment has been initiated.
              </p>

              {deploymentStatus && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
                  <div className="text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{deploymentStatus}</div>
                </div>
              )}

              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">What's Next?</h4>
                <ul className="text-left text-sm text-gray-700 dark:text-gray-300 space-y-2">
                  <li className="flex items-start space-x-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Monitor StackSet deployment progress in your dashboard</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Run cost analysis across all member accounts</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>View consolidated savings opportunities</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={onComplete}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors duration-200"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}