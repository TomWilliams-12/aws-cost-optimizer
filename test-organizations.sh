#!/bin/bash

# Test the organizations detect endpoint
API_URL="https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev"
AUTH_TOKEN="$1"

if [ -z "$AUTH_TOKEN" ]; then
    echo "Usage: ./test-organizations.sh <auth_token>"
    echo "Get auth token from browser developer tools after logging in"
    exit 1
fi

echo "Testing organizations/detect endpoint..."
curl -X POST "$API_URL/organizations/detect" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"region": "eu-west-2", "roleArn": "test"}' \
  -v