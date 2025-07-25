terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

variable "stage" {
  description = "Environment stage"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "aws-cost-optimizer"
}

variable "trusted_account_id" {
  description = "AWS account ID that can assume cross-account roles"
  type        = string
  default     = "123456789012" # Replace with actual account ID
}

locals {
  name_prefix = "${var.project_name}-${var.stage}"
} 
