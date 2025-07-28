"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
exports.validateEmail = validateEmail;
exports.validateAwsAccountId = validateAwsAccountId;
exports.validateAwsRegion = validateAwsRegion;
exports.validateRoleArn = validateRoleArn;
exports.sanitizeInput = sanitizeInput;
exports.generateTtl = generateTtl;
exports.parseQueryParameters = parseQueryParameters;
exports.parsePathParameters = parsePathParameters;
exports.handleCorsPreflightRequest = handleCorsPreflightRequest;
function createSuccessResponse(data, statusCode = 200, message) {
    const response = {
        success: true,
        data,
        ...(message && { message }),
    };
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: JSON.stringify(response),
    };
}
function createErrorResponse(statusCode, error, code, details) {
    const response = {
        success: false,
        error,
        ...(code && { code }),
        ...(details && { details }),
    };
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: JSON.stringify(response),
    };
}
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
function validateAwsAccountId(accountId) {
    const accountIdRegex = /^\d{12}$/;
    return accountIdRegex.test(accountId);
}
function validateAwsRegion(region) {
    const validRegions = [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
        'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
        'ca-central-1', 'sa-east-1', 'ap-south-1',
    ];
    return validRegions.includes(region);
}
function validateRoleArn(roleArn) {
    const roleArnRegex = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/;
    return roleArnRegex.test(roleArn);
}
function sanitizeInput(input, maxLength = 255) {
    return input.trim().substring(0, maxLength);
}
function generateTtl(daysFromNow) {
    return Math.floor(Date.now() / 1000) + (daysFromNow * 24 * 60 * 60);
}
function parseQueryParameters(event) {
    return event.queryStringParameters || {};
}
function parsePathParameters(event) {
    return event.pathParameters || {};
}
function handleCorsPreflightRequest() {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Max-Age': '86400',
        },
        body: '',
    };
}
//# sourceMappingURL=response.js.map