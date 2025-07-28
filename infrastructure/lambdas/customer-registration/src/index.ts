import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { OrganizationsClient, DescribeOrganizationCommand } from '@aws-sdk/client-organizations'

const stsClient = new STSClient({})
const orgsClient = new OrganizationsClient({})

// Configuration from environment variables
const API_ENDPOINT = process.env.API_ENDPOINT || 'https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev'
const EXTERNAL_ID = process.env.EXTERNAL_ID || ''
const ROLE_ARN = process.env.ROLE_ARN || ''
const ORGANIZATION_ID = process.env.ORGANIZATION_ID || ''
const IS_MANAGEMENT_ACCOUNT = process.env.IS_MANAGEMENT_ACCOUNT === 'true'

interface RegistrationPayload {
  accountId: string
  accountName: string
  region: string
  roleArn: string
  externalId: string
  organizationId: string
  isManagementAccount: boolean
  registrationType: 'initial' | 'heartbeat'
}

export const handler = async (event: APIGatewayProxyEvent | ScheduledEvent): Promise<APIGatewayProxyResult | void> => {
  console.log('Customer registration Lambda triggered:', JSON.stringify(event, null, 2))
  
  try {
    // Get current account information
    const identityCommand = new GetCallerIdentityCommand({})
    const identity = await stsClient.send(identityCommand)
    const accountId = identity.Account!
    
    // For management accounts, get the organization ID
    let actualOrganizationId = ORGANIZATION_ID
    let accountName = `AWS Account ${accountId}`
    
    if (IS_MANAGEMENT_ACCOUNT) {
      try {
        const orgCommand = new DescribeOrganizationCommand({})
        const orgInfo = await orgsClient.send(orgCommand)
        actualOrganizationId = orgInfo.Organization?.Id || ORGANIZATION_ID
        accountName = 'AWS Organization Management Account'
      } catch (err) {
        console.warn('Could not get organization info:', err)
      }
    }
    
    // Determine if this is initial registration or heartbeat
    const isScheduledEvent = 'source' in event && event.source === 'aws.events'
    const registrationType = isScheduledEvent ? 'heartbeat' : 'initial'
    
    // Build registration payload
    const payload: RegistrationPayload = {
      accountId,
      accountName,
      region: process.env.AWS_REGION || 'us-east-1',
      roleArn: ROLE_ARN,
      externalId: EXTERNAL_ID,
      organizationId: actualOrganizationId,
      isManagementAccount: IS_MANAGEMENT_ACCOUNT,
      registrationType
    }
    
    console.log('Sending registration payload:', payload)
    
    // Call the main API to register
    const response = await fetch(`${API_ENDPOINT}/accounts/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-registration-token': EXTERNAL_ID // Use external ID as a simple auth token
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Registration failed: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    console.log('Registration successful:', result)
    
    // If this is a scheduled event, we don't need to return anything
    if (isScheduledEvent) {
      return
    }
    
    // For API Gateway events, return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Account registered successfully',
        accountId,
        registrationType
      })
    }
    
  } catch (error) {
    console.error('Registration error:', error)
    
    // For scheduled events, just log and continue
    if ('source' in event && event.source === 'aws.events') {
      return
    }
    
    // For API Gateway events, return error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Registration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}