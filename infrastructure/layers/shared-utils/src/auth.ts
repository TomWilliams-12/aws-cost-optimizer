import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import * as jwt from 'jsonwebtoken'

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION })

// Cache the JWT secret to avoid repeated Secrets Manager calls
let cachedJwtSecret: string | undefined

/**
 * Retrieves the JWT secret from AWS Secrets Manager
 * Handles both JSON format (with jwtSecret property) and raw string format
 */
export async function getJwtSecret(): Promise<string> {
  if (cachedJwtSecret) {
    return cachedJwtSecret
  }

  try {
    const secretId = process.env.APP_SECRETS_ARN || process.env.JWT_SECRET_NAME || 'aws-cost-optimizer-jwt-secret'
    
    const command = new GetSecretValueCommand({ SecretId: secretId })
    const response = await secretsClient.send(command)
    
    if (!response.SecretString) {
      throw new Error('Secret value is empty')
    }
    
    try {
      // Try to parse as JSON (format used by auth handler)
      const secrets = JSON.parse(response.SecretString)
      cachedJwtSecret = secrets.jwtSecret
    } catch {
      // If not JSON, use as raw string
      cachedJwtSecret = response.SecretString
    }
    
    if (!cachedJwtSecret) {
      throw new Error('JWT secret not found in secret value')
    }
    
    return cachedJwtSecret
  } catch (error) {
    console.error('Error retrieving JWT secret:', error)
    throw new Error('Failed to retrieve JWT secret')
  }
}

/**
 * Verifies a JWT token and returns the decoded payload
 */
export async function verifyJwtToken(token: string): Promise<any> {
  const secret = await getJwtSecret()
  return jwt.verify(token, secret)
}

/**
 * Authenticates a user from the Authorization header
 * Returns null if authentication fails
 */
export async function authenticateUser(headers: any): Promise<{ userId: string; email: string; subscriptionTier: string } | null> {
  try {
    const authHeader = headers?.Authorization || headers?.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }
    
    const token = authHeader.replace('Bearer ', '')
    const decoded = await verifyJwtToken(token) as any
    
    if (!decoded.userId || !decoded.email) {
      return null
    }
    
    return {
      userId: decoded.userId,
      email: decoded.email,
      subscriptionTier: decoded.subscriptionTier || 'starter'
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

/**
 * Creates a JWT token with the given payload
 */
export async function createJwtToken(payload: any, expiresIn: string | number = '7d'): Promise<string> {
  const secret = await getJwtSecret()
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions)
}