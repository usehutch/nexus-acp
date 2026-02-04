import {
    ErrorHandler,
    NexusError,
    ErrorCode,
    createNexusError,
    withRetry,
    validateRequired
} from '../../error-handler.ts';
import { describe, it, expect, beforeEach, jest } from 'bun:test';

describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;

    beforeEach(() => {
        errorHandler = ErrorHandler.getInstance();
    });

    describe('NexusError', () => {
        it('should create NexusError with correct properties', () => {
            const error = new NexusError(
                ErrorCode.INVALID_INPUT,
                'Test error message',
                { field: 'test' },
                true
            );

            expect(error.name).toBe('NexusError');
            expect(error.code).toBe(ErrorCode.INVALID_INPUT);
            expect(error.message).toBe('Test error message');
            expect(error.details).toEqual({ field: 'test' });
            expect(error.retryable).toBe(true);
            expect(typeof error.timestamp).toBe('number');
            expect(error.timestamp).toBeGreaterThan(0);
        });

        it('should have default retryable value of false', () => {
            const error = new NexusError(ErrorCode.UNKNOWN_ERROR, 'Test message');
            expect(error.retryable).toBe(false);
        });

        it('should maintain proper prototype chain', () => {
            const error = new NexusError(ErrorCode.INVALID_INPUT, 'Test');
            expect(error instanceof NexusError).toBe(true);
            expect(error instanceof Error).toBe(true);
        });

        it('should serialize to JSON correctly', () => {
            const error = new NexusError(
                ErrorCode.NETWORK_ERROR,
                'Network failure',
                { url: 'http://example.com' },
                true
            );

            const json = error.toJSON();

            expect(json.name).toBe('NexusError');
            expect(json.code).toBe(ErrorCode.NETWORK_ERROR);
            expect(json.message).toBe('Network failure');
            expect(json.details).toEqual({ url: 'http://example.com' });
            expect(json.retryable).toBe(true);
            expect(typeof json.timestamp).toBe('number');
            expect(typeof json.stack).toBe('string');
        });
    });

    describe('Error Normalization', () => {
        it('should return NexusError as-is', () => {
            const originalError = new NexusError(ErrorCode.AGENT_NOT_REGISTERED, 'Test error');
            const normalized = errorHandler.normalizeError(originalError, 'test context');

            expect(normalized).toBe(originalError);
        });

        it('should wrap generic Error as NexusError', () => {
            const genericError = new Error('Generic error message');
            const normalized = errorHandler.normalizeError(genericError, 'test context');

            expect(normalized).toBeInstanceOf(NexusError);
            expect(normalized.code).toBe(ErrorCode.UNKNOWN_ERROR);
            expect(normalized.message).toContain('Generic error message');
            expect(normalized.message).toContain('test context');
            expect(normalized.details.originalError).toBe(genericError);
            expect(normalized.retryable).toBe(false);
        });

        it('should categorize network errors correctly', () => {
            const networkError = new Error('Network fetch failed');
            const normalized = errorHandler.normalizeError(networkError, 'network test');

            expect(normalized.code).toBe(ErrorCode.NETWORK_ERROR);
            expect(normalized.retryable).toBe(true);
        });

        it('should categorize timeout errors correctly', () => {
            const timeoutError = new Error('Request timeout occurred');
            const normalized = errorHandler.normalizeError(timeoutError, 'timeout test');

            expect(normalized.code).toBe(ErrorCode.API_TIMEOUT);
            expect(normalized.retryable).toBe(true);
        });

        it('should categorize file not found errors correctly', () => {
            const fileError = new Error('ENOENT: file not found');
            const normalized = errorHandler.normalizeError(fileError, 'file test');

            expect(normalized.code).toBe(ErrorCode.FILE_NOT_FOUND);
            expect(normalized.retryable).toBe(false);
        });

        it('should categorize permission errors correctly', () => {
            const permError = new Error('EACCES: permission denied');
            const normalized = errorHandler.normalizeError(permError, 'permission test');

            expect(normalized.code).toBe(ErrorCode.PERMISSION_DENIED);
            expect(normalized.retryable).toBe(false);
        });

        it('should handle non-Error objects', () => {
            const nonError = { message: 'Not an error object' };
            const normalized = errorHandler.normalizeError(nonError, 'object test');

            expect(normalized).toBeInstanceOf(NexusError);
            expect(normalized.code).toBe(ErrorCode.UNKNOWN_ERROR);
            expect(normalized.message).toContain(JSON.stringify(nonError));
        });

        it('should handle null and undefined', () => {
            const nullNormalized = errorHandler.normalizeError(null, 'null test');
            expect(nullNormalized).toBeInstanceOf(NexusError);

            const undefinedNormalized = errorHandler.normalizeError(undefined, 'undefined test');
            expect(undefinedNormalized).toBeInstanceOf(NexusError);
        });
    });

    describe('Retry Logic', () => {
        it('should succeed on first try without retry', async () => {
            let attempts = 0;
            const successOperation = async () => {
                attempts++;
                return 'success';
            };

            const result = await errorHandler.withErrorHandling(successOperation, 'success test');

            expect(result).toBe('success');
            expect(attempts).toBe(1);
        });

        it('should retry retryable errors up to max attempts', async () => {
            let attempts = 0;
            const failingOperation = async () => {
                attempts++;
                if (attempts < 3) {
                    throw new NexusError(ErrorCode.NETWORK_ERROR, 'Network failure', {}, true);
                }
                return 'success after retries';
            };

            const result = await errorHandler.withErrorHandling(
                failingOperation,
                'retry test',
                { maxRetries: 3, baseDelay: 10, backoffMultiplier: 1 }
            );

            expect(result).toBe('success after retries');
            expect(attempts).toBe(3);
        });

        it('should not retry non-retryable errors', async () => {
            let attempts = 0;
            const failingOperation = async () => {
                attempts++;
                throw new NexusError(ErrorCode.INVALID_INPUT, 'Bad input', {}, false);
            };

            await expect(async () => {
                await errorHandler.withErrorHandling(failingOperation, 'no retry test');
            }).toThrow('Bad input');

            expect(attempts).toBe(1);
        });

        it('should fail after max retries', async () => {
            let attempts = 0;
            const alwaysFailingOperation = async () => {
                attempts++;
                throw new NexusError(ErrorCode.NETWORK_ERROR, 'Always fails', {}, true);
            };

            await expect(async () => {
                await errorHandler.withErrorHandling(
                    alwaysFailingOperation,
                    'max retry test',
                    { maxRetries: 2, baseDelay: 1 }
                );
            }).toThrow('Always fails');

            expect(attempts).toBe(3); // Initial attempt + 2 retries
        });

        it('should use exponential backoff', async () => {
            let attempts = 0;
            const timestamps: number[] = [];

            const failingOperation = async () => {
                attempts++;
                timestamps.push(Date.now());
                throw new NexusError(ErrorCode.API_TIMEOUT, 'Timeout', {}, true);
            };

            try {
                await errorHandler.withErrorHandling(
                    failingOperation,
                    'backoff test',
                    { maxRetries: 2, baseDelay: 50, backoffMultiplier: 2, maxDelay: 200 }
                );
            } catch (error) {
                // Expected to fail
            }

            expect(attempts).toBe(3);
            expect(timestamps.length).toBe(3);

            // Check that delays increased (allowing some tolerance for timing)
            const delay1 = timestamps[1] - timestamps[0];
            const delay2 = timestamps[2] - timestamps[1];
            expect(delay1).toBeGreaterThan(40); // Should be around 50ms
            expect(delay2).toBeGreaterThan(80); // Should be around 100ms (50 * 2)
        });

        it('should respect max delay limit', async () => {
            let attempts = 0;
            const timestamps: number[] = [];

            const failingOperation = async () => {
                attempts++;
                timestamps.push(Date.now());
                throw new NexusError(ErrorCode.NETWORK_ERROR, 'Network error', {}, true);
            };

            try {
                await errorHandler.withErrorHandling(
                    failingOperation,
                    'max delay test',
                    { maxRetries: 5, baseDelay: 100, backoffMultiplier: 10, maxDelay: 200 }
                );
            } catch (error) {
                // Expected to fail
            }

            // Later delays should be capped at maxDelay
            if (timestamps.length > 2) {
                const laterDelay = timestamps[2] - timestamps[1];
                expect(laterDelay).toBeLessThan(250); // Should be capped around 200ms
            }
        });
    });

    describe('Validation Functions', () => {
        describe('validateRequired', () => {
            it('should pass validation for valid data', () => {
                const validData = {
                    name: 'Test Name',
                    description: 'Test Description',
                    price: 0.5
                };

                expect(() => {
                    errorHandler.validateRequired(validData, ['name', 'description', 'price'], 'test');
                }).not.toThrow();
            });

            it('should throw error for missing required fields', () => {
                const invalidData = {
                    name: 'Test Name',
                    description: '' // Empty string should be considered missing
                };

                expect(() => {
                    errorHandler.validateRequired(invalidData, ['name', 'description', 'price'], 'test context');
                }).toThrow('Missing required fields in test context: description, price');
            });

            it('should throw error for null values', () => {
                const nullData = {
                    name: 'Test',
                    value: null
                };

                expect(() => {
                    errorHandler.validateRequired(nullData, ['name', 'value'], 'null test');
                }).toThrow('Missing required fields in null test: value');
            });

            it('should throw error for undefined values', () => {
                const undefinedData = {
                    name: 'Test',
                    value: undefined
                };

                expect(() => {
                    errorHandler.validateRequired(undefinedData, ['name', 'value'], 'undefined test');
                }).toThrow('Missing required fields in undefined test: value');
            });

            it('should include error details', () => {
                const invalidData = { name: 'Test' };

                try {
                    errorHandler.validateRequired(invalidData, ['name', 'missing'], 'details test');
                } catch (error) {
                    expect(error).toBeInstanceOf(NexusError);
                    const nexusError = error as NexusError;
                    expect(nexusError.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
                    expect(nexusError.details.missingFields).toEqual(['missing']);
                    expect(nexusError.details.providedData).toBe(invalidData);
                }
            });
        });

        describe('validateRange', () => {
            it('should pass validation for values within range', () => {
                expect(() => {
                    errorHandler.validateRange(5, 1, 10, 'rating', 'range test');
                }).not.toThrow();

                expect(() => {
                    errorHandler.validateRange(1, 1, 10, 'rating', 'range test'); // Min boundary
                }).not.toThrow();

                expect(() => {
                    errorHandler.validateRange(10, 1, 10, 'rating', 'range test'); // Max boundary
                }).not.toThrow();
            });

            it('should throw error for values below range', () => {
                expect(() => {
                    errorHandler.validateRange(0, 1, 10, 'rating', 'range test');
                }).toThrow('rating must be between 1 and 10 in range test');
            });

            it('should throw error for values above range', () => {
                expect(() => {
                    errorHandler.validateRange(11, 1, 10, 'rating', 'range test');
                }).toThrow('rating must be between 1 and 10 in range test');
            });

            it('should include error details', () => {
                try {
                    errorHandler.validateRange(15, 1, 10, 'price', 'range details test');
                } catch (error) {
                    expect(error).toBeInstanceOf(NexusError);
                    const nexusError = error as NexusError;
                    expect(nexusError.code).toBe(ErrorCode.INVALID_INPUT);
                    expect(nexusError.details.value).toBe(15);
                    expect(nexusError.details.min).toBe(1);
                    expect(nexusError.details.max).toBe(10);
                    expect(nexusError.details.fieldName).toBe('price');
                }
            });

            it('should handle decimal ranges correctly', () => {
                expect(() => {
                    errorHandler.validateRange(0.5, 0.1, 1.0, 'decimal', 'decimal test');
                }).not.toThrow();

                expect(() => {
                    errorHandler.validateRange(1.1, 0.1, 1.0, 'decimal', 'decimal test');
                }).toThrow();
            });
        });
    });

    describe('Error Response Creation', () => {
        it('should create error response from NexusError', () => {
            const nexusError = new NexusError(
                ErrorCode.INVALID_INPUT,
                'Invalid data provided',
                { field: 'name' },
                false
            );

            const { response, status } = errorHandler.createErrorResponse(nexusError);

            expect(response.success).toBe(false);
            expect(response.error.code).toBe(ErrorCode.INVALID_INPUT);
            expect(response.error.message).toBe('Invalid data provided');
            expect(response.error.retryable).toBe(false);
            expect(typeof response.error.timestamp).toBe('number');
            expect(status).toBe(400);
        });

        it('should create error response from generic Error', () => {
            const genericError = new Error('Something went wrong');
            const { response, status } = errorHandler.createErrorResponse(genericError);

            expect(response.success).toBe(false);
            expect(response.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
            expect(response.error.message).toContain('Something went wrong');
            expect(status).toBe(500);
        });

        it('should map error codes to correct HTTP status codes', () => {
            const testCases = [
                { code: ErrorCode.UNAUTHORIZED, expectedStatus: 401 },
                { code: ErrorCode.FILE_NOT_FOUND, expectedStatus: 404 },
                { code: ErrorCode.WALLET_NOT_FOUND, expectedStatus: 404 },
                { code: ErrorCode.INTELLIGENCE_NOT_FOUND, expectedStatus: 404 },
                { code: ErrorCode.AGENT_NOT_REGISTERED, expectedStatus: 404 },
                { code: ErrorCode.MISSING_REQUIRED_FIELD, expectedStatus: 400 },
                { code: ErrorCode.INVALID_INPUT, expectedStatus: 400 },
                { code: ErrorCode.INVALID_FORMAT, expectedStatus: 400 },
                { code: ErrorCode.RATE_LIMIT_EXCEEDED, expectedStatus: 429 },
                { code: ErrorCode.INTERNAL_SERVER_ERROR, expectedStatus: 500 },
                { code: ErrorCode.NETWORK_ERROR, expectedStatus: 503 },
                { code: ErrorCode.API_TIMEOUT, expectedStatus: 503 }
            ];

            testCases.forEach(({ code, expectedStatus }) => {
                const error = new NexusError(code, 'Test message');
                const { status } = errorHandler.createErrorResponse(error);
                expect(status).toBe(expectedStatus);
            });
        });

        it('should hide details in production mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const nexusError = new NexusError(
                ErrorCode.INVALID_INPUT,
                'Test error',
                { sensitive: 'data' },
                false
            );

            const { response } = errorHandler.createErrorResponse(nexusError);

            expect(response.error).not.toHaveProperty('details');

            process.env.NODE_ENV = originalEnv;
        });

        it('should include details in development mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const nexusError = new NexusError(
                ErrorCode.INVALID_INPUT,
                'Test error',
                { debug: 'info' },
                false
            );

            const { response } = errorHandler.createErrorResponse(nexusError);

            expect((response.error as any).details).toEqual({ debug: 'info' });

            process.env.NODE_ENV = originalEnv;
        });

        it('should allow custom status code override', () => {
            const error = new NexusError(ErrorCode.INVALID_INPUT, 'Test');
            const { status } = errorHandler.createErrorResponse(error, 418); // Custom status

            expect(status).toBe(418);
        });
    });

    describe('Error Logging', () => {
        it('should log critical errors appropriately', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const criticalError = new NexusError(ErrorCode.INTERNAL_SERVER_ERROR, 'Critical failure');
            errorHandler.logError(criticalError, 'test context');

            expect(consoleSpy).toHaveBeenCalledWith('CRITICAL ERROR:', expect.objectContaining({
                context: 'test context',
                code: ErrorCode.INTERNAL_SERVER_ERROR,
                message: 'Critical failure'
            }));

            consoleSpy.mockRestore();
        });

        it('should log retryable errors as warnings', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const retryableError = new NexusError(ErrorCode.NETWORK_ERROR, 'Network issue', {}, true);
            errorHandler.logError(retryableError, 'network context');

            expect(consoleSpy).toHaveBeenCalledWith('RETRYABLE ERROR:', expect.objectContaining({
                context: 'network context',
                code: ErrorCode.NETWORK_ERROR,
                retryable: true
            }));

            consoleSpy.mockRestore();
        });

        it('should log regular errors appropriately', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const regularError = new NexusError(ErrorCode.INVALID_INPUT, 'Input error');
            errorHandler.logError(regularError, 'validation context');

            expect(consoleSpy).toHaveBeenCalledWith('ERROR:', expect.objectContaining({
                context: 'validation context',
                code: ErrorCode.INVALID_INPUT,
                retryable: false
            }));

            consoleSpy.mockRestore();
        });
    });

    describe('Convenience Functions', () => {
        it('should create NexusError via convenience function', () => {
            const error = createNexusError(
                ErrorCode.WALLET_CREATION_FAILED,
                'Failed to create wallet',
                { reason: 'insufficient entropy' },
                true
            );

            expect(error).toBeInstanceOf(NexusError);
            expect(error.code).toBe(ErrorCode.WALLET_CREATION_FAILED);
            expect(error.message).toBe('Failed to create wallet');
            expect(error.details).toEqual({ reason: 'insufficient entropy' });
            expect(error.retryable).toBe(true);
        });

        it('should execute withRetry convenience function', async () => {
            let attempts = 0;
            const operation = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new NexusError(ErrorCode.API_TIMEOUT, 'Timeout', {}, true);
                }
                return 'success';
            };

            const result = await withRetry(operation, 'convenience test', { maxRetries: 2 });

            expect(result).toBe('success');
            expect(attempts).toBe(2);
        });

        it('should execute validateRequired convenience function', () => {
            const data = { name: 'Test', value: 42 };

            expect(() => {
                validateRequired(data, ['name', 'value'], 'convenience test');
            }).not.toThrow();

            expect(() => {
                validateRequired(data, ['name', 'missing'], 'convenience test');
            }).toThrow();
        });
    });

    describe('Singleton Pattern', () => {
        it('should return same instance', () => {
            const instance1 = ErrorHandler.getInstance();
            const instance2 = ErrorHandler.getInstance();

            expect(instance1).toBe(instance2);
        });

        it('should maintain state across instances', async () => {
            const instance1 = ErrorHandler.getInstance();
            const instance2 = ErrorHandler.getInstance();

            // Both should behave identically
            let attempts1 = 0;
            let attempts2 = 0;

            const operation1 = async () => {
                attempts1++;
                throw new NexusError(ErrorCode.NETWORK_ERROR, 'Error 1', {}, true);
            };

            const operation2 = async () => {
                attempts2++;
                throw new NexusError(ErrorCode.NETWORK_ERROR, 'Error 2', {}, true);
            };

            try {
                await instance1.withErrorHandling(operation1, 'test1', { maxRetries: 1, baseDelay: 1 });
            } catch (e) {
                // Expected
            }

            try {
                await instance2.withErrorHandling(operation2, 'test2', { maxRetries: 1, baseDelay: 1 });
            } catch (e) {
                // Expected
            }

            expect(attempts1).toBe(2); // Initial + 1 retry
            expect(attempts2).toBe(2); // Initial + 1 retry
        });
    });

    describe('Edge Cases and Complex Scenarios', () => {
        it('should handle very long error messages', () => {
            const longMessage = 'A'.repeat(10000);
            const error = new NexusError(ErrorCode.UNKNOWN_ERROR, longMessage);

            expect(error.message).toBe(longMessage);
            expect(error.message.length).toBe(10000);
        });

        it('should handle circular reference in error details', () => {
            const circularObj: any = { name: 'test' };
            circularObj.self = circularObj;

            // Should not throw when creating error with circular reference
            expect(() => {
                new NexusError(ErrorCode.UNKNOWN_ERROR, 'Circular test', circularObj);
            }).not.toThrow();
        });

        it('should handle errors thrown during error handling', async () => {
            const faultyOperation = async () => {
                // Create an operation that throws during error processing
                const error = new Error('Original error');
                (error as any).toJSON = () => {
                    throw new Error('Error in error processing');
                };
                throw error;
            };

            await expect(async () => {
                await errorHandler.withErrorHandling(faultyOperation, 'faulty test');
            }).toThrow();
        });

        it('should handle concurrent error operations', async () => {
            const operations = Array(10).fill(0).map((_, i) => async () => {
                if (i % 2 === 0) {
                    throw new NexusError(ErrorCode.NETWORK_ERROR, `Error ${i}`, {}, true);
                }
                return `Success ${i}`;
            });

            const promises = operations.map((op, i) =>
                errorHandler.withErrorHandling(op, `concurrent ${i}`, { maxRetries: 1, baseDelay: 1 })
                    .catch(err => err)
            );

            const results = await Promise.all(promises);

            // Check that successes and errors are handled correctly
            results.forEach((result, i) => {
                if (i % 2 === 0) {
                    expect(result).toBeInstanceOf(NexusError);
                } else {
                    expect(result).toBe(`Success ${i}`);
                }
            });
        });

        it('should handle zero delay retry scenarios', async () => {
            let attempts = 0;
            const operation = async () => {
                attempts++;
                if (attempts < 3) {
                    throw new NexusError(ErrorCode.API_TIMEOUT, 'Timeout', {}, true);
                }
                return 'success';
            };

            const result = await errorHandler.withErrorHandling(
                operation,
                'zero delay test',
                { maxRetries: 3, baseDelay: 0 }
            );

            expect(result).toBe('success');
            expect(attempts).toBe(3);
        });

        it('should handle very large retry counts', async () => {
            let attempts = 0;
            const operation = async () => {
                attempts++;
                if (attempts < 5) {
                    throw new NexusError(ErrorCode.NETWORK_ERROR, 'Network error', {}, true);
                }
                return 'finally succeeded';
            };

            const result = await errorHandler.withErrorHandling(
                operation,
                'large retry test',
                { maxRetries: 100, baseDelay: 1, maxDelay: 5 }
            );

            expect(result).toBe('finally succeeded');
            expect(attempts).toBe(5);
        });
    });
});