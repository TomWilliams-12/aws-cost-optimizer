# AWS Cost Optimizer - Claude Context

## Project Overview

**AWS Cost Optimizer** is a comprehensive SaaS platform that helps businesses identify and implement cost savings across their AWS infrastructure. The platform provides automated analysis of AWS resources and actionable recommendations to reduce cloud spending by 20-40%.

### Key Features
- ✅ **One-click CloudFormation onboarding** - Frictionless IAM role setup
- ✅ **AWS Organizations integration** - Enterprise-scale multi-account deployment
- ✅ **Comprehensive cost analysis** - EC2, S3, EBS, Elastic IPs, Load Balancers
- ✅ **Analysis result persistence** - No data loss on page reload
- ✅ **Enterprise-grade UI** - Sophisticated multi-panel architecture with dark mode
- ✅ **Professional design system** - SVG icon library with consistent theming
- ✅ **CloudWatch integration** - 90-day historical metrics analysis
- ✅ **Security-first architecture** - Cross-account roles with external ID
- ✅ **Professional landing page** - ROI-focused marketing with trust indicators
- ✅ **Complete security documentation** - Privacy policy, terms, security pages

## Architecture

### Backend (Node.js/TypeScript)
- **Framework**: Serverless Lambda functions with API Gateway v2
- **Database**: DynamoDB for accounts and analysis storage
- **Authentication**: JWT with Secrets Manager
- **AWS Integration**: Cross-account role assumption for secure analysis
- **Infrastructure**: Terraform-managed AWS resources

### Frontend (React/TypeScript)
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with comprehensive dark mode support
- **State Management**: React Context API (Auth + Theme contexts)
- **UI Architecture**: Multi-panel enterprise application with sidebar navigation
- **Design System**: Professional SVG icon library with consistent theming
- **Build Tool**: Vite for fast development and builds
- **Deployment**: S3 + CloudFront (static hosting)

### Infrastructure
```
/infrastructure/
├── terraform/
│   ├── main.tf              # Provider and general config
│   ├── api_gateway.tf       # HTTP API Gateway v2 routes (includes organizations endpoints)
│   ├── lambda.tf           # Lambda functions and permissions (with Organizations support)
│   ├── dynamodb.tf         # User accounts, analysis tables, and organizations tables
│   ├── s3.tf              # Frontend hosting and file storage
│   ├── secrets.tf         # JWT secrets management
│   └── cloudformation_hosting.tf # Public CloudFormation templates (individual + organization)
└── lambdas/                # Individual Lambda packages (TypeScript)
    ├── auth/               # Authentication handler (3.6MB)
    ├── accounts/           # Account management (3.7MB)
    ├── analysis/           # Cost analysis engine (9.5MB)
    ├── reports/            # Report generation (4.7MB)
    ├── stripe/             # Payment processing (5.2MB)
    ├── organizations/      # AWS Organizations (4.7MB)
    └── package.json        # Root package with build scripts
```

Each Lambda is now individually packaged with only its required dependencies, reducing package sizes by 82-93% compared to the previous monolithic 54MB deployment.

## Key Components

### Analysis Engine (`/backend/src/handlers/analysis.ts`)
**Primary analysis handler supporting both GET (fetch previous) and POST (run new) requests**

Key functions:
- `getLatestAnalysis()` - Fetches previous analysis results from DynamoDB
- `analyzeUnattachedVolumes()` - Detects unused EBS volumes
- `analyzeEC2Instances()` - EC2 rightsizing with CloudWatch metrics
- `analyzeS3Storage()` - Storage class optimization recommendations
- `analyzeUnusedElasticIPs()` - Enhanced IP detection with comprehensive logging
- `analyzeLoadBalancers()` - ALB/NLB/Classic load balancer analysis

### Dashboard (`/frontend/src/pages/DashboardPage.tsx`)
**Enterprise-grade multi-panel application with:**
- Sophisticated sidebar navigation system
- Multi-view architecture (Overview, Accounts, Analysis, Recommendations, Reports, Settings)
- Real-time metrics cards with professional SVG icons
- Analysis result persistence (loads previous results on refresh)
- Cache indicators and "Run Fresh Analysis" functionality
- Interactive cost breakdown and savings impact charts
- Comprehensive dark mode with smooth transitions
- Professional theming throughout all components
- Account onboarding integration

### CloudFormation Onboarding (`/frontend/src/components/CloudFormationOnboarding.tsx`)
**3-step wizard for frictionless AWS account connection:**
1. **Region Selection** - Visual confirmation with deploy readiness
2. **One-Click Deploy** - Direct AWS Console integration with session preservation
3. **Role Configuration** - External ID setup and connection validation

## Current Status

### Phase 1: Professional Foundation ✅ **COMPLETED**
**Major Achievements:**
- ✅ One-click CloudFormation onboarding (conversion game-changer!)
- ✅ Analysis result persistence (no more data loss on reload!)
- ✅ Load balancer analysis restoration with corrected API parameters
- ✅ Enhanced Elastic IP detection with comprehensive association checking
- ✅ **MAJOR UI TRANSFORMATION**: Complete redesign from basic dashboard to enterprise-grade application
  - Sophisticated multi-panel architecture with sidebar navigation
  - Comprehensive dark mode system with theme persistence
  - Professional SVG icon library (eliminated all emoji icons)
  - Modern information architecture suitable for enterprise customers

### Recent Technical Work
1. **Analysis Persistence Implementation**
   - Added GET endpoint to `/analysis/{accountId}` for fetching previous results
   - Enhanced DynamoDB queries with proper error handling
   - Frontend auto-loads previous analysis on dashboard load
   - Cache indicators distinguish fresh vs cached data

2. **Enterprise UI Transformation**
   - Complete application redesign from basic dashboard to multi-panel architecture
   - Implemented sophisticated sidebar navigation with contextual views
   - Added comprehensive dark mode system with smooth transitions
   - Created professional SVG icon library with consistent theming
   - Enhanced user experience with modern information architecture

3. **Bug Fixes & Enhancements**
   - Fixed DynamoDB undefined values error with cleanup function
   - Restored load balancer analysis with corrected `LoadBalancerArn` parameter
   - Added S3 bucket filtering to exclude infrastructure buckets
   - Enhanced Elastic IP detection with comprehensive logging

## Development Environment

### Local Development
```bash
# Frontend  
cd frontend
npm install
npm run dev         # Vite development server

# Lambda Functions
cd infrastructure/lambdas
npm run install:all  # Install dependencies for all Lambdas
npm run build:all    # Build all Lambda packages

# Individual Lambda development
cd infrastructure/lambdas/auth
npm install
npm run package     # Build and create deployment package

# Infrastructure
cd infrastructure/terraform
terraform plan      # Review changes
terraform apply     # Deploy to AWS
```

### Lambda Development Workflow
1. **Edit Lambda code**: Modify TypeScript files in `infrastructure/lambdas/{function}/src/`
2. **Build the Lambda**: Run `npm run package` in the Lambda directory
3. **Deploy**: Run `terraform apply` from `infrastructure/terraform/`
4. **Build all Lambdas**: Run `npm run build:all` from `infrastructure/lambdas/`
5. **Note**: Each Lambda has its own package with minimal dependencies for optimal performance

### Important Development Notes
- **Terraform Deployments**: The user will ALWAYS run `terraform apply` commands manually. Never run terraform apply automatically - only prepare the changes and inform the user when they need to deploy.
- **Lambda Architecture**: Each Lambda function is individually packaged with only its required dependencies, significantly reducing cold start times and deployment sizes.

### Environment Variables
- `JWT_SECRET_NAME` - AWS Secrets Manager secret name
- `ACCOUNTS_TABLE` - DynamoDB table for user accounts
- `ANALYSES_TABLE` - DynamoDB table for analysis results
- `REGION` - AWS deployment region (eu-west-2)

### Key Dependencies
**Backend:**
- `@aws-sdk/*` - AWS service clients (EC2, S3, DynamoDB, CloudWatch, etc.)
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `uuid` - Unique ID generation

**Frontend:**
- `react` + `typescript` - Core framework
- `tailwindcss` - Styling framework with dark mode support
- `recharts` - Chart components for analytics
- Custom SVG icon library - Professional iconography system
- React Context API - Theme and authentication management

## API Endpoints

### Authentication
- `POST /auth` - User login/registration

### Account Management  
- `GET /accounts` - List connected AWS accounts
- `POST /accounts` - Add new AWS account

### Analysis
- `GET /analysis/{accountId}` - Fetch previous analysis results
- `POST /analysis` - Run new cost analysis
- `POST /reports` - Generate detailed reports

## Troubleshooting

### Common Issues

1. **✅ Analysis Persistence** *(RESOLVED)*
   - **Issue**: Analysis results disappeared on dashboard reload
   - **Root Cause**: DynamoDB undefined values + API Gateway v2 routing issues
   - **Fix**: Enhanced data cleaning + proper HTTP method detection
   - **Status**: Fixed in latest deployment

2. **Authentication Failures**
   - Verify JWT secret is properly stored in Secrets Manager
   - Check Authorization header format: `Bearer <token>`
   - Confirm token hasn't expired

3. **CloudFormation Deployment Issues**
   - Ensure S3 bucket permissions allow public read access
   - Verify CloudFormation template syntax
   - Check AWS session preservation in target account

### Debugging Tools
- **CloudWatch Logs** - Comprehensive logging in all Lambda functions
- **DynamoDB Console** - Inspect stored analysis results
- **API Gateway Console** - Monitor request/response patterns
- **Browser DevTools** - Frontend error tracking and network inspection

## Next Steps

### Immediate Issues (July 27, 2025)
- 🔴 **Organizations Detection 500 Error** 
  - API Gateway returning 500, CloudWatch logs now available
  - Lambda function may not have updated code deployed
  - Need to run `terraform apply` to update Lambda functions
- 🏢 **Multi-Organization Architecture**
  - AWS = 1 organization per account (1:1 relationship)
  - Customer may manage multiple organizations
  - Need to decide: separate accounts vs unified dashboard
- 🔄 **Lambda Deployment** 
  - ZIP file created but Lambda functions need updating
  - Run full `terraform apply` to deploy latest code

### Completed in Recent Sessions
- ✅ **Organization Management UI** - Full StackSet deployment interface
- ✅ **Authentication Improvements** - Auto-redirect when logged in, Dashboard button
- ✅ **Account Deletion** - Delete button with confirmation dialog
- ✅ **Backend CORS Fixes** - Added proper headers to all responses
- ✅ **Debug analysis persistence** - FIXED: DynamoDB undefined values and API Gateway v2 routing
- ✅ **Enterprise UI transformation** - Complete redesign to sophisticated multi-panel application
- ✅ **Dark mode implementation** - Comprehensive theming system with persistence
- ✅ **Professional icon system** - SVG library replacing all emoji icons

### Phase 2: Trust & Security
- 🔒 **Security documentation** - Read-only permission audit
- 📄 **Landing page** - Professional marketing site
- 🛡️ **Compliance features** - SOC2/GDPR preparation

### Phase 3: Advanced Features
- ⏰ **Scheduled analysis** - EventBridge-triggered automated scans
- 📊 **Historical trending** - Multi-month cost analysis
- 🔔 **Alert system** - Slack/email notifications for new wasteful resources

## Contact & Deployment

**Live Environment:**
- **Frontend**: S3 + CloudFront hosting
- **Backend**: API Gateway + Lambda (eu-west-2)
- **Database**: DynamoDB with GSI for efficient queries

**Repository**: Private GitHub repository with main branch auto-deployment

This context file should provide any future Claude session with comprehensive understanding of the project's current state, architecture, and development priorities.