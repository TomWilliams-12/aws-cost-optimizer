# DynamoDB table configurations
locals {
  dynamodb_tables = {
    users = {
      hash_key = "userId"
      attributes = [
        {
          name = "userId"
          type = "S"
        },
        {
          name = "email"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name            = "EmailIndex"
          hash_key        = "email"
          range_key       = null
          projection_type = "ALL"
        }
      ]
      ttl_enabled = false
    }

    accounts = {
      hash_key = "accountId"
      attributes = [
        {
          name = "accountId"
          type = "S"
        },
        {
          name = "userId"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name            = "UserIndex"
          hash_key        = "userId"
          range_key       = null
          projection_type = "ALL"
        }
      ]
      ttl_enabled = false
    }

    analyses = {
      hash_key = "analysisId"
      attributes = [
        {
          name = "analysisId"
          type = "S"
        },
        {
          name = "userId"
          type = "S"
        },
        {
          name = "createdAt"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name            = "UserAnalysesIndex"
          hash_key        = "userId"
          range_key       = "createdAt"
          projection_type = "ALL"
        }
      ]
      ttl_enabled = true
    }

    reports = {
      hash_key = "reportId"
      attributes = [
        {
          name = "reportId"
          type = "S"
        },
        {
          name = "userId"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name            = "UserReportsIndex"
          hash_key        = "userId"
          range_key       = null
          projection_type = "ALL"
        }
      ]
      ttl_enabled = true
    }

    organizations = {
      hash_key = "id"
      attributes = [
        {
          name = "id"
          type = "S"
        },
        {
          name = "organizationId"
          type = "S"
        },
        {
          name = "userId"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name            = "OrganizationIndex"
          hash_key        = "organizationId"
          range_key       = null
          projection_type = "ALL"
        },
        {
          name            = "UserOrganizationsIndex"
          hash_key        = "userId"
          range_key       = null
          projection_type = "ALL"
        }
      ]
      ttl_enabled = false
    }

    organization_accounts = {
      hash_key = "organizationId"
      range_key = "accountId"
      attributes = [
        {
          name = "organizationId"
          type = "S"
        },
        {
          name = "accountId"
          type = "S"
        },
        {
          name = "userId"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name            = "UserOrgAccountsIndex"
          hash_key        = "userId"
          range_key       = null
          projection_type = "ALL"
        }
      ]
      ttl_enabled = false
    }
  }
}

# DynamoDB Tables
resource "aws_dynamodb_table" "main" {
  for_each = local.dynamodb_tables

  name         = "${local.name_prefix}-${each.key}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = each.value.hash_key
  range_key    = lookup(each.value, "range_key", null)

  dynamic "attribute" {
    for_each = each.value.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  dynamic "global_secondary_index" {
    for_each = each.value.global_secondary_indexes
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      range_key       = global_secondary_index.value.range_key
      projection_type = global_secondary_index.value.projection_type
    }
  }

  dynamic "ttl" {
    for_each = each.value.ttl_enabled ? [1] : []
    content {
      attribute_name = "ttl"
      enabled        = true
    }
  }

  tags = {
    Name        = "${local.name_prefix}-${each.key}"
    Environment = var.stage
  }
}
