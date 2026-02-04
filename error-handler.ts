/**
 * Centralized Error Handling Utility for NEXUS Agent Intelligence Marketplace
 * Provides consistent error handling patterns across the application
 */

export enum ErrorCode {
    // Network/API errors
    NETWORK_ERROR = 'NETWORK_ERROR',
    API_TIMEOUT = 'API_TIMEOUT',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    UNAUTHORIZED = 'UNAUTHORIZED',

    // Marketplace errors
    AGENT_NOT_REGISTERED = 'AGENT_NOT_REGISTERED',
    INTELLIGENCE_NOT_FOUND = 'INTELLIGENCE_NOT_FOUND',
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    INVALID_TRANSACTION = 'INVALID_TRANSACTION',

    // Wallet errors
    WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
    WALLET_CREATION_FAILED = 'WALLET_CREATION_FAILED',
    KEYPAIR_INVALID = 'KEYPAIR_INVALID',

    // Solana blockchain errors
    SOLANA_CONNECTION_FAILED = 'SOLANA_CONNECTION_FAILED',
    TRANSACTION_FAILED = 'TRANSACTION_FAILED',
    BALANCE_FETCH_FAILED = 'BALANCE_FETCH_FAILED',

    // File system errors
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    FILE_READ_ERROR = 'FILE_READ_ERROR',
    FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
    PERMISSION_DENIED = 'PERMISSION_DENIED',

    // Validation errors
    INVALID_INPUT = 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
    INVALID_FORMAT = 'INVALID_FORMAT',

    // General errors
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

export class NexusError extends Error {
    public readonly code: ErrorCode;
    public readonly details?: any;
    public readonly timestamp: number;
    public readonly retryable: boolean;

    constructor(
        code: ErrorCode,
        message: string,
        details?: any,
        retryable: boolean = false
    ) {
        super(message);
        this.name = 'NexusError';
        this.code = code;
        this.details = details;
        this.timestamp = Date.now();
        this.retryable = retryable;

        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, NexusError.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp,
            retryable: this.retryable,
            stack: this.stack
        };
    }
}

export interface RetryOptions {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private retryOptions: RetryOptions = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
    };

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Wraps an async function with error handling and optional retry logic
     */
    async withErrorHandling<T>(
        operation: () => Promise<T>,
        context: string,
        options?: Partial<RetryOptions>
    ): Promise<T> {
        const retryOpts = { ...this.retryOptions, ...options };
        let lastError: Error;

        for (let attempt = 0; attempt <= retryOpts.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = this.normalizeError(error, context);

                // Don't retry non-retryable errors
                if (lastError instanceof NexusError && !lastError.retryable) {
                    throw lastError;
                }

                // Don't retry on last attempt
                if (attempt === retryOpts.maxRetries) {
                    break;
                }

                const delay = Math.min(
                    retryOpts.baseDelay * Math.pow(retryOpts.backoffMultiplier, attempt),
                    retryOpts.maxDelay
                );

                console.warn(`${context} failed (attempt ${attempt + 1}/${retryOpts.maxRetries + 1}), retrying in ${delay}ms:`, lastError.message);
                await this.sleep(delay);
            }
        }

        throw lastError!;
    }

    /**
     * Normalizes various error types into NexusError instances
     */
    normalizeError(error: any, context: string): NexusError {
        if (error instanceof NexusError) {
            return error;
        }

        if (error instanceof Error) {
            // Handle specific error types
            if (error.message.includes('fetch') || error.message.includes('network')) {
                return new NexusError(
                    ErrorCode.NETWORK_ERROR,
                    `Network error in ${context}: ${error.message}`,
                    { originalError: error },
                    true
                );
            }

            if (error.message.includes('timeout')) {
                return new NexusError(
                    ErrorCode.API_TIMEOUT,
                    `Timeout error in ${context}: ${error.message}`,
                    { originalError: error },
                    true
                );
            }

            if (error.message.includes('ENOENT') || error.message.includes('not found')) {
                return new NexusError(
                    ErrorCode.FILE_NOT_FOUND,
                    `File not found in ${context}: ${error.message}`,
                    { originalError: error },
                    false
                );
            }

            if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
                return new NexusError(
                    ErrorCode.PERMISSION_DENIED,
                    `Permission denied in ${context}: ${error.message}`,
                    { originalError: error },
                    false
                );
            }

            // Generic error wrapping
            return new NexusError(
                ErrorCode.UNKNOWN_ERROR,
                `Unknown error in ${context}: ${error.message}`,
                { originalError: error },
                false
            );
        }

        // Handle non-Error objects
        return new NexusError(
            ErrorCode.UNKNOWN_ERROR,
            `Unknown error in ${context}: ${JSON.stringify(error)}`,
            { originalError: error },
            false
        );
    }

    /**
     * Logs errors with appropriate level based on severity
     */
    logError(error: NexusError, context: string) {
        const logData = {
            context,
            code: error.code,
            message: error.message,
            details: error.details,
            timestamp: new Date(error.timestamp).toISOString(),
            retryable: error.retryable
        };

        // Log based on error severity
        if (error.code === ErrorCode.INTERNAL_SERVER_ERROR ||
            error.code === ErrorCode.UNKNOWN_ERROR) {
            console.error('CRITICAL ERROR:', logData);
        } else if (error.retryable) {
            console.warn('RETRYABLE ERROR:', logData);
        } else {
            console.error('ERROR:', logData);
        }
    }

    /**
     * Validates required fields and throws appropriate error
     */
    validateRequired<T extends Record<string, any>>(
        data: T,
        requiredFields: (keyof T)[],
        context: string
    ): void {
        const missing = requiredFields.filter(field =>
            data[field] === undefined || data[field] === null || data[field] === ''
        );

        if (missing.length > 0) {
            throw new NexusError(
                ErrorCode.MISSING_REQUIRED_FIELD,
                `Missing required fields in ${context}: ${missing.join(', ')}`,
                { missingFields: missing, providedData: data }
            );
        }
    }

    /**
     * Validates numeric ranges
     */
    validateRange(
        value: number,
        min: number,
        max: number,
        fieldName: string,
        context: string
    ): void {
        if (value < min || value > max) {
            throw new NexusError(
                ErrorCode.INVALID_INPUT,
                `${fieldName} must be between ${min} and ${max} in ${context}`,
                { value, min, max, fieldName }
            );
        }
    }

    /**
     * Creates API response format for errors
     */
    createErrorResponse(error: NexusError | Error, statusCode?: number) {
        const nexusError = error instanceof NexusError ? error : this.normalizeError(error, 'API');

        const response = {
            success: false,
            error: {
                code: nexusError.code,
                message: nexusError.message,
                timestamp: nexusError.timestamp,
                retryable: nexusError.retryable
            }
        };

        // Don't expose internal details in production
        if (process.env.NODE_ENV === 'development') {
            (response.error as any).details = nexusError.details;
        }

        return {
            response,
            status: statusCode || this.getHttpStatusFromError(nexusError)
        };
    }

    private getHttpStatusFromError(error: NexusError): number {
        switch (error.code) {
            case ErrorCode.UNAUTHORIZED:
                return 401;
            case ErrorCode.FILE_NOT_FOUND:
            case ErrorCode.WALLET_NOT_FOUND:
            case ErrorCode.INTELLIGENCE_NOT_FOUND:
            case ErrorCode.AGENT_NOT_REGISTERED:
                return 404;
            case ErrorCode.MISSING_REQUIRED_FIELD:
            case ErrorCode.INVALID_INPUT:
            case ErrorCode.INVALID_FORMAT:
                return 400;
            case ErrorCode.RATE_LIMIT_EXCEEDED:
                return 429;
            case ErrorCode.INTERNAL_SERVER_ERROR:
                return 500;
            case ErrorCode.NETWORK_ERROR:
            case ErrorCode.API_TIMEOUT:
                return 503;
            default:
                return 500;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Convenience functions for common error patterns
export const errorHandler = ErrorHandler.getInstance();

export function createNexusError(code: ErrorCode, message: string, details?: any, retryable?: boolean): NexusError {
    return new NexusError(code, message, details, retryable);
}

export async function withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    options?: Partial<RetryOptions>
): Promise<T> {
    return errorHandler.withErrorHandling(operation, context, options);
}

export function validateRequired<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[],
    context: string
): void {
    return errorHandler.validateRequired(data, fields, context);
}