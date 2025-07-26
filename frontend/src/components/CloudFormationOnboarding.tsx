import { useState, useEffect } from 'react'
import { CheckCircle, Cloud, Copy, ExternalLink, AlertTriangle } from 'lucide-react'

interface CloudFormationOnboardingProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (accountData: {
    accountName: string
    awsAccountId: string
    roleArn: string
    region: string
  }) => Promise<void>
  isLoading: boolean
}

interface DeployUrl {
  region: string
  regionName: string
  deployUrl: string
}

export function CloudFormationOnboarding({ isOpen, onClose, onSubmit, isLoading }: CloudFormationOnboardingProps) {
  const [step, setStep] = useState(1)
  const [externalId, setExternalId] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('us-east-1')
  const [deployUrls, setDeployUrls] = useState<DeployUrl[]>([])
  const [accountData, setAccountData] = useState({
    accountName: '',
    awsAccountId: '',
    roleArn: '',
    region: 'us-east-1'
  })
  const [copied, setCopied] = useState<string | null>(null)

  // Generate external ID and deploy URLs when component opens
  useEffect(() => {
    if (isOpen && !externalId) {
      const timestamp = Date.now().toString(36)
      const random = crypto.getRandomValues(new Uint8Array(8))
        .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
      const newExternalId = `cost-saver-${timestamp}-${random}`
      setExternalId(newExternalId)

      // Generate deploy URLs for all regions
      const regions = [
        { region: 'us-east-1', regionName: 'US East (N. Virginia)' },
        { region: 'us-east-2', regionName: 'US East (Ohio)' },
        { region: 'us-west-1', regionName: 'US West (N. California)' },
        { region: 'us-west-2', regionName: 'US West (Oregon)' },
        { region: 'eu-west-1', regionName: 'Europe (Ireland)' },
        { region: 'eu-west-2', regionName: 'Europe (London)' },
        { region: 'eu-central-1', regionName: 'Europe (Frankfurt)' },
        { region: 'ap-southeast-1', regionName: 'Asia Pacific (Singapore)' },
        { region: 'ap-southeast-2', regionName: 'Asia Pacific (Sydney)' },
        { region: 'ap-northeast-1', regionName: 'Asia Pacific (Tokyo)' }
      ]

      const templateUrl = 'https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-role.yaml'
      
      const urls = regions.map(({ region, regionName }) => ({
        region,
        regionName,
        deployUrl: `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/new?templateURL=${encodeURIComponent(templateUrl)}&stackName=AWS-Cost-Optimizer-Role&param_ExternalId=${newExternalId}&param_RoleName=AWSCostOptimizerRole`
      }))

      setDeployUrls(urls)
    }
  }, [isOpen, externalId])

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleSubmit = async () => {
    try {
      await onSubmit({
        ...accountData,
        region: selectedRegion
      })
      handleClose()
    } catch (error) {
      // Error is handled by parent component
    }
  }

  const handleClose = () => {
    setStep(1)
    setExternalId('')
    setAccountData({
      accountName: '',
      awsAccountId: '',
      roleArn: '',
      region: 'us-east-1'
    })
    setSelectedRegion('us-east-1')
    setDeployUrls([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Connect AWS Account</h2>
            <p className="text-gray-600">One-click setup with CloudFormation template</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center mb-8">
          {[1, 2, 3].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNumber 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step > stepNumber ? <CheckCircle className="w-5 h-5" /> : stepNumber}
              </div>
              {stepNumber < 3 && (
                <div className={`w-16 h-1 mx-2 ${
                  step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <Cloud className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Deploy IAM Role to Your AWS Account
              </h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                We'll deploy a secure, read-only IAM role to your AWS account using CloudFormation. 
                This gives us permission to analyze your resources and find cost savings.
              </p>
            </div>

            {/* Security Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-sm">
                  <h4 className="font-medium text-green-800 mb-1">Secure & Read-Only Access</h4>
                  <ul className="text-green-700 space-y-1">
                    <li>• No write permissions to your infrastructure</li>
                    <li>• Secure cross-account role with external ID</li>
                    <li>• Limited to cost analysis and optimization only</li>
                    <li>• Can be removed at any time</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Region Selection */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-blue-600 text-sm">🌍</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    Choose Your AWS Region
                  </label>
                  <p className="text-xs text-blue-700">
                    Select the region where you want to create the IAM role
                  </p>
                </div>
              </div>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {deployUrls.map(({ region, regionName }) => (
                  <option key={region} value={region}>
                    {regionName} ({region})
                  </option>
                ))}
              </select>
              <div className="text-xs text-blue-600 mt-2 space-y-1">
                <p>💡 Choose the region closest to you or where your main AWS resources are located</p>
                <p>ℹ️ Note: IAM roles work globally, but deploying in your preferred region is recommended</p>
              </div>
            </div>

            {/* Deploy Options */}
            <div className="text-center space-y-4">
              {/* Primary Deploy Button - Opens in new tab but shares session */}
              <div>
                <a
                  href={deployUrls.find(url => url.region === selectedRegion)?.deployUrl}
                  target="_blank"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-md hover:shadow-lg"
                  onClick={() => {
                    // Small delay to let user see the action, then proceed to step 2
                    setTimeout(() => setStep(2), 500)
                  }}
                >
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Deploy to AWS
                </a>
                <p className="text-sm text-gray-600 mt-2">
                  Deploying to <strong>{deployUrls.find(url => url.region === selectedRegion)?.regionName}</strong>
                </p>
              </div>

              {/* Alternative: Copy Link Option for existing AWS tabs */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-3">
                  Already logged into AWS in another tab?
                </p>
                <button
                  onClick={() => {
                    const deployUrl = deployUrls.find(url => url.region === selectedRegion)?.deployUrl
                    if (deployUrl) {
                      copyToClipboard(deployUrl, 'deployUrl')
                      // Also advance to step 2 since they're going to deploy
                      setTimeout(() => setStep(2), 1000)
                    }
                  }}
                  className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copied === 'deployUrl' ? 'Copied!' : 'Copy Deploy Link'}
                </button>
                {copied === 'deployUrl' && (
                  <p className="text-sm text-green-600 mt-2">
                    ✅ Link copied! Paste it in your AWS tab to avoid re-login
                  </p>
                )}
              </div>
            </div>

            {/* Manual Setup Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Prefer manual setup? Click here
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Cloud className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                CloudFormation Stack Deployment
              </h3>
              <p className="text-gray-600">
                Complete the deployment in <strong>{deployUrls.find(url => url.region === selectedRegion)?.regionName}</strong>, then return here
              </p>
            </div>

            {/* Quick Deploy Reminder */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">Need to deploy again?</h4>
                  <p className="text-sm text-blue-800">Click here if you haven't deployed yet</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      const deployUrl = deployUrls.find(url => url.region === selectedRegion)?.deployUrl
                      if (deployUrl) {
                        copyToClipboard(deployUrl, 'deployUrlStep2')
                      }
                    }}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Copy className="w-4 h-4 mr-1 inline" />
                    {copied === 'deployUrlStep2' ? 'Copied!' : 'Copy Link'}
                  </button>
                  <a
                    href={deployUrls.find(url => url.region === selectedRegion)?.deployUrl}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <ExternalLink className="w-4 h-4 mr-1 inline" />
                    Deploy
                  </a>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="font-medium text-gray-900 mb-4">In the AWS Console:</h4>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5 flex-shrink-0">1</span>
                  <span>Review the template parameters (External ID is pre-filled)</span>
                </li>
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5 flex-shrink-0">2</span>
                  <span>Click "Next" → "Next" → check "I acknowledge..." → "Create Stack"</span>
                </li>
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5 flex-shrink-0">3</span>
                  <span>Wait for stack creation (2-3 minutes) - you can bookmark this page</span>
                </li>
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5 flex-shrink-0">4</span>
                  <span>Go to the "Outputs" tab and copy the Role ARN</span>
                </li>
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5 flex-shrink-0">5</span>
                  <span>Return to this page and continue to the next step</span>
                </li>
              </ol>
            </div>

            {/* Session Tip */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-sm">
                  <h4 className="font-medium text-amber-800 mb-1">💡 Avoiding Re-Login</h4>
                  <p className="text-amber-700">
                    If you're asked to login again, you can copy the deploy link and paste it in a tab 
                    where you're already logged into AWS Console. This will use your existing session.
                  </p>
                </div>
              </div>
            </div>

            {/* External ID Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">Your External ID:</h4>
                  <code className="text-sm text-blue-800 font-mono">{externalId}</code>
                </div>
                <button
                  onClick={() => copyToClipboard(externalId, 'externalId')}
                  className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  {copied === 'externalId' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                I've completed the deployment
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Enter Connection Details
              </h3>
              <p className="text-gray-600">
                Provide the details from your CloudFormation stack outputs
              </p>
            </div>

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountData.accountName}
                  onChange={(e) => setAccountData({...accountData, accountName: e.target.value})}
                  placeholder="e.g., Production Account"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AWS Account ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountData.awsAccountId}
                  onChange={(e) => setAccountData({...accountData, awsAccountId: e.target.value})}
                  placeholder="123456789012"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role ARN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountData.roleArn}
                  onChange={(e) => setAccountData({...accountData, roleArn: e.target.value})}
                  placeholder="arn:aws:iam::123456789012:role/AWSCostOptimizerRole"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Find this in the CloudFormation stack "Outputs" tab
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AWS Region <span className="text-red-500">*</span>
                </label>
                <select
                  value={accountData.region}
                  onChange={(e) => setAccountData({...accountData, region: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {deployUrls.map(({ region, regionName }) => (
                    <option key={region} value={region}>
                      {regionName} ({region})
                    </option>
                  ))}
                </select>
              </div>
            </form>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                disabled={isLoading}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !accountData.accountName || !accountData.awsAccountId || !accountData.roleArn}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </>
                ) : (
                  'Connect Account'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Troubleshooting Section */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm">
              <h4 className="font-medium text-gray-900 mb-1">Need Help?</h4>
              <p className="text-gray-600">
                Having trouble? Check our{' '}
                <a href="#" className="text-blue-600 hover:text-blue-700 underline">
                  setup troubleshooting guide
                </a>{' '}
                or contact support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}