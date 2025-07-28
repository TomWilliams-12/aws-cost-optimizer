import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  BuildingIcon,
  CloudIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LoaderIcon,
  UserIcon,
  FolderIcon,
  PlayIcon
} from './Icons'

const API_URL = 'https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev'

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

interface DeploymentInfo {
  stackSetId: string
  operationId: string
  externalId: string
  deploymentStatus: string
  message: string
  accounts?: Array<{
    accountId: string
    region: string
    status: string
    statusReason?: string
  }>
}

export default function OrganizationManagement({ account }: { account: any }) {
  const { token } = useAuth()
  const [detecting, setDetecting] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null)
  const [selectedOUs, setSelectedOUs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null)
  const [showStackSetSetup, setShowStackSetSetup] = useState(false)
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [deploymentMode, setDeploymentMode] = useState<'ENTIRE_ORG' | 'SPECIFIC_OUS'>('ENTIRE_ORG')

  // Detect organization structure
  const detectOrganization = async () => {
    setDetecting(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_URL}/organizations/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          roleArn: account.roleArn,
          region: account.region,
          externalId: account.externalId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to detect organization')
      }

      const data = await response.json()
      setOrganization(data)
      // Select root OU by default
      const rootOU = data.organizationalUnits.find((ou: OrganizationalUnit) => ou.name === 'Root')
      if (rootOU) {
        setSelectedOUs([rootOU.id])
      }
    } catch (error) {
      console.error('Organization detection error:', error)
      setError(error instanceof Error ? error.message : 'Failed to detect organization')
    } finally {
      setDetecting(false)
    }
  }

  // Get account IDs from selected OUs (excluding management account)
  const getAccountsFromSelectedOUs = () => {
    if (!organization) return []
    
    const accountIds = new Set<string>()
    
    organization.organizationalUnits.forEach(ou => {
      if (selectedOUs.includes(ou.id)) {
        ou.accounts.forEach(account => {
          // Exclude the management account since it already has a role
          if (account.id !== organization.managementAccountId) {
            accountIds.add(account.id)
          }
        })
      }
    })
    
    return Array.from(accountIds)
  }

  // Deploy StackSet to selected OUs
  const deployStackSet = async () => {
    if (deploymentMode === 'SPECIFIC_OUS' && selectedOUs.length === 0) {
      setError('Please select at least one organizational unit')
      return
    }

    setDeploying(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_URL}/organizations/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: organization?.organizationId,
          deploymentMode,
          targetOUs: deploymentMode === 'SPECIFIC_OUS' ? selectedOUs : [],
          accounts: getAccountsFromSelectedOUs(), // Get account IDs from selected OUs
          managementAccountId: organization?.managementAccountId,
          excludeAccounts: [], // We'll filter in the backend
          region: account.region,
          roleArn: account.roleArn,
          externalId: account.externalId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || 'Failed to deploy StackSet')
      }

      const deploymentData = await response.json()
      setDeploymentInfo(deploymentData)
      setDeploymentStatus('StackSet deployment initiated successfully!')
      
      // Start polling for deployment status immediately
      setTimeout(() => checkDeploymentStatus(organization?.organizationId || ''), 2000)
      
    } catch (error) {
      console.error('StackSet deployment error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to deploy StackSet'
      
      // Check for specific error types
      if (errorMessage.includes('AWSCloudFormationStackSetAdministrationRole')) {
        setError('StackSet Administration Role not found. Please complete the setup steps first.')
        setShowStackSetSetup(true)
      } else if (errorMessage.includes('AWSCloudFormationStackSetExecutionRole')) {
        setError('StackSet Execution Role not found in one or more member accounts. Please ensure the execution role is deployed to ALL member accounts.')
        setShowStackSetSetup(true)
      } else if (errorMessage.includes('AlreadyExistsException')) {
        setError('A StackSet with this name already exists. This organization may already be configured.')
      } else if (errorMessage.includes('AccessDenied')) {
        setError('Access denied. Please ensure your role has the necessary permissions.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setDeploying(false)
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

  // Calculate selected accounts count (excluding management account)
  const getSelectedAccountsCount = () => {
    if (!organization) return 0
    
    return organization.organizationalUnits
      .filter(ou => selectedOUs.includes(ou.id))
      .reduce((total, ou) => {
        // Count accounts excluding the management account
        const nonManagementAccounts = ou.accounts.filter(
          account => account.id !== organization.managementAccountId
        )
        return total + nonManagementAccounts.length
      }, 0)
  }

  // Sync organization accounts to main accounts table
  const syncAccounts = async (organizationId: string) => {
    try {
      const response = await fetch(`${API_URL}/organizations/${organizationId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`Synced ${result.syncedAccounts} accounts`)
        return true
      }
    } catch (error) {
      console.error('Error syncing accounts:', error)
    }
    return false
  }

  // Check deployment status
  const checkDeploymentStatus = async (organizationId: string) => {
    if (!organizationId || checkingStatus) return
    
    setCheckingStatus(true)
    try {
      const response = await fetch(`${API_URL}/organizations/${organizationId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const status = await response.json()
        const allDeployed = status.successfulDeployments === status.totalTargetAccounts
        const hasFailures = status.failedDeployments > 0
        const inProgress = status.inProgressDeployments > 0
        
        if (allDeployed && !hasFailures) {
          setDeploymentStatus(`Deployment complete! Successfully deployed to ${status.successfulDeployments} accounts.`)
          // Sync accounts and redirect to dashboard
          const synced = await syncAccounts(organizationId)
          if (synced) {
            setTimeout(() => {
              window.location.href = '/dashboard'
            }, 2000)
          }
        } else if (hasFailures) {
          setDeploymentStatus(`Deployment failed. ${status.successfulDeployments} succeeded, ${status.failedDeployments} failed.`)
          
          // Check for execution role errors
          const executionRoleErrors = status.accounts?.filter((acc: any) => 
            acc.statusReason?.includes('AWSCloudFormationStackSetExecutionRole')
          )
          
          if (executionRoleErrors?.length > 0) {
            setError('One or more accounts are missing the StackSet Execution Role. Please deploy the execution role to ALL member accounts.')
            setShowStackSetSetup(true)
          }
          
          // Check for administration role errors
          const adminRoleErrors = status.accounts?.filter((acc: any) => 
            acc.statusReason?.includes('AWSCloudFormationStackSetAdministrationRole')
          )
          
          if (adminRoleErrors?.length > 0) {
            setError('The management account is missing the StackSet Administration Role. Please create it first.')
            setShowStackSetSetup(true)
          }
        } else if (inProgress) {
          setDeploymentStatus(`Deployment in progress... ${status.successfulDeployments}/${status.totalTargetAccounts} accounts completed.`)
          // Continue polling if not complete
          setTimeout(() => checkDeploymentStatus(organizationId), 10000)
        } else {
          // No progress and not complete - likely stalled
          setDeploymentStatus(`Deployment may have stalled. ${status.successfulDeployments}/${status.totalTargetAccounts} accounts completed.`)
        }
        
        // Store the detailed status for display
        if (status.accounts && Array.isArray(status.accounts)) {
          setDeploymentInfo(prev => ({
            ...prev!,
            accounts: status.accounts
          }))
        }
      }
    } catch (error) {
      console.error('Error checking deployment status:', error)
    } finally {
      setCheckingStatus(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BuildingIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            AWS Organization Management
          </h2>
        </div>
        {organization && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {organization.totalAccounts} accounts detected
          </span>
        )}
      </div>

      {!organization ? (
        <div className="text-center py-8">
          <CloudIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Detect your AWS Organization structure to deploy cost optimization across all accounts
          </p>
          <button
            onClick={detectOrganization}
            disabled={detecting}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 font-medium transition-colors duration-200"
          >
            {detecting ? (
              <>
                <LoaderIcon className="inline-block w-4 h-4 mr-2 animate-spin" />
                Detecting Organization...
              </>
            ) : (
              'Detect Organization Structure'
            )}
          </button>
        </div>
      ) : showStackSetSetup ? (
        <div className="space-y-6">
          {/* StackSet Administration Role Setup */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-4">
              Setup Required: Enable CloudFormation Trusted Access
            </h3>
            <p className="text-amber-800 dark:text-amber-200 mb-4">
              AWS StackSets require execution roles in member accounts. For organizations, AWS can manage this automatically.
            </p>
            
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border-2 border-amber-300 dark:border-amber-700">
                <div className="flex items-start space-x-3">
                  <div className="bg-amber-100 dark:bg-amber-800 rounded-full p-1 mt-1">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white mb-2">One-Time Setup Required</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Enable CloudFormation trusted access to automatically manage execution roles:
                    </p>
                    
                    {/* Primary Option: Enable Trusted Access */}
                    <div className="bg-green-50 dark:bg-green-900/20 rounded p-3 mb-3 border border-green-300 dark:border-green-700">
                      <p className="text-xs text-gray-700 dark:text-gray-300 mb-2 font-semibold">✅ Recommended: Enable Trusted Access</p>
                      <ol className="list-decimal list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <li>Go to <a href="https://console.aws.amazon.com/organizations/v2/home/services" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">AWS Organizations Console → Services</a></li>
                        <li>Find <strong>CloudFormation StackSets</strong> in the list</li>
                        <li>Click <strong>Enable trusted access</strong></li>
                        <li>AWS automatically creates execution roles in ALL member accounts</li>
                        <li>This enables the service principal: <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">member.org.stacksets.cloudformation.amazonaws.com</code></li>
                      </ol>
                      <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded">
                        <p className="text-xs text-green-700 dark:text-green-300">
                          <strong>Why this is best:</strong> Works for 10, 100, or 1000+ accounts automatically
                        </p>
                      </div>
                    </div>
                    
                    {/* Alternative Option - Collapsed by default */}
                    <details className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                      <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                        Alternative: Manual deployment (not recommended for organizations)
                      </summary>
                      <div className="mt-3">
                        <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                          ⚠️ <strong>Warning:</strong> Manual deployment doesn't scale. You'd need to:
                        </p>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside mb-3">
                          <li>Log into EACH member account individually</li>
                          <li>Deploy the execution role CloudFormation template</li>
                          <li>Repeat for every new account added to the organization</li>
                        </ul>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          If you must use manual deployment, use this template in each member account:
                        </p>
                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded mt-2">
                          <code className="text-xs break-all">
                            https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-stackset-execution-role.yaml
                          </code>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
              
              {/* Continue Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-700">
                <p className="font-medium text-gray-900 dark:text-white mb-2">Ready to Continue?</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  After enabling trusted access in the AWS Organizations Console, click continue to deploy Cost Optimizer roles to all member accounts.
                </p>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => {
                      setShowStackSetSetup(false)
                      // Auto-trigger deployment after setup
                      setTimeout(() => deployStackSet(), 100)
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
                  >
                    I've Enabled Trusted Access
                  </button>
                  <a 
                    href="https://console.aws.amazon.com/organizations/v2/home/services"
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open AWS Console →
                  </a>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> The Administration Role only needs to be created once per AWS Organization.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Organization Overview */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
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
                  {deploymentMode === 'ENTIRE_ORG' ? 'Entire Organization' : 'Specific OUs'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {deploymentMode === 'ENTIRE_ORG' ? 'All Accounts' : 'Selected Accounts'}
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {deploymentMode === 'ENTIRE_ORG' ? organization.totalAccounts : getSelectedAccountsCount()}
                </p>
              </div>
            </div>
          </div>

          {/* Deployment Mode Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Choose Deployment Mode
            </h3>
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
                  {deploymentMode === 'ENTIRE_ORG' && (
                    <CheckCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-auto" />
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Deploy to all current accounts and automatically include future accounts
                </p>
                <ul className="mt-2 text-xs text-gray-500 dark:text-gray-500 list-disc list-inside">
                  <li>One-click deployment for entire org</li>
                  <li>Auto-deployment for new accounts</li>
                  <li>Includes all {organization.totalAccounts} accounts</li>
                </ul>
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
                  {deploymentMode === 'SPECIFIC_OUS' && (
                    <CheckCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-auto" />
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Choose specific organizational units for deployment
                </p>
                <ul className="mt-2 text-xs text-gray-500 dark:text-gray-500 list-disc list-inside">
                  <li>Granular control over deployment</li>
                  <li>Deploy to selected OUs only</li>
                  <li>Manual control for new accounts</li>
                </ul>
              </label>
            </div>
          </div>

          {/* OU Selection - Only show for SPECIFIC_OUS mode */}
          {deploymentMode === 'SPECIFIC_OUS' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Select Organizational Units for Deployment
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
              {organization.organizationalUnits.map(ou => (
                <div 
                  key={ou.id}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <label className="flex items-start space-x-3 cursor-pointer">
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
                      {ou.accounts.length > 0 && (
                        <div className="mt-2 ml-7 text-sm text-gray-600 dark:text-gray-400">
                          {ou.accounts.slice(0, 3).map(acc => (
                            <div key={acc.id} className="flex items-center space-x-2 mt-1">
                              <UserIcon className="w-3 h-3" />
                              <span>{acc.name}</span>
                              {acc.id === organization.managementAccountId && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                                  Management (excluded)
                                </span>
                              )}
                            </div>
                          ))}
                          {ou.accounts.length > 3 && (
                            <span className="text-gray-500 dark:text-gray-500 ml-5">
                              +{ou.accounts.length - 3} more accounts
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Root OU Warning - Only show for SPECIFIC_OUS mode */}
          {deploymentMode === 'SPECIFIC_OUS' && selectedOUs.some(ouId => 
            organization?.organizationalUnits.find(ou => ou.id === ouId && ou.name === 'Root')
          ) && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                    Root Organization Unit Selected
                  </h4>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    With AWS Organizations trusted access enabled, StackSets cannot deploy directly to the root. 
                    If you have accounts directly in the root (not in any OU), the deployment will automatically:
                  </p>
                  <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 mt-2">
                    <li>Deploy to all child OUs instead of the root</li>
                    <li>Fail if ALL accounts are directly in the root with no OUs</li>
                  </ul>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                    <strong>Recommendation:</strong> Create organizational units and move accounts into them for better organization.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Deployment Summary for ENTIRE_ORG mode */}
          {deploymentMode === 'ENTIRE_ORG' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">
                Organization-Wide Deployment
              </h4>
              <p className="text-sm text-green-800 dark:text-green-200">
                AWS Cost Optimizer will be deployed to all {organization.totalAccounts} accounts in your organization.
              </p>
              <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/30 rounded">
                <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
                  Auto-deployment Enabled
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  New accounts added to your organization will automatically receive the Cost Optimizer role.
                </p>
              </div>
            </div>
          )}

          {/* Selected Accounts Summary - Only for SPECIFIC_OUS mode */}
          {deploymentMode === 'SPECIFIC_OUS' && selectedOUs.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Deployment Summary
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {getSelectedAccountsCount()} accounts will receive the Cost Optimizer role:
              </p>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {organization.organizationalUnits
                  .filter(ou => selectedOUs.includes(ou.id))
                  .flatMap(ou => ou.accounts)
                  .filter(account => account.id !== organization.managementAccountId)
                  .slice(0, 6)
                  .map(account => (
                    <div key={account.id} className="flex items-center space-x-1 text-blue-700 dark:text-blue-300">
                      <UserIcon className="w-3 h-3" />
                      <span className="truncate">{account.name}</span>
                    </div>
                  ))}
                {getSelectedAccountsCount() > 6 && (
                  <div className="text-blue-600 dark:text-blue-400">
                    +{getSelectedAccountsCount() - 6} more accounts
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Deployment Status */}
          {deploymentStatus && (
            <div className={`border rounded-lg p-4 ${
              deploymentStatus.includes('complete') 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                : deploymentStatus.includes('failed') || deploymentStatus.includes('partially')
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' 
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {deploymentStatus.includes('complete') ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : deploymentStatus.includes('failed') || deploymentStatus.includes('partially') ? (
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <LoaderIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  )}
                  <p className={`${
                    deploymentStatus.includes('complete')
                      ? 'text-green-700 dark:text-green-300'
                      : deploymentStatus.includes('failed') || deploymentStatus.includes('partially')
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-blue-700 dark:text-blue-300'
                  }`}>{deploymentStatus}</p>
                </div>
                {deploymentInfo && deploymentStatus.includes('progress') && (
                  <button
                    onClick={() => checkDeploymentStatus(organization?.organizationId || '')}
                    disabled={checkingStatus}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {checkingStatus ? 'Checking...' : 'Check Status'}
                  </button>
                )}
                {deploymentStatus.includes('complete') && (
                  <button
                    onClick={async () => {
                      const synced = await syncAccounts(organization?.organizationId || '')
                      if (synced) {
                        window.location.href = '/dashboard'
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors text-sm"
                  >
                    Go to Dashboard
                  </button>
                )}
              </div>
              {deploymentInfo && (
                <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  <p>StackSet ID: <span className="font-mono">{deploymentInfo.stackSetId}</span></p>
                  <p>Operation ID: <span className="font-mono">{deploymentInfo.operationId}</span></p>
                  
                  {/* Show failed accounts if any */}
                  {deploymentInfo.accounts && deploymentInfo.accounts.some(acc => acc.status === 'INOPERABLE' || acc.statusReason) && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                      <p className="font-medium text-red-700 dark:text-red-300 mb-2">Failed Accounts:</p>
                      <div className="space-y-2">
                        {deploymentInfo.accounts
                          .filter(acc => acc.status === 'INOPERABLE' || acc.statusReason)
                          .map(acc => (
                            <div key={acc.accountId} className="text-xs">
                              <p className="font-mono text-red-600 dark:text-red-400">{acc.accountId}</p>
                              {acc.statusReason && (
                                <p className="text-red-600 dark:text-red-400 ml-4">
                                  {acc.statusReason.includes('AWSCloudFormationStackSetExecutionRole') 
                                    ? 'Missing execution role in this account'
                                    : acc.statusReason}
                                </p>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Deploy Button */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={detectOrganization}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowStackSetSetup(true)}
              disabled={deploying || (deploymentMode === 'SPECIFIC_OUS' && selectedOUs.length === 0)}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 font-medium transition-colors duration-200 flex items-center"
            >
              {deploying ? (
                <>
                  <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                  Deploying StackSet...
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4 mr-2" />
                  {deploymentMode === 'ENTIRE_ORG' 
                    ? 'Deploy to Entire Organization' 
                    : 'Deploy to Selected OUs'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}