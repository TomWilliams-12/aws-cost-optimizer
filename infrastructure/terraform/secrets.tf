# Application Secrets
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${local.name_prefix}/app-secrets"
  description = "Application secrets for AWS Cost Optimizer"

  tags = {
    Name        = "${local.name_prefix}-app-secrets"
    Environment = var.stage
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    jwtSecret           = "super-secret-jwt-key-that-is-long-and-random-${random_password.jwt_secret.result}"
    stripeSecretKey     = "your-stripe-secret-key"
    stripeWebhookSecret = "your-stripe-webhook-secret"
  })
}

resource "random_password" "jwt_secret" {
  length  = 32
  special = true
} 
