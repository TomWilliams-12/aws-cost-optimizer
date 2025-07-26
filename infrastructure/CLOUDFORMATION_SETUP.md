# AWS Cost Optimizer - CloudFormation Setup Guide

This guide explains how the one-click CloudFormation setup works for customers to securely connect their AWS accounts.

## 🎯 Overview

Instead of complex manual IAM role setup, customers can now deploy the required permissions with a single click using CloudFormation. This dramatically improves conversion rates and user experience.

## 🚀 How It Works

### 1. **Template Generation**
```bash
# Generate external ID and deploy URLs
cd infrastructure/scripts
node generate-deploy-links.js --json
```

### 2. **One-Click Deployment**
Customers click the "Deploy to AWS" button which:
- Opens AWS CloudFormation Console
- Pre-fills template URL and parameters
- Customer clicks "Next" → "Next" → "Create Stack"
- Role is deployed in 2-3 minutes

### 3. **Automatic Configuration**
- External ID is pre-generated and secure
- Role ARN is provided in stack outputs
- Customer copies Role ARN back to Cost Optimizer
- Connection is tested and verified

## 📁 Files Structure

```
infrastructure/
├── cloudformation/
│   └── aws-cost-optimizer-role.yaml      # CloudFormation template
├── terraform/
│   └── cloudformation_hosting.tf         # S3 bucket for template hosting
├── scripts/
│   └── generate-deploy-links.js          # Deploy URL generator
└── CLOUDFORMATION_SETUP.md              # This guide
```

## 🔧 CloudFormation Template

### Template Features:
- ✅ **Secure External ID**: Unique per deployment
- ✅ **Read-Only Access**: ReadOnlyAccess + Billing policies
- ✅ **Cost Analysis Permissions**: CloudWatch, EC2, S3, ELB metrics
- ✅ **Cross-Account Role**: Secure role assumption
- ✅ **Rich Outputs**: Role ARN, External ID, setup instructions

### Key Parameters:
```yaml
Parameters:
  CostOptimizerAccountId: "504264909935"  # Cost Optimizer AWS account
  ExternalId: "cost-saver-abc123..."      # Unique security token
  RoleName: "AWSCostOptimizerRole"        # IAM role name
```

### Outputs:
```yaml
Outputs:
  RoleArn: "arn:aws:iam::123456789012:role/AWSCostOptimizerRole"
  ExternalId: "cost-saver-abc123..."
  SetupInstructions: "Detailed next steps..."
```

## 🌐 Template Hosting

### S3 Bucket Configuration:
- **Bucket**: `aws-cost-optimizer-dev-cloudformation-templates`
- **Public Access**: Read-only via bucket policy
- **Versioning**: Enabled for template updates
- **Object Tagging**: `Public=true` for access control

### Template URL:
```
https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-role.yaml
```

## 🔗 Deploy URLs by Region

### Example Deploy URL:
```
https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/new?templateURL=https%3A//aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-role.yaml&stackName=AWS-Cost-Optimizer-Role&param_ExternalId=cost-saver-abc123&param_RoleName=AWSCostOptimizerRole
```

### Supported Regions:
- US East (N. Virginia) - `us-east-1`
- US East (Ohio) - `us-east-2`
- US West (N. California) - `us-west-1`
- US West (Oregon) - `us-west-2`
- Europe (Ireland) - `eu-west-1`
- Europe (London) - `eu-west-2`
- Europe (Frankfurt) - `eu-central-1`
- Asia Pacific (Singapore) - `ap-southeast-1`
- Asia Pacific (Sydney) - `ap-southeast-2`
- Asia Pacific (Tokyo) - `ap-northeast-1`

## 🖥️ Frontend Integration

### CloudFormation Onboarding Component:
```typescript
// New component replaces manual setup wizard
<CloudFormationOnboarding
  isOpen={showAddAccount}
  onClose={() => setShowAddAccount(false)}
  onSubmit={handleAddAccount}
  isLoading={isAddingAccount}
/>
```

### User Experience Flow:
1. **Select Region** → Choose AWS region for deployment
2. **Click Deploy** → Opens AWS Console with pre-filled template
3. **Deploy Stack** → Customer clicks through CloudFormation wizard
4. **Copy Role ARN** → From stack outputs
5. **Complete Setup** → Paste Role ARN in Cost Optimizer
6. **Start Analysis** → Immediate access to cost optimization

## 🛡️ Security

### Access Control:
- **Cross-Account Role**: Secure with External ID
- **Read-Only Permissions**: No write access to customer infrastructure
- **Limited Scope**: Only cost analysis and optimization permissions
- **Auditable**: All API calls logged via CloudTrail

### External ID Security:
```javascript
// Generated per deployment
const externalId = `cost-saver-${timestamp}-${random}`
// Example: cost-saver-mdk002d9-cdd263f3bb757574
```

## 📊 Conversion Impact

### Before CloudFormation:
- ❌ 15-minute manual IAM setup
- ❌ Complex policy copy/paste
- ❌ High drop-off rate
- ❌ Support tickets for setup issues

### After CloudFormation:
- ✅ 30-second one-click deployment
- ✅ Zero manual configuration
- ✅ Professional AWS-native experience
- ✅ Self-service with clear instructions

**Expected Impact**: 50%+ improvement in trial-to-active conversion rate

## 🚀 Deployment

### Deploy Template Hosting:
```bash
cd infrastructure/terraform
terraform plan
terraform apply
```

### Update Template:
```bash
# Update template file
vim infrastructure/cloudformation/aws-cost-optimizer-role.yaml

# Re-deploy with Terraform
terraform apply
```

### Generate New Deploy URLs:
```bash
cd infrastructure/scripts
node generate-deploy-links.js 123456789012 --markdown > setup-guide.md
```

## 🧪 Testing

### Test Template Deployment:
1. Generate test external ID: `cost-saver-test-123`
2. Deploy to test AWS account
3. Verify role creation and permissions
4. Test role assumption from Cost Optimizer account
5. Validate CloudWatch, EC2, S3 access

### Verify Public Template Access:
```bash
curl -I https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-role.yaml
# Should return 200 OK
```

## 📈 Metrics to Track

### Conversion Metrics:
- Time from signup to first analysis
- Setup completion rate
- Support ticket volume
- User feedback scores

### Technical Metrics:
- Template deployment success rate
- Role assumption success rate
- API call latency after setup
- CloudFormation stack health

## 🔄 Future Enhancements

### Planned Improvements:
- **Stack Update Mechanism**: Automatic template updates
- **Regional Templates**: Host templates in multiple regions
- **Custom Domains**: Branded template URLs
- **Setup Analytics**: Track deployment success rates
- **Automated Testing**: CI/CD template validation

---

**Questions?** Contact the development team or check the troubleshooting guide.