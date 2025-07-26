#!/usr/bin/env node

/**
 * Debug script to test Elastic IP detection
 * Run this to see what IPs are found and their association status
 */

const { EC2Client, DescribeAddressesCommand } = require('@aws-sdk/client-ec2');

async function debugElasticIPs() {
  console.log('🔍 Debugging Elastic IP Detection...\n');
  
  // You'll need to configure AWS credentials
  const ec2Client = new EC2Client({ 
    region: process.env.AWS_REGION || 'us-east-1' 
  });
  
  try {
    const { Addresses } = await ec2Client.send(new DescribeAddressesCommand({}));
    
    console.log(`📊 Found ${Addresses?.length || 0} total Elastic IP addresses\n`);
    
    let unusedCount = 0;
    let usedCount = 0;
    
    for (const address of Addresses || []) {
      const isUnused = !address.InstanceId && 
                      !address.NetworkInterfaceId && 
                      !address.AssociationId;
      
      if (isUnused) {
        unusedCount++;
        console.log(`❌ UNUSED: ${address.PublicIp}`);
        console.log(`   Allocation ID: ${address.AllocationId}`);
        console.log(`   Domain: ${address.Domain}`);
        console.log(`   Monthly Cost: $3.65\n`);
      } else {
        usedCount++;
        console.log(`✅ IN USE: ${address.PublicIp}`);
        if (address.InstanceId) {
          console.log(`   → Associated with Instance: ${address.InstanceId}`);
        }
        if (address.NetworkInterfaceId) {
          console.log(`   → Associated with Network Interface: ${address.NetworkInterfaceId}`);
        }
        if (address.AssociationId) {
          console.log(`   → Association ID: ${address.AssociationId}`);
        }
        if (address.PrivateIpAddress) {
          console.log(`   → Private IP: ${address.PrivateIpAddress}`);
        }
        console.log('');
      }
    }
    
    console.log('📈 SUMMARY:');
    console.log(`   Used IPs: ${usedCount}`);
    console.log(`   Unused IPs: ${unusedCount}`);
    console.log(`   Monthly waste: $${(unusedCount * 3.65).toFixed(2)}`);
    console.log(`   Annual waste: $${(unusedCount * 3.65 * 12).toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.name === 'UnauthorizedOperation') {
      console.log('\n💡 Tip: Make sure your AWS credentials have ec2:DescribeAddresses permission');
    }
    
    if (error.name === 'CredentialsError') {
      console.log('\n💡 Tip: Configure AWS credentials using:');
      console.log('   - AWS CLI: aws configure');
      console.log('   - Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
      console.log('   - IAM roles (if running on EC2)');
    }
  }
}

// Run the debug script
if (require.main === module) {
  console.log('AWS Elastic IP Debug Tool');
  console.log('========================\n');
  
  const region = process.env.AWS_REGION || 'us-east-1';
  console.log(`Region: ${region}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  debugElasticIPs().catch(console.error);
}

module.exports = { debugElasticIPs };