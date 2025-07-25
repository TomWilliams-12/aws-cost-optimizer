import { APIGatewayProxyResult, Context } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { EC2Client, DescribeVolumesCommand, DescribeInstancesCommand, DescribeAddressesCommand, Instance } from '@aws-sdk/client-ec2'
import { CloudWatchClient, GetMetricDataCommand, GetMetricStatisticsCommand, ListMetricsCommand } from '@aws-sdk/client-cloudwatch'
import { S3Client, ListBucketsCommand, ListObjectsV2Command, GetBucketLocationCommand, GetBucketLifecycleConfigurationCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
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
      // Check if the Elastic IP is not associated with any instance
      if (!address.InstanceId && !address.NetworkInterfaceId) {
        unusedIPs.push({
          allocationId: address.AllocationId || '',
          publicIp: address.PublicIp || '',
          associatedInstanceId: undefined,
          monthlyCost: 3.65 // $0.005 per hour * 24 hours * 30.44 days = $3.65/month
        })
      }
    }
    
    console.log(`Found ${unusedIPs.length} unused Elastic IP addresses`)
    
  } catch (error) {
    console.error('Error analyzing Elastic IPs:', error)
  }
  
  return unusedIPs
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

    // 4. Store the results in DynamoDB
    const analysisResult = {
      unattachedVolumes,
      ec2Recommendations,
      s3Analysis,
      unusedElasticIPs,
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