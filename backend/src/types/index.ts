import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'

// Lambda handler types
export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>

export interface AuthorizedEvent extends APIGatewayProxyEvent {
  requestContext: APIGatewayProxyEvent['requestContext'] & {
    authorizer: {
      userId: string
      email: string
      subscriptionTier: string
    }
  }
}

export type AuthorizedHandler = (
  event: AuthorizedEvent,
  context: Context
) => Promise<APIGatewayProxyResult>

// Database types
export interface UserRecord {
  userId: string
  email: string
  name: string
  passwordHash: string
  company?: string
  subscriptionTier: SubscriptionTier
  subscriptionStatus: SubscriptionStatus
  accountsLimit: number
  stripeCustomerId?: string
  createdAt: string
  updatedAt: string
  ttl?: number
}

export interface AccountRecord {
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
}

export interface AnalysisRecord {
  analysisId: string
  userId: string
  accountId: string
  status: AnalysisStatus
  progress: number
  startedAt: string
  completedAt?: string
  results?: AnalysisResults
  error?: string
  ttl: number
}

export interface ReportRecord {
  reportId: string
  userId: string
  analysisId: string
  type: ReportType
  format: ReportFormat
  status: 'generating' | 'ready' | 'failed'
  s3Key?: string
  downloadUrl?: string
  expiresAt?: string
  createdAt: string
  ttl: number
}

// Analysis types
export type AnalysisStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface AnalysisResults {
  ec2: EC2AnalysisResults
  storage: StorageAnalysisResults
  unused: UnusedResourcesResults
  totalSavings: {
    monthly: number
    annual: number
  }
  summary: {
    totalResources: number
    resourcesAnalyzed: number
    recommendationsCount: number
    confidenceScore: number
  }
  metadata: {
    analysisId: string
    accountId: string
    region: string
    startTime: string
    endTime: string
    version: string
  }
}

// EC2 Analysis
export interface EC2AnalysisResults {
  instances: EC2InstanceData[]
  recommendations: EC2Recommendation[]
  potentialSavings: {
    monthly: number
    annual: number
  }
  metadata: {
    totalInstances: number
    analyzedInstances: number
    recommendationsCount: number
  }
}

export interface EC2InstanceData {
  instanceId: string
  instanceType: string
  state: string
  launchTime: string
  availabilityZone: string
  platform?: string
  monitoring: 'enabled' | 'disabled'
  metrics: {
    cpuUtilization: MetricDataPoint[]
    memoryUtilization?: MetricDataPoint[]
    networkIn: MetricDataPoint[]
    networkOut: MetricDataPoint[]
  }
  tags: Record<string, string>
  pricing: {
    onDemandPrice: number
    reservedPrice?: number
    spotPrice?: number
  }
  monthlyCost: number
}

export interface EC2Recommendation {
  instanceId: string
  type: 'rightsize' | 'terminate' | 'stop' | 'schedule'
  currentInstanceType: string
  recommendedInstanceType?: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  potentialSavings: {
    monthly: number
    annual: number
    percentage: number
  }
  performanceImpact: 'none' | 'minimal' | 'moderate' | 'significant'
  effort: 'low' | 'medium' | 'high'
  priority: number
}

// Storage Analysis
export interface StorageAnalysisResults {
  s3: S3AnalysisResults
  ebs: EBSAnalysisResults
  recommendations: StorageRecommendation[]
  potentialSavings: {
    monthly: number
    annual: number
  }
}

export interface S3AnalysisResults {
  buckets: S3BucketData[]
  totalSize: number
  totalCost: number
  recommendations: S3Recommendation[]
}

export interface S3BucketData {
  bucketName: string
  region: string
  storageClasses: Record<string, {
    sizeBytes: number
    objectCount: number
    cost: number
  }>
  lifecycle?: any
  versioning: boolean
  replication?: any
  encryption?: any
  totalCost: number
  lastModified?: string
}

export interface S3Recommendation {
  bucketName: string
  type: 'lifecycle' | 'storage-class' | 'cleanup'
  description: string
  currentCost: number
  projectedCost: number
  savings: {
    monthly: number
    annual: number
    percentage: number
  }
  implementation: string
}

export interface EBSAnalysisResults {
  volumes: EBSVolumeData[]
  snapshots: EBSSnapshotData[]
  totalCost: number
  recommendations: EBSRecommendation[]
}

export interface EBSVolumeData {
  volumeId: string
  volumeType: string
  size: number
  state: string
  attachments: Array<{
    instanceId: string
    device: string
  }>
  iops?: number
  throughput?: number
  encrypted: boolean
  cost: number
  utilization?: {
    readOps: number
    writeOps: number
    readBytes: number
    writeBytes: number
  }
}

export interface EBSSnapshotData {
  snapshotId: string
  volumeId?: string
  state: string
  startTime: string
  progress: string
  volumeSize: number
  cost: number
  description?: string
  tags: Record<string, string>
}

export interface EBSRecommendation {
  volumeId: string
  type: 'upgrade' | 'downgrade' | 'delete' | 'snapshot-cleanup'
  currentVolumeType: string
  recommendedVolumeType?: string
  description: string
  savings: {
    monthly: number
    annual: number
    percentage: number
  }
}

export interface StorageRecommendation {
  type: 'lifecycle' | 'storage-class' | 'volume-type' | 'cleanup'
  resourceId: string
  resourceType: 's3' | 'ebs' | 'snapshot'
  description: string
  currentCost: number
  projectedCost: number
  savings: {
    monthly: number
    annual: number
    percentage: number
  }
  effort: 'low' | 'medium' | 'high'
  priority: number
}

// Unused Resources
export interface UnusedResourcesResults {
  instances: IdleInstanceData[]
  volumes: UnattachedVolumeData[]
  loadBalancers: UnusedLoadBalancerData[]
  ips: OrphanedIPData[]
  nat: UnusedNATGatewayData[]
  potentialSavings: {
    monthly: number
    annual: number
  }
}

export interface IdleInstanceData {
  instanceId: string
  instanceType: string
  state: string
  launchTime: string
  metrics: {
    averageCpuUtilization: number
    maxCpuUtilization: number
    networkActivity: number
  }
  cost: number
  recommendation: 'stop' | 'terminate' | 'downsize'
  confidence: number
}

export interface UnattachedVolumeData {
  volumeId: string
  volumeType: string
  size: number
  state: string
  createTime: string
  cost: number
  lastAttached?: string
  lastDetached?: string
}

export interface UnusedLoadBalancerData {
  arn: string
  name: string
  type: 'application' | 'network' | 'classic'
  state: string
  scheme: string
  targets: {
    total: number
    healthy: number
    unhealthy: number
  }
  metrics: {
    requestCount: number
    activeConnections: number
    dataProcessed: number
  }
  cost: number
}

export interface OrphanedIPData {
  allocationId: string
  publicIp: string
  domain: string
  associatedInstanceId?: string
  associatedNetworkInterfaceId?: string
  cost: number
  allocationTime: string
}

export interface UnusedNATGatewayData {
  natGatewayId: string
  state: string
  subnetId: string
  vpcId: string
  dataProcessed: number
  cost: number
  createTime: string
}

// Metrics
export interface MetricDataPoint {
  timestamp: string
  value: number
  unit: string
}

// Subscription types
export type SubscriptionTier = 'starter' | 'professional' | 'enterprise'
export type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'cancelled'

// Report types
export type ReportType = 'summary' | 'detailed' | 'executive'
export type ReportFormat = 'pdf' | 'html' | 'json'

// Pricing types
export interface PricingData {
  ec2: Record<string, number> // instanceType -> price per hour
  ebs: Record<string, number> // volumeType -> price per GB-month
  s3: Record<string, number>  // storageClass -> price per GB-month
  dataTransfer: Record<string, number>
}

// AWS Service types
export interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

export interface AssumeRoleParams {
  roleArn: string
  externalId?: string
  sessionName: string
}

// Error types
export interface AnalysisError {
  code: string
  message: string
  service?: string
  operation?: string
  retryable: boolean
  timestamp: string
}

// Webhook types
export interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: any
  }
  created: number
}

// Configuration types
export interface AnalysisConfig {
  regions: string[]
  services: string[]
  metricsLookbackDays: number
  thresholds: {
    cpuUtilization: number
    networkActivity: number
    confidenceLevel: number
  }
}

// API Response types
export interface LambdaResponse<T = any> {
  statusCode: number
  headers?: Record<string, string>
  body: string
  isBase64Encoded?: boolean
}

export interface ApiError {
  code: string
  message: string
  details?: any
}

export interface ApiSuccess<T = any> {
  success: true
  data: T
  message?: string
}

export interface ApiFailure {
  success: false
  error: string
  code?: string
  details?: any
} 