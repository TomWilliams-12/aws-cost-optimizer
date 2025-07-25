# AWS Cost Optimizer SaaS Platform

A comprehensive serverless SaaS platform for automated AWS cost optimization and analysis.

## 🚀 Features

- **Multi-Account AWS Integration**: Secure credential handling with role-based access
- **Cost Analysis Modules**:
  - EC2 rightsizing recommendations based on CloudWatch metrics
  - Unused resource detection (idle instances, unattached EBS volumes, unused load balancers)
  - Storage optimization (S3 lifecycle policies, EBS GP2→GP3 upgrades)
  - Reserved Instance opportunity analysis
  - Data transfer waste detection
- **Professional Reporting**: Interactive dashboards with downloadable PDF reports
- **Subscription Management**: Stripe integration with usage-based billing
- **Historical Tracking**: Month-over-month savings visualization

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: AWS Serverless (Lambda + API Gateway + DynamoDB)
- **Infrastructure**: AWS CDK v2 for Infrastructure as Code
- **Analysis Engine**: TypeScript Lambda functions with AWS SDK v3
- **Payment Processing**: Stripe integration
- **Monitoring**: CloudWatch with custom metrics and alarms

## 📁 Project Structure

```
aws-cost-optimizer/
├── frontend/              # React TypeScript frontend
├── backend/               # Serverless Lambda functions
├── infrastructure/        # AWS CDK infrastructure code
├── package.json          # Root workspace configuration
└── README.md
```

## 🛠️ Quick Start

### Prerequisites

- Node.js 20+ and npm 10+
- AWS CLI configured with appropriate permissions
- AWS CDK CLI installed globally: `npm install -g aws-cdk`

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd aws-cost-optimizer
   npm run install:all
   ```

2. **Configure environment variables**:
   ```bash
   # Create .env files in each workspace
   cp frontend/.env.example frontend/.env.local
   cp backend/.env.example backend/.env
   cp infrastructure/.env.example infrastructure/.env
   ```

3. **Bootstrap AWS CDK** (first time only):
   ```bash
   npm run bootstrap:dev
   ```

4. **Deploy infrastructure**:
   ```bash
   npm run deploy:dev
   ```

5. **Start development servers**:
   ```bash
   npm run dev
   ```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start frontend and backend development servers
- `npm run build` - Build all workspaces for production
- `npm run test` - Run tests across all workspaces
- `npm run lint` - Lint all workspaces
- `npm run type-check` - TypeScript type checking
- `npm run deploy:dev` - Deploy to development environment
- `npm run deploy:prod` - Deploy to production environment

### Development Workflow

1. **Frontend Development**:
   ```bash
   cd frontend
   npm run dev
   ```
   Access at `http://localhost:5173`

2. **Backend Development**:
   ```bash
   cd backend
   npm run dev
   ```
   Serverless offline at `http://localhost:3000`

3. **Infrastructure Changes**:
   ```bash
   cd infrastructure
   npm run diff:dev  # Preview changes
   npm run deploy:dev  # Deploy changes
   ```

## 🏷️ Environment Management

### Development
- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:3000`
- **Stage**: `dev`

### Production
- **Frontend**: Deployed to CloudFront + S3
- **Backend**: AWS Lambda + API Gateway
- **Stage**: `prod`

## 📊 Cost Analysis Modules

### EC2 Rightsizing
- Analyzes CloudWatch CPU and memory utilization
- Recommends instance type changes based on usage patterns
- Calculates potential monthly savings

### Unused Resources
- Identifies idle EC2 instances (low CPU utilization)
- Finds unattached EBS volumes
- Detects unused Elastic Load Balancers
- Spots orphaned elastic IPs

### Storage Optimization
- S3 bucket lifecycle policy recommendations
- EBS volume type optimization (GP2 → GP3)
- Snapshot cleanup suggestions

### Reserved Instances
- Analyzes on-demand usage patterns
- Recommends RI purchases for cost savings
- Compares different RI options (1-year vs 3-year)

## 💳 Subscription Tiers

- **Starter**: £99/month - Up to 3 AWS accounts
- **Professional**: £199/month - Up to 10 AWS accounts
- **Enterprise**: £499/month - Unlimited accounts + priority support

## 🔐 Security

- **AWS Credentials**: Cross-account IAM roles with minimal permissions
- **API Security**: JWT authentication with role-based access control
- **Data Protection**: Encryption at rest and in transit
- **Compliance**: SOC 2 Type II considerations

## 🚀 Deployment

### CI/CD Pipeline

The project includes GitHub Actions workflows for:
- Automated testing on pull requests
- Deployment to development on merge to `develop`
- Deployment to production on merge to `main`

### Manual Deployment

```bash
# Development
npm run deploy:dev

# Production  
npm run deploy:prod
```

## 📈 Monitoring & Observability

- **CloudWatch Dashboards**: Real-time metrics and alarms
- **Lambda Insights**: Performance monitoring for serverless functions
- **Custom Metrics**: Business KPIs and usage tracking
- **Error Tracking**: Centralized error logging and alerting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 📞 Support

For technical support or questions:
- Email: support@awscostoptimizer.com
- Documentation: [docs.awscostoptimizer.com](https://docs.awscostoptimizer.com) 