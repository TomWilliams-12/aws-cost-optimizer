import { APIGatewayProxyResult, Context } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { EC2Client, DescribeVolumesCommand, DescribeInstancesCommand, DescribeAddressesCommand, Instance, DescribeNatGatewaysCommand, DescribeVpcEndpointsCommand } from '@aws-sdk/client-ec2'
import { CloudWatchClient, GetMetricDataCommand, GetMetricStatisticsCommand, ListMetricsCommand } from '@aws-sdk/client-cloudwatch'
import { S3Client, ListBucketsCommand, ListObjectsV2Command, GetBucketLocationCommand, GetBucketLifecycleConfigurationCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeTargetHealthCommand, DescribeTargetGroupsCommand } from '@aws-sdk/client-elastic-load-balancing-v2'
import { ElasticLoadBalancingClient, DescribeLoadBalancersCommand as DescribeClassicLoadBalancersCommand } from '@aws-sdk/client-elastic-load-balancing'
import { RDSClient, DescribeDBInstancesCommand, DescribeDBClustersCommand } from '@aws-sdk/client-rds'
import { ElastiCacheClient, DescribeCacheClustersCommand, DescribeReplicationGroupsCommand } from '@aws-sdk/client-elasticache'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { createSuccessResponse, createErrorResponse } from './utils/response'

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

// Analyze RDS instances for optimization opportunities
async function analyzeRDSInstances(rdsClient: RDSClient, cloudWatchClient: CloudWatchClient, region: string) {
  console.log('Starting RDS analysis...')
  const rdsFindings: any[] = []
  
  try {
    // Get all RDS instances
    const { DBInstances } = await rdsClient.send(new DescribeDBInstancesCommand({}))
    
    if (!DBInstances || DBInstances.length === 0) {
      console.log('No RDS instances found')
      return []
    }
    
    console.log(`Found ${DBInstances.length} RDS instances to analyze`)
    
    for (const instance of DBInstances) {
      if (!instance.DBInstanceIdentifier) continue
      
      const instanceInfo: any = {
        instanceId: instance.DBInstanceIdentifier,
        instanceClass: instance.DBInstanceClass,
        engine: instance.Engine,
        engineVersion: instance.EngineVersion,
        multiAZ: instance.MultiAZ,
        storageType: instance.StorageType,
        allocatedStorage: instance.AllocatedStorage,
        status: instance.DBInstanceStatus,
        createdTime: instance.InstanceCreateTime,
        environment: 'production', // Default, will be updated based on tags/name
        metrics: {},
        recommendations: [],
        monthlyCost: 0,
        potentialSavings: 0
      }
      
      // Detect environment based on instance name
      const lowerName = instance.DBInstanceIdentifier.toLowerCase()
      if (lowerName.includes('dev') || lowerName.includes('development')) {
        instanceInfo.environment = 'development'
      } else if (lowerName.includes('test') || lowerName.includes('staging')) {
        instanceInfo.environment = 'test'
      }
      
      // Estimate monthly cost (simplified - in production, use AWS Pricing API)
      const instanceSizeMultiplier = {
        'db.t3.micro': 0.017,
        'db.t3.small': 0.034,
        'db.t3.medium': 0.068,
        'db.t3.large': 0.136,
        'db.t3.xlarge': 0.272,
        'db.t3.2xlarge': 0.544,
        'db.r5.large': 0.24,
        'db.r5.xlarge': 0.48,
        'db.r5.2xlarge': 0.96,
        'db.r5.4xlarge': 1.92,
        'db.m5.large': 0.171,
        'db.m5.xlarge': 0.342,
        'db.m5.2xlarge': 0.684,
      }[instance.DBInstanceClass || ''] || 0.5
      
      instanceInfo.monthlyCost = instanceSizeMultiplier * 730 // hours per month
      if (instance.MultiAZ) {
        instanceInfo.monthlyCost *= 2 // Multi-AZ doubles the cost
      }
      
      // Get CloudWatch metrics for the instance
      try {
        const endTime = new Date()
        const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days
        
        // Get database connections
        const connectionsData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
          Namespace: 'AWS/RDS',
          MetricName: 'DatabaseConnections',
          Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instance.DBInstanceIdentifier }],
          StartTime: startTime,
          EndTime: endTime,
          Period: 3600, // 1 hour
          Statistics: ['Average', 'Maximum']
        }))
        
        const avgConnections = (connectionsData.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0) / (connectionsData.Datapoints?.length || 1)
        const maxConnections = Math.max(...(connectionsData.Datapoints?.map(dp => dp.Maximum || 0) || [0]))
        
        instanceInfo.metrics.avgConnections = Math.round(avgConnections)
        instanceInfo.metrics.maxConnections = Math.round(maxConnections)
        
        // Get CPU utilization
        const cpuData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
          Namespace: 'AWS/RDS',
          MetricName: 'CPUUtilization',
          Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instance.DBInstanceIdentifier }],
          StartTime: startTime,
          EndTime: endTime,
          Period: 3600,
          Statistics: ['Average', 'Maximum']
        }))
        
        const avgCPU = (cpuData.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0) / (cpuData.Datapoints?.length || 1)
        const maxCPU = Math.max(...(cpuData.Datapoints?.map(dp => dp.Maximum || 0) || [0]))
        
        instanceInfo.metrics.avgCPU = Math.round(avgCPU)
        instanceInfo.metrics.maxCPU = Math.round(maxCPU)
        
        // Get Read/Write IOPS
        const readIOPSData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
          Namespace: 'AWS/RDS',
          MetricName: 'ReadIOPS',
          Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instance.DBInstanceIdentifier }],
          StartTime: startTime,
          EndTime: endTime,
          Period: 3600,
          Statistics: ['Average']
        }))
        
        const avgReadIOPS = (readIOPSData.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0) / (readIOPSData.Datapoints?.length || 1)
        instanceInfo.metrics.avgReadIOPS = Math.round(avgReadIOPS)
        
        // Analyze and make recommendations
        
        // 1. Check if database is idle
        if (avgConnections < 1 && avgCPU < 5 && avgReadIOPS < 10) {
          instanceInfo.recommendations.push({
            type: 'idle_database',
            severity: 'high',
            description: 'Database appears to be idle with no connections',
            action: instanceInfo.environment === 'production' 
              ? 'Investigate if this database is still needed'
              : 'Consider deleting or stopping this database',
            savingsAmount: instanceInfo.monthlyCost,
            confidence: 0.9
          })
          instanceInfo.potentialSavings += instanceInfo.monthlyCost
        }
        
        // 2. Check for oversized instances
        else if (avgCPU < 20 && maxCPU < 40) {
          const downsizeRecommendation = {
            type: 'downsize_instance',
            severity: 'medium',
            description: `CPU utilization is low (avg: ${avgCPU}%, max: ${maxCPU}%)`,
            action: 'Consider downsizing to a smaller instance class',
            savingsAmount: instanceInfo.monthlyCost * 0.5,
            confidence: 0.7
          }
          instanceInfo.recommendations.push(downsizeRecommendation)
          instanceInfo.potentialSavings += downsizeRecommendation.savingsAmount
        }
        
        // 3. Check Multi-AZ in non-production
        if (instance.MultiAZ && instanceInfo.environment !== 'production') {
          const multiAZRecommendation = {
            type: 'remove_multi_az',
            severity: 'medium',
            description: `Multi-AZ is enabled in ${instanceInfo.environment} environment`,
            action: 'Consider disabling Multi-AZ for non-production databases',
            savingsAmount: instanceInfo.monthlyCost * 0.5,
            confidence: 0.85
          }
          instanceInfo.recommendations.push(multiAZRecommendation)
          instanceInfo.potentialSavings += multiAZRecommendation.savingsAmount
        }
        
        // 4. Suggest auto-stop for dev/test
        if (instanceInfo.environment !== 'production' && avgConnections > 0) {
          const autoStopRecommendation = {
            type: 'implement_auto_stop',
            severity: 'medium',
            description: `${instanceInfo.environment} database running 24/7`,
            action: 'Implement auto-stop schedule for nights and weekends',
            savingsAmount: instanceInfo.monthlyCost * 0.65, // ~65% savings for nights/weekends
            confidence: 0.8
          }
          instanceInfo.recommendations.push(autoStopRecommendation)
          instanceInfo.potentialSavings += autoStopRecommendation.savingsAmount
        }
        
      } catch (metricsError) {
        console.error(`Error fetching metrics for RDS instance ${instance.DBInstanceIdentifier}:`, metricsError)
        instanceInfo.metricsError = 'Unable to fetch CloudWatch metrics'
      }
      
      if (instanceInfo.recommendations.length > 0) {
        rdsFindings.push(instanceInfo)
      }
    }
    
    console.log(`RDS analysis complete. Found ${rdsFindings.length} instances with recommendations`)
    return rdsFindings
    
  } catch (error) {
    console.error('Error analyzing RDS instances:', error)
    return []
  }
}

// Analyze NAT Gateways for optimization
async function analyzeNATGateways(ec2Client: EC2Client, cloudWatchClient: CloudWatchClient, region: string) {
  console.log('Starting NAT Gateway analysis...')
  const natFindings: any[] = []
  
  try {
    // Get all NAT Gateways
    const { NatGateways } = await ec2Client.send(new DescribeNatGatewaysCommand({}))
    
    if (!NatGateways || NatGateways.length === 0) {
      console.log('No NAT Gateways found')
      return []
    }
    
    console.log(`Found ${NatGateways.length} NAT Gateways to analyze`)
    
    // Get VPC Endpoints to check for alternatives
    const { VpcEndpoints } = await ec2Client.send(new DescribeVpcEndpointsCommand({}))
    const vpcEndpointsByVpc: Record<string, string[]> = {}
    VpcEndpoints?.forEach(endpoint => {
      if (endpoint.VpcId) {
        if (!vpcEndpointsByVpc[endpoint.VpcId]) {
          vpcEndpointsByVpc[endpoint.VpcId] = []
        }
        vpcEndpointsByVpc[endpoint.VpcId].push(endpoint.ServiceName || '')
      }
    })
    
    for (const natGateway of NatGateways) {
      if (!natGateway.NatGatewayId || natGateway.State !== 'available') continue
      
      const gatewayInfo: any = {
        natGatewayId: natGateway.NatGatewayId,
        vpcId: natGateway.VpcId,
        subnetId: natGateway.SubnetId,
        state: natGateway.State,
        createdTime: natGateway.CreateTime,
        metrics: {},
        recommendations: [],
        monthlyCost: 45, // NAT Gateway hourly cost * 730 hours
        potentialSavings: 0
      }
      
      // Get CloudWatch metrics for the NAT Gateway
      try {
        const endTime = new Date()
        const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days
        
        // Get bytes out to internet
        const bytesOutData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
          Namespace: 'AWS/EC2',
          MetricName: 'BytesOutToDestination',
          Dimensions: [{ Name: 'NatGatewayId', Value: natGateway.NatGatewayId }],
          StartTime: startTime,
          EndTime: endTime,
          Period: 3600,
          Statistics: ['Sum']
        }))
        
        const totalBytesOut = bytesOutData.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0
        const avgDailyGB = (totalBytesOut / (7 * 1024 * 1024 * 1024)) // Convert to GB per day
        gatewayInfo.metrics.avgDailyDataTransferGB = Math.round(avgDailyGB * 10) / 10
        
        // Get active connections
        const connectionsData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
          Namespace: 'AWS/EC2',
          MetricName: 'ActiveConnectionCount',
          Dimensions: [{ Name: 'NatGatewayId', Value: natGateway.NatGatewayId }],
          StartTime: startTime,
          EndTime: endTime,
          Period: 3600,
          Statistics: ['Average', 'Maximum']
        }))
        
        const avgConnections = (connectionsData.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0) / (connectionsData.Datapoints?.length || 1)
        const maxConnections = Math.max(...(connectionsData.Datapoints?.map(dp => dp.Maximum || 0) || [0]))
        
        gatewayInfo.metrics.avgConnections = Math.round(avgConnections)
        gatewayInfo.metrics.maxConnections = Math.round(maxConnections)
        
        // Add data transfer costs (simplified - $0.045 per GB)
        const monthlyDataTransferCost = avgDailyGB * 30 * 0.045
        gatewayInfo.monthlyCost += monthlyDataTransferCost
        gatewayInfo.metrics.monthlyDataTransferCost = Math.round(monthlyDataTransferCost)
        
        // Analyze and make recommendations
        
        // 1. Check if NAT Gateway is idle
        if (avgConnections < 10 && avgDailyGB < 1) {
          gatewayInfo.recommendations.push({
            type: 'idle_nat_gateway',
            severity: 'high',
            description: 'NAT Gateway has very low usage',
            action: 'Consider removing this NAT Gateway if not needed',
            savingsAmount: gatewayInfo.monthlyCost,
            confidence: 0.85
          })
          gatewayInfo.potentialSavings += gatewayInfo.monthlyCost
        }
        
        // 2. Check for VPC Endpoint opportunities
        const vpcEndpoints = vpcEndpointsByVpc[natGateway.VpcId || ''] || []
        const hasS3Endpoint = vpcEndpoints.some(ep => ep.includes('s3'))
        const hasDynamoEndpoint = vpcEndpoints.some(ep => ep.includes('dynamodb'))
        
        if (!hasS3Endpoint) {
          gatewayInfo.recommendations.push({
            type: 'add_vpc_endpoint',
            severity: 'medium',
            description: 'No S3 VPC Endpoint found',
            action: 'Add S3 VPC Endpoint to reduce NAT Gateway data transfer costs',
            savingsAmount: monthlyDataTransferCost * 0.3, // Estimate 30% of traffic is S3
            confidence: 0.7
          })
          gatewayInfo.potentialSavings += monthlyDataTransferCost * 0.3
        }
        
        if (!hasDynamoEndpoint) {
          gatewayInfo.recommendations.push({
            type: 'add_vpc_endpoint',
            severity: 'low',
            description: 'No DynamoDB VPC Endpoint found',
            action: 'Add DynamoDB VPC Endpoint to reduce NAT Gateway data transfer costs',
            savingsAmount: monthlyDataTransferCost * 0.1, // Estimate 10% of traffic
            confidence: 0.6
          })
          gatewayInfo.potentialSavings += monthlyDataTransferCost * 0.1
        }
        
        // 3. Check for multiple NAT Gateways in same AZ (redundancy issue)
        const allNATsInVPC = NatGateways.filter(n => n.VpcId === natGateway.VpcId && n.State === 'available')
        if (allNATsInVPC.length > 1) {
          const natsInSameSubnet = allNATsInVPC.filter(n => n.SubnetId === natGateway.SubnetId)
          if (natsInSameSubnet.length > 1) {
            gatewayInfo.recommendations.push({
              type: 'duplicate_nat_gateway',
              severity: 'high',
              description: 'Multiple NAT Gateways found in the same subnet',
              action: 'Remove duplicate NAT Gateways in the same availability zone',
              savingsAmount: 45, // Cost of one NAT Gateway
              confidence: 0.9
            })
            gatewayInfo.potentialSavings += 45
          }
        }
        
      } catch (metricsError) {
        console.error(`Error fetching metrics for NAT Gateway ${natGateway.NatGatewayId}:`, metricsError)
        gatewayInfo.metricsError = 'Unable to fetch CloudWatch metrics'
      }
      
      if (gatewayInfo.recommendations.length > 0) {
        natFindings.push(gatewayInfo)
      }
    }
    
    console.log(`NAT Gateway analysis complete. Found ${natFindings.length} gateways with recommendations`)
    return natFindings
    
  } catch (error) {
    console.error('Error analyzing NAT Gateways:', error)
    return []
  }
}

// Analyze ElastiCache clusters for optimization
async function analyzeElastiCache(elasticacheClient: ElastiCacheClient, cloudWatchClient: CloudWatchClient, region: string) {
  console.log('Starting ElastiCache analysis...')
  const cacheFindings: any[] = []
  
  try {
    // Get all cache clusters
    const { CacheClusters } = await elasticacheClient.send(new DescribeCacheClustersCommand({ ShowCacheNodeInfo: true }))
    
    // Get all replication groups (Redis)
    const { ReplicationGroups } = await elasticacheClient.send(new DescribeReplicationGroupsCommand({}))
    
    const totalClusters = (CacheClusters?.length || 0) + (ReplicationGroups?.length || 0)
    
    if (totalClusters === 0) {
      console.log('No ElastiCache clusters found')
      return []
    }
    
    console.log(`Found ${CacheClusters?.length || 0} cache clusters and ${ReplicationGroups?.length || 0} replication groups to analyze`)
    
    // Analyze standalone cache clusters (Memcached)
    if (CacheClusters) {
      for (const cluster of CacheClusters) {
        if (!cluster.CacheClusterId || cluster.CacheClusterStatus !== 'available') continue
        
        // Skip if part of a replication group (will be analyzed separately)
        if (cluster.ReplicationGroupId) continue
        
        const clusterInfo: any = {
          clusterId: cluster.CacheClusterId,
          engine: cluster.Engine,
          engineVersion: cluster.EngineVersion,
          nodeType: cluster.CacheNodeType,
          numNodes: cluster.NumCacheNodes,
          createdTime: cluster.CacheClusterCreateTime,
          metrics: {},
          recommendations: [],
          monthlyCost: 0,
          potentialSavings: 0
        }
        
        // Estimate monthly cost (simplified)
        const nodeCostMultiplier = {
          'cache.t3.micro': 0.017,
          'cache.t3.small': 0.034,
          'cache.t3.medium': 0.068,
          'cache.t4g.micro': 0.016,
          'cache.t4g.small': 0.032,
          'cache.t4g.medium': 0.065,
          'cache.m5.large': 0.142,
          'cache.m5.xlarge': 0.284,
          'cache.m5.2xlarge': 0.568,
          'cache.m6g.large': 0.128,
          'cache.m6g.xlarge': 0.256,
          'cache.r5.large': 0.182,
          'cache.r5.xlarge': 0.364,
        }[cluster.CacheNodeType || ''] || 0.1
        
        clusterInfo.monthlyCost = nodeCostMultiplier * 730 * (cluster.NumCacheNodes || 1)
        
        // Get CloudWatch metrics
        try {
          const endTime = new Date()
          const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days
          
          // Get CPU utilization
          const cpuData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
            Namespace: 'AWS/ElastiCache',
            MetricName: 'CPUUtilization',
            Dimensions: [{ Name: 'CacheClusterId', Value: cluster.CacheClusterId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600,
            Statistics: ['Average', 'Maximum']
          }))
          
          const avgCPU = (cpuData.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0) / (cpuData.Datapoints?.length || 1)
          const maxCPU = Math.max(...(cpuData.Datapoints?.map(dp => dp.Maximum || 0) || [0]))
          
          clusterInfo.metrics.avgCPU = Math.round(avgCPU)
          clusterInfo.metrics.maxCPU = Math.round(maxCPU)
          
          // Get cache hits/misses for Memcached
          if (cluster.Engine === 'memcached') {
            const hitsData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
              Namespace: 'AWS/ElastiCache',
              MetricName: 'CacheHits',
              Dimensions: [{ Name: 'CacheClusterId', Value: cluster.CacheClusterId }],
              StartTime: startTime,
              EndTime: endTime,
              Period: 3600,
              Statistics: ['Sum']
            }))
            
            const totalHits = hitsData.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0
            clusterInfo.metrics.totalHits = totalHits
            
            const missesData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
              Namespace: 'AWS/ElastiCache',
              MetricName: 'CacheMisses',
              Dimensions: [{ Name: 'CacheClusterId', Value: cluster.CacheClusterId }],
              StartTime: startTime,
              EndTime: endTime,
              Period: 3600,
              Statistics: ['Sum']
            }))
            
            const totalMisses = missesData.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0
            clusterInfo.metrics.totalMisses = totalMisses
            clusterInfo.metrics.hitRate = totalHits > 0 ? Math.round((totalHits / (totalHits + totalMisses)) * 100) : 0
          }
          
          // Get network bytes in/out
          const bytesInData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
            Namespace: 'AWS/ElastiCache',
            MetricName: 'NetworkBytesIn',
            Dimensions: [{ Name: 'CacheClusterId', Value: cluster.CacheClusterId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600,
            Statistics: ['Sum']
          }))
          
          const totalBytesIn = bytesInData.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0
          clusterInfo.metrics.avgDailyDataGB = Math.round((totalBytesIn / (7 * 1024 * 1024 * 1024)) * 10) / 10
          
          // Analyze and make recommendations
          
          // 1. Check if cache is idle
          if (avgCPU < 5 && totalBytesIn < 1024 * 1024 * 100) { // Less than 100MB in 7 days
            clusterInfo.recommendations.push({
              type: 'idle_cache_cluster',
              severity: 'high',
              description: 'Cache cluster appears to be idle',
              action: 'Consider deleting this unused cache cluster',
              savingsAmount: clusterInfo.monthlyCost,
              confidence: 0.9
            })
            clusterInfo.potentialSavings += clusterInfo.monthlyCost
          }
          
          // 2. Check for oversized instances
          else if (avgCPU < 20 && maxCPU < 40) {
            clusterInfo.recommendations.push({
              type: 'downsize_cache_node',
              severity: 'medium',
              description: `CPU utilization is low (avg: ${avgCPU}%, max: ${maxCPU}%)`,
              action: 'Consider using a smaller node type',
              savingsAmount: clusterInfo.monthlyCost * 0.5,
              confidence: 0.7
            })
            clusterInfo.potentialSavings += clusterInfo.monthlyCost * 0.5
          }
          
          // 3. Check cache effectiveness (Memcached only)
          if (cluster.Engine === 'memcached' && clusterInfo.metrics.hitRate < 80 && clusterInfo.metrics.totalHits > 1000) {
            clusterInfo.recommendations.push({
              type: 'low_cache_hit_rate',
              severity: 'medium',
              description: `Low cache hit rate (${clusterInfo.metrics.hitRate}%)`,
              action: 'Review caching strategy or consider removing if not effective',
              savingsAmount: clusterInfo.monthlyCost * 0.5,
              confidence: 0.6
            })
            clusterInfo.potentialSavings += clusterInfo.monthlyCost * 0.5
          }
          
        } catch (metricsError) {
          console.error(`Error fetching metrics for cache cluster ${cluster.CacheClusterId}:`, metricsError)
          clusterInfo.metricsError = 'Unable to fetch CloudWatch metrics'
        }
        
        if (clusterInfo.recommendations.length > 0) {
          cacheFindings.push(clusterInfo)
        }
      }
    }
    
    // Analyze Redis replication groups
    if (ReplicationGroups) {
      for (const replGroup of ReplicationGroups) {
        if (!replGroup.ReplicationGroupId || replGroup.Status !== 'available') continue
        
        const groupInfo: any = {
          replicationGroupId: replGroup.ReplicationGroupId,
          description: replGroup.Description,
          engine: 'redis',
          nodeType: replGroup.CacheNodeType,
          numNodeGroups: replGroup.NodeGroups?.length || 0,
          automaticFailover: replGroup.AutomaticFailover,
          multiAZ: replGroup.MultiAZ,
          metrics: {},
          recommendations: [],
          monthlyCost: 0,
          potentialSavings: 0
        }
        
        // Count total nodes
        const totalNodes = replGroup.NodeGroups?.reduce((sum, ng) => sum + (ng.NodeGroupMembers?.length || 0), 0) || 0
        
        // Estimate monthly cost
        const nodeCostMultiplier = {
          'cache.t3.micro': 0.017,
          'cache.t3.small': 0.034,
          'cache.t3.medium': 0.068,
          'cache.t4g.micro': 0.016,
          'cache.t4g.small': 0.032,
          'cache.t4g.medium': 0.065,
          'cache.m5.large': 0.142,
          'cache.m5.xlarge': 0.284,
          'cache.m5.2xlarge': 0.568,
          'cache.m6g.large': 0.128,
          'cache.m6g.xlarge': 0.256,
          'cache.r5.large': 0.182,
          'cache.r5.xlarge': 0.364,
        }[replGroup.CacheNodeType || ''] || 0.1
        
        groupInfo.monthlyCost = nodeCostMultiplier * 730 * totalNodes
        
        // Get CloudWatch metrics
        try {
          const endTime = new Date()
          const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days
          
          // Get CPU utilization
          const cpuData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
            Namespace: 'AWS/ElastiCache',
            MetricName: 'CPUUtilization',
            Dimensions: [{ Name: 'ReplicationGroupId', Value: replGroup.ReplicationGroupId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600,
            Statistics: ['Average', 'Maximum']
          }))
          
          const avgCPU = (cpuData.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0) / (cpuData.Datapoints?.length || 1)
          const maxCPU = Math.max(...(cpuData.Datapoints?.map(dp => dp.Maximum || 0) || [0]))
          
          groupInfo.metrics.avgCPU = Math.round(avgCPU)
          groupInfo.metrics.maxCPU = Math.round(maxCPU)
          
          // Get memory utilization for Redis
          const memoryData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
            Namespace: 'AWS/ElastiCache',
            MetricName: 'DatabaseMemoryUsagePercentage',
            Dimensions: [{ Name: 'ReplicationGroupId', Value: replGroup.ReplicationGroupId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600,
            Statistics: ['Average', 'Maximum']
          }))
          
          const avgMemory = (memoryData.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0) / (memoryData.Datapoints?.length || 1)
          const maxMemory = Math.max(...(memoryData.Datapoints?.map(dp => dp.Maximum || 0) || [0]))
          
          groupInfo.metrics.avgMemoryUsage = Math.round(avgMemory)
          groupInfo.metrics.maxMemoryUsage = Math.round(maxMemory)
          
          // Get current connections
          const connectionsData = await cloudWatchClient.send(new GetMetricStatisticsCommand({
            Namespace: 'AWS/ElastiCache',
            MetricName: 'CurrConnections',
            Dimensions: [{ Name: 'ReplicationGroupId', Value: replGroup.ReplicationGroupId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600,
            Statistics: ['Average', 'Maximum']
          }))
          
          const avgConnections = (connectionsData.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) || 0) / (connectionsData.Datapoints?.length || 1)
          groupInfo.metrics.avgConnections = Math.round(avgConnections)
          
          // Analyze and make recommendations
          
          // 1. Check if Redis cluster is idle
          if (avgCPU < 5 && avgConnections < 5) {
            groupInfo.recommendations.push({
              type: 'idle_redis_cluster',
              severity: 'high',
              description: 'Redis cluster appears to be idle',
              action: 'Consider deleting this unused Redis cluster',
              savingsAmount: groupInfo.monthlyCost,
              confidence: 0.9
            })
            groupInfo.potentialSavings += groupInfo.monthlyCost
          }
          
          // 2. Check for oversized instances
          else if (avgCPU < 20 && maxCPU < 40 && avgMemory < 50) {
            groupInfo.recommendations.push({
              type: 'downsize_redis_nodes',
              severity: 'medium',
              description: `Low resource utilization (CPU: ${avgCPU}%, Memory: ${avgMemory}%)`,
              action: 'Consider using smaller node types',
              savingsAmount: groupInfo.monthlyCost * 0.5,
              confidence: 0.7
            })
            groupInfo.potentialSavings += groupInfo.monthlyCost * 0.5
          }
          
          // 3. Check Multi-AZ for non-critical workloads
          if (replGroup.MultiAZ && avgConnections < 100) {
            groupInfo.recommendations.push({
              type: 'unnecessary_multi_az',
              severity: 'low',
              description: 'Multi-AZ enabled for low-traffic Redis cluster',
              action: 'Consider disabling Multi-AZ if high availability is not critical',
              savingsAmount: groupInfo.monthlyCost * 0.3,
              confidence: 0.5
            })
            groupInfo.potentialSavings += groupInfo.monthlyCost * 0.3
          }
          
        } catch (metricsError) {
          console.error(`Error fetching metrics for replication group ${replGroup.ReplicationGroupId}:`, metricsError)
          groupInfo.metricsError = 'Unable to fetch CloudWatch metrics'
        }
        
        if (groupInfo.recommendations.length > 0) {
          cacheFindings.push(groupInfo)
        }
      }
    }
    
    console.log(`ElastiCache analysis complete. Found ${cacheFindings.length} clusters with recommendations`)
    return cacheFindings
    
  } catch (error) {
    console.error('Error analyzing ElastiCache clusters:', error)
    return []
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
  console.log('Analysis handler started')
  console.log('Event:', JSON.stringify(event, null, 2))
  
  // Quick test - if path contains 'test', return immediately
  if (event.path?.includes('test') || event.rawPath?.includes('test')) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: JSON.stringify({ message: 'Lambda is working!', timestamp: new Date().toISOString() })
    }
  }
  
  try {
    console.log('HTTP Method:', event.httpMethod || event.requestContext?.http?.method)
    console.log('Request path:', event.path || event.rawPath || event.requestContext?.http?.path)
    console.log('Path parameters:', event.pathParameters)
    console.log('Request body:', event.body)
    console.log('Event keys:', Object.keys(event))
    console.log('Request context:', event.requestContext)
    
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
    console.log('Determined HTTP method:', httpMethod)
    
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
    console.log('POST request detected, processing analysis request...')
    
    let accountId: string
    try {
      const body = JSON.parse(event.body || '{}')
      accountId = body.accountId
      console.log('Parsed request body, accountId:', accountId)
    } catch (error) {
      console.error('Failed to parse request body:', error)
      return createErrorResponse(400, 'Invalid request body')
    }

    if (!accountId) {
      console.log('Missing accountId in request body')
      return createErrorResponse(400, 'accountId is required')
    }

    // 1. Get account details from DynamoDB
    console.log(`Fetching account details for accountId: ${accountId}`)
    const accountResult = await dynamo.send(new GetCommand({
      TableName: ACCOUNTS_TABLE,
      Key: { accountId },
    }))

    console.log('Account lookup result:', accountResult.Item ? 'Found' : 'Not found')
    
    if (!accountResult.Item || (accountResult.Item.userId !== user.userId && accountResult.Item.userId !== 'SYSTEM')) {
      console.log('Account access denied. Account userId:', accountResult.Item?.userId, 'User userId:', user.userId)
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

    const rdsClient = new RDSClient({
      region: account.region,
      credentials: {
        accessKeyId: credentials.Credentials!.AccessKeyId!,
        secretAccessKey: credentials.Credentials!.SecretAccessKey!,
        sessionToken: credentials.Credentials!.SessionToken!,
      },
    })

    const elasticacheClient = new ElastiCacheClient({
      region: account.region,
      credentials: {
        accessKeyId: credentials.Credentials!.AccessKeyId!,
        secretAccessKey: credentials.Credentials!.SecretAccessKey!,
        sessionToken: credentials.Credentials!.SessionToken!,
      },
    })

    // 3. Perform the analysis
    const analysisId = randomUUID()
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

    // Analyze RDS instances
    console.log('Analyzing RDS instances...')
    const rdsAnalysis = await analyzeRDSInstances(rdsClient, cloudWatchClient, account.region)

    // Analyze NAT Gateways
    console.log('Analyzing NAT Gateways...')
    const natGatewayAnalysis = await analyzeNATGateways(ec2Client, cloudWatchClient, account.region)

    // Analyze ElastiCache clusters
    console.log('Analyzing ElastiCache clusters...')
    const elastiCacheAnalysis = await analyzeElastiCache(elasticacheClient, cloudWatchClient, account.region)

    // 4. Store the results in DynamoDB
    const analysisResult = {
      unattachedVolumes,
      ec2Recommendations,
      s3Analysis,
      unusedElasticIPs,
      loadBalancerAnalysis,
      rdsAnalysis,
      natGatewayAnalysis,
      elastiCacheAnalysis,
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