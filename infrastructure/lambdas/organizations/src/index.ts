import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { 
  OrganizationsClient, 
  DescribeOrganizationCommand,
  ListAccountsCommand,
  ListOrganizationalUnitsForParentCommand,
  ListRootsCommand
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
    SecretId: process.env.JWT_SECRET_NAME || 'aws-cost-optimizer-jwt-secret'
  })
  const secret = await secretsClient.send(command)
  return secret.SecretString || ''
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

    // Calculate pricing
    const totalAccounts = allAccounts.filter(acc => acc.Status === 'ACTIVE').length
    const { tier, monthlyCost } = calculatePricingTier(totalAccounts)

    const organizationInfo: OrganizationInfo = {
      organizationId,
      managementAccountId,
      organizationalUnits,
      totalAccounts,
      pricingTier: tier,
      monthlyCost
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
      targetOUs, 
      excludeAccounts = [],
      region = 'us-east-1',
      roleArn
    } = body

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

    // Create StackSet
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
      PermissionModel: 'SERVICE_MANAGED',
      AutoDeployment: {
        Enabled: true,
        RetainStacksOnAccountRemoval: false
      }
    })

    const stackSetResult = await cloudFormationClient.send(createStackSetCommand)
    console.log('StackSet created:', stackSetResult.StackSetId)

    // Create stack instances for target OUs
    const createInstancesCommand = new CreateStackInstancesCommand({
      StackSetName: stackSetName,
      DeploymentTargets: {
        OrganizationalUnitIds: targetOUs,
        AccountFilterType: excludeAccounts.length > 0 ? 'DIFFERENCE' : 'NONE',
        Accounts: excludeAccounts.length > 0 ? excludeAccounts : undefined
      },
      Regions: [region],
      OperationId: randomUUID()
    })

    const instancesResult = await cloudFormationClient.send(createInstancesCommand)
    console.log('Stack instances creation initiated:', instancesResult.OperationId)

    // Store organization info in DynamoDB
    const organizationRecord = {
      id: randomUUID(),
      organizationId,
      externalId,
      stackSetId: stackSetResult.StackSetId,
      stackSetName,
      targetOUs,
      excludeAccounts,
      region,
      userId: user.sub,
      deploymentStatus: 'DEPLOYING',
      operationId: instancesResult.OperationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await docClient.send(new PutCommand({
      TableName: ORGANIZATIONS_TABLE,
      Item: organizationRecord
    }))

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        stackSetId: stackSetResult.StackSetId,
        operationId: instancesResult.OperationId,
        externalId,
        deploymentStatus: 'DEPLOYING',
        message: 'StackSet deployment initiated. Roles will be created across all specified accounts.'
      })
    }

  } catch (error) {
    console.error('StackSet deployment error:', error)

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
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

    // Check StackSet deployment status
    const describeStackSetCommand = new DescribeStackSetCommand({
      StackSetName: organization.stackSetName
    })

    const stackSetInfo = await cloudFormationClient.send(describeStackSetCommand)

    // Get stack instances status
    const listInstancesCommand = new ListStackInstancesCommand({
      StackSetName: organization.stackSetName
    })

    const instancesInfo = await cloudFormationClient.send(listInstancesCommand)

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