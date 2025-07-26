# S3 bucket for hosting CloudFormation templates
resource "aws_s3_bucket" "cloudformation_templates" {
  bucket = "${local.name_prefix}-cloudformation-templates"

  tags = {
    Name        = "${local.name_prefix}-cloudformation-templates"
    Environment = var.stage
    Purpose     = "CloudFormation template hosting"
  }
}

# Bucket versioning
resource "aws_s3_bucket_versioning" "cloudformation_templates" {
  bucket = aws_s3_bucket.cloudformation_templates.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Bucket public access block (initially block all, we'll use bucket policy for specific access)
resource "aws_s3_bucket_public_access_block" "cloudformation_templates" {
  bucket = aws_s3_bucket.cloudformation_templates.id

  block_public_acls       = true
  block_public_policy     = false  # Allow bucket policy for public read
  ignore_public_acls      = true
  restrict_public_buckets = false  # Allow public read via bucket policy
}

# Bucket policy for public read access to CloudFormation templates
resource "aws_s3_bucket_policy" "cloudformation_templates_policy" {
  bucket = aws_s3_bucket.cloudformation_templates.id
  depends_on = [aws_s3_bucket_public_access_block.cloudformation_templates]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadAccess"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.cloudformation_templates.arn}/*"
        Condition = {
          StringEquals = {
            "s3:ExistingObjectTag/Public" = "true"
          }
        }
      }
    ]
  })
}

# Upload the CloudFormation template
resource "aws_s3_object" "iam_role_template" {
  bucket = aws_s3_bucket.cloudformation_templates.id
  key    = "v1/aws-cost-optimizer-role.yaml"
  source = "${path.module}/../cloudformation/aws-cost-optimizer-role.yaml"
  etag   = filemd5("${path.module}/../cloudformation/aws-cost-optimizer-role.yaml")

  content_type = "text/yaml"
  
  tags = {
    Public      = "true"  # This tag allows public access via bucket policy
    Version     = "1.0"
    Environment = var.stage
  }
}

# Upload the Organization CloudFormation template
resource "aws_s3_object" "org_role_template" {
  bucket = aws_s3_bucket.cloudformation_templates.id
  key    = "v1/aws-cost-optimizer-organization-role.yaml"
  source = "${path.module}/../cloudformation/aws-cost-optimizer-organization-role.yaml"
  etag   = filemd5("${path.module}/../cloudformation/aws-cost-optimizer-organization-role.yaml")

  content_type = "text/yaml"
  
  tags = {
    Public      = "true"  # This tag allows public access via bucket policy
    Version     = "1.0"
    Environment = var.stage
    Type        = "Organization"
  }
}

# Create a JSON metadata file for versioning
resource "aws_s3_object" "template_metadata" {
  bucket = aws_s3_bucket.cloudformation_templates.id
  key    = "metadata/templates.json"
  
  content = jsonencode({
    templates = {
      "aws-cost-optimizer-role" = {
        latest_version = "v1"
        versions = {
          "v1" = {
            file = "v1/aws-cost-optimizer-role.yaml"
            description = "Initial version - Complete IAM role setup for AWS Cost Optimizer"
            created_date = "2025-07-26"
            parameters = {
              ExternalId = {
                type = "String"
                description = "Unique external ID for secure role assumption"
                required = true
              }
              RoleName = {
                type = "String"
                description = "Name for the IAM role"
                default = "AWSCostOptimizerRole"
                required = false
              }
            }
            outputs = [
              "RoleArn",
              "ExternalId", 
              "AccountId",
              "SetupInstructions"
            ]
          }
        }
      }
      "aws-cost-optimizer-organization-role" = {
        latest_version = "v1"
        versions = {
          "v1" = {
            file = "v1/aws-cost-optimizer-organization-role.yaml"
            description = "Organization management role with StackSet deployment permissions"
            created_date = "2025-07-26"
            parameters = {
              ExternalId = {
                type = "String"
                description = "Unique external ID for secure role assumption"
                required = true
              }
              TrustedAccountId = {
                type = "String"
                description = "AWS Account ID of the Cost Optimizer service"
                required = true
              }
            }
            outputs = [
              "RoleArn",
              "ExternalId",
              "SetupInstructions"
            ]
          }
        }
      }
    }
    last_updated = "2025-07-26T20:00:00Z"
  })

  content_type = "application/json"
  
  tags = {
    Public      = "true"
    Version     = "1.0"
    Environment = var.stage
  }
}

# Outputs for CloudFormation template URLs
output "cloudformation_template_urls" {
  description = "URLs for CloudFormation templates"
  value = {
    individual_account = "https://${aws_s3_bucket.cloudformation_templates.bucket_domain_name}/v1/aws-cost-optimizer-role.yaml"
    organization       = "https://${aws_s3_bucket.cloudformation_templates.bucket_domain_name}/v1/aws-cost-optimizer-organization-role.yaml"
    bucket_name       = aws_s3_bucket.cloudformation_templates.id
  }
}