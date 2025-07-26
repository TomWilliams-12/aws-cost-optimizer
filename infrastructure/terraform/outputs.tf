output "api_gateway_url" {
  description = "HTTP API Gateway URL"
  value       = "${aws_apigatewayv2_api.main.execution_arn}/${var.stage}/"
}

output "api_gateway_invoke_url" {
  description = "HTTP API Gateway Invoke URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "users_table_name" {
  description = "Users DynamoDB table name"
  value       = aws_dynamodb_table.main["users"].name
}

output "accounts_table_name" {
  description = "Accounts DynamoDB table name"
  value       = aws_dynamodb_table.main["accounts"].name
}

output "analyses_table_name" {
  description = "Analyses DynamoDB table name"
  value       = aws_dynamodb_table.main["analyses"].name
}

output "reports_table_name" {
  description = "Reports DynamoDB table name"
  value       = aws_dynamodb_table.main["reports"].name
}

output "reports_bucket_name" {
  description = "Reports S3 bucket name"
  value       = aws_s3_bucket.reports.id
}

output "frontend_bucket_name" {
  description = "Frontend S3 bucket name"
  value       = aws_s3_bucket.frontend.id
}

output "app_secrets_arn" {
  description = "Application secrets ARN"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "cloudformation_templates_bucket" {
  description = "CloudFormation templates S3 bucket name"
  value       = aws_s3_bucket.cloudformation_templates.id
}

output "cloudformation_template_url" {
  description = "Public URL for the IAM role CloudFormation template"
  value       = "https://${aws_s3_bucket.cloudformation_templates.bucket}.s3.${var.aws_region}.amazonaws.com/v1/aws-cost-optimizer-role.yaml"
}

output "one_click_deploy_url" {
  description = "One-click deploy URL for CloudFormation template"
  value       = "https://console.aws.amazon.com/cloudformation/home?region=${var.aws_region}#/stacks/new?templateURL=https%3A//${aws_s3_bucket.cloudformation_templates.bucket}.s3.${var.aws_region}.amazonaws.com/v1/aws-cost-optimizer-role.yaml"
}
