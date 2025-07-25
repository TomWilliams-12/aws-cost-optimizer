# AWS Cost Optimizer - Deployment Guide

This guide will walk you through setting up the complete AWS Cost Optimizer SaaS platform from development to production.

## 🚀 Quick Start (15 minutes)

### Prerequisites

1. **Node.js & npm**: Version 20+ and npm 10+
2. **AWS CLI**: Configured with appropriate permissions
3. **AWS CDK**: Install globally: `npm install -g aws-cdk`
4. **Git**: For version control

### AWS Permissions Required

Your AWS user/role needs these permissions:
- IAM: Create roles, policies, attach policies
- Lambda: Create, update, delete functions and layers
- API Gateway: Create, update, delete APIs
- DynamoDB: Create, update, delete tables
- S3: Create, update, delete buckets
- CloudFront: Create, update distributions
- CloudFormation: Full access for CDK deployments

## 📋 Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### 2. Environment Configuration

Create environment files in each workspace:

**Frontend (.env.local):**
```bash
# Copy and modify
cp frontend/.env.example frontend/.env.local

# Edit with your values:
VITE_API_URL=https://your-api-domain.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
VITE_ENVIRONMENT=development
```

**Backend (.env):**
```bash
# Copy and modify  
cp backend/.env.example backend/.env

# Edit with your values:
AWS_REGION=us-east-1
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
STRIPE_SECRET_KEY=sk_test_your_stripe_secret
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

**Infrastructure (.env):**
```bash
# Copy and modify
cp infrastructure/.env.example infrastructure/.env

# Edit with your values:
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
DOMAIN_NAME=yourdomain.com  # Optional for custom domain
```

### 3. AWS CDK Bootstrap (First Time Only)

```bash
# Bootstrap CDK for development
npm run bootstrap:dev

# Bootstrap CDK for production (when ready)
npm run bootstrap:prod
```

### 4. Build and Deploy Backend

```bash
# Build backend
cd backend
npm run build

# Deploy to development
cd ../infrastructure
npm run deploy:dev
```

**Note:** The initial deployment will take 15-20 minutes to create all AWS resources.

### 5. Build and Deploy Frontend

```bash
# Build frontend
cd frontend
npm run build

# Deploy to S3 (after infrastructure is deployed)
aws s3 sync dist/ s3://your-frontend-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

## 🏗️ Development Workflow

### Local Development

```bash
# Start all development servers
npm run dev

# Or individually:
npm run dev:frontend  # Frontend at http://localhost:5173
npm run dev:backend   # Backend at http://localhost:3000
```

### Code Quality

```bash
# Run linting
npm run lint

# Run type checking
npm run type-check

# Run tests
npm run test

# Format code
npm run format
```

### Database Setup

The CDK deployment automatically creates DynamoDB tables:
- `aws-cost-optimizer-{stage}-users`
- `aws-cost-optimizer-{stage}-accounts` 
- `aws-cost-optimizer-{stage}-analyses`
- `aws-cost-optimizer-{stage}-reports`

## 🔒 Security Configuration

### 1. JWT Secret

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Stripe Setup

1. Create a Stripe account
2. Get API keys from Dashboard > Developers > API keys
3. Set up webhook endpoint: `https://your-api-domain.com/webhooks/stripe`
4. Configure webhook events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 3. AWS Cross-Account Role

For customer AWS accounts, they need to create this IAM role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "unique-external-id-per-customer"
        }
      }
    }
  ]
}
```

Attach this policy to the role:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:GetMetricData",
        "cloudwatch:ListMetrics",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "s3:GetBucketLifecycleConfiguration",
        "elasticloadbalancing:Describe*",
        "rds:Describe*",
        "ce:GetCostAndUsage",
        "ce:GetUsageReport",
        "ce:GetReservationCoverage",
        "ce:GetReservationPurchaseRecommendation"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🌍 Production Deployment

### 1. Domain Setup (Optional)

If using a custom domain:

1. **Purchase domain** in Route 53 or configure DNS
2. **Request SSL certificate** in AWS Certificate Manager
3. **Update infrastructure/.env** with domain and certificate ARN
4. **Deploy with domain configuration**

### 2. Production Environment

```bash
# Set production environment variables
export AWS_PROFILE=production
export STAGE=prod

# Deploy infrastructure
cd infrastructure
npm run deploy:prod

# Deploy frontend
cd ../frontend
npm run build
aws s3 sync dist/ s3://your-prod-frontend-bucket --delete --profile production
```

### 3. Monitoring Setup

The platform includes built-in monitoring:
- **CloudWatch Alarms**: API errors, Lambda failures
- **CloudWatch Logs**: All Lambda function logs
- **CloudWatch Metrics**: Custom business metrics

Configure SNS notifications:
```bash
# Subscribe to alerts topic
aws sns subscribe \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:aws-cost-optimizer-prod-alerts \
  --protocol email \
  --notification-endpoint your-email@domain.com
```

## 🔧 Troubleshooting

### Common Issues

**1. CDK Bootstrap Errors**
```bash
# If bootstrap fails, try with explicit account/region
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

**2. Lambda Function Timeout**
- Increase timeout in infrastructure stack
- Check CloudWatch logs for performance issues

**3. CORS Issues**
- Verify API Gateway CORS configuration
- Check frontend environment variables

**4. Database Connection Issues**
- Verify DynamoDB table names in environment
- Check IAM permissions for Lambda roles

### Debugging

**View Logs:**
```bash
# API Gateway logs
aws logs tail /aws/apigateway/aws-cost-optimizer-dev-api --follow

# Lambda function logs
aws logs tail /aws/lambda/aws-cost-optimizer-dev-auth --follow
```

**Test API Endpoints:**
```bash
# Test authentication
curl -X POST https://your-api-url/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## 📊 Performance Optimization

### Lambda Cold Starts
- Functions use provisioned concurrency for production
- Shared layer reduces package size
- Optimized bundle sizes with esbuild

### Database Performance
- DynamoDB on-demand billing with auto-scaling
- Optimized query patterns with GSI
- TTL configured for temporary data

### Frontend Performance
- CloudFront CDN with optimized caching
- Code splitting and lazy loading
- Optimized bundle sizes

## 💰 Cost Estimation

**Monthly AWS costs** (for moderate usage):
- Lambda: $10-50
- DynamoDB: $20-100
- S3: $5-20
- CloudFront: $10-30
- API Gateway: $15-75
- **Total: ~$60-275/month**

**Revenue potential**:
- Starter: £99/month × customers
- Professional: £199/month × customers  
- Enterprise: £499/month × customers

## 🚀 Scaling Considerations

### High Traffic
- Enable Lambda provisioned concurrency
- Consider DynamoDB reserved capacity
- Implement API rate limiting

### Multiple Regions
- Deploy stacks in multiple regions
- Use Route 53 for geo-routing
- Replicate critical data across regions

### Enterprise Features
- Add SSO integration (SAML/OIDC)
- Implement advanced RBAC
- Add audit logging
- Custom branding options

## 📞 Support

For deployment issues:
1. Check CloudFormation stack events
2. Review CloudWatch logs
3. Verify IAM permissions
4. Test network connectivity

**Common Commands:**
```bash
# View stack status
aws cloudformation describe-stacks --stack-name AwsCostOptimizerDevStack

# View stack resources
aws cloudformation describe-stack-resources --stack-name AwsCostOptimizerDevStack

# Delete stack (careful!)
cdk destroy --profile dev
```

This platform is now ready for MVP deployment and can scale to handle significant traffic and customer growth. 