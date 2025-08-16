import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { 
  OrganizationsClient, 
  DescribeOrganizationCommand,
  ListAccountsCommand,
  ListAccountsForParentCommand,
  ListOrganizationalUnitsForParentCommand,
  ListRootsCommand,
  ListAWSServiceAccessForOrganizationCommand
} from '@aws-sdk/client-organizations'
import { 
  CloudFormationClient,
  CreateStackSetCommand,
  DescribeStackSetCommand,
  CreateStackInstancesCommand,
  ListStackInstancesCommand,
  StackInstanceStatus
} from '@aws-sdk/client-cloudformation'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION })
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const organizationsClient = new OrganizationsClient({ region: process.env.AWS_REGION })
const cloudFormationClient = new CloudFormationClient({ region: process.env.AWS_REGION })
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION })

const ORGANIZATIONS_TABLE = process.env.ORGANIZATIONS_TABLE || 'aws-cost-optimizer-organizations'
const ORG_ACCOUNTS_TABLE = process.env.ORG_ACCOUNTS_TABLE || 'aws-cost-optimizer-org-accounts'
const ACCOUNTS_TABLE = process.env.ACCOUNTS_TABLE || 'aws-cost-optimizer-accounts'

interface OrganizationInfo {
  organizationId: string
  managementAccountId: string
  organizationalUnits: Array<{
    id: string
    name: string
    parentId: string
    accounts: Array<{
      id: string
      name: string
      email: string
      status: string
    }>
  }>
  totalAccounts: number
  pricingTier: string
  monthlyCost: number
}

// Get JWT secret from Secrets Manager
async function getJwtSecret(): Promise<string> {
  const command = new GetSecretValueCommand({
    SecretId: process.env.APP_SECRETS_ARN || process.env.JWT_SECRET_NAME || 'aws-cost-optimizer-jwt-secret'
  })
  const secret = await secretsClient.send(command)
  
  if (secret.SecretString) {
    try {
      // Try to parse as JSON (format used by auth handler)
      const secrets = JSON.parse(secret.SecretString)
      return secrets.jwtSecret
    } catch {
      // If not JSON, return as is
      return secret.SecretString
    }
  }
  
  throw new Error('JWT secret not found')
}

// Verify JWT token
async function verifyToken(authHeader: string): Promise<any> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header')
  }
  
  const token = authHeader.slice(7)
  const jwtSecret = await getJwtSecret()
  return jwt.verify(token, jwtSecret)
}

// Calculate pricing tier based on account count
function calculatePricingTier(accountCount: number): { tier: string, monthlyCost: number } {
  if (accountCount <= 3) {
    return { tier: 'Starter', monthlyCost: 49 }
  } else if (accountCount <= 10) {
    return { tier: 'Professional', monthlyCost: 149 }
  } else {
    return { tier: 'Enterprise', monthlyCost: 0 } // Custom pricing
  }
}

// Helper function to get organization root ID
async function getRootId(orgsClient: OrganizationsClient): Promise<string> {
  const rootsCommand = new ListRootsCommand({})
  const rootsResult = await orgsClient.send(rootsCommand)
  const rootId = rootsResult.Roots?.[0]?.Id
  
  if (!rootId) {
    throw new Error('Could not find organization root')
  }
  
  return rootId
}

// Detect AWS Organization
export async function detectOrganization(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Organization detection request:', JSON.stringify(event, null, 2))

  try {
    // Verify authentication
    const user = await verifyToken(event.headers?.Authorization || event.headers?.authorization || '')
    
    // Parse request body
    const body = JSON.parse(event.body || '{}')
    const { region = 'us-east-1', roleArn } = body

    let orgsClient = organizationsClient

    // If roleArn is provided, assume role first
    if (roleArn) {
      const stsClient = new STSClient({ region })
      const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: 'aws-cost-optimizer-org-detection',
        ExternalId: body.externalId
      })
      
      const assumeRoleResult = await stsClient.send(assumeRoleCommand)
      const credentials = assumeRoleResult.Credentials

      orgsClient = new OrganizationsClient({
        region,
        credentials: {
          accessKeyId: credentials?.AccessKeyId || '',
          secretAccessKey: credentials?.SecretAccessKey || '',
          sessionToken: credentials?.SessionToken
        }
      })
    }

    // Check if caller is in management account
    const orgCommand = new DescribeOrganizationCommand({})
    const orgResult = await orgsClient.send(orgCommand)
    
    if (!orgResult.Organization) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        body: JSON.stringify({
          error: 'No AWS Organization found. This API must be called from the management account.'
        })
      }
    }

    const organizationId = orgResult.Organization.Id!
    const managementAccountId = orgResult.Organization.MasterAccountId!

    // Get organization root
    const rootsCommand = new ListRootsCommand({})
    const rootsResult = await orgsClient.send(rootsCommand)
    const rootId = rootsResult.Roots?.[0]?.Id

    if (!rootId) {
      throw new Error('Could not find organization root')
    }

    // Get all organizational units
    const ouCommand = new ListOrganizationalUnitsForParentCommand({
      ParentId: rootId
    })
    const ouResult = await orgsClient.send(ouCommand)

    // Get accounts for each OU (and root)
    const organizationalUnits = []
    
    // Add root level accounts
    const rootAccountsCommand = new ListAccountsCommand({})
    const rootAccountsResult = await orgsClient.send(rootAccountsCommand)
    const allAccounts = rootAccountsResult.Accounts || []

    // Process OUs
    for (const ou of ouResult.OrganizationalUnits || []) {
      const ouAccountsCommand = new ListAccountsCommand({})
      const ouAccountsResult = await orgsClient.send(ouAccountsCommand)
      
      // Filter accounts that belong to this OU (this is simplified - in reality you'd need to traverse the tree)
      const ouAccounts = allAccounts
        .filter(account => account.Status === 'ACTIVE')
        .map(account => ({
          id: account.Id!,
          name: account.Name!,
          email: account.Email!,
          status: account.Status!
        }))

      organizationalUnits.push({
        id: ou.Id!,
        name: ou.Name!,
        parentId: rootId,
        accounts: ouAccounts
      })
    }

    // Count active accounts
    const totalAccounts = allAccounts.filter(acc => acc.Status === 'ACTIVE').length

    const organizationInfo: OrganizationInfo = {
      organizationId,
      managementAccountId,
      organizationalUnits,
      totalAccounts,
      pricingTier: '', // Removed until pricing is finalized
      monthlyCost: 0   // Removed until pricing is finalized
    }

    console.log('Organization detected successfully:', organizationInfo)

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(organizationInfo)
    }

  } catch (error) {
    console.error('Organization detection error:', error)

    if (error instanceof Error) {
      if (error.name === 'AWSOrganizationsNotInUseException') {
        return {
          statusCode: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
          },
          body: JSON.stringify({
            error: 'AWS Organizations is not enabled for this account.',
            suggestion: 'Enable AWS Organizations in the AWS console first.'
          })
        }
      }

      if (error.name === 'AccessDeniedException') {
        return {
          statusCode: 403,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
          },
          body: JSON.stringify({
            error: 'Insufficient permissions to access AWS Organizations.',
            suggestion: 'Ensure you are calling from the management account with proper IAM permissions.'
          })
        }
      }
    }

    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: JSON.stringify({
        error: 'Failed to detect organization',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Deploy StackSet to organization
export async function deployStackSet(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('StackSet deployment request:', JSON.stringify(event, null, 2))

  try {
    // Verify authentication
    const user = await verifyToken(event.headers?.Authorization || event.headers?.authorization || '')
    
    // Parse request body
    const body = JSON.parse(event.body || '{}')
    const { 
      organizationId, 
      deploymentMode, // 'ENTIRE_ORG' or 'SPECIFIC_OUS'
      targetOUs = [], 
      excludeAccounts = [],
      region = 'us-east-1',
      roleArn,
      externalId: providedExternalId
    } = body

    if (!roleArn || !providedExternalId) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Missing required parameters',
          details: 'roleArn and externalId are required for StackSet deployment'
        })
      }
    }

    // Assume the customer's role to create StackSet in their account
    console.log('Assuming customer role for StackSet deployment:', roleArn)
    const stsClient = new STSClient({ region })
    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: 'aws-cost-optimizer-stackset-deployment',
      ExternalId: providedExternalId
    })
    
    const assumeRoleResult = await stsClient.send(assumeRoleCommand)
    const credentials = assumeRoleResult.Credentials

    if (!credentials) {
      throw new Error('Failed to assume customer role')
    }

    // Create CloudFormation client with assumed role credentials
    const cfnClient = new CloudFormationClient({
      region,
      credentials: {
        accessKeyId: credentials.AccessKeyId || '',
        secretAccessKey: credentials.SecretAccessKey || '',
        sessionToken: credentials.SessionToken
      }
    })

    // Create Organizations client with assumed role to check trusted access
    const orgsClient = new OrganizationsClient({
      region,
      credentials: {
        accessKeyId: credentials.AccessKeyId || '',
        secretAccessKey: credentials.SecretAccessKey || '',
        sessionToken: credentials.SessionToken
      }
    })

    // Check if CloudFormation has trusted access enabled
    // member.org.stacksets.cloudformation.amazonaws.com is the correct principal for SERVICE_MANAGED
    let useServiceManaged = false
    try {
      const { EnabledServicePrincipals } = await orgsClient.send(
        new ListAWSServiceAccessForOrganizationCommand({})
      )
      useServiceManaged = EnabledServicePrincipals?.some(
        service => service.ServicePrincipal === 'member.org.stacksets.cloudformation.amazonaws.com'
      ) || false
      console.log('CloudFormation trusted access enabled:', useServiceManaged)
      console.log('Enabled service principals:', EnabledServicePrincipals?.map(s => s.ServicePrincipal))
    } catch (err) {
      console.log('Could not check trusted access, defaulting to SELF_MANAGED:', err)
    }

    // Generate external ID for the organization
    const externalId = `org-${organizationId}-${Date.now()}`
    const stackSetName = `aws-cost-optimizer-org-${organizationId}`

    // CloudFormation template for organization role
    const template = JSON.stringify({
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'AWS Cost Optimizer Organization Role - Read-only access for cost analysis',
      Parameters: {
        ExternalId: {
          Type: 'String',
          Description: 'External ID for cross-account role access',
          Default: externalId
        },
        TrustedAccountId: {
          Type: 'String',
          Description: 'AWS Account ID that can assume this role',
          Default: process.env.TRUSTED_ACCOUNT_ID || '123456789012'
        }
      },
      Resources: {
        AWSCostOptimizerRole: {
          Type: 'AWS::IAM::Role',
          Properties: {
            RoleName: 'AWSCostOptimizerOrganizationRole',
            AssumeRolePolicyDocument: {
              Version: '2012-10-17',
              Statement: [{
                Effect: 'Allow',
                Principal: {
                  AWS: { Ref: 'TrustedAccountId' }
                },
                Action: 'sts:AssumeRole',
                Condition: {
                  StringEquals: {
                    'sts:ExternalId': { Ref: 'ExternalId' }
                  }
                }
              }]
            },
            ManagedPolicyArns: [
              'arn:aws:iam::aws:policy/ReadOnlyAccess'
            ],
            Tags: [
              {
                Key: 'Purpose',
                Value: 'AWS Cost Optimizer Organization Access'
              },
              {
                Key: 'ExternalId',
                Value: { Ref: 'ExternalId' }
              }
            ]
          }
        }
      },
      Outputs: {
        RoleArn: {
          Description: 'ARN of the created IAM role',
          Value: { 'Fn::GetAtt': ['AWSCostOptimizerRole', 'Arn'] }
        },
        ExternalId: {
          Description: 'External ID for assuming the role',
          Value: { Ref: 'ExternalId' }
        }
      }
    })

    // Validate deployment mode
    if (!deploymentMode || !['ENTIRE_ORG', 'SPECIFIC_OUS'].includes(deploymentMode)) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Invalid deployment mode',
          details: 'Deployment mode must be either ENTIRE_ORG or SPECIFIC_OUS'
        })
      }
    }

    // For SPECIFIC_OUS mode, validate that OUs were provided
    if (deploymentMode === 'SPECIFIC_OUS' && (!targetOUs || targetOUs.length === 0)) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Missing target OUs',
          details: 'When using SPECIFIC_OUS deployment mode, you must specify target organizational units'
        })
      }
    }

    // First, check if StackSet already exists
    let stackSetExists = false
    let existingPermissionModel = null
    try {
      const describeCommand = new DescribeStackSetCommand({
        StackSetName: stackSetName,
        CallAs: useServiceManaged ? 'SELF' : undefined
      })
      const existingStackSet = await cfnClient.send(describeCommand)
      stackSetExists = true
      existingPermissionModel = existingStackSet.StackSet?.PermissionModel
      console.log('Existing StackSet found with permission model:', existingPermissionModel)
      
      // If the existing StackSet has different permission model, we need to delete it first
      if (existingPermissionModel && existingPermissionModel !== (useServiceManaged ? 'SERVICE_MANAGED' : 'SELF_MANAGED')) {
        return {
          statusCode: 409,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'StackSet Permission Model Conflict',
            details: `Existing StackSet uses ${existingPermissionModel} permissions but you have trusted access enabled for SERVICE_MANAGED permissions.`,
            suggestion: `Delete the existing StackSet '${stackSetName}' first, then redeploy with SERVICE_MANAGED permissions.`,
            currentModel: existingPermissionModel,
            requestedModel: useServiceManaged ? 'SERVICE_MANAGED' : 'SELF_MANAGED'
          })
        }
      }
    } catch (err: any) {
      if (err.name !== 'StackSetNotFoundException') {
        throw err
      }
      console.log('No existing StackSet found, creating new one')
    }

    // Create StackSet only if it doesn't exist
    let stackSetId: string
    if (!stackSetExists) {
      const createStackSetCommand = new CreateStackSetCommand({
        StackSetName: stackSetName,
        TemplateBody: template,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
        Description: 'AWS Cost Optimizer organization-wide IAM roles for cost analysis',
        Parameters: [
          {
            ParameterKey: 'ExternalId',
            ParameterValue: externalId
          },
          {
            ParameterKey: 'TrustedAccountId',
            ParameterValue: process.env.TRUSTED_ACCOUNT_ID || '123456789012'
          }
        ],
        PermissionModel: useServiceManaged ? 'SERVICE_MANAGED' : 'SELF_MANAGED',
        ...(useServiceManaged && {
          AutoDeployment: {
            // Enable auto-deployment for ENTIRE_ORG mode
            Enabled: deploymentMode === 'ENTIRE_ORG',
            RetainStacksOnAccountRemoval: false
          },
          // For SERVICE_MANAGED StackSets, Organizations handles the execution roles
          CallAs: 'SELF'
        })
      })

      const stackSetResult = await cfnClient.send(createStackSetCommand)
      console.log('StackSet created:', stackSetResult.StackSetId)
      stackSetId = stackSetResult.StackSetId!
    } else {
      // Use existing StackSet
      stackSetId = `${stackSetName}:existing`
    }

    // Create stack instances based on deployment mode
    const operationIds = []
    let rootAccounts: any[] = [] // Declare at function scope
    
    if (useServiceManaged) {
      const rootId = await getRootId(orgsClient)
      
      if (deploymentMode === 'ENTIRE_ORG') {
        // Deploy to entire organization
        console.log('Deploying to entire organization with auto-deployment enabled')
        
        // For entire org deployment, we need to:
        // 1. Get all OUs in the organization
        // 2. Deploy to all OUs (SERVICE_MANAGED can't target root directly)
        
        const allOUs: string[] = []
        
        // Recursively get all OUs in the organization
        const getAllOUs = async (parentId: string) => {
          const listOUsCommand = new ListOrganizationalUnitsForParentCommand({
            ParentId: parentId
          })
          const ousResult = await orgsClient.send(listOUsCommand)
          
          for (const ou of ousResult.OrganizationalUnits || []) {
            allOUs.push(ou.Id!)
            // Recursively get child OUs
            await getAllOUs(ou.Id!)
          }
        }
        
        await getAllOUs(rootId)
        
        // Check for accounts directly under root
        const listAccountsCommand = new ListAccountsForParentCommand({
          ParentId: rootId
        })
        const rootAccountsResult = await orgsClient.send(listAccountsCommand)
        rootAccounts = (rootAccountsResult.Accounts || []).filter((acc: any) => 
          acc.Status === 'ACTIVE' && acc.Id !== body.managementAccountId
        )
        
        if (allOUs.length === 0 && rootAccounts.length > 0) {
          // No OUs exist - all accounts are in root
          return {
            statusCode: 400,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              error: 'No organizational units found',
              details: `SERVICE_MANAGED StackSets require organizational units. Found ${rootAccounts.length} accounts directly under root that cannot be targeted.`,
              suggestion: 'Create organizational units and move accounts into them, or disable trusted access to use SELF_MANAGED deployment.',
              accountsInRoot: rootAccounts.length
            })
          }
        }
        
        // Warn if there are accounts under root that won't be included
        if (rootAccounts.length > 0) {
          console.warn(`WARNING: ${rootAccounts.length} accounts are directly under root and will NOT be included in the deployment`)
          console.warn('Accounts under root:', rootAccounts.map(a => `${a.Name} (${a.Id})`).join(', '))
        }
        
        console.log(`Found ${allOUs.length} organizational units to deploy to`)
        
        // Deploy to all OUs in batches (AWS has limits on concurrent operations)
        const ouBatchSize = 10 // AWS recommends not exceeding 10 concurrent operations
        for (let i = 0; i < allOUs.length; i += ouBatchSize) {
          const ouBatch = allOUs.slice(i, i + ouBatchSize)
          const operationId = randomUUID()
          operationIds.push(operationId)
          
          console.log(`Deploying to OUs batch ${i / ouBatchSize + 1}/${Math.ceil(allOUs.length / ouBatchSize)}: ${ouBatch.join(', ')}`)
          
          const createInstancesCommand = new CreateStackInstancesCommand({
            StackSetName: stackSetName,
            DeploymentTargets: {
              OrganizationalUnitIds: ouBatch
            },
            Regions: [region],
            OperationId: operationId,
            CallAs: 'SELF'
          })
          
          const instancesResult = await cfnClient.send(createInstancesCommand)
          console.log(`Batch ${i / ouBatchSize + 1} deployment initiated:`, instancesResult.OperationId)
          
          // Add small delay between batches to avoid throttling
          if (i + ouBatchSize < allOUs.length) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        console.log(`Organization-wide deployment initiated with ${operationIds.length} operations`)
        
        // Don't return early - let the function continue to store the organization record
        
      } else if (deploymentMode === 'SPECIFIC_OUS') {
        // Deploy to specific OUs
        console.log('Deploying to specific organizational units:', targetOUs)
        
        // Filter out root if included
        const validOUs = targetOUs.filter((ou: string) => ou !== rootId)
        
        if (validOUs.length === 0) {
          return {
            statusCode: 400,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              error: 'No valid organizational units selected',
              details: 'The root organizational unit cannot be targeted directly with SERVICE_MANAGED permissions.',
              suggestion: 'Select specific organizational units (not the root) for deployment.'
            })
          }
        }
        
        // Deploy to specific OUs in batches
        const ouBatchSize = 10
        for (let i = 0; i < validOUs.length; i += ouBatchSize) {
          const ouBatch = validOUs.slice(i, i + ouBatchSize)
          const operationId = randomUUID()
          operationIds.push(operationId)
          
          console.log(`Deploying to specific OUs batch ${i / ouBatchSize + 1}/${Math.ceil(validOUs.length / ouBatchSize)}: ${ouBatch.join(', ')}`)
          
          const createInstancesCommand = new CreateStackInstancesCommand({
            StackSetName: stackSetName,
            DeploymentTargets: {
              OrganizationalUnitIds: ouBatch
            },
            Regions: [region],
            OperationId: operationId,
            CallAs: 'SELF'
          })
          
          const instancesResult = await cfnClient.send(createInstancesCommand)
          console.log(`Specific OUs batch ${i / ouBatchSize + 1} deployment initiated:`, instancesResult.OperationId)
          
          // Add small delay between batches to avoid throttling
          if (i + ouBatchSize < validOUs.length) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        console.log(`Specific OUs deployment initiated with ${operationIds.length} operations`)
      }
      
    } else {
      // SELF_MANAGED deployment - fallback when trusted access is not enabled
      console.log('Using SELF_MANAGED deployment (trusted access not enabled)')
      
      // Get all accounts from the frontend
      const accountIds = body.accounts || []
      
      // Filter out excluded accounts
      const targetAccounts = accountIds.filter((accountId: string) => {
        return !excludeAccounts.includes(accountId) && 
               accountId !== '504264909935' // Our application account
      })
      
      if (targetAccounts.length === 0) {
        return {
          statusCode: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'No accounts to deploy to',
            details: 'All accounts were filtered out or excluded.'
          })
        }
      }
      
      const operationId = randomUUID()
      operationIds.push(operationId)
      
      const createInstancesCommand = new CreateStackInstancesCommand({
        StackSetName: stackSetName,
        Accounts: targetAccounts,
        Regions: [region],
        OperationId: operationId
      })
      
      const instancesResult = await cfnClient.send(createInstancesCommand)
      console.log('SELF_MANAGED deployment initiated:', instancesResult.OperationId)
    }

    // Store organization info in DynamoDB
    const organizationRecord = {
      id: randomUUID(),
      organizationId,
      externalId,
      stackSetId: stackSetId,
      stackSetName,
      deploymentMode,
      targetOUs: deploymentMode === 'SPECIFIC_OUS' ? targetOUs : [],
      excludeAccounts,
      region,
      roleArn, // Store the role ARN for later status checks
      managementAccountId: body.managementAccountId,
      permissionModel: useServiceManaged ? 'SERVICE_MANAGED' : 'SELF_MANAGED',
      userId: user.sub,
      deploymentStatus: 'DEPLOYING',
      operationIds: operationIds, // Store all operation IDs
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await docClient.send(new PutCommand({
      TableName: ORGANIZATIONS_TABLE,
      Item: organizationRecord
    }))

    // Build response with warnings if applicable
    const response: any = {
      success: true,
      stackSetId: stackSetId,
      operationIds: operationIds,
      externalId,
      deploymentStatus: 'DEPLOYING',
      deploymentMode,
      message: deploymentMode === 'ENTIRE_ORG' 
        ? 'Organization-wide deployment initiated. Roles will be created in all current and future accounts.'
        : 'StackSet deployment initiated. Roles will be created in selected organizational units.'
    }
    
    // Add warning about accounts under root if applicable
    if (deploymentMode === 'ENTIRE_ORG' && rootAccounts.length > 0) {
      response.warning = `${rootAccounts.length} accounts directly under root were NOT included in deployment`
      response.excludedAccounts = rootAccounts.map(a => ({
        id: a.Id,
        name: a.Name
      }))
      response.suggestion = 'Move these accounts into organizational units to include them in future deployments'
    }
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    }

  } catch (error) {
    console.error('StackSet deployment error:', error)

    // Provide more specific error messages
    if (error instanceof Error) {
      // Check if error is about ANY account needing execution role
      if (error.message.includes('AWSCloudFormationStackSetExecutionRole')) {
        // Extract account ID from error message if possible
        const accountMatch = error.message.match(/Account (\d{12})/)
        const accountId = accountMatch ? accountMatch[1] : 'one or more accounts'
        
        return {
          statusCode: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'StackSet Execution Role Missing',
            details: `Account ${accountId} is missing the AWSCloudFormationStackSetExecutionRole. This role is required in ALL member accounts for StackSets to work.`,
            suggestion: 'Enable trusted access in AWS Organizations Console → Services → CloudFormation StackSets, OR manually deploy the execution role to each member account.',
            failedAccount: accountId,
            helpUrl: 'https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacksets-prereqs.html'
          })
        }
      }
      
      if (error.message.includes('AWSCloudFormationStackSetAdministrationRole')) {
        return {
          statusCode: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'StackSet Administration Role not found',
            details: 'The AWSCloudFormationStackSetAdministrationRole must be created in your management account before deploying StackSets.',
            suggestion: 'Please follow the setup guide to create the required role.'
          })
        }
      }
      
      if (error.name === 'AlreadyExistsException' || error.message.includes('AlreadyExists')) {
        return {
          statusCode: 409,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'StackSet already exists',
            details: 'A StackSet for this organization already exists. You may need to update or delete the existing StackSet.'
          })
        }
      }
      
      if (error.name === 'AccessDeniedException' || error.message.includes('AccessDenied')) {
        return {
          statusCode: 403,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Access denied',
            details: 'The role does not have sufficient permissions to create StackSets.',
            suggestion: 'Ensure the OrganizationCostOptimizerRole has the required CloudFormation permissions.'
          })
        }
      }
    }

    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to deploy StackSet',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Get organization deployment status
export async function getOrganizationStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Verify authentication
    const user = await verifyToken(event.headers?.Authorization || event.headers?.authorization || '')
    
    const organizationId = event.pathParameters?.organizationId

    if (!organizationId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Organization ID is required' })
      }
    }

    // Get organization record
    const queryCommand = new QueryCommand({
      TableName: ORGANIZATIONS_TABLE,
      IndexName: 'organizationId-index',
      KeyConditionExpression: 'organizationId = :orgId',
      ExpressionAttributeValues: {
        ':orgId': organizationId
      }
    })

    const result = await docClient.send(queryCommand)
    const organization = result.Items?.[0]

    if (!organization) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Organization not found' })
      }
    }

    // Need to assume the customer's role to check their StackSet status
    const stsClient = new STSClient({ region: organization.region || 'us-east-1' })
    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: organization.roleArn,
      RoleSessionName: 'aws-cost-optimizer-stackset-status-check',
      ExternalId: organization.externalId
    })
    
    let cfnClient = cloudFormationClient
    try {
      const assumeRoleResult = await stsClient.send(assumeRoleCommand)
      const credentials = assumeRoleResult.Credentials
      
      if (credentials) {
        cfnClient = new CloudFormationClient({
          region: organization.region || 'us-east-1',
          credentials: {
            accessKeyId: credentials.AccessKeyId || '',
            secretAccessKey: credentials.SecretAccessKey || '',
            sessionToken: credentials.SessionToken
          }
        })
      }
    } catch (assumeError) {
      console.error('Failed to assume customer role for status check:', assumeError)
      // Continue with default client if assume role fails
    }

    // Check StackSet deployment status
    const describeStackSetCommand = new DescribeStackSetCommand({
      StackSetName: organization.stackSetName
    })

    const stackSetInfo = await cfnClient.send(describeStackSetCommand)

    // Get stack instances status
    const listInstancesCommand = new ListStackInstancesCommand({
      StackSetName: organization.stackSetName
    })

    const instancesInfo = await cfnClient.send(listInstancesCommand)

    const deploymentSummary = {
      organizationId,
      deploymentStatus: organization.deploymentStatus,
      stackSetStatus: stackSetInfo.StackSet?.Status,
      totalTargetAccounts: instancesInfo.Summaries?.length || 0,
      successfulDeployments: instancesInfo.Summaries?.filter(s => s.Status === StackInstanceStatus.CURRENT).length || 0,
      failedDeployments: instancesInfo.Summaries?.filter(s => s.Status === StackInstanceStatus.INOPERABLE).length || 0,
      inProgressDeployments: instancesInfo.Summaries?.filter(s => s.Status === StackInstanceStatus.OUTDATED).length || 0,
      accounts: instancesInfo.Summaries?.map(summary => ({
        accountId: summary.Account,
        region: summary.Region,
        status: summary.Status,
        statusReason: summary.StatusReason
      })) || []
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(deploymentSummary)
    }

  } catch (error) {
    console.error('Get organization status error:', error)

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to get organization status',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Sync organization accounts to main accounts table
export async function syncOrganizationAccounts(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Syncing organization accounts request:', JSON.stringify(event, null, 2))

  try {
    // Verify authentication
    const user = await verifyToken(event.headers?.Authorization || event.headers?.authorization || '')
    
    const organizationId = event.pathParameters?.organizationId

    if (!organizationId) {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Organization ID is required' })
      }
    }

    // Get organization record
    const queryCommand = new QueryCommand({
      TableName: ORGANIZATIONS_TABLE,
      IndexName: 'organizationId-index',
      KeyConditionExpression: 'organizationId = :orgId',
      ExpressionAttributeValues: {
        ':orgId': organizationId
      }
    })

    const result = await docClient.send(queryCommand)
    const organization = result.Items?.[0]

    if (!organization) {
      return {
        statusCode: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Organization not found' })
      }
    }

    // Get deployment status first
    const statusResult = await getOrganizationStatus(event)
    const statusBody = JSON.parse(statusResult.body)
    
    if (statusResult.statusCode !== 200) {
      return statusResult
    }

    // Sync successfully deployed accounts to main accounts table
    const successfulAccounts = statusBody.accounts?.filter((acc: any) => 
      acc.status === 'CURRENT' || acc.status === 'SUCCEEDED'
    ) || []

    console.log(`Syncing ${successfulAccounts.length} successful accounts to main accounts table`)

    for (const account of successfulAccounts) {
      const accountRecord = {
        accountId: randomUUID(),
        userId: user.sub,
        accountName: `Organization Account ${account.accountId}`,
        awsAccountId: account.accountId,
        region: account.region || organization.region || 'us-east-1',
        roleArn: `arn:aws:iam::${account.accountId}:role/AWSCostOptimizerOrganizationRole`,
        externalId: organization.externalId,
        organizationId: organizationId,
        deploymentType: 'ORGANIZATION',
        isOrganization: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      try {
        await docClient.send(new PutCommand({
          TableName: ACCOUNTS_TABLE,
          Item: accountRecord,
          ConditionExpression: 'attribute_not_exists(awsAccountId) OR awsAccountId <> :accountId',
          ExpressionAttributeValues: {
            ':accountId': account.accountId
          }
        }))
        console.log(`Successfully synced account ${account.accountId}`)
      } catch (err: any) {
        if (err.name === 'ConditionalCheckFailedException') {
          console.log(`Account ${account.accountId} already exists, skipping`)
        } else {
          console.error(`Failed to sync account ${account.accountId}:`, err)
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        syncedAccounts: successfulAccounts.length,
        accounts: successfulAccounts
      })
    }

  } catch (error) {
    console.error('Sync organization accounts error:', error)

    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to sync organization accounts',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Lambda handler routing
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Organizations handler received event:', JSON.stringify(event, null, 2))

  const { httpMethod, pathParameters } = event
  const path = (event as any).requestContext?.http?.path || event.path || ''
  const method = (event as any).requestContext?.http?.method || httpMethod || ''
  const routeKey = `${method} ${path}`

  try {
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        body: ''
      }
    }

    if (path.endsWith('/organizations/detect')) {
      return await detectOrganization(event)
    }
    
    if (path.endsWith('/organizations/deploy')) {
      return await deployStackSet(event)
    }
    
    if (path.includes('/organizations/') && path.includes('/status')) {
      return await getOrganizationStatus(event)
    }
    
    if (path.includes('/organizations/') && path.includes('/sync')) {
      return await syncOrganizationAccounts(event)
    }

    return {
      statusCode: 404,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: JSON.stringify({ error: 'Route not found', path, method })
    }

  } catch (error) {
    console.error('Handler error:', error)
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}