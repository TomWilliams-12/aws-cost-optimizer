/**
 * Test script to debug Elastic IP detection
 * Run this to see what IPs are found and their association status
 */

import { EC2Client, DescribeAddressesCommand } from '@aws-sdk/client-ec2'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'

async function testElasticIPDetection() {
  console.log('🔍 Testing Elastic IP Detection...\n')
  
  // Use your account's role ARN and external ID here
  const ROLE_ARN = 'arn:aws:iam::YOUR_ACCOUNT:role/AWSCostOptimizerRole'
  const EXTERNAL_ID = 'your-external-id'
  const REGION = 'us-east-1' // or your preferred region
  
  try {
    // Step 1: Assume the role (same as in production)
    const stsClient = new STSClient({ region: REGION })
    const credentials = await stsClient.send(new AssumeRoleCommand({
      RoleArn: ROLE_ARN,
      RoleSessionName: `CostOptimizerTest-${Date.now()}`,
      ExternalId: EXTERNAL_ID,
      DurationSeconds: 3600,
    }))
    
    console.log('✅ Successfully assumed role')
    
    // Step 2: Create EC2 client with assumed role credentials
    const ec2Client = new EC2Client({
      region: REGION,
      credentials: {
        accessKeyId: credentials.Credentials!.AccessKeyId!,
        secretAccessKey: credentials.Credentials!.SecretAccessKey!,
        sessionToken: credentials.Credentials!.SessionToken!,
      },
    })
    
    // Step 3: Get all Elastic IP addresses
    const { Addresses } = await ec2Client.send(new DescribeAddressesCommand({}))
    
    console.log(`📊 Found ${Addresses?.length || 0} total Elastic IP addresses\n`)
    
    let unusedCount = 0
    let usedCount = 0
    
    for (const address of Addresses || []) {
      console.log(`🔍 Analyzing: ${address.PublicIp}`)
      console.log(`   Allocation ID: ${address.AllocationId}`)
      console.log(`   Domain: ${address.Domain}`)
      console.log(`   Instance ID: ${address.InstanceId || 'none'}`)
      console.log(`   Network Interface ID: ${address.NetworkInterfaceId || 'none'}`)
      console.log(`   Association ID: ${address.AssociationId || 'none'}`)
      console.log(`   Private IP: ${address.PrivateIpAddress || 'none'}`)
      
      // Check if unused using our enhanced logic
      const isUnused = !address.InstanceId && 
                      !address.NetworkInterfaceId && 
                      !address.AssociationId
      
      if (isUnused) {
        unusedCount++
        console.log(`   ❌ STATUS: UNUSED - $3.65/month waste`)
      } else {
        usedCount++
        console.log(`   ✅ STATUS: IN USE`)
      }
      console.log('')
    }
    
    console.log('📈 SUMMARY:')
    console.log(`   Used IPs: ${usedCount}`)
    console.log(`   Unused IPs: ${unusedCount}`)
    console.log(`   Monthly waste: $${(unusedCount * 3.65).toFixed(2)}`)
    console.log(`   Annual waste: $${(unusedCount * 3.65 * 12).toFixed(2)}`)
    
    if (unusedCount === 0 && usedCount > 0) {
      console.log('\n💡 All your Elastic IPs appear to be in use. If you expected to see unused IPs:')
      console.log('   1. Check if the IP might be associated with a load balancer or NAT gateway')
      console.log('   2. Verify you\'re checking the correct AWS region')
      console.log('   3. The IP might be associated via a network interface you\'re not seeing')
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    
    if (error.name === 'AccessDenied') {
      console.log('\n💡 Check:')
      console.log('   - Role ARN is correct')
      console.log('   - External ID matches')
      console.log('   - Role has ec2:DescribeAddresses permission')
    }
  }
}

// Run the test
if (require.main === module) {
  console.log('AWS Elastic IP Detection Test')
  console.log('============================\n')
  
  console.log('⚠️  SETUP REQUIRED:')
  console.log('   1. Edit this file and add your ROLE_ARN and EXTERNAL_ID')
  console.log('   2. Make sure you have AWS credentials configured')
  console.log('   3. Run: npx ts-node test-elastic-ip.ts\n')
  
  testElasticIPDetection().catch(console.error)
}

export { testElasticIPDetection }