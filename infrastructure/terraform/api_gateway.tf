# HTTP API Gateway configuration (cheaper and simpler than REST API)
locals {
  # HTTP API routes configuration
  api_routes = {
    "POST /auth"         = "auth"
    "GET /accounts"      = "accounts"
    "POST /accounts"     = "accounts"
    "POST /analysis"     = "analysis"
    "GET /analysis/{accountId}" = "analysis"
    "POST /reports"      = "reports"
    "GET /reports/{id}"  = "reports"
    "POST /subscriptions" = "stripe"
    "POST /webhooks/stripe" = "stripe"
    "POST /organizations/detect" = "organizations"
    "POST /organizations/deploy" = "organizations"
    "GET /organizations/{organizationId}/status" = "organizations"
  }
}

# HTTP API Gateway (v2)
resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "AWS Cost Optimizer HTTP API"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["content-type", "x-amz-date", "authorization", "x-api-key", "x-amz-security-token"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins     = ["*"]
    max_age           = 86400
  }

  tags = {
    Name        = "${local.name_prefix}-api"
    Environment = var.stage
  }
}

# Authorizer removed - authentication now handled inside Lambda functions

# HTTP API integrations
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = local.api_routes

  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.main[each.value].invoke_arn
  
  payload_format_version = "2.0"
}

# HTTP API routes
resource "aws_apigatewayv2_route" "lambda" {
  for_each = local.api_routes

  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.key].id}"
  
  # Explicitly set to NONE to remove any existing authorizer references
  authorization_type = "NONE"
}

# HTTP API stage
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.stage
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 1000
    throttling_burst_limit = 2000
  }

  tags = {
    Name        = "${local.name_prefix}-api-${var.stage}"
    Environment = var.stage
  }
}

# Authorizer permission removed - no longer needed

# Lambda permissions for HTTP API Gateway
resource "aws_lambda_permission" "api_gateway" {
  for_each = local.lambda_functions

  statement_id  = "AllowExecutionFromHTTPAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.main[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}