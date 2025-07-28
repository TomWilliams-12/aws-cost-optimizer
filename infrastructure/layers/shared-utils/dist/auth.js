"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecret = getJwtSecret;
exports.verifyJwtToken = verifyJwtToken;
exports.authenticateUser = authenticateUser;
exports.createJwtToken = createJwtToken;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const jwt = __importStar(require("jsonwebtoken"));
const secretsClient = new client_secrets_manager_1.SecretsManagerClient({ region: process.env.AWS_REGION });
// Cache the JWT secret to avoid repeated Secrets Manager calls
let cachedJwtSecret;
/**
 * Retrieves the JWT secret from AWS Secrets Manager
 * Handles both JSON format (with jwtSecret property) and raw string format
 */
async function getJwtSecret() {
    if (cachedJwtSecret) {
        return cachedJwtSecret;
    }
    try {
        const secretId = process.env.APP_SECRETS_ARN || process.env.JWT_SECRET_NAME || 'aws-cost-optimizer-jwt-secret';
        const command = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: secretId });
        const response = await secretsClient.send(command);
        if (!response.SecretString) {
            throw new Error('Secret value is empty');
        }
        try {
            // Try to parse as JSON (format used by auth handler)
            const secrets = JSON.parse(response.SecretString);
            cachedJwtSecret = secrets.jwtSecret;
        }
        catch {
            // If not JSON, use as raw string
            cachedJwtSecret = response.SecretString;
        }
        if (!cachedJwtSecret) {
            throw new Error('JWT secret not found in secret value');
        }
        return cachedJwtSecret;
    }
    catch (error) {
        console.error('Error retrieving JWT secret:', error);
        throw new Error('Failed to retrieve JWT secret');
    }
}
/**
 * Verifies a JWT token and returns the decoded payload
 */
async function verifyJwtToken(token) {
    const secret = await getJwtSecret();
    return jwt.verify(token, secret);
}
/**
 * Authenticates a user from the Authorization header
 * Returns null if authentication fails
 */
async function authenticateUser(headers) {
    try {
        const authHeader = headers?.Authorization || headers?.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        const token = authHeader.replace('Bearer ', '');
        const decoded = await verifyJwtToken(token);
        if (!decoded.userId || !decoded.email) {
            return null;
        }
        return {
            userId: decoded.userId,
            email: decoded.email,
            subscriptionTier: decoded.subscriptionTier || 'starter'
        };
    }
    catch (error) {
        console.error('Authentication error:', error);
        return null;
    }
}
/**
 * Creates a JWT token with the given payload
 */
async function createJwtToken(payload, expiresIn = '7d') {
    const secret = await getJwtSecret();
    return jwt.sign(payload, secret, { expiresIn });
}
//# sourceMappingURL=auth.js.map