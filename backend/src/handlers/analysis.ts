import { APIGatewayProxyResult, Context } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { EC2Client, DescribeVolumesCommand } from '@aws-sdk/client-ec2'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import { createSuccessResponse, createErrorResponse } from '../utils/response'

const dynamoClient = new DynamoDBClient({ region: process.env.REGION })
const dynamo = DynamoDBDocumentClient.from(dynamoClient)
const stsClient = new STSClient({ region: process.env.REGION })
const secretsManager = new SecretsManagerClient({ region: process.env.REGION })

const ACCOUNTS_TABLE = process.env.ACCOUNTS_TABLE!
const ANALYSES_TABLE = process.env.ANALYSES_TABLE!

// Helper function to get JWT secret
async function getJwtSecret(): Promise<string> {
  try {
    const result = await secretsManager.send(new GetSecretValueCommand({
      SecretId: process.env.JWT_SECRET_NAME,
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

export const handler = async (
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Authenticate user
    const user = await authenticateUser(event);
    if (!user) {
      return createErrorResponse(401, 'Unauthorized');
    }
    
    const { accountId } = JSON.parse(event.body || '{}')

    if (!accountId) {
      return createErrorResponse(400, 'accountId is required')
    }

    // 1. Get account details from DynamoDB
    const accountResult = await dynamo.send(new GetCommand({
      TableName: ACCOUNTS_TABLE,
      Key: { accountId },
    }))

    if (!accountResult.Item || accountResult.Item.userId !== user.userId) {
      return createErrorResponse(404, 'Account not found or access denied')
    }
    const account = accountResult.Item

    // 2. Assume the cross-account role
    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: account.roleArn,
      RoleSessionName: `CostOptimizerAnalysis-${Date.now()}`,
      ExternalId: account.externalId || `cost-saver-${account.awsAccountId}`,
    })
    const credentials = await stsClient.send(assumeRoleCommand)

    const ec2Client = new EC2Client({
      region: account.region,
      credentials: {
        accessKeyId: credentials.Credentials!.AccessKeyId!,
        secretAccessKey: credentials.Credentials!.SecretAccessKey!,
        sessionToken: credentials.Credentials!.SessionToken!,
      },
    })

    // 3. Perform the analysis
    const analysisId = uuidv4()
    const analysisStartTime = new Date().toISOString()
    
    // Create an initial analysis record
    await dynamo.send(new PutCommand({
        TableName: ANALYSES_TABLE,
        Item: {
            analysisId,
            userId: user.userId,
            accountId,
            status: 'in-progress',
            createdAt: analysisStartTime,
            updatedAt: analysisStartTime,
        },
    }));

    // Example: Find unattached EBS volumes
    const { Volumes } = await ec2Client.send(new DescribeVolumesCommand({}))
    const unattachedVolumes = Volumes
        ?.filter(v => v.State === 'available')
        .map(v => ({
            volumeId: v.VolumeId,
            size: v.Size,
            region: account.region,
            potentialSavings: (v.Size || 0) * 0.1, // Approximate cost per GB
        })) || [];


    // 4. Store the results in DynamoDB
    const analysisResult = {
      unattachedVolumes,
    }

    const analysisFinishTime = new Date().toISOString();
    await dynamo.send(new UpdateCommand({
        TableName: ANALYSES_TABLE,
        Key: { analysisId },
        UpdateExpression: 'set #status = :status, #result = :result, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#result': 'result',
            '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
            ':status': 'completed',
            ':result': analysisResult,
            ':updatedAt': analysisFinishTime,
        },
    }));


    return createSuccessResponse({
      message: 'Analysis completed successfully',
      analysisId,
      result: analysisResult,
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return createErrorResponse(500, 'Internal server error')
  }
} 