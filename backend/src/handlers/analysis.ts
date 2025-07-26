import { APIGatewayProxyResult, Context } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { EC2Client, DescribeVolumesCommand, DescribeInstancesCommand, DescribeAddressesCommand, Instance } from '@aws-sdk/client-ec2'
import { CloudWatchClient, GetMetricDataCommand, GetMetricStatisticsCommand, ListMetricsCommand } from '@aws-sdk/client-cloudwatch'
import { S3Client, ListBucketsCommand, ListObjectsV2Command, GetBucketLocationCommand, GetBucketLifecycleConfigurationCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeTargetHealthCommand, DescribeTargetGroupsCommand } from '@aws-sdk/client-elastic-load-balancing-v2'
import { ElasticLoadBalancingClient, DescribeLoadBalancersCommand as DescribeClassicLoadBalancersCommand } from '@aws-sdk/client-elastic-load-balancing'
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

// EC2 Instance types and pricing information
const EC2_INSTANCE_TYPES = {
  // General Purpose
  't3.nano': { vcpu: 2, memory: 0.5, architecture: 'x86_64', hourlyPrice: 0.0052, family: 't3' },
  't3.micro': { vcpu: 2, memory: 1, architecture: 'x86_64', hourlyPrice: 0.0104, family: 't3' },
  't3.small': { vcpu: 2, memory: 2, architecture: 'x86_64', hourlyPrice: 0.0208, family: 't3' },
  't3.medium': { vcpu: 2, memory: 4, architecture: 'x86_64', hourlyPrice: 0.0416, family: 't3' },
  't3.large': { vcpu: 2, memory: 8, architecture: 'x86_64', hourlyPrice: 0.0832, family: 't3' },
  't3.xlarge': { vcpu: 4, memory: 16, architecture: 'x86_64', hourlyPrice: 0.1664, family: 't3' },
  't3.2xlarge': { vcpu: 8, memory: 32, architecture: 'x86_64', hourlyPrice: 0.3328, family: 't3' },
  
  // Graviton instances (ARM-based)
  't4g.nano': { vcpu: 2, memory: 0.5, architecture: 'arm64', hourlyPrice: 0.0042, family: 't4g' },
  't4g.micro': { vcpu: 2, memory: 1, architecture: 'arm64', hourlyPrice: 0.0084, family: 't4g' },
  't4g.small': { vcpu: 2, memory: 2, architecture: 'arm64', hourlyPrice: 0.0168, family: 't4g' },
  't4g.medium': { vcpu: 2, memory: 4, architecture: 'arm64', hourlyPrice: 0.0336, family: 't4g' },
  't4g.large': { vcpu: 2, memory: 8, architecture: 'arm64', hourlyPrice: 0.0672, family: 't4g' },
  't4g.xlarge': { vcpu: 4, memory: 16, architecture: 'arm64', hourlyPrice: 0.1344, family: 't4g' },
  't4g.2xlarge': { vcpu: 8, memory: 32, architecture: 'arm64', hourlyPrice: 0.2688, family: 't4g' },
  
  // Memory optimized
  'm5.large': { vcpu: 2, memory: 8, architecture: 'x86_64', hourlyPrice: 0.096, family: 'm5' },
  'm5.xlarge': { vcpu: 4, memory: 16, architecture: 'x86_64', hourlyPrice: 0.192, family: 'm5' },
  'm5.2xlarge': { vcpu: 8, memory: 32, architecture: 'x86_64', hourlyPrice: 0.384, family: 'm5' },
  
  // Graviton memory optimized
  'm6g.large': { vcpu: 2, memory: 8, architecture: 'arm64', hourlyPrice: 0.077, family: 'm6g' },
  'm6g.xlarge': { vcpu: 4, memory: 16, architecture: 'arm64', hourlyPrice: 0.154, family: 'm6g' },
  'm6g.2xlarge': { vcpu: 8, memory: 32, architecture: 'arm64', hourlyPrice: 0.308, family: 'm6g' },
  
  // Compute optimized
  'c5.large': { vcpu: 2, memory: 4, architecture: 'x86_64', hourlyPrice: 0.085, family: 'c5' },
  'c5.xlarge': { vcpu: 4, memory: 8, architecture: 'x86_64', hourlyPrice: 0.17, family: 'c5' },
  'c5.2xlarge': { vcpu: 8, memory: 16, architecture: 'x86_64', hourlyPrice: 0.34, family: 'c5' },
  
  // Graviton compute optimized
  'c6g.large': { vcpu: 2, memory: 4, architecture: 'arm64', hourlyPrice: 0.068, family: 'c6g' },
  'c6g.xlarge': { vcpu: 4, memory: 8, architecture: 'arm64', hourlyPrice: 0.136, family: 'c6g' },
  'c6g.2xlarge': { vcpu: 8, memory: 16, architecture: 'arm64', hourlyPrice: 0.272, family: 'c6g' },
} as const

type InstanceTypeKey = keyof typeof EC2_INSTANCE_TYPES

interface EC2Metrics {
  cpuUtilization: number[]
  memoryUtilization: number[]
  networkIn: number[]
  networkOut: number[]
  hasCloudWatchAgent: boolean
  dataPointsCount: number
}

interface EC2Recommendation {
  instanceId: string
  currentInstanceType: string
  recommendedInstanceType: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  potentialSavings: {
    monthly: number
    annual: number
    percentage: number
  }
  performanceImpact: 'none' | 'minimal' | 'moderate' | 'significant'
  gravitonWarning?: string
  workloadPattern: 'steady' | 'peaky' | 'dev-test' | 'unknown'
}

interface S3BucketAnalysis {
  bucketName: string
  region: string
  totalSize: number
  objectCount: number
  hasLifecyclePolicy: boolean
  storageClassBreakdown: {
    standard: { size: number; cost: number }
    ia: { size: number; cost: number }
    glacier: { size: number; cost: number }
  }
  recommendations: S3Recommendation[]
  potentialSavings: {
    monthly: number
    annual: number
  }
}

interface S3Recommendation {
  type: 'lifecycle-policy' | 'storage-class-optimization'
  description: string
  potentialSavings: {
    monthly: number
    annual: number
  }
  effort: 'low' | 'medium' | 'high'
  details: string
}

interface UnusedElasticIP {
  allocationId: string
  publicIp: string
  associatedInstanceId?: string
  monthlyCost: number
}

interface LoadBalancerAnalysis {
  loadBalancerArn: string
  loadBalancerName: string
  type: 'application' | 'network' | 'classic'
  scheme: 'internet-facing' | 'internal'
  state: string
  createdTime?: Date
  targetGroups: {
    targetGroupArn?: string
    targetGroupName?: string
    healthyTargets: number
    unhealthyTargets: number
    totalTargets: number
  }[]
  metrics: {
    requestCount: number
    activeConnectionCount: number
    targetResponseTime?: number
    dataPointsAnalyzed: number
  }
  recommendation: 'keep' | 'review' | 'consider-removal'
  reasoning: string
  monthlyCost: number
  potentialSavings: number
  confidenceLevel: 'high' | 'medium' | 'low'
}

// Analyze EC2 instances for rightsizing recommendations
async function analyzeEC2Instances(
  instances: Instance[],
  cloudWatchClient: CloudWatchClient,
  region: string
): Promise<EC2Recommendation[]> {
  const recommendations: EC2Recommendation[] = []
  
  console.log(`Starting EC2 rightsizing analysis for ${instances.length} instances`)
  
  for (const instance of instances) {
    if (!instance.InstanceId || !instance.InstanceType) {
      continue
    }
    
    try {
      console.log(`Analyzing instance ${instance.InstanceId} (${instance.InstanceType})`)
      
      // Get 90-day metrics for this instance
      const metrics = await getInstanceMetrics(cloudWatchClient, instance.InstanceId, region)
      const recommendation = await generateRecommendation(instance, metrics)
      
      if (recommendation) {
        recommendations.push(recommendation)
      }
    } catch (error) {
      console.error(`Error analyzing instance ${instance.InstanceId}:`, error)
    }
  }
  
  console.log(`Generated ${recommendations.length} EC2 rightsizing recommendations`)
  return recommendations
}

// Get CloudWatch metrics for an instance over the past 90 days
async function getInstanceMetrics(
  cloudWatchClient: CloudWatchClient,
  instanceId: string,
  region: string
): Promise<EC2Metrics> {
  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - (90 * 24 * 60 * 60 * 1000)) // 90 days ago
  
  console.log(`Fetching metrics for ${instanceId} from ${startTime.toISOString()} to ${endTime.toISOString()}`)
  
  try {
    // Check if CloudWatch agent is installed by looking for memory metrics
    const memoryMetrics = await cloudWatchClient.send(new ListMetricsCommand({
      Namespace: 'CWAgent',
      Dimensions: [
        {
          Name: 'InstanceId',
          Value: instanceId
        }
      ],
      MetricName: 'mem_used_percent'
    }))
    
    const hasCloudWatchAgent = (memoryMetrics.Metrics?.length || 0) > 0
    console.log(`CloudWatch agent detected for ${instanceId}: ${hasCloudWatchAgent}`)
    
    // Get CPU utilization metrics
    const cpuMetrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
      Namespace: 'AWS/EC2',
      MetricName: 'CPUUtilization',
      Dimensions: [
        {
          Name: 'InstanceId',
          Value: instanceId
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600, // 1 hour periods
      Statistics: ['Average']
    }))
    
    const cpuUtilization = cpuMetrics.Datapoints?.map(dp => dp.Average || 0) || []
    
    // Get memory metrics if CloudWatch agent is available
    let memoryUtilization: number[] = []
    if (hasCloudWatchAgent) {
      const memoryMetricsData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
        Namespace: 'CWAgent',
        MetricName: 'mem_used_percent',
        Dimensions: [
          {
            Name: 'InstanceId',
            Value: instanceId
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Average']
      }))
      
      memoryUtilization = memoryMetricsData.Datapoints?.map(dp => dp.Average || 0) || []
    }
    
    // Get network metrics
    const networkInMetrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
      Namespace: 'AWS/EC2',
      MetricName: 'NetworkIn',
      Dimensions: [
        {
          Name: 'InstanceId',
          Value: instanceId
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600,
      Statistics: ['Average']
    }))
    
    const networkOutMetrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
      Namespace: 'AWS/EC2',
      MetricName: 'NetworkOut',
      Dimensions: [
        {
          Name: 'InstanceId',
          Value: instanceId
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600,
      Statistics: ['Average']
    }))
    
    const networkIn = networkInMetrics.Datapoints?.map(dp => dp.Average || 0) || []
    const networkOut = networkOutMetrics.Datapoints?.map(dp => dp.Average || 0) || []
    
    console.log(`Collected metrics for ${instanceId}: ${cpuUtilization.length} CPU, ${memoryUtilization.length} memory, ${networkIn.length} network data points`)
    
    return {
      cpuUtilization,
      memoryUtilization,
      networkIn,
      networkOut,
      hasCloudWatchAgent,
      dataPointsCount: cpuUtilization.length
    }
  } catch (error) {
    console.error(`Error fetching metrics for ${instanceId}:`, error)
    return {
      cpuUtilization: [],
      memoryUtilization: [],
      networkIn: [],
      networkOut: [],
      hasCloudWatchAgent: false,
      dataPointsCount: 0
    }
  }
}

// Generate rightsizing recommendation based on metrics
async function generateRecommendation(
  instance: Instance,
  metrics: EC2Metrics
): Promise<EC2Recommendation | null> {
  const { InstanceId, InstanceType, Platform } = instance
  
  if (!InstanceId || !InstanceType) {
    return null
  }
  
  // Calculate average utilization
  const avgCpuUtilization = metrics.cpuUtilization.length > 0 
    ? metrics.cpuUtilization.reduce((a, b) => a + b, 0) / metrics.cpuUtilization.length 
    : 0
    
  const maxCpuUtilization = metrics.cpuUtilization.length > 0
    ? Math.max(...metrics.cpuUtilization)
    : 0
    
  const avgMemoryUtilization = metrics.memoryUtilization.length > 0 
    ? metrics.memoryUtilization.reduce((a, b) => a + b, 0) / metrics.memoryUtilization.length 
    : 0
  
  console.log(`Instance ${InstanceId}: Avg CPU ${avgCpuUtilization.toFixed(1)}%, Max CPU ${maxCpuUtilization.toFixed(1)}%, Avg Memory ${avgMemoryUtilization.toFixed(1)}%`)
  
  // Determine workload pattern
  const workloadPattern = determineWorkloadPattern(metrics.cpuUtilization, metrics.memoryUtilization)
  
  // Get current instance specs
  const currentSpecs = EC2_INSTANCE_TYPES[InstanceType as InstanceTypeKey]
  if (!currentSpecs) {
    console.log(`Unknown instance type: ${InstanceType}`)
    return null
  }
  
  // Determine confidence level based on data availability
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (metrics.dataPointsCount >= 1440) { // 60+ days of hourly data
    confidence = 'high'
  } else if (metrics.dataPointsCount >= 480) { // 20+ days of hourly data
    confidence = 'medium'
  }
  
  // Reduce confidence if no memory metrics
  if (!metrics.hasCloudWatchAgent && confidence === 'high') {
    confidence = 'medium'
  }
  
  // Generate recommendation
  const recommendedType = findOptimalInstanceType(avgCpuUtilization, maxCpuUtilization, avgMemoryUtilization, currentSpecs, Platform)
  
  if (!recommendedType || recommendedType === InstanceType) {
    return null // No change needed
  }
  
  const recommendedSpecs = EC2_INSTANCE_TYPES[recommendedType as InstanceTypeKey]
  const currentMonthlyCost = currentSpecs.hourlyPrice * 24 * 30
  const recommendedMonthlyCost = recommendedSpecs.hourlyPrice * 24 * 30
  const monthlySavings = currentMonthlyCost - recommendedMonthlyCost
  const savingsPercentage = (monthlySavings / currentMonthlyCost) * 100
  
  // Check for Graviton architecture change
  const isGravitonMigration = currentSpecs.architecture === 'x86_64' && recommendedSpecs.architecture === 'arm64'
  let gravitonWarning: string | undefined
  
  if (isGravitonMigration) {
    gravitonWarning = 'This recommendation involves migrating from Intel (x86_64) to Graviton (ARM64) architecture. While Graviton instances offer significant cost savings, this migration may require application compatibility testing and could potentially cause instability. Please thoroughly test your workloads before implementing this change.'
    // Reduce confidence for Graviton migrations
    if (confidence === 'high') confidence = 'medium'
    if (confidence === 'medium') confidence = 'low'
  }
  
  // Generate reasoning
  let reasoning = `Based on ${metrics.dataPointsCount} hours of metrics data: `
  if (avgCpuUtilization < 20) {
    reasoning += `Low average CPU utilization (${avgCpuUtilization.toFixed(1)}%). `
  }
  if (maxCpuUtilization < 50) {
    reasoning += `Peak CPU usage below 50% (${maxCpuUtilization.toFixed(1)}%). `
  }
  if (metrics.hasCloudWatchAgent && avgMemoryUtilization < 50) {
    reasoning += `Low memory utilization (${avgMemoryUtilization.toFixed(1)}%). `
  }
  if (!metrics.hasCloudWatchAgent) {
    reasoning += `Memory metrics unavailable (CloudWatch agent not detected). `
  }
  reasoning += `Workload pattern: ${workloadPattern}.`
  
  // Determine performance impact
  let performanceImpact: 'none' | 'minimal' | 'moderate' | 'significant' = 'none'
  if (recommendedSpecs.vcpu < currentSpecs.vcpu || recommendedSpecs.memory < currentSpecs.memory) {
    if (isGravitonMigration) {
      performanceImpact = 'moderate'
    } else if (avgCpuUtilization > 50 || avgMemoryUtilization > 60) {
      performanceImpact = 'moderate'
    } else {
      performanceImpact = 'minimal'
    }
  }
  
  return {
    instanceId: InstanceId,
    currentInstanceType: InstanceType,
    recommendedInstanceType: recommendedType,
    confidence,
    reasoning,
    potentialSavings: {
      monthly: Math.round(monthlySavings * 100) / 100,
      annual: Math.round(monthlySavings * 12 * 100) / 100,
      percentage: Math.round(savingsPercentage * 100) / 100
    },
    performanceImpact,
    gravitonWarning,
    workloadPattern
  }
}

// Determine workload pattern based on CPU and memory metrics
function determineWorkloadPattern(cpuMetrics: number[], memoryMetrics: number[]): 'steady' | 'peaky' | 'dev-test' | 'unknown' {
  if (cpuMetrics.length === 0) {
    return 'unknown'
  }
  
  const avgCpu = cpuMetrics.reduce((a, b) => a + b, 0) / cpuMetrics.length
  const maxCpu = Math.max(...cpuMetrics)
  const minCpu = Math.min(...cpuMetrics)
  
  // Calculate coefficient of variation (standard deviation / mean)
  const cpuStdDev = Math.sqrt(cpuMetrics.reduce((sum, val) => sum + Math.pow(val - avgCpu, 2), 0) / cpuMetrics.length)
  const cpuVariation = cpuStdDev / avgCpu
  
  // Check for periods of very low usage (potential dev/test)
  const lowUsagePeriods = cpuMetrics.filter(cpu => cpu < 5).length
  const lowUsagePercentage = lowUsagePeriods / cpuMetrics.length
  
  if (lowUsagePercentage > 0.7) {
    return 'dev-test'
  } else if (cpuVariation > 1.0 || (maxCpu - minCpu) > 50) {
    return 'peaky'
  } else if (cpuVariation < 0.5 && avgCpu > 10) {
    return 'steady'
  }
  
  return 'unknown'
}

// Find optimal instance type based on utilization metrics
function findOptimalInstanceType(
  avgCpuUtilization: number,
  maxCpuUtilization: number,
  avgMemoryUtilization: number,
  currentSpecs: typeof EC2_INSTANCE_TYPES[InstanceTypeKey],
  platform?: string
): string | null {
  // Target utilization thresholds
  const targetCpuUtilization = 70 // Target 70% average CPU
  const targetMemoryUtilization = 80 // Target 80% average memory
  
  // If already well-utilized, don't recommend downsizing
  if (avgCpuUtilization > 50 && maxCpuUtilization > 80) {
    return null
  }
  
  // Calculate required resources based on current usage
  const requiredCpuRatio = Math.max(avgCpuUtilization / targetCpuUtilization, maxCpuUtilization / 90) // Allow some headroom for peaks
  const requiredMemoryRatio = avgMemoryUtilization > 0 ? avgMemoryUtilization / targetMemoryUtilization : 0
  
  const requiredVcpu = Math.ceil(currentSpecs.vcpu * requiredCpuRatio)
  const requiredMemory = avgMemoryUtilization > 0 ? currentSpecs.memory * requiredMemoryRatio : currentSpecs.memory * 0.5 // Conservative estimate if no memory data
  
  console.log(`Required resources: ${requiredVcpu} vCPU, ${requiredMemory.toFixed(1)} GB memory`)
  
  // Find suitable instance types
  const suitableTypes: Array<{ type: string; specs: typeof EC2_INSTANCE_TYPES[InstanceTypeKey]; score: number }> = []
  
  for (const [instanceType, specs] of Object.entries(EC2_INSTANCE_TYPES)) {
    // Skip if doesn't meet minimum requirements
    if (specs.vcpu < requiredVcpu || specs.memory < requiredMemory) {
      continue
    }
    
    // Skip if it's the same or more expensive than current
    if (specs.hourlyPrice >= currentSpecs.hourlyPrice) {
      continue
    }
    
    // Calculate efficiency score (lower is better)
    const cpuOverProvision = specs.vcpu / requiredVcpu
    const memoryOverProvision = specs.memory / requiredMemory
    const overProvisionPenalty = (cpuOverProvision - 1) + (memoryOverProvision - 1)
    
    // Prefer instances that aren't massively over-provisioned
    if (overProvisionPenalty > 2) {
      continue
    }
    
    const score = specs.hourlyPrice + (overProvisionPenalty * 0.01)
    suitableTypes.push({ type: instanceType, specs, score })
  }
  
  // Sort by score (price + over-provisioning penalty)
  suitableTypes.sort((a, b) => a.score - b.score)
  
  // Return the most cost-effective option
  return suitableTypes.length > 0 ? suitableTypes[0].type : null
}

// S3 storage pricing (USD per GB per month)
const S3_PRICING = {
  standard: 0.023,
  ia: 0.0125,        // Standard-IA
  glacier: 0.004,    // Glacier Instant Retrieval
  deepArchive: 0.00099  // Glacier Deep Archive
}

// Analyze S3 buckets for storage optimization opportunities
async function analyzeS3Storage(s3Client: S3Client, region: string): Promise<S3BucketAnalysis[]> {
  const bucketAnalyses: S3BucketAnalysis[] = []
  
  try {
    // List all buckets
    const { Buckets } = await s3Client.send(new ListBucketsCommand({}))
    console.log(`Found ${Buckets?.length || 0} S3 buckets`)
    
    for (const bucket of Buckets || []) {
      if (!bucket.Name) continue
      
      // Skip Cost Optimizer's own infrastructure buckets
      if (bucket.Name.includes('aws-cost-optimizer') || 
          bucket.Name.includes('cost-optimizer') ||
          bucket.Name.includes('cloudformation-templates')) {
        console.log(`Skipping infrastructure bucket: ${bucket.Name}`)
        continue
      }
      
      try {
        console.log(`Analyzing S3 bucket: ${bucket.Name}`)
        
        // Get bucket location
        let bucketRegion = region
        try {
          const { LocationConstraint } = await s3Client.send(new GetBucketLocationCommand({
            Bucket: bucket.Name
          }))
          bucketRegion = LocationConstraint || 'us-east-1'
        } catch (error) {
          console.log(`Could not get location for bucket ${bucket.Name}, using default region`)
        }
        
        // Check for existing lifecycle policy
        let hasLifecyclePolicy = false
        try {
          await s3Client.send(new GetBucketLifecycleConfigurationCommand({
            Bucket: bucket.Name
          }))
          hasLifecyclePolicy = true
        } catch (error) {
          // No lifecycle policy exists
        }
        
        // Analyze objects in bucket (sample first 1000 objects)
        const objectAnalysis = await analyzeBucketObjects(s3Client, bucket.Name)
        
        const bucketAnalysis: S3BucketAnalysis = {
          bucketName: bucket.Name,
          region: bucketRegion,
          totalSize: objectAnalysis.totalSize,
          objectCount: objectAnalysis.objectCount,
          hasLifecyclePolicy,
          storageClassBreakdown: objectAnalysis.storageClassBreakdown,
          recommendations: generateS3Recommendations(objectAnalysis, hasLifecyclePolicy),
          potentialSavings: {
            monthly: 0,
            annual: 0
          }
        }
        
        // Calculate potential savings
        const savings = calculateS3Savings(bucketAnalysis)
        bucketAnalysis.potentialSavings = savings
        
        bucketAnalyses.push(bucketAnalysis)
        
      } catch (error) {
        console.error(`Error analyzing bucket ${bucket.Name}:`, error)
      }
    }
    
  } catch (error) {
    console.error('Error listing S3 buckets:', error)
  }
  
  console.log(`Completed S3 analysis for ${bucketAnalyses.length} buckets`)
  return bucketAnalyses
}

// Analyze objects in a bucket to understand storage patterns
async function analyzeBucketObjects(s3Client: S3Client, bucketName: string) {
  const analysis = {
    totalSize: 0,
    objectCount: 0,
    storageClassBreakdown: {
      standard: { size: 0, cost: 0 },
      ia: { size: 0, cost: 0 },
      glacier: { size: 0, cost: 0 }
    },
    objectAgeDistribution: {
      recent: 0,      // < 30 days
      medium: 0,      // 30-90 days  
      old: 0,         // 90+ days
    }
  }
  
  try {
    let continuationToken: string | undefined
    let objectsAnalyzed = 0
    const maxObjects = 1000 // Limit analysis to prevent timeouts
    
    do {
      const { Contents, NextContinuationToken } = await s3Client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: Math.min(1000, maxObjects - objectsAnalyzed),
        ContinuationToken: continuationToken
      }))
      
      if (!Contents) break
      
      for (const obj of Contents) {
        if (!obj.Key || !obj.Size) continue
        
        objectsAnalyzed++
        analysis.objectCount++
        analysis.totalSize += obj.Size
        
        // Determine storage class
        const storageClass = obj.StorageClass || 'STANDARD'
        const sizeInGB = obj.Size / (1024 * 1024 * 1024)
        
        if (storageClass === 'STANDARD') {
          analysis.storageClassBreakdown.standard.size += sizeInGB
          analysis.storageClassBreakdown.standard.cost += sizeInGB * S3_PRICING.standard
        } else if (storageClass.includes('IA')) {
          analysis.storageClassBreakdown.ia.size += sizeInGB
          analysis.storageClassBreakdown.ia.cost += sizeInGB * S3_PRICING.ia
        } else if (storageClass.includes('GLACIER')) {
          analysis.storageClassBreakdown.glacier.size += sizeInGB
          analysis.storageClassBreakdown.glacier.cost += sizeInGB * S3_PRICING.glacier
        }
        
        // Analyze object age
        if (obj.LastModified) {
          const ageInDays = (Date.now() - obj.LastModified.getTime()) / (1000 * 60 * 60 * 24)
          if (ageInDays < 30) {
            analysis.objectAgeDistribution.recent++
          } else if (ageInDays < 90) {
            analysis.objectAgeDistribution.medium++
          } else {
            analysis.objectAgeDistribution.old++
          }
        }
      }
      
      continuationToken = NextContinuationToken
    } while (continuationToken && objectsAnalyzed < maxObjects)
    
    console.log(`Analyzed ${objectsAnalyzed} objects in bucket ${bucketName}`)
    
  } catch (error) {
    console.error(`Error analyzing objects in bucket ${bucketName}:`, error)
  }
  
  return analysis
}

// Generate S3 optimization recommendations
function generateS3Recommendations(
  objectAnalysis: any,
  hasLifecyclePolicy: boolean
): S3Recommendation[] {
  const recommendations: S3Recommendation[] = []
  
  // Check if lifecycle policy would be beneficial
  if (!hasLifecyclePolicy && objectAnalysis.objectAgeDistribution.old > 0) {
    const oldObjectsPercent = (objectAnalysis.objectAgeDistribution.old / objectAnalysis.objectCount) * 100
    
    if (oldObjectsPercent > 20) {
      recommendations.push({
        type: 'lifecycle-policy',
        description: `Implement lifecycle policy to automatically transition objects older than 90 days`,
        potentialSavings: {
          monthly: 0, // Will be calculated
          annual: 0
        },
        effort: 'low',
        details: `${oldObjectsPercent.toFixed(1)}% of objects are older than 90 days and could benefit from automatic transitions to IA or Glacier storage classes.`
      })
    }
  }
  
  // Check for Standard storage that could be moved to IA
  if (objectAnalysis.storageClassBreakdown.standard.size > 1) { // More than 1GB in Standard
    const potentialIATransition = objectAnalysis.storageClassBreakdown.standard.size * 0.3 // Assume 30% could move to IA
    const monthlySavings = potentialIATransition * (S3_PRICING.standard - S3_PRICING.ia)
    
    if (monthlySavings > 1) { // More than $1/month savings
      recommendations.push({
        type: 'storage-class-optimization',
        description: `Transition infrequently accessed objects to Standard-IA storage class`,
        potentialSavings: {
          monthly: monthlySavings,
          annual: monthlySavings * 12
        },
        effort: 'medium',
        details: `Approximately ${potentialIATransition.toFixed(1)} GB could be moved to Standard-IA, saving ${(S3_PRICING.standard - S3_PRICING.ia).toFixed(4)} per GB per month.`
      })
    }
  }
  
  return recommendations
}

// Calculate total potential savings for S3 bucket
function calculateS3Savings(bucketAnalysis: S3BucketAnalysis): { monthly: number; annual: number } {
  const totalMonthlySavings = bucketAnalysis.recommendations.reduce(
    (sum, rec) => sum + rec.potentialSavings.monthly, 0
  )
  
  return {
    monthly: Math.round(totalMonthlySavings * 100) / 100,
    annual: Math.round(totalMonthlySavings * 12 * 100) / 100
  }
}

// Analyze unused Elastic IPs
async function analyzeUnusedElasticIPs(ec2Client: EC2Client): Promise<UnusedElasticIP[]> {
  const unusedIPs: UnusedElasticIP[] = []
  
  try {
    const { Addresses } = await ec2Client.send(new DescribeAddressesCommand({}))
    
    console.log(`Found ${Addresses?.length || 0} Elastic IP addresses`)
    
    for (const address of Addresses || []) {
      console.log(`Analyzing Elastic IP: ${address.PublicIp}`, {
        AllocationId: address.AllocationId,
        InstanceId: address.InstanceId,
        NetworkInterfaceId: address.NetworkInterfaceId,
        AssociationId: address.AssociationId,
        Domain: address.Domain,
        PrivateIpAddress: address.PrivateIpAddress
      })
      
      // An Elastic IP is considered unused if:
      // 1. Not associated with an EC2 instance (InstanceId is null/undefined)
      // 2. Not associated with a network interface (NetworkInterfaceId is null/undefined)
      // 3. No association ID (AssociationId is null/undefined)
      const isUnused = !address.InstanceId && 
                      !address.NetworkInterfaceId && 
                      !address.AssociationId
      
      if (isUnused) {
        console.log(`Found unused Elastic IP: ${address.PublicIp}`)
        unusedIPs.push({
          allocationId: address.AllocationId || '',
          publicIp: address.PublicIp || '',
          monthlyCost: 3.65 // $0.005 per hour * 24 hours * 30.44 days = $3.65/month
        })
      } else {
        console.log(`Elastic IP ${address.PublicIp} is in use:`, {
          hasInstance: !!address.InstanceId,
          hasNetworkInterface: !!address.NetworkInterfaceId,
          hasAssociation: !!address.AssociationId
        })
      }
    }
    
    console.log(`Found ${unusedIPs.length} unused Elastic IP addresses out of ${Addresses?.length || 0} total IPs`)
    
  } catch (error) {
    console.error('Error analyzing Elastic IPs:', error)
  }
  
  return unusedIPs
}

// Load balancer pricing (USD per hour)
const LOAD_BALANCER_PRICING = {
  application: 0.0225,    // ALB: $0.0225 per hour
  network: 0.0225,       // NLB: $0.0225 per hour  
  classic: 0.025         // Classic: $0.025 per hour
}

// Analyze load balancers for idle/unused resources
async function analyzeLoadBalancers(
  elbv2Client: ElasticLoadBalancingV2Client,
  elbClassicClient: ElasticLoadBalancingClient,
  cloudWatchClient: CloudWatchClient,
  region: string
): Promise<LoadBalancerAnalysis[]> {
  const analyses: LoadBalancerAnalysis[] = []
  
  try {
    // Analyze ALB and NLB (v2)
    const { LoadBalancers: v2LoadBalancers } = await elbv2Client.send(new DescribeLoadBalancersCommand({}))
    console.log(`Found ${v2LoadBalancers?.length || 0} ALB/NLB load balancers`)
    
    for (const lb of v2LoadBalancers || []) {
      if (!lb.LoadBalancerArn || !lb.LoadBalancerName) continue
      
      try {
        console.log(`Analyzing load balancer: ${lb.LoadBalancerName}`)
        
        // Get target groups for this load balancer
        const { TargetGroups } = await elbv2Client.send(new DescribeTargetGroupsCommand({
          LoadBalancerArn: lb.LoadBalancerArn
        }))
        
        const targetGroupsAnalysis = []
        for (const tg of TargetGroups || []) {
          if (!tg.TargetGroupArn) continue
          
          // Get target health
          const { TargetHealthDescriptions } = await elbv2Client.send(new DescribeTargetHealthCommand({
            TargetGroupArn: tg.TargetGroupArn
          }))
          
          const healthyTargets = TargetHealthDescriptions?.filter((t: any) => t.TargetHealth?.State === 'healthy').length || 0
          const unhealthyTargets = TargetHealthDescriptions?.filter((t: any) => t.TargetHealth?.State === 'unhealthy').length || 0
          const totalTargets = TargetHealthDescriptions?.length || 0
          
          targetGroupsAnalysis.push({
            targetGroupArn: tg.TargetGroupArn,
            targetGroupName: tg.TargetGroupName,
            healthyTargets,
            unhealthyTargets,
            totalTargets
          })
        }
        
        // Get CloudWatch metrics for the load balancer
        const metrics = await getLoadBalancerMetrics(cloudWatchClient, lb.LoadBalancerArn, lb.Type as 'application' | 'network')
        
        // Generate recommendation
        const analysis = generateLoadBalancerRecommendation(lb, targetGroupsAnalysis, metrics)
        analyses.push(analysis)
        
      } catch (error) {
        console.error(`Error analyzing load balancer ${lb.LoadBalancerName}:`, error)
      }
    }
    
    // Analyze Classic Load Balancers
    const { LoadBalancerDescriptions: classicLoadBalancers } = await elbClassicClient.send(new DescribeClassicLoadBalancersCommand({}))
    console.log(`Found ${classicLoadBalancers?.length || 0} Classic load balancers`)
    
    for (const clb of classicLoadBalancers || []) {
      if (!clb.LoadBalancerName) continue
      
      try {
        console.log(`Analyzing Classic load balancer: ${clb.LoadBalancerName}`)
        
        // Classic LBs don't have target groups, use instances
        const targetGroupsAnalysis = [{
          healthyTargets: clb.Instances?.length || 0,
          unhealthyTargets: 0,
          totalTargets: clb.Instances?.length || 0
        }]
        
        // Get CloudWatch metrics for classic load balancer
        const metrics = await getClassicLoadBalancerMetrics(cloudWatchClient, clb.LoadBalancerName)
        
        // Generate recommendation
        const analysis = generateClassicLoadBalancerRecommendation(clb, targetGroupsAnalysis, metrics)
        analyses.push(analysis)
        
      } catch (error) {
        console.error(`Error analyzing Classic load balancer ${clb.LoadBalancerName}:`, error)
      }
    }
    
  } catch (error) {
    console.error('Error analyzing load balancers:', error)
  }
  
  console.log(`Completed load balancer analysis for ${analyses.length} load balancers`)
  return analyses
}

// Get CloudWatch metrics for ALB/NLB
async function getLoadBalancerMetrics(
  cloudWatchClient: CloudWatchClient,
  loadBalancerArn: string,
  type: 'application' | 'network'
): Promise<{ requestCount: number; activeConnectionCount: number; targetResponseTime?: number; dataPointsAnalyzed: number }> {
  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - (7 * 24 * 60 * 60 * 1000)) // 7 days ago
  
  // Extract load balancer name from ARN for CloudWatch
  const lbName = loadBalancerArn.split('/').slice(-3).join('/')
  
  try {
    const namespace = type === 'application' ? 'AWS/ApplicationELB' : 'AWS/NetworkELB'
    
    // Get request count or processed bytes
    const primaryMetric = type === 'application' ? 'RequestCount' : 'ProcessedBytes'
    const requestMetrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: primaryMetric,
      Dimensions: [
        {
          Name: 'LoadBalancer',
          Value: lbName
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600, // 1 hour periods
      Statistics: ['Sum']
    }))
    
    const requestCount = requestMetrics.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0
    
    // Get active connection count
    const connectionMetrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: type === 'application' ? 'ActiveConnectionCount' : 'ActiveFlowCount',
      Dimensions: [
        {
          Name: 'LoadBalancer',
          Value: lbName
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600,
      Statistics: ['Average']
    }))
    
    const activeConnectionCount = connectionMetrics.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0
    
    // Get target response time for ALB
    let targetResponseTime: number | undefined
    if (type === 'application') {
      const responseTimeMetrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/ApplicationELB',
        MetricName: 'TargetResponseTime',
        Dimensions: [
          {
            Name: 'LoadBalancer',
            Value: lbName
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Average']
      }))
      
      targetResponseTime = responseTimeMetrics.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0
    }
    
    return {
      requestCount,
      activeConnectionCount,
      targetResponseTime,
      dataPointsAnalyzed: requestMetrics.Datapoints?.length || 0
    }
    
  } catch (error) {
    console.error(`Error fetching metrics for load balancer ${lbName}:`, error)
    return {
      requestCount: 0,
      activeConnectionCount: 0,
      dataPointsAnalyzed: 0
    }
  }
}

// Get CloudWatch metrics for Classic Load Balancer
async function getClassicLoadBalancerMetrics(
  cloudWatchClient: CloudWatchClient,
  loadBalancerName: string
): Promise<{ requestCount: number; activeConnectionCount: number; dataPointsAnalyzed: number }> {
  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - (7 * 24 * 60 * 60 * 1000)) // 7 days ago
  
  try {
    // Get request count
    const requestMetrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
      Namespace: 'AWS/ELB',
      MetricName: 'RequestCount',
      Dimensions: [
        {
          Name: 'LoadBalancerName',
          Value: loadBalancerName
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600,
      Statistics: ['Sum']
    }))
    
    const requestCount = requestMetrics.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0
    
    return {
      requestCount,
      activeConnectionCount: 0, // Classic ELB doesn't have this metric
      dataPointsAnalyzed: requestMetrics.Datapoints?.length || 0
    }
    
  } catch (error) {
    console.error(`Error fetching metrics for Classic load balancer ${loadBalancerName}:`, error)
    return {
      requestCount: 0,
      activeConnectionCount: 0,
      dataPointsAnalyzed: 0
    }
  }
}

// Generate recommendation for ALB/NLB
function generateLoadBalancerRecommendation(
  loadBalancer: any,
  targetGroups: any[],
  metrics: any
): LoadBalancerAnalysis {
  const totalTargets = targetGroups.reduce((sum, tg) => sum + tg.totalTargets, 0)
  const healthyTargets = targetGroups.reduce((sum, tg) => sum + tg.healthyTargets, 0)
  
  const lbType = loadBalancer.Type as 'application' | 'network'
  const monthlyCost = LOAD_BALANCER_PRICING[lbType] * 24 * 30.44 // 30.44 days average per month
  
  let recommendation: 'keep' | 'review' | 'consider-removal' = 'keep'
  let reasoning = ''
  let potentialSavings = 0
  let confidenceLevel: 'high' | 'medium' | 'low' = 'medium'
  
  // Analysis logic
  if (totalTargets === 0) {
    recommendation = 'consider-removal'
    reasoning = `No targets configured. Load balancer has been running without any targets.`
    potentialSavings = monthlyCost
    confidenceLevel = 'high'
  } else if (healthyTargets === 0) {
    recommendation = 'review'
    reasoning = `All ${totalTargets} targets are unhealthy. Investigate if load balancer is needed.`
    potentialSavings = monthlyCost * 0.8 // Conservative estimate
    confidenceLevel = 'medium'
  } else if (metrics.requestCount === 0 && metrics.dataPointsAnalyzed > 24) { // At least 24 hours of data
    recommendation = 'consider-removal'
    reasoning = `No requests in the last 7 days despite having ${healthyTargets} healthy targets. May be unused.`
    potentialSavings = monthlyCost
    confidenceLevel = 'high'
  } else if (metrics.requestCount < 100 && metrics.dataPointsAnalyzed > 48) { // At least 48 hours of data
    recommendation = 'review'
    reasoning = `Very low traffic (${metrics.requestCount.toFixed(0)} requests in 7 days). Consider if load balancer is necessary.`
    potentialSavings = monthlyCost * 0.5
    confidenceLevel = 'medium'
  } else {
    reasoning = `Load balancer appears to be actively used with ${healthyTargets} healthy targets and ${metrics.requestCount.toFixed(0)} requests in 7 days.`
  }
  
  if (metrics.dataPointsAnalyzed < 24) {
    confidenceLevel = 'low'
    reasoning += ` Limited metrics data available (${metrics.dataPointsAnalyzed} hours).`
  }
  
  return {
    loadBalancerArn: loadBalancer.LoadBalancerArn,
    loadBalancerName: loadBalancer.LoadBalancerName,
    type: lbType,
    scheme: loadBalancer.Scheme,
    state: loadBalancer.State?.Code || 'unknown',
    createdTime: loadBalancer.CreatedTime,
    targetGroups,
    metrics,
    recommendation,
    reasoning,
    monthlyCost,
    potentialSavings,
    confidenceLevel
  }
}

// Generate recommendation for Classic Load Balancer
function generateClassicLoadBalancerRecommendation(
  loadBalancer: any,
  targetGroups: any[],
  metrics: any
): LoadBalancerAnalysis {
  const totalTargets = targetGroups[0]?.totalTargets || 0
  const healthyTargets = targetGroups[0]?.healthyTargets || 0
  
  const monthlyCost = LOAD_BALANCER_PRICING.classic * 24 * 30.44
  
  let recommendation: 'keep' | 'review' | 'consider-removal' = 'keep'
  let reasoning = ''
  let potentialSavings = 0
  let confidenceLevel: 'high' | 'medium' | 'low' = 'medium'
  
  if (totalTargets === 0) {
    recommendation = 'consider-removal'
    reasoning = `No instances registered. Classic load balancer appears unused.`
    potentialSavings = monthlyCost
    confidenceLevel = 'high'
  } else if (metrics.requestCount === 0 && metrics.dataPointsAnalyzed > 24) {
    recommendation = 'consider-removal'
    reasoning = `No requests in the last 7 days despite having ${healthyTargets} instances. Consider migration to ALB/NLB or removal.`
    potentialSavings = monthlyCost
    confidenceLevel = 'high'
  } else if (metrics.requestCount < 100 && metrics.dataPointsAnalyzed > 48) {
    recommendation = 'review'
    reasoning = `Very low traffic (${metrics.requestCount.toFixed(0)} requests in 7 days). Consider modernizing to ALB/NLB or removal.`
    potentialSavings = monthlyCost * 0.5
    confidenceLevel = 'medium'
  } else {
    reasoning = `Classic load balancer appears active with ${healthyTargets} instances and ${metrics.requestCount.toFixed(0)} requests in 7 days. Consider modernizing to ALB/NLB for better features and cost efficiency.`
  }
  
  if (metrics.dataPointsAnalyzed < 24) {
    confidenceLevel = 'low'
    reasoning += ` Limited metrics data available (${metrics.dataPointsAnalyzed} hours).`
  }
  
  return {
    loadBalancerArn: `arn:aws:elasticloadbalancing:${loadBalancer.AvailabilityZones?.[0]?.split('-').slice(0, -1).join('-') || 'unknown'}:classic-lb/${loadBalancer.LoadBalancerName}`,
    loadBalancerName: loadBalancer.LoadBalancerName,
    type: 'classic',
    scheme: loadBalancer.Scheme,
    state: 'active',
    createdTime: loadBalancer.CreatedTime,
    targetGroups,
    metrics,
    recommendation,
    reasoning,
    monthlyCost,
    potentialSavings,
    confidenceLevel
  }
}

// Fetch latest analysis results for an account
async function getLatestAnalysis(userId: string, accountId: string): Promise<any | null> {
  try {
    console.log(`Searching for latest analysis - userId: ${userId}, accountId: ${accountId}`)
    
    // For now, scan the table to find the latest analysis (we'll optimize with GSI later)
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb')
    
    const result = await dynamo.send(new ScanCommand({
      TableName: ANALYSES_TABLE,
      FilterExpression: 'userId = :userId AND accountId = :accountId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':accountId': accountId,
        ':status': 'completed'
      }
    }))

    console.log(`DynamoDB scan result: Found ${result.Items?.length || 0} items`)
    
    if (result.Items && result.Items.length > 0) {
      console.log('Sample item structure:', JSON.stringify(result.Items[0], null, 2))
      
      // Sort by updatedAt to get the most recent
      const sortedItems = result.Items.sort((a, b) => 
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      )
      
      const latestAnalysis = sortedItems[0]
      console.log(`Returning latest analysis: ${latestAnalysis.analysisId}`)
      
      return {
        analysisId: latestAnalysis.analysisId,
        result: latestAnalysis.result,
        createdAt: latestAnalysis.createdAt,
        updatedAt: latestAnalysis.updatedAt
      }
    }

    console.log('No completed analysis found for this user and account')
    return null
  } catch (error) {
    console.error('Error fetching latest analysis:', error)
    return null
  }
}

export const handler = async (
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Analysis handler started')
    console.log('HTTP Method:', event.httpMethod || event.requestContext?.http?.method)
    console.log('Request path:', event.path || event.rawPath || event.requestContext?.http?.path)
    console.log('Full event structure:', JSON.stringify(event, null, 2))
    
    // Authenticate user
    console.log('Starting authentication...')
    const user = await authenticateUser(event);
    if (!user) {
      console.log('Authentication failed')
      return createErrorResponse(401, 'Unauthorized');
    }
    console.log('Authentication successful for user:', user.userId)

    // Determine HTTP method (API Gateway v2 uses different event structure)
    const httpMethod = event.httpMethod || event.requestContext?.http?.method
    
    // Handle GET request - fetch latest analysis
    if (httpMethod === 'GET') {
      console.log('GET request received for analysis fetch')
      console.log('Path parameters:', event.pathParameters)
      console.log('Query parameters:', event.queryStringParameters)
      
      const accountId = event.pathParameters?.accountId || event.pathParameters?.proxy
      
      if (!accountId) {
        console.log('Missing accountId in path parameters')
        return createErrorResponse(400, 'accountId is required in path')
      }

      console.log(`Fetching latest analysis for user: ${user.userId}, account: ${accountId}`)
      const latestAnalysis = await getLatestAnalysis(user.userId, accountId)
      
      if (latestAnalysis) {
        console.log('Found previous analysis, returning cached result')
        return createSuccessResponse({
          message: 'Latest analysis retrieved successfully',
          analysisId: latestAnalysis.analysisId,
          result: latestAnalysis.result,
          createdAt: latestAnalysis.createdAt,
          updatedAt: latestAnalysis.updatedAt,
          cached: true
        })
      } else {
        console.log('No previous analysis found, returning empty result')
        return createSuccessResponse({
          message: 'No previous analysis found',
          result: null,
          cached: false
        })
      }
    }

    // Handle POST request - run new analysis
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

    const cloudWatchClient = new CloudWatchClient({
      region: account.region,
      credentials: {
        accessKeyId: credentials.Credentials!.AccessKeyId!,
        secretAccessKey: credentials.Credentials!.SecretAccessKey!,
        sessionToken: credentials.Credentials!.SessionToken!,
      },
    })

    const s3Client = new S3Client({
      region: account.region,
      credentials: {
        accessKeyId: credentials.Credentials!.AccessKeyId!,
        secretAccessKey: credentials.Credentials!.SecretAccessKey!,
        sessionToken: credentials.Credentials!.SessionToken!,
      },
    })

    const elbv2Client = new ElasticLoadBalancingV2Client({
      region: account.region,
      credentials: {
        accessKeyId: credentials.Credentials!.AccessKeyId!,
        secretAccessKey: credentials.Credentials!.SecretAccessKey!,
        sessionToken: credentials.Credentials!.SessionToken!,
      },
    })

    const elbClassicClient = new ElasticLoadBalancingClient({
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

    // Analyze unattached EBS volumes
    const { Volumes } = await ec2Client.send(new DescribeVolumesCommand({}))
    const unattachedVolumes = Volumes
        ?.filter(v => v.State === 'available')
        .map(v => ({
            volumeId: v.VolumeId,
            size: v.Size,
            region: account.region,
            potentialSavings: (v.Size || 0) * 0.1, // Approximate cost per GB
        })) || [];

    // Analyze EC2 instances for rightsizing
    const { Reservations } = await ec2Client.send(new DescribeInstancesCommand({}))
    const instances = Reservations?.flatMap(r => r.Instances || []).filter(i => i.State?.Name === 'running') || []
    
    console.log(`Found ${instances.length} running EC2 instances for analysis`)
    const ec2Recommendations = await analyzeEC2Instances(instances, cloudWatchClient, account.region)

    // Analyze S3 buckets for storage optimization
    console.log('Starting S3 storage analysis...')
    const s3Analysis = await analyzeS3Storage(s3Client, account.region)

    // Analyze unused Elastic IPs
    console.log('Analyzing unused Elastic IPs...')
    const unusedElasticIPs = await analyzeUnusedElasticIPs(ec2Client)

    // Analyze load balancers for idle/unused resources
    console.log('Analyzing load balancers...')
    const loadBalancerAnalysis = await analyzeLoadBalancers(elbv2Client, elbClassicClient, cloudWatchClient, account.region)

    // 4. Store the results in DynamoDB
    const analysisResult = {
      unattachedVolumes,
      ec2Recommendations,
      s3Analysis,
      unusedElasticIPs,
      loadBalancerAnalysis,
    }

    // Remove undefined values to prevent DynamoDB errors
    function removeUndefinedValues(obj: any): any {
      if (Array.isArray(obj)) {
        return obj.map(item => removeUndefinedValues(item)).filter(item => item !== undefined)
      } else if (obj !== null && typeof obj === 'object') {
        const cleaned: any = {}
        Object.keys(obj).forEach(key => {
          const value = removeUndefinedValues(obj[key])
          if (value !== undefined) {
            cleaned[key] = value
          }
        })
        return cleaned
      }
      return obj
    }

    const cleanedAnalysisResult = removeUndefinedValues(analysisResult)

    const analysisFinishTime = new Date().toISOString();
    
    // Ensure result is properly cleaned before storing
    let finalResult;
    try {
        finalResult = cleanedAnalysisResult;
        // Additional safety check - stringify and parse to remove any remaining undefined values
        finalResult = JSON.parse(JSON.stringify(cleanedAnalysisResult));
    } catch (error) {
        console.error('Error cleaning analysis result:', error);
        finalResult = cleanedAnalysisResult;
    }
    
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
            ':result': finalResult,
            ':updatedAt': analysisFinishTime,
        },
    }));


    return createSuccessResponse({
      message: 'Analysis completed successfully',
      analysisId,
      result: analysisResult,
    })
  } catch (error) {
    console.error('Analysis handler error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return createErrorResponse(500, 'Internal server error')
  }
} 