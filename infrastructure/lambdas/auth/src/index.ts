import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import {
  createSuccessResponse,
  createErrorResponse,
  validateEmail,
  handleCorsPreflightRequest,
} from './utils/response'

const dynamoClient = new DynamoDBClient({ region: process.env.REGION })
const dynamo = DynamoDBDocumentClient.from(dynamoClient)
const secretsManagerClient = new SecretsManagerClient({ region: process.env.REGION })

const USERS_TABLE = process.env.USERS_TABLE!
const APP_SECRETS_ARN = process.env.APP_SECRETS_ARN!

let jwtSecret: string | undefined;

async function getJwtSecret(): Promise<string> {
  if (jwtSecret) {
    return jwtSecret;
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: APP_SECRETS_ARN });
    const data = await secretsManagerClient.send(command);
    if (data.SecretString) {
      const secrets = JSON.parse(data.SecretString);
      jwtSecret = secrets.jwtSecret;
      return jwtSecret!;
    }
    throw new Error('JWT secret not found in Secrets Manager');
  } catch (error) {
    console.error('Error retrieving JWT secret from Secrets Manager:', error);
    throw new Error('Could not retrieve JWT secret');
  }
}

interface UserRecord {
  userId: string
  email: string
  name: string
  passwordHash: string
  company?: string
  subscriptionTier: string
  subscriptionStatus: string
  accountsLimit: number
  stripeCustomerId?: string
  createdAt: string
  updatedAt: string
  ttl?: number
}

export const login = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const { email, password } = JSON.parse(event.body || '{}')

    // Validate input
    if (!email || !password) {
      return createErrorResponse(400, 'Email and password are required')
    }

    if (!validateEmail(email)) {
      return createErrorResponse(400, 'Invalid email format')
    }

    // Find user by email
    const queryResult = await dynamo.send(new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email.toLowerCase(),
      },
    }))

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return createErrorResponse(401, 'Invalid credentials')
    }

    const user = queryResult.Items[0] as UserRecord

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      return createErrorResponse(401, 'Invalid credentials')
    }

    // Check subscription status
    if (user.subscriptionStatus !== 'active') {
      return createErrorResponse(403, `Your account is ${user.subscriptionStatus}. Please contact support to activate your account.`)
    }

    // Generate JWT token
    const tokenPayload = {
      userId: user.userId,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
    }

    const secret = await getJwtSecret();
    const accessToken = jwt.sign(tokenPayload, secret, { expiresIn: '7d' })

    // Return user data without sensitive information
    const userResponse = {
      id: user.userId,
      email: user.email,
      name: user.name,
      company: user.company,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      accountsLimit: user.accountsLimit,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }

    return createSuccessResponse({
      user: userResponse,
      tokens: {
        accessToken,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return createErrorResponse(500, 'Internal server error')
  }
}

export const register = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const { name, email, password, company } = JSON.parse(event.body || '{}')

    // Validate input
    if (!name || !email || !password) {
      return createErrorResponse(400, 'Name, email, and password are required')
    }

    if (!validateEmail(email)) {
      return createErrorResponse(400, 'Invalid email format')
    }

    if (password.length < 8) {
      return createErrorResponse(400, 'Password must be at least 8 characters long')
    }

    const emailLower = email.toLowerCase()

    // Check if user already exists
    const existingUser = await dynamo.send(new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': emailLower,
      },
    }))

    if (existingUser.Items && existingUser.Items.length > 0) {
      return createErrorResponse(409, 'User with this email already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user record
    const userId = randomUUID()
    const now = new Date().toISOString()

    const userRecord: UserRecord = {
      userId,
      email: emailLower,
      name: name.trim(),
      passwordHash,
      company: company?.trim(),
      subscriptionTier: 'starter',
      subscriptionStatus: 'inactive', // Require manual activation for MVP
      accountsLimit: 3, // Starter tier limit
      createdAt: now,
      updatedAt: now,
    }

    // Save user to database
    await dynamo.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: userRecord,
      ConditionExpression: 'attribute_not_exists(userId)',
    }))

    // Generate JWT token
    const tokenPayload = {
      userId: userRecord.userId,
      email: userRecord.email,
      subscriptionTier: userRecord.subscriptionTier,
    }

    const secret = await getJwtSecret();
    const accessToken = jwt.sign(tokenPayload, secret, { expiresIn: '7d' })

    // Return user data without sensitive information
    const userResponse = {
      id: userRecord.userId,
      email: userRecord.email,
      name: userRecord.name,
      company: userRecord.company,
      subscriptionTier: userRecord.subscriptionTier,
      subscriptionStatus: userRecord.subscriptionStatus,
      accountsLimit: userRecord.accountsLimit,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
    }

    return createSuccessResponse({
      user: userResponse,
      tokens: {
        accessToken,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      },
    }, 201)
  } catch (error) {
    console.error('Registration error:', error)
    return createErrorResponse(500, 'Internal server error')
  }
}

export const verify = async (
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer.userId

    // Get user from database
    const result = await dynamo.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    }))

    if (!result.Item) {
      return createErrorResponse(404, 'User not found')
    }

    const user = result.Item as UserRecord

    // Return user data without sensitive information
    const userResponse = {
      id: user.userId,
      email: user.email,
      name: user.name,
      company: user.company,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      accountsLimit: user.accountsLimit,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }

    return createSuccessResponse({ user: userResponse })
  } catch (error) {
    console.error('Verify error:', error)
    return createErrorResponse(500, 'Internal server error')
  }
}

export const authorizer = async (event: any): Promise<any> => {
  try {
    const token = event.headers?.Authorization?.replace('Bearer ', '') || 
                 event.headers?.authorization?.replace('Bearer ', '')

    if (!token) {
      throw new Error('No token provided')
    }

    // Verify JWT token
    const secret = await getJwtSecret();
    const decoded = jwt.verify(token, secret) as any

    if (!decoded.userId || !decoded.email) {
      throw new Error('Invalid token payload')
    }

    // Generate policy
    const policy = {
      principalId: decoded.userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn || '*',
          },
        ],
      },
      context: {
        userId: decoded.userId,
        email: decoded.email,
        subscriptionTier: decoded.subscriptionTier,
      },
    }

    return policy
  } catch (error) {
    console.error('Authorization error:', error)
    throw new Error('Unauthorized')
  }
}

// Main handler function that routes based on the action in the request body
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const method = (event as any).requestContext?.http?.method || event.httpMethod;
  if (method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }
  
  try {
    const { action, ...payload } = JSON.parse(event.body || '{}');

    // Re-pack the payload into the event body for the downstream functions
    const newEvent = { ...event, body: JSON.stringify(payload) };

    switch (action) {
      case 'login':
        return login(newEvent, context);
      case 'register':
        return register(newEvent, context);
      default:
        return createErrorResponse(400, 'Invalid action');
    }
  } catch (error) {
    console.error('Handler error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
}; 