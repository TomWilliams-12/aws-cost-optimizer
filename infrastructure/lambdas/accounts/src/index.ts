import { APIGatewayProxyResult, Context } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  validateAwsAccountId, 
  validateAwsRegion, 
  validateRoleArn,
  sanitizeInput,
  parsePathParameters,
  handleCorsPreflightRequest
} from './utils/response'

const dynamoClient = new DynamoDBClient({ region: process.env.REGION })
const dynamo = DynamoDBDocumentClient.from(dynamoClient)
const stsClient = new STSClient({ region: process.env.REGION })
const secretsManager = new SecretsManagerClient({ region: process.env.REGION })

const ACCOUNTS_TABLE = process.env.ACCOUNTS_TABLE!
const USERS_TABLE = process.env.USERS_TABLE!

// Helper function to get JWT secret
async function getJwtSecret(): Promise<string> {
  try {
    const result = await secretsManager.send(new GetSecretValueCommand({
      SecretId: process.env.APP_SECRETS_ARN || process.env.JWT_SECRET_NAME,
    }));
    const secrets = JSON.parse(result.SecretString!);
    return secrets.jwtSecret;
  } catch (error) {
    console.error('Error fetching JWT secret:', error);
    throw new Error('Failed to fetch JWT secret');
  }
}

// Helper function to authenticate user from JWT token
async function authenticateUser(event: any): Promise<{ userId: string; email: string; subscriptionTier: string } | null> {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const secret = await getJwtSecret();
    const decoded = jwt.verify(token, secret) as any;

    if (!decoded.userId || !decoded.email) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      subscriptionTier: decoded.subscriptionTier || 'starter'
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

interface AccountRecord {
  accountId: string
  userId: string
  accountName: string
  awsAccountId: string
  region: string
  roleArn: string
  externalId?: string
  status: 'active' | 'inactive' | 'error'
  lastError?: string
  lastAnalyzed?: string
  createdAt: string
  updatedAt: string
  isOrganization?: boolean
}

export const list = async (
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const method = (event as any).requestContext?.http?.method || event.httpMethod;
    if (method === 'OPTIONS') {
      return handleCorsPreflightRequest()
    }

    // Authenticate user
    const user = await authenticateUser(event);
    if (!user) {
      return createErrorResponse(401, 'Unauthorized');
    }

    // Get user's AWS accounts
    const result = await dynamo.send(new QueryCommand({
      TableName: ACCOUNTS_TABLE,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': user.userId,
      },
    }))

    // Also get system accounts (self-registered) - for now, return all
    // In the future, filter by user's email domain or organization
    const systemResult = await dynamo.send(new QueryCommand({
      TableName: ACCOUNTS_TABLE,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': 'SYSTEM',
      },
    }))

    // Combine user's direct accounts and system accounts
    const allItems = [...(result.Items || []), ...(systemResult.Items || [])]

    const accounts = allItems.map(item => ({
      id: item.accountId,
      accountId: item.awsAccountId || item.accountId.replace('self-', ''),
      accountName: item.accountName,
      region: item.region,
      roleArn: item.roleArn,
      status: item.status,
      lastAnalyzed: item.lastAnalyzed,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isOrganization: item.isOrganization || false,
      externalId: item.externalId,
      registrationType: item.registrationType,
      lastSeen: item.lastSeen,
    }))

    return createSuccessResponse({ accounts })
  } catch (error) {
    console.error('List accounts error:', error)
    return createErrorResponse(500, 'Internal server error')
  }
}

export const add = async (
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const method = (event as any).requestContext?.http?.method || event.httpMethod;
    if (method === 'OPTIONS') {
      return handleCorsPreflightRequest()
    }

    // Authenticate user
    const user = await authenticateUser(event);
    if (!user) {
      return createErrorResponse(401, 'Unauthorized');
    }

    const { accountName, accountId, region, roleArn, externalId, isOrganization } = JSON.parse(event.body || '{}')

    // For organizations, extract account ID from role ARN
    let effectiveAccountId = accountId
    if (isOrganization && !accountId) {
      const arnMatch = roleArn.match(/arn:aws:iam::(\d{12}):role\//)
      if (arnMatch) {
        effectiveAccountId = arnMatch[1]
      }
    }

    // Validate input
    if (!accountName || !effectiveAccountId || !region || !roleArn) {
      return createErrorResponse(400, 'Account name, AWS account ID, region, and role ARN are required')
    }

    if (!validateAwsAccountId(effectiveAccountId)) {
      return createErrorResponse(400, 'AWS Account ID must be exactly 12 digits (e.g., 123456789012)')
    }

    if (!validateAwsRegion(region)) {
      return createErrorResponse(400, 'Please select a valid AWS region from the dropdown')
    }

    if (!validateRoleArn(roleArn)) {
      return createErrorResponse(400, 'Role ARN must be in format: arn:aws:iam::123456789012:role/RoleName')
    }

    // Check user's account limit
    const userResult = await dynamo.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: user.userId },
    }))

    if (!userResult.Item) {
      return createErrorResponse(404, 'User not found')
    }

    const userRecord = userResult.Item
    const accountsLimit = userRecord?.accountsLimit || 3

    // Count existing accounts
    const existingAccounts = await dynamo.send(new QueryCommand({
      TableName: ACCOUNTS_TABLE,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': user.userId,
      },
      Select: 'COUNT',
    }))

    const accountCount = existingAccounts.Count || 0

    if (accountCount >= accountsLimit) {
      return createErrorResponse(403, `Account limit reached. Your ${userRecord?.subscriptionTier || user.subscriptionTier || 'current'} plan allows ${accountsLimit} accounts. Upgrade your plan to add more accounts.`)
    }

    // Test AWS credentials by assuming the role
    try {
      const effectiveExternalId = externalId || `cost-saver-${effectiveAccountId}`;
      console.log('Attempting to assume role:', {
        roleArn,
        externalId: effectiveExternalId,
        accountId: effectiveAccountId,
        isOrganization
      });
      
      const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `CostOptimizerValidation-${Date.now()}`,
        ExternalId: effectiveExternalId,
        DurationSeconds: 900, // 15 minutes
      })

      const credentials = await stsClient.send(assumeRoleCommand)

      // Verify we can use the assumed role
      const tempStsClient = new STSClient({
        region: region,
        credentials: {
          accessKeyId: credentials.Credentials!.AccessKeyId!,
          secretAccessKey: credentials.Credentials!.SecretAccessKey!,
          sessionToken: credentials.Credentials!.SessionToken!,
        },
      })

      const identity = await tempStsClient.send(new GetCallerIdentityCommand({}))
      
      if (identity.Account !== effectiveAccountId) {
        return createErrorResponse(400, 'Role ARN does not belong to the specified AWS account. Please verify both the Role ARN and AWS Account ID are correct.')
      }
    } catch (error: any) {
      console.error('Role assumption failed:', error)
      
      if (error.name === 'AccessDenied') {
        return createErrorResponse(400, 'Access denied when assuming role. Please ensure:\n1. The IAM role exists and is named correctly\n2. The role trusts account 504264909935 (Cost Saver)\n3. The role has the required permissions (ReadOnlyAccess + Billing)')
      }
      
      if (error.name === 'InvalidParameterValue') {
        return createErrorResponse(400, 'Invalid Role ARN format. Please check the role ARN is correct.')
      }
      
      if (error.name === 'NoSuchEntity') {
        return createErrorResponse(400, 'Role not found. Please verify the role exists and the ARN is correct.')
      }
      
      return createErrorResponse(400, `Failed to connect to AWS account: ${error.message || 'Unknown error'}. Please check your IAM role setup.`)
    }

    // Create account record
    const accountRecordId = randomUUID()
    const now = new Date().toISOString()

    const accountRecord: AccountRecord = {
      accountId: accountRecordId,
      userId: user.userId,
      accountName: sanitizeInput(accountName, 100),
      awsAccountId: effectiveAccountId,
      region,
      roleArn,
      externalId: externalId || undefined,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      isOrganization: isOrganization || undefined,
    }

    // Save account to database
    await dynamo.send(new PutCommand({
      TableName: ACCOUNTS_TABLE,
      Item: accountRecord,
    }))

    // Return account data
    const accountResponse = {
      id: accountRecord.accountId,
      accountId: accountRecord.awsAccountId,
      accountName: accountRecord.accountName,
      region: accountRecord.region,
      roleArn: accountRecord.roleArn,
      status: accountRecord.status,
      createdAt: accountRecord.createdAt,
      updatedAt: accountRecord.updatedAt,
    }

    return createSuccessResponse({ account: accountResponse }, 201)
  } catch (error) {
    console.error('Add account error:', error)
    return createErrorResponse(500, 'Internal server error')
  }
}

export const remove = async (
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const method = (event as any).requestContext?.http?.method || event.httpMethod;
    if (method === 'OPTIONS') {
      return handleCorsPreflightRequest()
    }

    // Authenticate user
    const user = await authenticateUser(event);
    if (!user) {
      return createErrorResponse(401, 'Unauthorized');
    }
    const { accountId } = parsePathParameters(event)

    if (!accountId) {
      return createErrorResponse(400, 'Account ID is required')
    }

    // Get account to verify ownership
    const accountResult = await dynamo.send(new GetCommand({
      TableName: ACCOUNTS_TABLE,
      Key: { accountId },
    }))

    if (!accountResult.Item) {
      return createErrorResponse(404, 'Account not found')
    }

    const account = accountResult.Item as AccountRecord

    // Allow deletion of user's own accounts or SYSTEM accounts (self-registered)
    if (account.userId !== user.userId && account.userId !== 'SYSTEM') {
      return createErrorResponse(403, 'Access denied')
    }

    // Delete account
    await dynamo.send(new DeleteCommand({
      TableName: ACCOUNTS_TABLE,
      Key: { accountId },
    }))

    return createSuccessResponse({ message: 'Account removed successfully' })
  } catch (error) {
    console.error('Remove account error:', error)
    return createErrorResponse(500, 'Internal server error')
  }
}

// Handle self-registration from customer Lambda functions
async function handleRegistration(event: any, context: Context): Promise<APIGatewayProxyResult> {
  try {
    // Validate registration token (external ID)
    const registrationToken = event.headers?.['x-registration-token'] || event.headers?.['X-Registration-Token'];
    if (!registrationToken) {
      return createErrorResponse(401, 'Missing registration token')
    }

    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    const {
      accountId,
      accountName,
      region,
      roleArn,
      externalId,
      organizationId,
      isManagementAccount,
      registrationType
    } = body

    // Validate required fields
    if (!accountId || !roleArn || !externalId || !region) {
      return createErrorResponse(400, 'Missing required fields')
    }

    // Verify the registration token matches the external ID
    if (registrationToken !== externalId) {
      return createErrorResponse(401, 'Invalid registration token')
    }

    // Validate the role can be assumed
    try {
      const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: 'cost-optimizer-registration-validation',
        ExternalId: externalId,
      })
      await stsClient.send(assumeRoleCommand)
    } catch (error) {
      console.error('Failed to assume role during registration:', error)
      return createErrorResponse(400, 'Unable to assume provided role')
    }

    // For heartbeats, update the last seen timestamp
    if (registrationType === 'heartbeat') {
      const updateParams = {
        TableName: ACCOUNTS_TABLE,
        Key: {
          accountId: `self-${accountId}` // Prefix to avoid conflicts
        },
        UpdateExpression: 'SET lastSeen = :timestamp, heartbeatCount = if_not_exists(heartbeatCount, :zero) + :one, #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':timestamp': new Date().toISOString(),
          ':zero': 0,
          ':one': 1,
          ':status': 'active'
        }
      }
      
      await dynamo.send(new UpdateCommand(updateParams))
      
      return createSuccessResponse({
        message: 'Heartbeat recorded',
        accountId,
        registrationType
      })
    }

    // For initial registration, create or update the account
    const accountRecordId = `self-${accountId}` // Prefix for self-registered accounts
    const accountData = {
      accountId: accountRecordId,
      userId: 'SYSTEM', // System accounts for self-registered
      awsAccountId: accountId,
      accountName,
      roleArn,
      externalId,
      region,
      organizationId: organizationId || null,
      isOrganization: isManagementAccount || false,
      isManagementAccount: isManagementAccount || false,
      registrationType: 'self-registered',
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'active'
    }

    await dynamo.send(new PutCommand({
      TableName: ACCOUNTS_TABLE,
      Item: accountData
    }))

    console.log(`Account ${accountId} self-registered successfully`)
    
    return createSuccessResponse({
      message: 'Account registered successfully',
      account: accountData
    })

  } catch (error) {
    console.error('Registration error:', error)
    return createErrorResponse(500, 'Registration failed')
  }
}

// Main handler function that routes based on HTTP method
export const handler = async (
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // API Gateway v2 (HTTP API) uses different event structure than v1 (REST API)
    const method = (event as any).requestContext?.http?.method || event.httpMethod;
    const path = (event as any).requestContext?.http?.path || event.path || '';
    
    // Handle registration endpoint separately (no auth required)
    if (path.endsWith('/register') && method === 'POST') {
      return handleRegistration(event, context)
    }
    
    switch (method) {
      case 'OPTIONS':
        return handleCorsPreflightRequest()
      case 'GET':
        return list(event, context)
      case 'POST':
        return add(event, context)
      case 'DELETE':
        return remove(event, context)
      default:
        return createErrorResponse(405, 'Method not allowed')
    }
  } catch (error) {
    console.error('Handler error:', error)
    return createErrorResponse(500, 'Internal server error')
  }
} 