import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  CloudIcon,
  ShieldCheckIcon,
  ServerIcon,
  MoneyIcon,
  BuildingIcon,
  LoaderIcon,
  FolderIcon,
  PlayIcon,
  RefreshIcon
} from './Icons'

const API_URL = 'https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev'

interface StackSetOrganizationOnboardingProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export default function StackSetOrganizationOnboarding({ isOpen, onClose, onComplete }: StackSetOrganizationOnboardingProps) {
  const { token } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedRegion, setSelectedRegion] = useState('us-east-1')
  const [externalId, setExternalId] = useState(() => {
    const timestamp = Date.now().toString(36)
    const random = crypto.getRandomValues(new Uint8Array(8))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
    return `cost-saver-${timestamp}-${random}`
  })
  const [loading, setLoading] = useState(false)
  const [registeredAccounts, setRegisteredAccounts] = useState<any[]>([])
  const [checkInterval, setCheckInterval] = useState<number | null>(null)

  const regions = [
    { code: 'us-east-1', name: 'US East (N. Virginia)' },
    { code: 'us-west-2', name: 'US West (Oregon)' },
    { code: 'eu-west-1', name: 'EU (Ireland)' },
    { code: 'eu-west-2', name: 'EU (London)' },
    { code: 'eu-central-1', name: 'EU (Frankfurt)' },
    { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
    { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
  ]

  // Generate CloudFormation StackSet URL
  const getStackSetUrl = () => {
    const templateUrl = 'https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-stackset.yaml'
    
    // StackSets use a different URL structure - they don't support pre-filled parameters
    // Users will need to:
    // 1. Choose "Amazon S3 URL" and paste the template URL
    // 2. Fill in the parameters manually
    return `https://console.aws.amazon.com/cloudformation/home?region=${selectedRegion}#/stacksets/create`
  }

  // Check for newly registered accounts
  const checkForRegisteredAccounts = async () => {
    try {
      const response = await fetch(`${API_URL}/accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const selfRegistered = data.accounts.filter((acc: any) => 
          acc.registrationType === 'self-registered' &&
          acc.externalId === externalId
        )
        setRegisteredAccounts(selfRegistered)
        
        // If we have registered accounts and they belong to an organization, we're done
        if (selfRegistered.length > 0) {
          const orgAccounts = selfRegistered.filter((acc: any) => acc.organizationId)
          if (orgAccounts.length > 0) {
            return true
          }
        }
      }
    } catch (err) {
      console.error('Error checking for registered accounts:', err)
    }
    return false
  }

  // Start monitoring for account registration
  const startMonitoring = () => {
    setCurrentStep(3)
    setLoading(true)
    
    // Check immediately
    checkForRegisteredAccounts()
    
    // Then check every 3 seconds
    const interval = setInterval(async () => {
      const complete = await checkForRegisteredAccounts()
      if (complete) {
        clearInterval(interval)
        setLoading(false)
        onComplete()
      }
    }, 3000)
    
    setCheckInterval(interval)
  }

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval)
      }
    }
  }, [checkInterval])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BuildingIcon className="h-8 w-8" />
              <h2 className="text-2xl font-bold">Deploy to AWS Organization</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-blue-100">Deploy Cost Optimizer across your entire AWS Organization with StackSets</p>
        </div>

        {/* Progress Steps */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between p-4">
            {[
              { num: 1, label: 'Select Region' },
              { num: 2, label: 'Deploy StackSet' },
              { num: 3, label: 'Monitor Registration' }
            ].map((step, idx) => (
              <div key={step.num} className={`flex items-center ${idx < 2 ? 'flex-1' : ''}`}>
                <div className={`flex items-center space-x-3 ${currentStep >= step.num ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${currentStep === step.num ? 'bg-blue-600 text-white' : 
                      currentStep > step.num ? 'bg-green-500 text-white' : 
                      'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'}
                  `}>
                    {currentStep > step.num ? <CheckCircleIcon className="h-5 w-5" /> : step.num}
                  </div>
                  <span className="font-medium">{step.label}</span>
                </div>
                {idx < 2 && (
                  <div className={`flex-1 h-1 mx-4 rounded ${
                    currentStep > step.num ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Select Your AWS Region</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Choose the region where you'll deploy the StackSet. This should typically be your primary AWS region.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {regions.map(region => (
                    <button
                      key={region.code}
                      onClick={() => setSelectedRegion(region.code)}
                      className={`
                        p-4 rounded-lg border-2 text-left transition-all
                        ${selectedRegion === region.code
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }
                      `}
                    >
                      <div className="font-medium">{region.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{region.code}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">StackSet Deployment</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      StackSets allow you to deploy the same CloudFormation template across multiple accounts 
                      and regions in your AWS Organization with a single operation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Deploy the StackSet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Click the button below to open AWS CloudFormation and create the StackSet. 
                  You'll be able to select which organizational units (OUs) or specific accounts to deploy to.
                </p>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">StackSet Configuration</h4>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Step 1: Template URL</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Choose "Amazon S3 URL" and paste this:</p>
                    <div className="mt-1 flex items-center space-x-2">
                      <input
                        type="text"
                        value="https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-stackset.yaml"
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-xs"
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText('https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-stackset.yaml')}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Copy template URL"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Step 2: External ID Parameter</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Enter this value for the ExternalId parameter:</p>
                    <div className="mt-1 flex items-center space-x-2">
                      <input
                        type="text"
                        value={externalId}
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm"
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(externalId)}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Copy External ID"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">Important StackSet Settings:</p>
                        <ul className="mt-2 space-y-1 text-yellow-700 dark:text-yellow-300">
                          <li>• <strong>Permissions model:</strong> Use "Self-managed permissions"</li>
                          <li>• <strong>Deployment targets:</strong> Select OUs AND add management account</li>
                          <li>• <strong>Deployment options:</strong> Use "Parallel" for faster deployment</li>
                          <li>• <strong>Maximum concurrent accounts:</strong> Set to 10 or higher</li>
                          <li>• <strong>Failure tolerance:</strong> Set to 10-20% to continue on errors</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-4">
                    <div className="flex items-start space-x-3">
                      <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800 dark:text-blue-200">Including the Management Account:</p>
                        <p className="text-blue-700 dark:text-blue-300 mt-1">
                          To include your management account in the deployment:
                        </p>
                        <ol className="mt-2 space-y-1 text-blue-700 dark:text-blue-300 list-decimal list-inside">
                          <li>Choose "Self-managed permissions" (not service-managed)</li>
                          <li>Create IAM admin roles if prompted</li>
                          <li>Manually add your management account ID to deployment targets</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <a
                    href={getStackSetUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <CloudIcon className="h-5 w-5" />
                    <span>Deploy StackSet in AWS Console</span>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                <div className="mt-6 space-y-3">
                  <h4 className="font-medium">What happens next:</h4>
                  <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start">
                      <span className="font-medium mr-2">1.</span>
                      AWS CloudFormation will deploy the template to each selected account
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">2.</span>
                      Each account will automatically register with Cost Optimizer
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">3.</span>
                      You'll see the accounts appear here as they register
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Monitoring Account Registration</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Accounts will appear here as the StackSet deploys and they self-register. 
                  This typically takes 1-5 minutes per account.
                </p>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  {loading && registeredAccounts.length === 0 ? (
                    <div className="text-center py-8">
                      <LoaderIcon className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4 animate-spin" />
                      <p className="text-gray-600 dark:text-gray-400">Waiting for accounts to register...</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                        Make sure you've deployed the StackSet in the AWS Console
                      </p>
                    </div>
                  ) : registeredAccounts.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Registered Accounts ({registeredAccounts.length})</h4>
                        <button
                          onClick={() => checkForRegisteredAccounts()}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <RefreshIcon className="h-4 w-4" />
                          <span className="text-sm">Refresh</span>
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        {registeredAccounts.map((account) => (
                          <div key={account.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center space-x-3">
                              <ServerIcon className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="font-medium">{account.accountName}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {account.accountId} • {account.region}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {account.isOrganization && (
                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded">
                                  Management
                                </span>
                              )}
                              <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            </div>
                          </div>
                        ))}
                      </div>

                      {!loading && (
                        <div className="mt-6 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                            <p className="text-green-800 dark:text-green-200 font-medium">
                              Organization setup complete! You can now analyze costs across all registered accounts.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                  <p>💡 Tip: You can always add more accounts later by updating the StackSet deployment targets.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Cancel
            </button>
            <div className="space-x-3">
              {currentStep > 1 && currentStep < 3 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  Back
                </button>
              )}
              {currentStep === 1 && (
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Continue
                </button>
              )}
              {currentStep === 2 && (
                <button
                  onClick={startMonitoring}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Start Monitoring
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}