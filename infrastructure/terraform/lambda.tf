# Lambda configuration
locals {
  # Common environment variables for all lambdas
  lambda_environment_variables = {
    STAGE           = var.stage
    REGION          = var.aws_region
    USERS_TABLE     = aws_dynamodb_table.main["users"].name
    ACCOUNTS_TABLE  = aws_dynamodb_table.main["accounts"].name
    ANALYSES_TABLE  = aws_dynamodb_table.main["analyses"].name
    REPORTS_TABLE   = aws_dynamodb_table.main["reports"].name
    ORGANIZATIONS_TABLE = aws_dynamodb_table.main["organizations"].name
    ORG_ACCOUNTS_TABLE = aws_dynamodb_table.main["organization_accounts"].name
    REPORTS_BUCKET  = aws_s3_bucket.reports.id
    APP_SECRETS_ARN = aws_secretsmanager_secret.app_secrets.arn
    JWT_SECRET_NAME = aws_secretsmanager_secret.app_secrets.name
    TRUSTED_ACCOUNT_ID = var.trusted_account_id
  }

  # Lambda function configurations
  lambda_functions = {
    auth = {
      handler     = "index.handler"
      timeout     = 30
      memory_size = 256
    }
    accounts = {
      handler     = "index.handler"
      timeout     = 30
      memory_size = 256
    }
    analysis = {
      handler     = "index.handler"
      timeout     = 300
      memory_size = 1024
    }
    reports = {
      handler     = "index.handler"
      timeout     = 300
      memory_size = 1024
    }
    stripe = {
      handler     = "index.handler"
      timeout     = 30
      memory_size = 256
    }
    organizations = {
      handler     = "index.handler"
      timeout     = 300
      memory_size = 512
    }
  }
}

# Lambda execution role
resource "aws_iam_role" "lambda_execution_role" {
  name = "${local.name_prefix}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${local.name_prefix}-lambda-execution-role"
    Environment = var.stage
  }
}

# Attach basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_execution_role.name
}

# DynamoDB policy
resource "aws_iam_role_policy" "lambda_dynamodb_policy" {
  name = "${local.name_prefix}-lambda-dynamodb-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.main["users"].arn,
          aws_dynamodb_table.main["accounts"].arn,
          aws_dynamodb_table.main["analyses"].arn,
          aws_dynamodb_table.main["reports"].arn,
          aws_dynamodb_table.main["organizations"].arn,
          aws_dynamodb_table.main["organization_accounts"].arn,
          "${aws_dynamodb_table.main["users"].arn}/index/*",
          "${aws_dynamodb_table.main["accounts"].arn}/index/*",
          "${aws_dynamodb_table.main["analyses"].arn}/index/*",
          "${aws_dynamodb_table.main["reports"].arn}/index/*",
          "${aws_dynamodb_table.main["organizations"].arn}/index/*",
          "${aws_dynamodb_table.main["organization_accounts"].arn}/index/*"
        ]
      }
    ]
  })
}

# S3 policy
resource "aws_iam_role_policy" "lambda_s3_policy" {
  name = "${local.name_prefix}-lambda-s3-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion"
        ]
        Resource = "${aws_s3_bucket.reports.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.reports.arn
      }
    ]
  })
}

# Secrets Manager policy
resource "aws_iam_role_policy" "lambda_secrets_policy" {
  name = "${local.name_prefix}-lambda-secrets-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      }
    ]
  })
}

# AWS Analysis policy
resource "aws_iam_role_policy" "lambda_aws_analysis_policy" {
  name = "${local.name_prefix}-lambda-aws-analysis-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
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
          "ce:GetReservationPurchaseRecommendation",
          "support:*",
          "sts:AssumeRole",
          "sts:GetCallerIdentity",
          "organizations:DescribeOrganization",
          "organizations:ListAccounts",
          "organizations:ListOrganizationalUnitsForParent",
          "organizations:ListRoots",
          "cloudformation:CreateStackSet",
          "cloudformation:DescribeStackSet",
          "cloudformation:CreateStackInstances",
          "cloudformation:ListStackInstances",
          "cloudformation:UpdateStackSet",
          "cloudformation:DeleteStackInstances",
          "cloudformation:DeleteStackSet"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["sts:AssumeRole"]
        Resource = "arn:aws:iam::*:role/CostOptimizerAnalysisRole"
      }
    ]
  })
}

# Lambda functions using for_each with individual packages
resource "aws_lambda_function" "main" {
  for_each = local.lambda_functions

  filename         = "${path.module}/../lambdas/${each.key}/${each.key}.zip"
  function_name    = "${local.name_prefix}-${each.key}"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = each.value.handler
  runtime          = "nodejs22.x"
  timeout          = each.value.timeout
  memory_size      = each.value.memory_size
  source_code_hash = filebase64sha256("${path.module}/../lambdas/${each.key}/${each.key}.zip")

  environment {
    variables = local.lambda_environment_variables
  }

  tags = {
    Name        = "${local.name_prefix}-${each.key}"
    Environment = var.stage
  }
}
