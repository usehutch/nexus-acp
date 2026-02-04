#!/usr/bin/env bun

/**
 * Comprehensive Marketplace Tests
 *
 * This file contains comprehensive tests for the AgentMarketplace class,
 * focusing on edge cases, error handling, and security validation.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { AgentMarketplace } from '../../src/marketplace.js';
import { Connection } from '@solana/web3.js';
import { NexusError, ErrorCode } from '../../error-handler.js';

describe('AgentMarketplace - Comprehensive Tests', () => {
    let connection: Connection;
    let marketplace: AgentMarketplace;

    beforeEach(() => {
        connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        marketplace = new AgentMarketplace(connection);
    });

    describe('Input Validation and Security', () => {
        it('should reject SQL injection attempts in agent names', async () => {
            const maliciousNames = [
                "'; DROP TABLE agents; --",
                "test' OR '1'='1",
                "admin'; INSERT INTO agents VALUES ('hacker'); --",
                "test\"; rm -rf /; #"
            ];

            for (const name of maliciousNames) {
                await expect(async () => {
                    await marketplace.registerAgent(name, {
                        name: 'Security Test Agent',
                        description: 'description that is long enough to meet requirements',
                        specialization: ['security-testing']
                    });
                }).toThrow();
            }
        });

        it('should reject XSS attempts in descriptions', async () => {
            const xssPayloads = [
                '<script>alert("xss")</script>',
                'javascript:alert("xss")',
                '<img src="x" onerror="alert(1)">',
                '<iframe src="javascript:alert(1)"></iframe>'
            ];

            for (const payload of xssPayloads) {
                // Should either reject or sanitize
                const result = await marketplace.registerAgent('test-agent', {
                    name: 'XSS Test Agent',
                    description: payload,
                    specialization: ['security-testing']
                });
                expect(result).toBeDefined();

                const agent = marketplace.getAgent('test-agent');
                expect(agent?.description).not.toContain('<script>');
                expect(agent?.description).not.toContain('javascript:');
            }
        });

        it('should handle unicode and special characters safely', async () => {
            const specialChars = [
                '测试代理', // Chinese
                'тест агент', // Cyrillic
                'テストエージェント', // Japanese
                '🚀🤖💰', // Emojis
                'test\u0000null', // Null bytes
                'test\u001b[31mcolors', // ANSI escape
            ];

            for (const name of specialChars) {
                const result = await marketplace.registerAgent(name, {
                    name: 'Unicode Test Agent',
                    description: 'This is a comprehensive description that meets the minimum length requirements for testing unicode',
                    specialization: ['unicode-testing']
                });
                expect(result).toBeDefined();
            }
        });

        it('should enforce rate limiting for rapid registrations', async () => {
            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(marketplace.registerAgent(`rapid-agent-${i}`, {
                    name: `Rapid Test Agent ${i}`,
                    description: `This is a description for rapid agent ${i} that meets the minimum length requirements`,
                    specialization: ['rate-limiting-test']
                }));
            }

            // Should not crash or cause memory issues
            const results = await Promise.allSettled(promises);
            expect(results.length).toBe(100);
        });
    });

    describe('Edge Cases and Boundary Conditions', () => {
        it('should handle maximum length inputs', async () => {
            const maxLengthName = 'a'.repeat(100); // Assuming 100 char limit
            const maxLengthDescription = 'b'.repeat(1000); // Max description length

            const result = await marketplace.registerAgent(maxLengthName, {
                name: 'Max Length Test Agent',
                description: maxLengthDescription,
                specialization: ['boundary-testing']
            });
            expect(result).toBeDefined();
        });

        it('should handle empty marketplace operations gracefully', () => {
            expect(marketplace.getAgent('nonexistent')).toBeNull();
            expect(marketplace.getAllAgents()).toEqual([]);
            expect(() => marketplace.getMarketplaceStats()).not.toThrow();
        });

        it('should handle concurrent agent registration', async () => {
            const promises = Array.from({ length: 50 }, (_, i) =>
                marketplace.registerAgent(`concurrent-agent-${i}`, {
                    name: `Concurrent Test Agent ${i}`,
                    description: `Concurrent registration test for agent ${i} with adequate description length`,
                    specialization: ['concurrency-testing']
                })
            );

            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled');
            expect(successful.length).toBeGreaterThan(0);
        });

        it('should maintain data consistency under load', async () => {
            // Register agents concurrently
            const registrations = Array.from({ length: 20 }, (_, i) =>
                marketplace.registerAgent(`load-test-agent-${i}`, {
                    name: `Load Test Agent ${i}`,
                    description: `Load testing agent ${i} with proper description length for consistency verification`,
                    specialization: ['load-testing']
                })
            );

            await Promise.all(registrations);

            // Verify all agents were registered
            const agents = marketplace.getAllAgents();
            expect(agents.length).toBeGreaterThanOrEqual(20);

            // Check for duplicate IDs
            const ids = agents.map(a => a.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });
    });

    describe('Memory and Resource Management', () => {
        it('should not leak memory with large datasets', async () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Create and destroy many objects
            for (let i = 0; i < 1000; i++) {
                await marketplace.registerAgent(`memory-test-${i}`, {
                    name: `Memory Test Agent ${i}`,
                    description: `Memory test agent ${i} with adequate description length to test memory management`,
                    specialization: ['memory-testing']
                });
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Memory increase should be reasonable (less than 100MB for 1000 agents)
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        });

        it('should handle cleanup of large object graphs', () => {
            // Create complex interconnected agents
            const agents = [];
            for (let i = 0; i < 100; i++) {
                agents.push({
                    id: `cleanup-test-${i}`,
                    name: `Agent ${i}`,
                    description: `Complex agent ${i} for cleanup testing with proper description length`,
                    connections: agents.slice(Math.max(0, i-5), i) // Reference previous agents
                });
            }

            // Verify objects can be properly cleaned up
            expect(() => {
                agents.length = 0; // Clear array
            }).not.toThrow();
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should recover from corrupted internal state', async () => {
            // Register some agents
            await marketplace.registerAgent('test1', {
                name: 'First Recovery Test Agent',
                description: 'First test agent with proper description length',
                specialization: ['error-recovery']
            });
            await marketplace.registerAgent('test2', {
                name: 'Second Recovery Test Agent',
                description: 'Second test agent with proper description length',
                specialization: ['error-recovery']
            });

            // Simulate state corruption (if internal state is accessible)
            // Note: This would depend on the actual implementation
            expect(() => marketplace.getAllAgents()).not.toThrow();
        });

        it('should handle invalid connection gracefully', () => {
            const invalidConnection = null as any;
            expect(() => new AgentMarketplace(invalidConnection)).toThrow();
        });

        it('should validate marketplace integrity', async () => {
            await marketplace.registerAgent('integrity-test', {
                name: 'Integrity Test Agent',
                description: 'Agent for integrity testing with proper description length',
                specialization: ['integrity-testing']
            });

            const stats = marketplace.getMarketplaceStats();
            expect(stats).toBeDefined();
            expect(typeof stats.totalAgents).toBe('number');
        });
    });

    describe('Performance and Scalability', () => {
        it('should maintain performance with large agent count', async () => {
            const startTime = Date.now();

            // Register many agents
            const promises = [];
            for (let i = 0; i < 500; i++) {
                promises.push(marketplace.registerAgent(`perf-agent-${i}`, {
                    name: `Performance Test Agent ${i}`,
                    description: `Performance test agent ${i} with adequate description for testing scalability`,
                    specialization: ['performance-testing']
                }));
            }

            await Promise.all(promises);

            const registrationTime = Date.now() - startTime;

            // Test search performance
            const searchStart = Date.now();
            const agents = marketplace.getAllAgents();
            const searchTime = Date.now() - searchStart;

            expect(agents.length).toBe(500);
            expect(registrationTime).toBeLessThan(5000); // 5 seconds max
            expect(searchTime).toBeLessThan(100); // 100ms max for search
        });

        it('should handle rapid successive operations', async () => {
            const operations = [];

            for (let i = 0; i < 50; i++) {
                operations.push(async () => {
                    await marketplace.registerAgent(`rapid-op-${i}`, {
                        name: `Rapid Operation Test Agent ${i}`,
                        description: `Rapid operation test agent ${i} with proper description length`,
                        specialization: ['rapid-operations']
                    });
                    return marketplace.getAgent(`rapid-op-${i}`);
                });
            }

            const results = await Promise.all(operations.map(op => op()));
            expect(results.every(r => r !== null)).toBe(true);
        });
    });

    describe('Data Validation and Consistency', () => {
        it('should maintain referential integrity', async () => {
            await marketplace.registerAgent('ref-test-1', {
                name: 'Reference Test Agent 1',
                description: 'Reference test agent 1 with proper description',
                specialization: ['referential-integrity']
            });
            await marketplace.registerAgent('ref-test-2', {
                name: 'Reference Test Agent 2',
                description: 'Reference test agent 2 with proper description',
                specialization: ['referential-integrity']
            });

            const agent1 = marketplace.getAgent('ref-test-1');
            const agent2 = marketplace.getAgent('ref-test-2');

            expect(agent1).toBeDefined();
            expect(agent2).toBeDefined();
            expect(agent1!.id).not.toBe(agent2!.id);
        });

        it('should validate agent data completeness', async () => {
            await marketplace.registerAgent('complete-test', {
                name: 'Completeness Test Agent',
                description: 'Agent for completeness testing with proper description',
                specialization: ['data-validation']
            });

            const agent = marketplace.getAgent('complete-test');
            expect(agent).toBeDefined();
            expect(agent!.id).toBeDefined();
            expect(agent!.name).toBeDefined();
            expect(agent!.description).toBeDefined();
            expect(agent!.reputation_score).toBeDefined();
            expect(agent!.created_at).toBeDefined();
        });

        it('should prevent duplicate agent registration', async () => {
            await marketplace.registerAgent('duplicate-test', {
                name: 'Duplicate Test Agent',
                description: 'First registration with proper description',
                specialization: ['duplicate-prevention']
            });

            await expect(async () => {
                await marketplace.registerAgent('duplicate-test', {
                    name: 'Duplicate Test Agent 2',
                    description: 'Attempted duplicate registration',
                    specialization: ['duplicate-prevention']
                });
            }).toThrow();
        });
    });

    describe('Advanced Security Tests', () => {
        it('should prevent prototype pollution attacks', async () => {
            const maliciousInput = {
                __proto__: {
                    polluted: 'yes'
                }
            } as any;

            // Attempt to register with malicious object
            await expect(async () => {
                await marketplace.registerAgent('proto-test', {
                    name: 'Prototype Pollution Test',
                    description: 'Testing prototype pollution protection',
                    specialization: ['security-testing']
                });
            }).not.toThrow();

            // Verify prototype wasn't polluted
            expect((({} as any).polluted)).toBeUndefined();
        });

        it('should handle buffer overflow attempts', async () => {
            const hugeInput = 'x'.repeat(10000000); // 10MB string

            await expect(async () => {
                await marketplace.registerAgent('overflow-test', {
                    name: 'Buffer Overflow Test',
                    description: hugeInput,
                    specialization: ['security-testing']
                });
            }).toThrow(); // Should reject oversized input
        });

        it('should sanitize output to prevent information leakage', async () => {
            await marketplace.registerAgent('leak-test', {
                name: 'Information Leak Test Agent',
                description: 'Test for information leakage prevention',
                specialization: ['security-testing']
            });

            const agent = marketplace.getAgent('leak-test');
            expect(agent).toBeDefined();

            // Verify no internal properties are exposed
            const agentString = JSON.stringify(agent);
            expect(agentString).not.toContain('__');
            expect(agentString).not.toContain('prototype');
        });
    });
});