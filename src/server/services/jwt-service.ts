import jwt from 'jsonwebtoken';
import { appConfig } from '../config';
import { logger } from '../utils/logging';

export interface JWTPayload {
  userId: string;
  sessionId: string;
  type: 'access_token' | 'refresh_token';
  email?: string;
  name?: string;
  role?: string;
  exp: number;
  iat: number;
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

export class JWTService {
  private jwtSecret: string;
  private accessTokenExpiry: number;
  private refreshTokenExpiry: number;

  constructor() {
    this.jwtSecret = appConfig.jwt.secret;
    this.accessTokenExpiry = appConfig.jwt.accessTokenExpiry;
    this.refreshTokenExpiry = appConfig.jwt.refreshTokenExpiry;

    if (!this.jwtSecret || this.jwtSecret === 'default-jwt-secret-change-in-production') {
      logger.error('JWT_SECRET is not properly configured. Please set a secure JWT_SECRET in your environment variables.');
      throw new Error('JWT_SECRET is not properly configured');
    }
  }

  /**
   * Generates an access token for a user
   * @param user - User information
   * @param sessionId - Session identifier
   * @returns JWT access token
   */
  generateAccessToken(user: User, sessionId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      userId: user.id,
      sessionId,
      type: 'access_token',
      exp: now + this.accessTokenExpiry,
      iat: now,
    };

    // Add optional properties only if they exist
    if (user.email) payload.email = user.email;
    if (user.name) payload.name = user.name;
    if (user.role) payload.role = user.role;

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Generates a refresh token for a user
   * @param user - User information
   * @param sessionId - Session identifier
   * @returns JWT refresh token
   */
  generateRefreshToken(user: User, sessionId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      userId: user.id,
      sessionId,
      type: 'refresh_token',
      exp: now + this.refreshTokenExpiry,
      iat: now,
    };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Verifies and decodes a JWT token
   * @param token - JWT token to verify
   * @returns Decoded token payload
   * @throws Error if token is invalid
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as JWTPayload;

      // Additional validation
      if (!decoded.userId || !decoded.sessionId || !decoded.type) {
        throw new Error('Invalid token payload');
      }

      return decoded;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('JWT token verification failed', { error: errorMessage });
      throw new Error(`Invalid JWT token: ${errorMessage}`);
    }
  }

  /**
   * Verifies a token and checks if it's an access token
   * @param token - JWT token to verify
   * @returns Decoded access token payload
   * @throws Error if token is invalid or not an access token
   */
  verifyAccessToken(token: string): JWTPayload {
    const decoded = this.verifyToken(token);

    if (decoded.type !== 'access_token') {
      throw new Error('Token is not an access token');
    }

    return decoded;
  }

  /**
   * Verifies a token and checks if it's a refresh token
   * @param token - JWT token to verify
   * @returns Decoded refresh token payload
   * @throws Error if token is invalid or not a refresh token
   */
  verifyRefreshToken(token: string): JWTPayload {
    const decoded = this.verifyToken(token);

    if (decoded.type !== 'refresh_token') {
      throw new Error('Token is not a refresh token');
    }

    return decoded;
  }

  /**
   * Refreshes an access token using a refresh token
   * @param refreshToken - Valid refresh token
   * @param user - User information
   * @param sessionId - Session identifier
   * @returns New access token
   * @throws Error if refresh token is invalid
   */
  refreshAccessToken(refreshToken: string, user: User, sessionId: string): string {
    const decoded = this.verifyRefreshToken(refreshToken);

    // Verify the session ID matches
    if (decoded.sessionId !== sessionId) {
      throw new Error('Session ID mismatch');
    }

    return this.generateAccessToken(user, sessionId);
  }

  /**
   * Extracts token from Authorization header
   * @param authHeader - Authorization header value
   * @returns Token string or null if not found
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Extracts token from WebSocket query parameters
   * @param query - WebSocket query parameters
   * @returns Token string or null if not found
   */
  extractTokenFromQuery(query: unknown): string | null {
    if (!query || typeof query !== 'object') return null;
    const queryObj = query as { token?: string };
    return queryObj.token || null;
  }
}
