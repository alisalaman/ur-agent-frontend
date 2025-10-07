import Hapi from '@hapi/hapi';
import Joi from '@hapi/joi';
import { JWTService, User } from '../services/jwt-service';
import { logger } from '../utils/logging';

const loginSchema = Joi.object({
    userId: Joi.string().required(),
    email: Joi.string().email().optional(),
    name: Joi.string().optional(),
    role: Joi.string().optional(),
});

const refreshSchema = Joi.object({
    refreshToken: Joi.string().required(),
    sessionId: Joi.string().required(),
});

export const authRoutes: Hapi.Plugin<{}> = {
    name: 'auth-routes',
    register: async (server: Hapi.Server): Promise<void> => {
        const jwtService = new JWTService();

        // Login endpoint - generates access and refresh tokens
        server.route({
            method: 'POST',
            path: '/api/v1/auth/login',
            options: {
                auth: false,
                validate: {
                    payload: loginSchema,
                },
            },
            handler: async (request, h) => {
                try {
                    const { userId, email, name, role } = request.payload as {
                        userId: string;
                        email?: string;
                        name?: string;
                        role?: string;
                    };
                    const sessionId = Math.random().toString(36).substr(2, 9);

                    const user: User = {
                        id: userId,
                        ...(email && { email }),
                        ...(name && { name }),
                        ...(role && { role }),
                    };

                    const accessToken = jwtService.generateAccessToken(user, sessionId);
                    const refreshToken = jwtService.generateRefreshToken(user, sessionId);

                    logger.info('User logged in successfully', { userId, sessionId });

                    return h.response({
                        success: true,
                        accessToken,
                        refreshToken,
                        sessionId,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role,
                        },
                        expiresIn: 3600, // 1 hour
                    });
                } catch (error) {
                    logger.error('Login failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    return h
                        .response({
                            success: false,
                            error: 'Login failed',
                        })
                        .code(500);
                }
            },
        });

        // Refresh token endpoint
        server.route({
            method: 'POST',
            path: '/api/v1/auth/refresh',
            options: {
                auth: false,
                validate: {
                    payload: refreshSchema,
                },
            },
            handler: async (request, h) => {
                try {
                    const { refreshToken, sessionId } = request.payload as {
                        refreshToken: string;
                        sessionId: string;
                    };

                    // For demo purposes, we'll create a mock user
                    // In production, you'd fetch the user from your database
                    const user: User = {
                        id: 'demo-user',
                        email: 'demo@example.com',
                        name: 'Demo User',
                        role: 'user',
                    };

                    const newAccessToken = jwtService.refreshAccessToken(refreshToken, user, sessionId);

                    logger.info('Token refreshed successfully', { sessionId });

                    return h.response({
                        success: true,
                        accessToken: newAccessToken,
                        expiresIn: 3600, // 1 hour
                    });
                } catch (error) {
                    logger.error('Token refresh failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    return h
                        .response({
                            success: false,
                            error: 'Invalid refresh token',
                        })
                        .code(401);
                }
            },
        });

        // Verify token endpoint
        server.route({
            method: 'GET',
            path: '/api/v1/auth/verify',
            options: {
                auth: false,
            },
            handler: async (request, h) => {
                try {
                    const authHeader = request.headers.authorization;
                    const token = jwtService.extractTokenFromHeader(authHeader);

                    if (!token) {
                        return h
                            .response({
                                success: false,
                                error: 'No token provided',
                            })
                            .code(401);
                    }

                    const payload = jwtService.verifyAccessToken(token);

                    return h.response({
                        success: true,
                        payload: {
                            userId: payload.userId,
                            sessionId: payload.sessionId,
                            type: payload.type,
                            exp: payload.exp,
                            iat: payload.iat,
                        },
                    });
                } catch (error) {
                    logger.error('Token verification failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    return h
                        .response({
                            success: false,
                            error: 'Invalid token',
                        })
                        .code(401);
                }
            },
        });

        // Get WebSocket token endpoint - generates a token specifically for WebSocket connection
        server.route({
            method: 'POST',
            path: '/api/v1/auth/websocket-token',
            options: {
                auth: 'session', // Require session authentication
                validate: {
                    payload: Joi.object({
                        sessionId: Joi.string().required(),
                    }),
                },
            },
            handler: async (request, h) => {
                try {
                    const { sessionId } = request.payload as { sessionId: string };
                    const userId = request.auth.credentials.userId;

                    const user: User = {
                        id: userId as string,
                        email: request.auth.credentials.email as string,
                        name: request.auth.credentials.name as string,
                        role: request.auth.credentials.role as string,
                    };

                    const accessToken = jwtService.generateAccessToken(user, sessionId);

                    logger.info('WebSocket token generated', { userId, sessionId });

                    return h.response({
                        success: true,
                        token: accessToken,
                        sessionId,
                        expiresIn: 3600, // 1 hour
                    });
                } catch (error) {
                    logger.error('WebSocket token generation failed', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    return h
                        .response({
                            success: false,
                            error: 'Token generation failed',
                        })
                        .code(500);
                }
            },
        });
    },
};
