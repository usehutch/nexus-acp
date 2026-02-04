import { AgentManager } from '../../src/core/agent-manager.ts';
import { IntelligenceManager } from '../../src/core/intelligence-manager.ts';
import { TransactionManager } from '../../src/core/transaction-manager.ts';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { AgentMarketplace } from '../../src/marketplace.ts';
import { CONFIG } from '../../src/config/index.ts';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('Error Handling and Edge Cases', () => {
    describe('AgentManager Edge Cases', () => {
        let agentManager: AgentManager;

        beforeEach(() => {
            agentManager = new AgentManager();
        });

        it('should handle null and undefined inputs gracefully', async () => {
            // Test with null/undefined public key
            await expect(async () => {
                await agentManager.registerAgent(null as any, {
                    name: 'Test Agent',
                    description: 'Test description',
                    specialization: ['test'],
                    verified: false
                });
            }).not.toThrow();

            // Test with undefined profile properties
            await expect(async () => {
                await agentManager.registerAgent('test-key', {
                    name: undefined as any,
                    description: undefined as any,
                    specialization: undefined as any,
                    verified: undefined as any
                });
            }).not.toThrow();
        });

        it('should handle extremely large data', async () => {
            const largeSpecialization = new Array(10000).fill('specialization');
            const largeName = 'A'.repeat(100000);
            const largeDescription = 'B'.repeat(1000000);

            const result = await agentManager.registerAgent('large-data-agent', {
                name: largeName,
                description: largeDescription,
                specialization: largeSpecialization,
                verified: true
            });

            expect(result).toBe(true);
            const agent = agentManager.getAgent('large-data-agent')!;
            expect(agent.name.length).toBe(100000);
            expect(agent.description.length).toBe(1000000);
            expect(agent.specialization.length).toBe(10000);
        });

        it('should handle malformed specialization arrays', async () => {
            const malformedSpecs = [
                [],
                [null],
                [undefined],
                ['', null, undefined, 'valid'],
                new Array(1000).fill(null)
            ] as any[];

            for (let i = 0; i < malformedSpecs.length; i++) {
                await expect(async () => {
                    await agentManager.registerAgent(`malformed-${i}`, {
                        name: 'Malformed Spec Agent',
                        description: 'Testing malformed specializations',
                        specialization: malformedSpecs[i],
                        verified: false
                    });
                }).not.toThrow();
            }
        });

        it('should handle reputation update with empty/invalid transactions', () => {
            const invalidTransactions = [
                [],
                [null],
                [undefined],
                [{ invalid: 'transaction' }],
                [{ id: 'tx1', rating: null }],
                [{ id: 'tx2', seller: null, rating: 5 }]
            ] as any[];

            for (const txSet of invalidTransactions) {
                expect(() => {
                    agentManager.updateAgentReputation(txSet);
                }).not.toThrow();
            }
        });
    });

    describe('IntelligenceManager Edge Cases', () => {
        let intelligenceManager: IntelligenceManager;
        let agentManager: AgentManager;

        beforeEach(async () => {
            agentManager = new AgentManager();
            intelligenceManager = new IntelligenceManager(agentManager);

            await agentManager.registerAgent('edge-case-seller', {
                name: 'Edge Case Seller',
                description: 'Seller for edge case testing',
                specialization: ['testing'],
                verified: false
            });
        });

        it('should handle extreme price values', async () => {
            const extremePrices = [
                0,
                -1,
                -99999999,
                0.000000001,
                999999999999,
                Infinity,
                -Infinity,
                NaN
            ];

            for (let i = 0; i < extremePrices.length; i++) {
                await expect(async () => {
                    await intelligenceManager.listIntelligence('edge-case-seller', {
                        title: `Extreme Price Test ${i}`,
                        description: 'Testing extreme prices',
                        category: 'market-analysis',
                        price: extremePrices[i]
                    });
                }).not.toThrow();
            }
        });

        it('should handle invalid category values', async () => {
            const invalidCategories = [
                '',
                null,
                undefined,
                'invalid-category',
                123,
                {},
                []
            ] as any[];

            for (let i = 0; i < invalidCategories.length; i++) {
                await expect(async () => {
                    await intelligenceManager.listIntelligence('edge-case-seller', {
                        title: `Invalid Category Test ${i}`,
                        description: 'Testing invalid categories',
                        category: invalidCategories[i],
                        price: 0.1
                    });
                }).not.toThrow();
            }
        });

        it('should handle search with malformed filters', () => {
            const malformedFilters = [
                null,
                undefined,
                { category: null },
                { maxPrice: 'invalid' },
                { minQuality: -1000000 },
                { seller: 123 },
                { nonExistentFilter: 'value' },
                { category: '', maxPrice: NaN, minQuality: Infinity }
            ] as any[];

            for (const filter of malformedFilters) {
                expect(() => {
                    const results = intelligenceManager.searchIntelligence(filter);
                    expect(Array.isArray(results)).toBe(true);
                }).not.toThrow();
            }
        });

        it('should handle concurrent intelligence listing', async () => {
            const promises = [];
            const concurrentCount = 100;

            for (let i = 0; i < concurrentCount; i++) {
                promises.push(
                    intelligenceManager.listIntelligence('edge-case-seller', {
                        title: `Concurrent Intelligence ${i}`,
                        description: `Concurrent test ${i}`,
                        category: 'market-analysis',
                        price: 0.01 * i
                    })
                );
            }

            const results = await Promise.all(promises);
            expect(results.length).toBe(concurrentCount);

            // All IDs should be unique
            const uniqueIds = new Set(results);
            expect(uniqueIds.size).toBe(concurrentCount);

            expect(intelligenceManager.getIntelligenceCount()).toBe(concurrentCount);
        });

        it('should handle rating updates with malformed data', () => {
            const malformedTransactions = [
                [{ rating: 'not-a-number' }],
                [{ rating: null, intelligence_id: null }],
                [{ rating: 999, intelligence_id: 'valid-id' }],
                [{ rating: -5, intelligence_id: 'valid-id' }]
            ] as any[];

            for (const transactions of malformedTransactions) {
                expect(() => {
                    intelligenceManager.updateIntelligenceRating('any-id', transactions);
                }).not.toThrow();
            }
        });
    });

    describe('TransactionManager Edge Cases', () => {
        let transactionManager: TransactionManager;
        let agentManager: AgentManager;
        let intelligenceManager: IntelligenceManager;

        beforeEach(async () => {
            agentManager = new AgentManager();
            intelligenceManager = new IntelligenceManager(agentManager);
            transactionManager = new TransactionManager(agentManager, intelligenceManager);

            await agentManager.registerAgent('tx-seller', {
                name: 'Transaction Test Seller',
                description: 'Seller for transaction testing',
                specialization: ['testing'],
                verified: true
            });

            await agentManager.registerAgent('tx-buyer', {
                name: 'Transaction Test Buyer',
                description: 'Buyer for transaction testing',
                specialization: ['testing'],
                verified: false
            });
        });

        it('should handle purchase with null/undefined parameters', async () => {
            await expect(async () => {
                await transactionManager.purchaseIntelligence(null as any, undefined as any);
            }).toThrow();

            await expect(async () => {
                await transactionManager.purchaseIntelligence('valid-buyer', '');
            }).toThrow();
        });

        it('should handle rating with invalid rating values', async () => {
            const intelligenceId = await intelligenceManager.listIntelligence('tx-seller', {
                title: 'Rating Test Intelligence',
                description: 'For rating edge case testing',
                category: 'market-analysis',
                price: 0.1
            });

            await transactionManager.purchaseIntelligence('tx-buyer', intelligenceId);

            const invalidRatings = [
                0, 6, -1, 999, NaN, Infinity, -Infinity, 'not-a-number', null, undefined
            ] as any[];

            for (const rating of invalidRatings) {
                if (rating >= 1 && rating <= 5) {
                    await expect(async () => {
                        await transactionManager.rateIntelligence('tx-buyer', intelligenceId, rating);
                    }).not.toThrow();
                } else {
                    await expect(async () => {
                        await transactionManager.rateIntelligence('tx-buyer', intelligenceId, rating);
                    }).toThrow();
                }
            }
        });

        it('should handle massive transaction volumes', async () => {
            const intelligenceId = await intelligenceManager.listIntelligence('tx-seller', {
                title: 'Volume Test Intelligence',
                description: 'For volume testing',
                category: 'market-analysis',
                price: 0.001
            });

            const volumeCount = 1000;
            const promises = [];

            // Register many buyers
            for (let i = 0; i < volumeCount; i++) {
                const buyerKey = `volume-buyer-${i}`;
                await agentManager.registerAgent(buyerKey, {
                    name: `Volume Buyer ${i}`,
                    description: 'Buyer for volume testing',
                    specialization: ['volume'],
                    verified: false
                });

                promises.push(transactionManager.purchaseIntelligence(buyerKey, intelligenceId));
            }

            const startTime = Date.now();
            await Promise.all(promises);
            const endTime = Date.now();

            expect(transactionManager.getTransactionCount()).toBe(volumeCount);
            expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds

            const seller = agentManager.getAgent('tx-seller')!;
            expect(seller.total_sales).toBe(volumeCount);
            expect(seller.total_earnings).toBe(volumeCount * 0.001);
        });

        it('should handle transaction with deleted/corrupted agent data', () => {
            // Simulate corrupted data by manually modifying internal state
            const mockIntelligence = {
                id: 'corrupt-intel',
                seller: 'non-existent-seller',
                title: 'Corrupt Intelligence',
                description: 'Test corrupt data',
                category: 'market-analysis' as any,
                price: 0.1,
                quality_score: 50,
                created_at: Date.now(),
                sales_count: 0,
                rating: 0
            };

            const mockIntelligenceManager = {
                ...intelligenceManager,
                getIntelligence: () => mockIntelligence,
                incrementSalesCount: () => {},
                generateSampleData: () => ({ data: 'mock data' })
            };

            const mockAgentManager = {
                ...agentManager,
                getAgent: () => undefined,
                updateAgentStats: () => {}
            };

            const corruptTransactionManager = new TransactionManager(mockAgentManager as any, mockIntelligenceManager as any);

            expect(async () => {
                await corruptTransactionManager.purchaseIntelligence('any-buyer', 'corrupt-intel');
            }).rejects.toThrow();
        });
    });

    describe('Full System Error Handling', () => {
        let marketplace: AgentMarketplace;

        beforeEach(() => {
            const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
            marketplace = new AgentMarketplace(connection);
        });

        it('should handle malformed connection gracefully', () => {
            expect(() => {
                new AgentMarketplace(null as any);
            }).not.toThrow();

            expect(() => {
                new AgentMarketplace(undefined as any);
            }).not.toThrow();
        });

        it('should maintain consistency during error cascades', async () => {
            // Register agent with valid data
            await marketplace.registerAgent('cascade-seller', {
                name: 'Cascade Test Seller',
                description: 'Testing error cascades',
                specialization: ['testing'],
                verified: true
            });

            // List intelligence
            const intelId = await marketplace.listIntelligence('cascade-seller', {
                title: 'Cascade Test Intelligence',
                description: 'For cascade testing',
                category: 'market-analysis',
                price: 0.2
            });

            // Register buyer
            await marketplace.registerAgent('cascade-buyer', {
                name: 'Cascade Test Buyer',
                description: 'Testing error cascades',
                specialization: ['testing'],
                verified: false
            });

            // Purchase intelligence
            await marketplace.purchaseIntelligence('cascade-buyer', intelId);

            // Try multiple invalid operations in sequence
            const errorOperations = [
                () => marketplace.rateIntelligence('cascade-buyer', intelId, 6 as any),
                () => marketplace.purchaseIntelligence('non-existent-buyer', intelId),
                () => marketplace.rateIntelligence('cascade-buyer', 'non-existent-intel', 5),
                () => marketplace.listIntelligence('non-existent-seller', {
                    title: 'Should Fail',
                    description: 'Should fail',
                    category: 'market-analysis',
                    price: 0.1
                })
            ];

            for (const operation of errorOperations) {
                await expect(operation).rejects.toThrow();
            }

            // System should still be functional
            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBe(2);
            expect(stats.totalIntelligence).toBe(1);
            expect(stats.totalTransactions).toBe(1);

            // Valid operations should still work
            await expect(async () => {
                await marketplace.rateIntelligence('cascade-buyer', intelId, 4);
            }).not.toThrow();

            const finalStats = marketplace.getMarketStats();
            expect(finalStats.totalTransactions).toBe(1); // No new transactions
        });

        it('should handle memory pressure scenarios', async () => {
            // Create large amounts of data to test memory handling
            const agentCount = 500;
            const intelligencePerAgent = 20;

            // Register many agents
            for (let i = 0; i < agentCount; i++) {
                await marketplace.registerAgent(`memory-agent-${i}`, {
                    name: `Memory Test Agent ${i}`,
                    description: 'A'.repeat(1000), // 1KB description
                    specialization: new Array(50).fill(`spec-${i}`),
                    verified: i % 2 === 0
                });
            }

            // Each agent creates intelligence
            for (let i = 0; i < agentCount; i += 10) { // Use every 10th agent as seller
                for (let j = 0; j < intelligencePerAgent; j++) {
                    await marketplace.listIntelligence(`memory-agent-${i}`, {
                        title: `Memory Test Intelligence ${i}-${j}`,
                        description: 'B'.repeat(2000), // 2KB description
                        category: ['market-analysis', 'defi-strategy', 'price-prediction'][j % 3] as any,
                        price: 0.01 + (j * 0.01)
                    });
                }
            }

            // Verify system is still responsive
            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBe(agentCount);
            expect(stats.totalIntelligence).toBe((agentCount / 10) * intelligencePerAgent);

            // Search should still work efficiently
            const startTime = Date.now();
            const searchResults = marketplace.searchIntelligence({ category: 'market-analysis' });
            const endTime = Date.now();

            expect(searchResults.length).toBeGreaterThan(0);
            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        it('should handle configuration edge cases', () => {
            // Test with modified CONFIG values
            const originalConfig = { ...CONFIG.MARKETPLACE };

            // Temporarily modify config for testing
            (CONFIG.MARKETPLACE as any).MAX_RATING = 0;
            (CONFIG.MARKETPLACE as any).MIN_RATING = 10;
            (CONFIG.MARKETPLACE as any).MAX_REPUTATION = -1000;

            expect(() => {
                const testMarketplace = new AgentMarketplace(new Connection(clusterApiUrl('devnet')));
            }).not.toThrow();

            // Restore original config
            Object.assign(CONFIG.MARKETPLACE, originalConfig);
        });
    });

    describe('Resource Management Edge Cases', () => {
        it('should handle cleanup of large data structures', async () => {
            const marketplace = new AgentMarketplace(new Connection(clusterApiUrl('devnet')));

            // Create large amounts of data
            for (let i = 0; i < 1000; i++) {
                await marketplace.registerAgent(`cleanup-agent-${i}`, {
                    name: `Cleanup Agent ${i}`,
                    description: 'Test agent for cleanup',
                    specialization: ['cleanup'],
                    verified: false
                });
            }

            // Verify data exists
            let stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBe(1000);

            // Create new marketplace instance to test cleanup
            const newMarketplace = new AgentMarketplace(new Connection(clusterApiUrl('devnet')));
            stats = newMarketplace.getMarketStats();
            expect(stats.totalAgents).toBe(0); // Should start fresh

            // Memory should be properly managed
            expect(() => {
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
            }).not.toThrow();
        });

        it('should handle circular reference scenarios', async () => {
            const marketplace = new AgentMarketplace(new Connection(clusterApiUrl('devnet')));

            // Create scenario where agents reference each other
            await marketplace.registerAgent('circular-1', {
                name: 'Circular Agent 1',
                description: 'References circular-2',
                specialization: ['circular-2-related'],
                verified: true
            });

            await marketplace.registerAgent('circular-2', {
                name: 'Circular Agent 2',
                description: 'References circular-1',
                specialization: ['circular-1-related'],
                verified: true
            });

            // Create intelligence that references the other agent
            const intel1 = await marketplace.listIntelligence('circular-1', {
                title: 'Intelligence about circular-2',
                description: 'Analysis of agent circular-2',
                category: 'market-analysis',
                price: 0.1
            });

            const intel2 = await marketplace.listIntelligence('circular-2', {
                title: 'Intelligence about circular-1',
                description: 'Analysis of agent circular-1',
                category: 'market-analysis',
                price: 0.1
            });

            // Cross-purchase scenario
            await marketplace.purchaseIntelligence('circular-2', intel1);
            await marketplace.purchaseIntelligence('circular-1', intel2);

            // Rate each other's intelligence
            await marketplace.rateIntelligence('circular-2', intel1, 5);
            await marketplace.rateIntelligence('circular-1', intel2, 5);

            // System should handle this gracefully
            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBe(2);
            expect(stats.totalTransactions).toBe(2);

            const topAgents = marketplace.getTopAgents(2);
            expect(topAgents.length).toBe(2);
            topAgents.forEach(agent => {
                expect(agent.reputation_score).toBe(1000); // Both should have perfect reputation
            });
        });
    });
});