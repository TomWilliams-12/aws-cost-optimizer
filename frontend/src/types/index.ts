// User types
export interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  accountsLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  accountId: string;
  accountName: string;
  region: string;
  roleArn: string;
  status: 'active' | 'inactive' | 'error';
  lastAnalyzed?: string;
  createdAt: string;
  updatedAt: string;
  isOrganization?: boolean;
  externalId?: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    expiresIn: number;
  };
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn: number
}

// AWS Account types
export interface AWSAccount {
  id: string
  accountId: string
  accountName: string
  region: string
  roleArn: string
  externalId?: string
  status: 'active' | 'inactive' | 'error'
  lastAnalyzed?: string
  createdAt: string
  updatedAt: string
}

// Analysis types
export interface Analysis {
  id: string
  userId: string
  accountId: string
  status: AnalysisStatus
  progress: number
  startedAt: string
  completedAt?: string
  results?: AnalysisResults
  error?: string
}

export type AnalysisStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface AnalysisResults {
  ec2: EC2Analysis
  storage: StorageAnalysis
  unused: UnusedResourcesAnalysis
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
}

// EC2 Analysis types
export interface EC2Analysis {
  instances: EC2Instance[]
  recommendations: EC2Recommendation[]
  potentialSavings: {
    monthly: number
    annual: number
  }
}

export interface EC2Instance {
  instanceId: string
  instanceType: string
  state: string
  launchTime: string
  availabilityZone: string
  platform?: string
  monitoring: 'enabled' | 'disabled'
  metrics: {
    cpuUtilization: MetricData[]
    memoryUtilization?: MetricData[]
    networkIn: MetricData[]
    networkOut: MetricData[]
  }
  tags: Record<string, string>
  monthlyCost: number
}

export interface EC2Recommendation {
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
}

// Storage Analysis types
export interface StorageAnalysis {
  s3Buckets: S3BucketAnalysis[]
  ebsVolumes: EBSVolumeAnalysis[]
  recommendations: StorageRecommendation[]
  potentialSavings: {
    monthly: number
    annual: number
  }
}

export interface S3BucketAnalysis {
  bucketName: string
  region: string
  storageClass: string
  sizeBytes: number
  objectCount: number
  lifecyclePolicy?: any
  versioning: boolean
  monthlyCost: number
  lastModified?: string
}

export interface EBSVolumeAnalysis {
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
  monthlyCost: number
  utilization?: number
}

export interface StorageRecommendation {
  type: 'lifecycle' | 'storage-class' | 'volume-type' | 'cleanup'
  resourceId: string
  resourceType: 's3' | 'ebs'
  description: string
  potentialSavings: {
    monthly: number
    annual: number
    percentage: number
  }
  effort: 'low' | 'medium' | 'high'
}

// Unused Resources types
export interface UnusedResourcesAnalysis {
  idleInstances: IdleInstance[]
  unattachedVolumes: UnattachedVolume[]
  unusedLoadBalancers: UnusedLoadBalancer[]
  orphanedIPs: OrphanedIP[]
  potentialSavings: {
    monthly: number
    annual: number
  }
}

export interface IdleInstance {
  instanceId: string
  instanceType: string
  state: string
  launchTime: string
  averageCpuUtilization: number
  networkActivity: number
  monthlyCost: number
  recommendation: 'stop' | 'terminate' | 'downsize'
}

export interface UnattachedVolume {
  volumeId: string
  volumeType: string
  size: number
  state: string
  createTime: string
  monthlyCost: number
  lastAttached?: string
}

export interface UnusedLoadBalancer {
  arn: string
  name: string
  type: 'application' | 'network' | 'classic'
  state: string
  activeTargets: number
  requestCount: number
  monthlyCost: number
}

export interface OrphanedIP {
  allocationId: string
  publicIp: string
  domain: string
  associatedInstanceId?: string
  monthlyCost: number
}

// Metric types
export interface MetricData {
  timestamp: string
  value: number
  unit: string
}

// Report types
export interface Report {
  id: string
  userId: string
  analysisId: string
  type: 'summary' | 'detailed' | 'executive'
  format: 'pdf' | 'html' | 'json'
  status: 'generating' | 'ready' | 'failed'
  downloadUrl?: string
  expiresAt?: string
  createdAt: string
}

// Subscription types
export type SubscriptionTier = 'starter' | 'professional' | 'enterprise'
export type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'cancelled'

export interface Subscription {
  id: string
  userId: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  priceId: string
  customerId: string
  subscriptionId: string
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

// Form types
export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  name: string
  email: string
  password: string
  confirmPassword: string
  company?: string
}

export interface AWSAccountForm {
  accountName: string
  accountId: string
  region: string
  roleArn: string
  externalId?: string
}

// Dashboard types
export interface DashboardStats {
  totalSavings: {
    monthly: number
    annual: number
  }
  accountsConnected: number
  lastAnalysis?: string
  analysisCount: number
  topRecommendations: Array<{
    type: string
    description: string
    savings: number
  }>
}

// Chart data types
export interface ChartData {
  name: string
  value: number
  fill?: string
}

export interface TimeSeriesData {
  timestamp: string
  value: number
  label?: string
} 