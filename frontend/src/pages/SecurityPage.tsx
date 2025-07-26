import { useState } from 'react'
import { 
  ShieldCheckIcon, 
  LockClosedIcon, 
  EyeIcon, 
  DocumentCheckIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  QuestionMarkCircleIcon
} from '../components/Icons'

export default function SecurityPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const iamPermissions = [
    {
      category: "EC2 Analysis",
      purpose: "Analyze EC2 instances for rightsizing opportunities",
      permissions: [
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceTypes", 
        "ec2:DescribeImages",
        "ec2:DescribeVolumes",
        "ec2:DescribeAddresses",
        "ec2:DescribeNetworkInterfaces"
      ],
      why: "We analyze your EC2 instances to identify overprovisioned resources and recommend cost-effective alternatives based on actual usage patterns."
    },
    {
      category: "CloudWatch Metrics",
      purpose: "Access performance metrics for rightsizing recommendations",
      permissions: [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:GetMetricData",
        "cloudwatch:ListMetrics",
        "cloudwatch:DescribeAlarms"
      ],
      why: "We analyze 90 days of CPU, memory, network, and disk usage to ensure our recommendations won't impact performance."
    },
    {
      category: "S3 Storage Analysis", 
      purpose: "Optimize S3 storage costs and lifecycle policies",
      permissions: [
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketLifecycleConfiguration",
        "s3:GetBucketVersioning",
        "s3:ListBucket"
      ],
      why: "We analyze S3 buckets to recommend optimal storage classes (Standard → IA → Glacier) based on access patterns."
    },
    {
      category: "Load Balancer Analysis",
      purpose: "Identify unused or underutilized load balancers",
      permissions: [
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeTargetGroups", 
        "elasticloadbalancing:DescribeTargetHealth",
        "elasticloadbalancing:DescribeListeners"
      ],
      why: "We identify load balancers with no healthy targets or minimal traffic to eliminate unnecessary costs."
    },
    {
      category: "Cost & Billing Data",
      purpose: "Access historical cost data for trend analysis",
      permissions: [
        "ce:GetCostAndUsage",
        "ce:GetRightsizingRecommendation",
        "pricing:GetProducts",
        "support:DescribeTrustedAdvisorChecks"
      ],
      why: "We access AWS Cost Explorer and Trusted Advisor data to provide comprehensive cost optimization insights."
    }
  ]

  const securityMeasures = [
    {
      title: "Read-Only Access",
      description: "We only request read permissions - we cannot modify, delete, or create any resources in your AWS account.",
      icon: EyeIcon
    },
    {
      title: "External ID Protection",
      description: "Each account connection uses a unique external ID, preventing unauthorized access even if our account is compromised.",
      icon: LockClosedIcon
    },
    {
      title: "Cross-Account Role",
      description: "We use AWS's recommended cross-account role approach - you maintain full control and can revoke access anytime.",
      icon: ShieldCheckIcon
    },
    {
      title: "Secure Data Handling",
      description: "Analysis results are encrypted at rest and in transit. We never store sensitive data like instance names or IP addresses.",
      icon: DocumentCheckIcon
    },
    {
      title: "Minimal Permissions",
      description: "We follow the principle of least privilege - only requesting the minimum permissions needed for cost analysis.",
      icon: ClipboardDocumentCheckIcon
    },
    {
      title: "Audit Trail",
      description: "All API calls are logged in AWS CloudTrail in your account, giving you complete visibility into our actions.",
      icon: CheckCircleIcon
    }
  ]

  const dataHandling = [
    {
      question: "What data do we collect?",
      answer: "We collect metadata about your AWS resources (instance types, sizes, utilization metrics) but never personal data, application data, or business logic."
    },
    {
      question: "Where is data stored?", 
      answer: "Analysis results are stored in our secure AWS infrastructure in the EU (Ireland) region with encryption at rest and in transit."
    },
    {
      question: "How long do we keep data?",
      answer: "Resource metadata is retained for 90 days to provide trend analysis. You can request deletion at any time."
    },
    {
      question: "Who can access your data?",
      answer: "Only our automated analysis systems and authorized engineers for support purposes. No data is shared with third parties."
    },
    {
      question: "Can you revoke access?",
      answer: "Yes! Simply delete the IAM role in your AWS account and access is immediately revoked. No lengthy cancellation process required."
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <ShieldCheckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Security & Permissions
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Complete transparency about how AWS Cost Optimizer securely accesses and analyzes your infrastructure
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
            <EyeIcon className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Read-Only Access</h3>
            <p className="text-gray-600 dark:text-gray-400">We cannot modify, delete, or create any resources</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
            <LockClosedIcon className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Zero Data Risk</h3>
            <p className="text-gray-600 dark:text-gray-400">No access to your applications, databases, or business data</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
            <ShieldCheckIcon className="w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">You Stay in Control</h3>
            <p className="text-gray-600 dark:text-gray-400">Revoke access instantly by deleting the IAM role</p>
          </div>
        </div>

        {/* Security Measures */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">How We Keep Your AWS Account Secure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {securityMeasures.map((measure, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <measure.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{measure.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{measure.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Permissions */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Exact IAM Permissions Explained</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {iamPermissions.map((category, index) => (
              <div key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <button
                  onClick={() => toggleSection(category.category)}
                  className="w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{category.category}</h3>
                      <p className="text-gray-600 dark:text-gray-400">{category.purpose}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-sm font-medium">
                        {category.permissions.length} permissions
                      </span>
                      <QuestionMarkCircleIcon className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        expandedSection === category.category ? 'rotate-180' : ''
                      }`} />
                    </div>
                  </div>
                </button>
                {expandedSection === category.category && (
                  <div className="px-6 pb-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{category.why}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {category.permissions.map((permission, permIndex) => (
                        <div key={permIndex} className="bg-gray-100 dark:bg-gray-700 rounded px-3 py-2">
                          <code className="text-sm text-gray-800 dark:text-gray-200 font-mono">{permission}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Data Handling FAQ */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Data Privacy & Handling</h2>
          <div className="space-y-4">
            {dataHandling.map((item, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{item.question}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance & Certifications */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Compliance & Certifications</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExclamationTriangleIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Security Certifications In Progress</h3>
              <p className="text-gray-600 dark:text-gray-400">We're actively working towards industry-standard security certifications</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">SOC 2 Type II</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Security audit planned for Q3 2025</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">GDPR Compliance</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Privacy policy and data handling procedures</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">AWS Security</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Built on AWS with security best practices</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact & Support */}
        <div className="text-center">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700 p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Questions About Security?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
              Our team is happy to provide additional security documentation, answer compliance questions, 
              or arrange security reviews for enterprise customers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="mailto:security@awscostoptimizer.com"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Contact Security Team
              </a>
              <a 
                href="mailto:enterprise@awscostoptimizer.com"
                className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Enterprise Inquiries
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}