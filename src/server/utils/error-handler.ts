import { Request, ResponseToolkit } from '@hapi/hapi';
import { ChatServiceError } from '../types/errors';
import { logger } from './logging';

export function errorHandler(error: Error, request: Request, h: ResponseToolkit) {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    url: request.url.toString(),
    method: request.method,
    userAgent: request.headers['user-agent'],
    ip: request.info.remoteAddress,
  });

  if (error instanceof ChatServiceError) {
    return h
      .response({
        error: {
          code: error.code,
          message: error.message,
          isRetryable: error.isRetryable,
        },
      })
      .code(error.statusCode);
  }

  // Handle Hapi validation errors
  if (error.name === 'ValidationError') {
    return h
      .response({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.message,
        },
      })
      .code(400);
  }

  // Default error response
  return h
    .response({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      },
    })
    .code(500);
}

export function createErrorResponse(error: Error): any {
  if (error instanceof ChatServiceError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        isRetryable: error.isRetryable,
      },
    };
  }

  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
    },
  };
}
