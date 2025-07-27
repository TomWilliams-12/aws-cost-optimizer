import { APIGatewayProxyResult } from 'aws-lambda'

interface ApiSuccess<T> {
  success: true
  data: T
  message?: string
}

interface ApiFailure {
  success: false
  error: string
  code?: string
  details?: any
}

export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200,
  message?: string
): APIGatewayProxyResult {
  const response: ApiSuccess<T> = {
    success: true,
    data,
    ...(message && { message }),
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(response),
  }
}

export function createErrorResponse(
  statusCode: number,
  error: string,
  code?: string,
  details?: any
): APIGatewayProxyResult {
  const response: ApiFailure = {
    success: false,
    error,
    ...(code && { code }),
    ...(details && { details }),
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(response),
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateAwsAccountId(accountId: string): boolean {
  const accountIdRegex = /^\d{12}$/
  return accountIdRegex.test(accountId)
}

export function validateAwsRegion(region: string): boolean {
  const validRegions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
    'ca-central-1', 'sa-east-1', 'ap-south-1',
  ]
  return validRegions.includes(region)
}

export function validateRoleArn(roleArn: string): boolean {
  const roleArnRegex = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/
  return roleArnRegex.test(roleArn)
}

export function sanitizeInput(input: string, maxLength: number = 255): string {
  return input.trim().substring(0, maxLength)
}

export function generateTtl(daysFromNow: number): number {
  return Math.floor(Date.now() / 1000) + (daysFromNow * 24 * 60 * 60)
}

export function parseQueryParameters(event: any): Record<string, string> {
  return event.queryStringParameters || {}
}

export function parsePathParameters(event: any): Record<string, string> {
  return event.pathParameters || {}
}

export function handleCorsPreflightRequest(): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
    body: '',
  }
} 