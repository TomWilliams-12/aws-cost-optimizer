/**
 * Retrieves the JWT secret from AWS Secrets Manager
 * Handles both JSON format (with jwtSecret property) and raw string format
 */
export declare function getJwtSecret(): Promise<string>;
/**
 * Verifies a JWT token and returns the decoded payload
 */
export declare function verifyJwtToken(token: string): Promise<any>;
/**
 * Authenticates a user from the Authorization header
 * Returns null if authentication fails
 */
export declare function authenticateUser(headers: any): Promise<{
    userId: string;
    email: string;
    subscriptionTier: string;
} | null>;
/**
 * Creates a JWT token with the given payload
 */
export declare function createJwtToken(payload: any, expiresIn?: string | number): Promise<string>;
