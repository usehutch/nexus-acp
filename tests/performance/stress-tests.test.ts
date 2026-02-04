import { Connection, clusterApiUrl } from '@solana/web3.js';
import { AgentMarketplace } from '../../src/marketplace.ts';
import { AgentManager } from '../../src/core/agent-manager.ts';
import { IntelligenceManager } from '../../src/core/intelligence-manager.ts';
import { TransactionManager } from '../../src/core/transaction-manager.ts';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('Performance and Stress Tests', () => {
    describe('Marketplace Performance', () => {
        let marketplace: AgentMarketplace;
        let connection: Connection;

        beforeEach(() => {
            connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
            marketplace = new AgentMarketplace(connection);
        });

        it('should handle large-scale agent registration efficiently', async () => {
            const agentCount = 1000;
            const startTime = Date.now();

            // Register many agents
            const registrationPromises = [];
            for (let i = 0; i < agentCount; i++) {
                registrationPromises.push(
                    marketplace.registerAgent(`perf-agent-${i}`, {
                        name: `Performance Agent ${i}`,
                        description: `Test agent ${i} for performance testing`,
                        specialization: [`spec-${i % 10}`, `category-${i % 5}`],
                        verified: i % 3 === 0
                    })
                );
            }

            await Promise.all(registrationPromises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(marketplace.getMarketStats().totalAgents).toBe(agentCount);
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
            expect(duration / agentCount).toBeLessThan(5); // Average less than 5ms per registration

            console.log(`🚀 Registered ${agentCount} agents in ${duration}ms (${(duration/agentCount).toFixed(2)}ms per agent)`);
        });

        it('should handle large-scale intelligence listing efficiently', async () => {
            // First register sellers
            const sellerCount = 100;
            const intelligencePerSeller = 50;

            const sellerIds: string[] = [];
            for (let i = 0; i < sellerCount; i++) {
                const sellerId = `perf-seller-${i}`;
                sellerIds.push(sellerId);
                await marketplace.registerAgent(sellerId, {
                    name: `Performance Seller ${i}`,
                    description: `Seller ${i} for performance testing`,
                    specialization: ['selling', `category-${i % 5}`],
                    verified: true
                });
            }

            const startTime = Date.now();

            // Each seller lists multiple intelligence
            const listingPromises = [];
            for (let sellerId of sellerIds) {
                for (let j = 0; j < intelligencePerSeller; j++) {
                    listingPromises.push(
                        marketplace.listIntelligence(sellerId, {
                            title: `Performance Intelligence ${sellerId}-${j}`,
                            description: `Test intelligence ${j} from ${sellerId}`,
                            category: ['market-analysis', 'defi-strategy', 'price-prediction', 'risk-assessment', 'trend-analysis'][j % 5] as any,
                            price: 0.01 + (j * 0.01)
                        })
                    );
                }
            }

            await Promise.all(listingPromises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            const totalIntelligence = sellerCount * intelligencePerSeller;
            expect(marketplace.getMarketStats().totalIntelligence).toBe(totalIntelligence);
            expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
            expect(duration / totalIntelligence).toBeLessThan(2); // Average less than 2ms per listing

            console.log(`📊 Listed ${totalIntelligence} intelligence pieces in ${duration}ms (${(duration/totalIntelligence).toFixed(2)}ms per listing)`);
        });

        it('should handle large-scale search operations efficiently', async () => {
            // Setup data for search testing
            const agentCount = 200;
            const intelligenceCount = 1000;

            // Register agents
            for (let i = 0; i < agentCount; i++) {
                await marketplace.registerAgent(`search-agent-${i}`, {
                    name: `Search Agent ${i}`,
                    description: `Agent ${i} for search testing`,
                    specialization: [`spec-${i % 20}`],
                    verified: i % 2 === 0
                });
            }

            // List intelligence
            for (let i = 0; i < intelligenceCount; i++) {
                const sellerId = `search-agent-${i % agentCount}`;
                await marketplace.listIntelligence(sellerId, {
                    title: `Search Intelligence ${i}`,
                    description: `Intelligence ${i} for search testing`,
                    category: ['market-analysis', 'defi-strategy', 'price-prediction', 'risk-assessment', 'trend-analysis'][i % 5] as any,
                    price: 0.01 + (i * 0.001)
                });
            }

            // Perform various search operations
            const searchOperations = [
                () => marketplace.searchIntelligence(),
                () => marketplace.searchIntelligence({ category: 'market-analysis' }),
                () => marketplace.searchIntelligence({ maxPrice: 0.5 }),
                () => marketplace.searchIntelligence({ minQuality: 50 }),
                () => marketplace.searchIntelligence({ category: 'defi-strategy', maxPrice: 0.3 }),
                () => marketplace.searchIntelligence({ seller: 'search-agent-0' }),
            ];

            const searchCount = 1000;
            const startTime = Date.now();

            for (let i = 0; i < searchCount; i++) {
                const operation = searchOperations[i % searchOperations.length];
                const results = operation();
                expect(Array.isArray(results)).toBe(true);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
            expect(duration / searchCount).toBeLessThan(5); // Average less than 5ms per search

            console.log(`🔍 Performed ${searchCount} searches in ${duration}ms (${(duration/searchCount).toFixed(2)}ms per search)`);
        });

        it('should handle high-volume transaction processing', async () => {
            const sellerCount = 50;
            const buyerCount = 200;
            const intelligencePerSeller = 10;

            // Register sellers
            const sellerIds: string[] = [];
            for (let i = 0; i < sellerCount; i++) {
                const sellerId = `tx-seller-${i}`;
                sellerIds.push(sellerId);
                await marketplace.registerAgent(sellerId, {
                    name: `Transaction Seller ${i}`,
                    description: `Seller ${i} for transaction testing`,
                    specialization: ['selling'],
                    verified: true
                });
            }

            // Register buyers
            const buyerIds: string[] = [];
            for (let i = 0; i < buyerCount; i++) {
                const buyerId = `tx-buyer-${i}`;
                buyerIds.push(buyerId);
                await marketplace.registerAgent(buyerId, {
                    name: `Transaction Buyer ${i}`,
                    description: `Buyer ${i} for transaction testing`,
                    specialization: ['buying'],
                    verified: false
                });
            }

            // List intelligence
            const intelligenceIds: string[] = [];
            for (const sellerId of sellerIds) {
                for (let j = 0; j < intelligencePerSeller; j++) {
                    const intelId = await marketplace.listIntelligence(sellerId, {
                        title: `Transaction Intelligence ${sellerId}-${j}`,
                        description: `Intelligence for transaction testing`,
                        category: 'market-analysis',
                        price: 0.05 + (j * 0.01)
                    });
                    intelligenceIds.push(intelId);
                }
            }

            // Perform transactions
            const transactionCount = 1000;
            const startTime = Date.now();

            const transactionPromises = [];
            for (let i = 0; i < transactionCount; i++) {
                const buyerId = buyerIds[i % buyerIds.length];
                const intelId = intelligenceIds[i % intelligenceIds.length];
                transactionPromises.push(marketplace.purchaseIntelligence(buyerId, intelId));
            }

            await Promise.all(transactionPromises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(marketplace.getMarketStats().totalTransactions).toBe(transactionCount);
            expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
            expect(duration / transactionCount).toBeLessThan(15); // Average less than 15ms per transaction

            console.log(`💰 Processed ${transactionCount} transactions in ${duration}ms (${(duration/transactionCount).toFixed(2)}ms per transaction)`);
        });

        it('should handle concurrent rating operations efficiently', async () => {
            // Setup minimal data for rating test
            const sellerId = 'rating-seller';
            const buyerCount = 500;

            await marketplace.registerAgent(sellerId, {
                name: 'Rating Test Seller',
                description: 'Seller for rating performance test',
                specialization: ['selling'],
                verified: true
            });

            const intelligenceId = await marketplace.listIntelligence(sellerId, {
                title: 'Rating Performance Intelligence',
                description: 'Intelligence for rating performance testing',
                category: 'market-analysis',
                price: 0.1
            });

            // Register buyers and make purchases
            const buyerIds: string[] = [];
            for (let i = 0; i < buyerCount; i++) {
                const buyerId = `rating-buyer-${i}`;
                buyerIds.push(buyerId);
                await marketplace.registerAgent(buyerId, {
                    name: `Rating Buyer ${i}`,
                    description: 'Buyer for rating testing',
                    specialization: ['buying'],
                    verified: false
                });
                await marketplace.purchaseIntelligence(buyerId, intelligenceId);
            }

            // Perform concurrent ratings
            const startTime = Date.now();

            const ratingPromises = buyerIds.map((buyerId, index) =>
                marketplace.rateIntelligence(buyerId, intelligenceId, ((index % 5) + 1) as any)
            );

            await Promise.all(ratingPromises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(8000); // Should complete within 8 seconds
            expect(duration / buyerCount).toBeLessThan(16); // Average less than 16ms per rating

            console.log(`⭐ Processed ${buyerCount} ratings in ${duration}ms (${(duration/buyerCount).toFixed(2)}ms per rating)`);
        });
    });

    describe('Core Component Performance', () => {
        describe('AgentManager Performance', () => {
            let agentManager: AgentManager;

            beforeEach(() => {
                agentManager = new AgentManager();
            });

            it('should handle large-scale agent operations efficiently', async () => {
                const agentCount = 10000;

                // Mass registration
                const startTime = Date.now();
                for (let i = 0; i < agentCount; i++) {
                    await agentManager.registerAgent(`stress-agent-${i}`, {
                        name: `Stress Agent ${i}`,
                        description: `Agent ${i} for stress testing`,
                        specialization: [`spec-${i % 100}`],
                        verified: i % 3 === 0
                    });
                }
                const registrationTime = Date.now() - startTime;

                expect(agentManager.getAgentCount()).toBe(agentCount);
                expect(registrationTime / agentCount).toBeLessThan(1); // Less than 1ms per registration

                // Mass retrieval
                const retrievalStart = Date.now();
                for (let i = 0; i < 1000; i++) {
                    const agent = agentManager.getAgent(`stress-agent-${i}`);
                    expect(agent).toBeDefined();
                }
                const retrievalTime = Date.now() - retrievalStart;
                expect(retrievalTime).toBeLessThan(100); // Should complete within 100ms

                // Top agents calculation with large dataset
                const rankingStart = Date.now();
                const topAgents = agentManager.getTopAgents(100);
                const rankingTime = Date.now() - rankingStart;

                expect(topAgents.length).toBe(100);
                expect(rankingTime).toBeLessThan(500); // Should complete within 500ms

                console.log(`👥 AgentManager: ${agentCount} agents - Registration: ${registrationTime}ms, Ranking: ${rankingTime}ms`);
            });

            it('should handle reputation updates efficiently at scale', () => {
                const agentCount = 1000;
                const transactionCount = 10000;

                // Register agents
                for (let i = 0; i < agentCount; i++) {
                    agentManager.registerAgent(`rep-agent-${i}`, {
                        name: `Rep Agent ${i}`,
                        description: 'Reputation test agent',
                        specialization: ['testing'],
                        verified: true
                    });
                }

                // Create large transaction set
                const transactions = [];
                for (let i = 0; i < transactionCount; i++) {
                    transactions.push({
                        id: `tx-${i}`,
                        buyer: `buyer-${i}`,
                        seller: `rep-agent-${i % agentCount}`,
                        intelligence_id: `intel-${i}`,
                        price: 0.1,
                        timestamp: Date.now(),
                        rating: (i % 5) + 1
                    });
                }

                // Update reputation
                const startTime = Date.now();
                agentManager.updateAgentReputation(transactions);
                const duration = Date.now() - startTime;

                expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
                console.log(`📊 Reputation update: ${transactionCount} transactions in ${duration}ms`);
            });
        });

        describe('IntelligenceManager Performance', () => {
            let intelligenceManager: IntelligenceManager;
            let agentManager: AgentManager;

            beforeEach(async () => {
                agentManager = new AgentManager();
                intelligenceManager = new IntelligenceManager(agentManager);

                // Register test sellers
                for (let i = 0; i < 100; i++) {
                    await agentManager.registerAgent(`intel-seller-${i}`, {
                        name: `Intel Seller ${i}`,
                        description: `Seller ${i}`,
                        specialization: ['testing'],
                        verified: true
                    });
                }
            });

            it('should handle large-scale intelligence operations efficiently', async () => {
                const intelligenceCount = 10000;

                // Mass intelligence listing
                const startTime = Date.now();
                const intelligenceIds = [];
                for (let i = 0; i < intelligenceCount; i++) {
                    const sellerId = `intel-seller-${i % 100}`;
                    const intelId = await intelligenceManager.listIntelligence(sellerId, {
                        title: `Intel ${i}`,
                        description: `Intelligence ${i}`,
                        category: ['market-analysis', 'defi-strategy', 'price-prediction'][i % 3] as any,
                        price: 0.01 + (i * 0.001)
                    });
                    intelligenceIds.push(intelId);
                }
                const listingTime = Date.now() - startTime;

                expect(intelligenceManager.getIntelligenceCount()).toBe(intelligenceCount);
                expect(listingTime / intelligenceCount).toBeLessThan(2); // Less than 2ms per listing

                // Mass search operations
                const searchStart = Date.now();
                for (let i = 0; i < 1000; i++) {
                    const results = intelligenceManager.searchIntelligence({
                        category: ['market-analysis', 'defi-strategy', 'price-prediction'][i % 3],
                        maxPrice: 0.5 + (i * 0.01)
                    });
                    expect(Array.isArray(results)).toBe(true);
                }
                const searchTime = Date.now() - searchStart;

                expect(searchTime).toBeLessThan(2000); // Should complete within 2 seconds

                console.log(`🧠 IntelligenceManager: ${intelligenceCount} intelligence - Listing: ${listingTime}ms, Search: ${searchTime}ms`);
            });

            it('should handle complex filtering efficiently', async () => {
                // Create diverse intelligence data
                const categories = ['market-analysis', 'defi-strategy', 'price-prediction', 'risk-assessment', 'trend-analysis'];
                const intelligenceCount = 5000;

                for (let i = 0; i < intelligenceCount; i++) {
                    await intelligenceManager.listIntelligence(`intel-seller-${i % 100}`, {
                        title: `Complex Intel ${i}`,
                        description: `Complex intelligence ${i}`,
                        category: categories[i % categories.length] as any,
                        price: Math.random() * 2
                    });
                }

                // Perform complex searches
                const complexSearches = [
                    { category: 'market-analysis', maxPrice: 0.5, minQuality: 30 },
                    { category: 'defi-strategy', maxPrice: 1.0, seller: 'intel-seller-0' },
                    { maxPrice: 0.3, minQuality: 50 },
                    { category: 'price-prediction', maxPrice: 1.5 },
                    { minQuality: 70, seller: 'intel-seller-1' }
                ];

                const startTime = Date.now();
                for (let i = 0; i < 1000; i++) {
                    const filter = complexSearches[i % complexSearches.length];
                    const results = intelligenceManager.searchIntelligence(filter);
                    expect(Array.isArray(results)).toBe(true);
                }
                const duration = Date.now() - startTime;

                expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
                console.log(`🔍 Complex filtering: 1000 searches in ${duration}ms`);
            });
        });

        describe('TransactionManager Performance', () => {
            let transactionManager: TransactionManager;
            let agentManager: AgentManager;
            let intelligenceManager: IntelligenceManager;

            beforeEach(async () => {
                agentManager = new AgentManager();
                intelligenceManager = new IntelligenceManager(agentManager);
                transactionManager = new TransactionManager(agentManager, intelligenceManager);

                // Setup test data
                const agentCount = 100;
                for (let i = 0; i < agentCount; i++) {
                    await agentManager.registerAgent(`stress-agent-${i}`, {
                        name: `Stress Agent ${i}`,
                        description: `Agent ${i}`,
                        specialization: ['testing'],
                        verified: true
                    });
                }

                // Create intelligence
                for (let i = 0; i < 50; i++) {
                    await intelligenceManager.listIntelligence(`stress-agent-${i}`, {
                        title: `Stress Intel ${i}`,
                        description: `Intelligence ${i}`,
                        category: 'market-analysis',
                        price: 0.1 + (i * 0.01)
                    });
                }
            });

            it('should handle high-volume transaction processing', async () => {
                const transactionCount = 5000;
                const intelligenceList = intelligenceManager.getAllIntelligence();

                const startTime = Date.now();

                // Process many transactions
                for (let i = 0; i < transactionCount; i++) {
                    const buyerId = `stress-agent-${50 + (i % 50)}`; // Use latter half as buyers
                    const intel = intelligenceList[i % intelligenceList.length];
                    await transactionManager.purchaseIntelligence(buyerId, intel.id);
                }

                const duration = Date.now() - startTime;

                expect(transactionManager.getTransactionCount()).toBe(transactionCount);
                expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
                expect(duration / transactionCount).toBeLessThan(2); // Less than 2ms per transaction

                console.log(`💳 TransactionManager: ${transactionCount} transactions in ${duration}ms (${(duration/transactionCount).toFixed(2)}ms per transaction)`);
            });

            it('should calculate statistics efficiently with large datasets', () => {
                // Create a large number of transactions first
                const transactionCount = 10000;

                // Manually inject transactions for testing
                for (let i = 0; i < transactionCount; i++) {
                    const transaction = {
                        id: `perf-tx-${i}`,
                        buyer: `buyer-${i % 100}`,
                        seller: `seller-${i % 50}`,
                        intelligence_id: `intel-${i % 200}`,
                        price: Math.random() * 2,
                        timestamp: Date.now() + i,
                        rating: i % 2 === 0 ? ((i % 5) + 1) : undefined
                    };
                    (transactionManager as any).transactions.push(transaction);
                }

                // Test statistics calculation performance
                const startTime = Date.now();

                const count = transactionManager.getTransactionCount();
                const volume = transactionManager.getTotalVolume();
                const avgPrice = transactionManager.getAveragePrice();
                const transactions = transactionManager.getTransactions();

                const duration = Date.now() - startTime;

                expect(count).toBe(transactionCount);
                expect(volume).toBeGreaterThan(0);
                expect(avgPrice).toBeGreaterThan(0);
                expect(transactions.length).toBe(transactionCount);
                expect(duration).toBeLessThan(100); // Should complete within 100ms

                console.log(`📈 Statistics calculation: ${transactionCount} transactions analyzed in ${duration}ms`);
            });
        });
    });

    describe('Memory and Resource Management', () => {
        it('should maintain stable memory usage under load', async () => {
            const marketplace = new AgentMarketplace(new Connection(clusterApiUrl('devnet')));

            // Force garbage collection at start if available
            if (global.gc) global.gc();

            const cycles = 100;
            const itemsPerCycle = 50;

            for (let cycle = 0; cycle < cycles; cycle++) {
                // Register agents
                for (let i = 0; i < itemsPerCycle; i++) {
                    await marketplace.registerAgent(`memory-agent-${cycle}-${i}`, {
                        name: `Memory Agent ${cycle}-${i}`,
                        description: `Cycle ${cycle} Agent ${i}`,
                        specialization: [`cycle-${cycle}`],
                        verified: false
                    });
                }

                // List intelligence
                for (let i = 0; i < itemsPerCycle / 2; i++) {
                    await marketplace.listIntelligence(`memory-agent-${cycle}-${i}`, {
                        title: `Memory Intelligence ${cycle}-${i}`,
                        description: `Cycle ${cycle} Intelligence ${i}`,
                        category: 'market-analysis',
                        price: 0.1
                    });
                }

                // Perform some operations
                if (cycle > 0) {
                    const results = marketplace.searchIntelligence();
                    expect(results.length).toBeGreaterThan(0);

                    const stats = marketplace.getMarketStats();
                    expect(stats.totalAgents).toBeGreaterThan(0);
                }

                // Periodic cleanup check
                if (cycle % 10 === 0 && global.gc) {
                    global.gc();
                    console.log(`🧹 Memory test cycle ${cycle}/${cycles} completed`);
                }
            }

            const finalStats = marketplace.getMarketStats();
            expect(finalStats.totalAgents).toBe(cycles * itemsPerCycle);
            console.log(`💾 Memory stress test completed: ${finalStats.totalAgents} agents, ${finalStats.totalIntelligence} intelligence`);
        });

        it('should handle concurrent access patterns efficiently', async () => {
            const marketplace = new AgentMarketplace(new Connection(clusterApiUrl('devnet')));
            const concurrentOperations = 100;

            // Setup base data
            for (let i = 0; i < 20; i++) {
                await marketplace.registerAgent(`concurrent-agent-${i}`, {
                    name: `Concurrent Agent ${i}`,
                    description: `Agent ${i} for concurrency testing`,
                    specialization: ['concurrency'],
                    verified: true
                });
            }

            // Run concurrent operations
            const startTime = Date.now();
            const operations = [];

            for (let i = 0; i < concurrentOperations; i++) {
                operations.push(
                    // Mix of different operations
                    i % 4 === 0 ? marketplace.searchIntelligence() :
                    i % 4 === 1 ? marketplace.getMarketStats() :
                    i % 4 === 2 ? marketplace.getTopAgents(10) :
                    marketplace.searchIntelligence({ category: 'market-analysis' })
                );
            }

            const results = await Promise.all(operations);
            const duration = Date.now() - startTime;

            expect(results.length).toBe(concurrentOperations);
            expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
            console.log(`🚦 Concurrent operations: ${concurrentOperations} operations in ${duration}ms`);
        });
    });
});