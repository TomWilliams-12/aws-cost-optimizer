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

export default function OrganizationManagement({ account }: { account: any }) {
  const { token } = useAuth()
  const [detecting, setDetecting] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null)
  const [selectedOUs, setSelectedOUs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null)

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
          region: account.region
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to detect organization')
      }

      const data = await response.json()
      setOrganization(data.organization)
      // Select root OU by default
      const rootOU = data.organization.organizationalUnits.find((ou: OrganizationalUnit) => ou.name === 'Root')
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

  // Deploy StackSet to selected OUs
  const deployStackSet = async () => {
    if (selectedOUs.length === 0) {
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
          targetOUs: selectedOUs,
          excludeAccounts: [account.accountId], // Exclude management account
          region: account.region,
          roleArn: account.roleArn,
          externalId: account.externalId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to deploy StackSet')
      }

      await response.json()
      setDeploymentStatus('StackSet deployment initiated successfully!')
      
      // TODO: Add polling for deployment status
      
    } catch (error) {
      console.error('StackSet deployment error:', error)
      setError(error instanceof Error ? error.message : 'Failed to deploy StackSet')
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

  // Calculate selected accounts count
  const getSelectedAccountsCount = () => {
    if (!organization) return 0
    
    return organization.organizationalUnits
      .filter(ou => selectedOUs.includes(ou.id))
      .reduce((total, ou) => total + ou.accounts.length, 0)
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
            {organization.totalAccounts} accounts • {organization.pricingTier} tier
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Selected Accounts</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{getSelectedAccountsCount()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Cost</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${organization.monthlyCost === 0 ? 'Custom' : organization.monthlyCost}
                </p>
              </div>
            </div>
          </div>

          {/* OU Selection */}
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

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {deploymentStatus && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-green-700 dark:text-green-300">{deploymentStatus}</p>
              </div>
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
              onClick={deployStackSet}
              disabled={deploying || selectedOUs.length === 0}
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
                  Deploy to Selected Accounts
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}