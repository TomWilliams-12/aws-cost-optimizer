#!/usr/bin/env node

/**
 * Generate One-Click CloudFormation Deploy Links
 * 
 * This script generates parameterized URLs for one-click CloudFormation template deployment
 * across different AWS regions.
 */

const crypto = require('crypto');

// AWS regions where Cost Optimizer is available
const regions = [
  'us-east-1',
  'us-east-2', 
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1'
];

// Template URL (will be updated once S3 bucket is deployed)
const templateBaseUrl = 'https://aws-cost-optimizer-dev-cloudformation-templates.s3.eu-west-2.amazonaws.com/v1/aws-cost-optimizer-role.yaml';

/**
 * Generate a secure external ID
 */
function generateExternalId(accountHint = '') {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  const hint = accountHint ? `-${accountHint.slice(-4)}` : '';
  return `cost-saver-${timestamp}-${random}${hint}`;
}

/**
 * Generate one-click deploy URL for a specific region
 */
function generateDeployUrl(region, externalId, roleName = 'AWSCostOptimizerRole') {
  const baseUrl = `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/new`;
  
  const params = {
    templateURL: templateBaseUrl,
    stackName: 'AWS-Cost-Optimizer-Role',
    'param_ExternalId': externalId,
    'param_RoleName': roleName
  };
  
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
    
  return `${baseUrl}?${queryString}`;
}

/**
 * Generate quick setup instructions
 */
function generateSetupInstructions(externalId) {
  return {
    externalId,
    instructions: [
      "1. Choose your AWS region below",
      "2. Click the 'Deploy to AWS' button",  
      "3. In AWS Console, click 'Next' → 'Next' → 'Create Stack'",
      "4. Wait for stack creation (2-3 minutes)",
      "5. Copy the Role ARN from the 'Outputs' tab",
      "6. Return to Cost Optimizer and paste the Role ARN",
      "7. Start your first analysis!"
    ],
    deployUrls: regions.map(region => ({
      region,
      regionName: getRegionName(region),
      deployUrl: generateDeployUrl(region, externalId)
    }))
  };
}

/**
 * Get human-readable region name
 */
function getRegionName(region) {
  const regionNames = {
    'us-east-1': 'US East (N. Virginia)',
    'us-east-2': 'US East (Ohio)',
    'us-west-1': 'US West (N. California)', 
    'us-west-2': 'US West (Oregon)',
    'eu-west-1': 'Europe (Ireland)',
    'eu-west-2': 'Europe (London)',
    'eu-central-1': 'Europe (Frankfurt)',
    'ap-southeast-1': 'Asia Pacific (Singapore)',
    'ap-southeast-2': 'Asia Pacific (Sydney)',
    'ap-northeast-1': 'Asia Pacific (Tokyo)'
  };
  return regionNames[region] || region;
}

/**
 * Generate markdown documentation for the setup
 */
function generateMarkdown(setupData) {
  const { externalId, instructions, deployUrls } = setupData;
  
  return `# AWS Cost Optimizer - One-Click Setup

**External ID:** \`${externalId}\`

## Setup Instructions

${instructions.map(instruction => instruction).join('\n')}

## Deploy to Your AWS Region

Choose your AWS region and click the "Deploy to AWS" button:

${deployUrls.map(({ region, regionName, deployUrl }) => 
  `### ${regionName} (\`${region}\`)
[![Deploy to AWS](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](${deployUrl})`
).join('\n\n')}

## Manual Setup (Alternative)

If you prefer manual setup:

1. **Template URL:** \`${templateBaseUrl}\`
2. **External ID:** \`${externalId}\`
3. **Stack Name:** \`AWS-Cost-Optimizer-Role\`

## Troubleshooting

- **Permission Denied:** Ensure you have CloudFormation and IAM permissions
- **Stack Creation Failed:** Check the CloudFormation events tab for details  
- **Role Not Found:** Verify the stack created successfully and check outputs
- **Connection Failed:** Ensure the Role ARN and External ID are correct

## Security

This CloudFormation template creates:
- ✅ Read-only access to your AWS resources
- ✅ Secure cross-account role with external ID
- ✅ No write permissions to your infrastructure
- ✅ Limited to cost analysis and optimization only

Questions? Contact support@awscostoptimizer.com
`;
}

// Main execution
if (require.main === module) {
  const accountHint = process.argv[2] || '';
  const externalId = generateExternalId(accountHint);
  const setupData = generateSetupInstructions(externalId);
  
  if (process.argv.includes('--markdown')) {
    console.log(generateMarkdown(setupData));
  } else if (process.argv.includes('--json')) {
    console.log(JSON.stringify(setupData, null, 2));
  } else {
    console.log('AWS Cost Optimizer - CloudFormation Setup Generator');
    console.log('='.repeat(55));
    console.log(`External ID: ${externalId}`);
    console.log('');
    console.log('Deploy URLs by Region:');
    setupData.deployUrls.forEach(({ region, regionName, deployUrl }) => {
      console.log(`  ${regionName} (${region}):`);
      console.log(`    ${deployUrl}`);
      console.log('');
    });
    
    console.log('Usage:');
    console.log('  node generate-deploy-links.js [account-hint] [--json|--markdown]');
    console.log('');
    console.log('Examples:');
    console.log('  node generate-deploy-links.js                    # Basic output');
    console.log('  node generate-deploy-links.js 123456789012 --json # JSON output with account hint');
    console.log('  node generate-deploy-links.js --markdown          # Markdown documentation');
  }
}

module.exports = {
  generateExternalId,
  generateDeployUrl,
  generateSetupInstructions,
  generateMarkdown
};