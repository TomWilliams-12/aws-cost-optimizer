#!/bin/bash

# Quick script to check Lambda logs
echo "Checking recent Lambda logs for accounts function..."
echo ""

# Get the log group name
LOG_GROUP="/aws/lambda/aws-cost-optimizer-dev-accounts"

# Get recent log streams
echo "Recent log streams:"
aws logs describe-log-streams \
  --log-group-name "$LOG_GROUP" \
  --order-by LastEventTime \
  --descending \
  --limit 5 \
  --query 'logStreams[*].[logStreamName, lastEventTime]' \
  --output table

echo ""
echo "To view the latest logs, run:"
echo "aws logs tail $LOG_GROUP --follow"