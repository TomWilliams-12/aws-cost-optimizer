import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  ArrowRightIcon,
  CloudIcon,
  ShieldCheckIcon,
  RocketIcon,
  ServerIcon,
  MoneyIcon
} from './Icons'

const API_URL = 'https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev'

export default function OrganizationOnboarding() {
  const { token } = useAuth()
  const [currentStep, setCurrentStep] = useState<'setup' | 'connect' | 'complete'>('setup')
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

  // Generate CloudFormation URL
  const getCloudFormationUrl = () => {
    // S3-hosted template URL - matches individual account template location
    const templateUrl = 'https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-organization-role.yaml'
    const stackName = 'AWSCostOptimizerOrganizationRole'
    
    // Build parameters object for cleaner URL construction
    const params = new URLSearchParams({
      templateURL: templateUrl,
      stackName: stackName,
      param_ExternalId: externalId,
      param_TrustedAccountId: '504264909935'
    })
    
    return `https://console.aws.amazon.com/cloudformation/home?region=${selectedRegion}#/stacks/create/review?${params.toString()}`
  }

  // Add organization account
  const handleAddOrganization = async () => {
    console.log('handleAddOrganization called')
    console.log('roleArn:', roleArn)
    
    if (!roleArn) {
      setError('Please enter the Role ARN from CloudFormation outputs')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('Token from useAuth:', !!token)
      
      if (!token) {
        setError('You must be logged in to connect an organization')
        setLoading(false)
        return
      }
      
      // First, add the organization account
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
        let errorMessage = 'Failed to add organization'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.'
          // Clear invalid token
          localStorage.removeItem('token')
          // Redirect to login after a delay
          setTimeout(() => {
            window.location.href = '/login'
          }, 2000)
        }
        
        throw new Error(errorMessage)
      }

      setCurrentStep('complete')

    } catch (error) {
      console.error('Add organization error:', error)
      setError(error instanceof Error ? error.message : 'Failed to add organization')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CloudIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          AWS Organization Onboarding
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Deploy cost optimization across your entire AWS Organization
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          {[
            { key: 'setup', label: 'Setup', icon: ShieldCheckIcon },
            { key: 'connect', label: 'Connect', icon: CloudIcon },
            { key: 'complete', label: 'Complete', icon: CheckCircleIcon }
          ].map((step, index) => (
            <React.Fragment key={step.key}>
              <div className={`flex items-center space-x-2 ${
                currentStep === step.key 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : index < ['setup', 'connect', 'complete'].indexOf(currentStep)
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-600'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === step.key
                    ? 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : index < ['setup', 'connect', 'complete'].indexOf(currentStep)
                      ? 'border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                }`}>
                  <step.icon size={16} />
                </div>
                <span className="font-medium">{step.label}</span>
              </div>
              {index < 2 && (
                <ArrowRightIcon className="w-4 h-4 text-gray-400" />
              )}
            </React.Fragment>
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
        
        {/* Step 1: Setup */}
        {currentStep === 'setup' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Configure Your AWS Organization
            </h2>

            {/* Region Selection */}
            <div className="mb-8">
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
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Organization Benefits</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start space-x-3">
                  <ServerIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Multi-Account Coverage</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Deploy to all accounts with one click</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MoneyIcon className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Consolidated Savings</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">See total savings across all accounts</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RocketIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Auto-Discovery</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">New accounts automatically included</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <ShieldCheckIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Centralized Control</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Manage from management account</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-8">
              <div className="flex items-start space-x-4">
                <ShieldCheckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Security Information</h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                    You'll deploy a CloudFormation StackSet that creates read-only IAM roles across all your accounts.
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    <strong>External ID:</strong> <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">{externalId}</code>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setCurrentStep('connect')}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors duration-200"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Connect */}
        {currentStep === 'connect' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Deploy to AWS Management Account
            </h2>

            <div className="space-y-6">
              {/* Deploy Button */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Step 1: Deploy CloudFormation Stack
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Click the button below to deploy the IAM role in your AWS management account. 
                  This will open the AWS Console with pre-filled parameters.
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
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Step 2: Enter Role ARN
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  After the CloudFormation stack completes, copy the Role ARN from the Outputs tab.
                </p>
                <input
                  type="text"
                  value={roleArn}
                  onChange={(e) => setRoleArn(e.target.value)}
                  placeholder="arn:aws:iam::123456789012:role/OrganizationCostOptimizerRole"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Instructions</h3>
                <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>1. Click "Deploy to AWS" to open the CloudFormation console</li>
                  <li>2. Review the stack parameters (pre-filled for you)</li>
                  <li>3. Check the acknowledgment box and click "Create stack"</li>
                  <li>4. Wait for the stack to complete (Status: CREATE_COMPLETE)</li>
                  <li>5. Go to the "Outputs" tab and copy the Role ARN</li>
                  <li>6. Paste the Role ARN above and click "Connect Organization"</li>
                </ol>
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
                onClick={handleAddOrganization}
                disabled={!roleArn || loading}
                className="px-8 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors duration-200"
              >
                {loading ? 'Connecting...' : 'Connect Organization'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {currentStep === 'complete' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Organization Connected!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Your AWS Organization management account is now connected. You can start analyzing costs across all accounts.
            </p>

            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Next Steps</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
                From the dashboard, you can now:
              </p>
              <ul className="text-left text-sm text-gray-700 dark:text-gray-300 space-y-2 max-w-md mx-auto">
                <li className="flex items-start space-x-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Run organization-wide cost analysis</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Deploy StackSets to analyze all member accounts</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>View consolidated savings opportunities</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Track costs by organizational unit</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors duration-200"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}