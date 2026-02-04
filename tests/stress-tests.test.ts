import { AgentManager } from '../src/core/agent-manager.ts';
import { IntelligenceManager } from '../src/core/intelligence-manager.ts';
import { TransactionManager } from '../src/core/transaction-manager.ts';
import type { AgentProfile } from '../src/types/index.ts';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('Performance and Stress Tests', () => {
    let agentManager: AgentManager;
    let intelligenceManager: IntelligenceManager;
    let transactionManager: TransactionManager;

    beforeEach(() => {
        agentManager = new AgentManager();
        intelligenceManager = new IntelligenceManager(agentManager);
        transactionManager = new TransactionManager(agentManager, intelligenceManager);
    });

    describe('High-Volume Agent Operations', () => {
        it('should efficiently handle thousands of agent registrations', async () => {
            const numAgents = 2000; // Reduced for faster testing
            const startTime = Date.now();

            // Register many agents rapidly
            for (let i = 0; i < numAgents; i++) {
                await agentManager.registerAgent(`stress-agent-${i}`, {
                    name: `Stress Test Agent ${i}`,
                    description: `Agent ${i} for stress testing the marketplace`,
                    specialization: ['market-analysis'],
                    verified: i % 10 === 0 // Every 10th agent is verified
                });
            }

            const registrationTime = Date.now() - startTime;

            // Performance assertions
            expect(registrationTime).toBeLessThan(15000); // Should complete within 15 seconds
            expect(agentManager.getAgentCount()).toBe(numAgents);

            // Test retrieval performance
            const retrievalStart = Date.now();
            for (let i = 0; i < 50; i++) {
                const randomId = `stress-agent-${Math.floor(Math.random() * numAgents)}`;
                const agent = agentManager.getAgent(randomId);
                expect(agent).toBeDefined();
            }
            const retrievalTime = Date.now() - retrievalStart;

            expect(retrievalTime).toBeLessThan(100); // 50 lookups should be under 100ms

            // Test ranking performance with large dataset
            const rankingStart = Date.now();
            const topAgents = agentManager.getTopAgents(100);
            const rankingTime = Date.now() - rankingStart;

            expect(rankingTime).toBeLessThan(500); // Ranking should be under 500ms
            expect(topAgents.length).toBe(100);

            console.log(`Performance metrics for ${numAgents} agents:`);
            console.log(`- Registration: ${registrationTime}ms`);
            console.log(`- Retrieval (50 ops): ${retrievalTime}ms`);
            console.log(`- Ranking (top 100): ${rankingTime}ms`);
        });

        it('should handle massive intelligence listings efficiently', async () => {
            const numSellers = 50;
            const intelligencePerSeller = 20;
            const totalIntelligence = numSellers * intelligencePerSeller;

            // Register sellers
            const sellers: string[] = [];
            for (let i = 0; i < numSellers; i++) {
                const sellerId = `bulk-seller-${i}`;
                sellers.push(sellerId);
                await agentManager.registerAgent(sellerId, {
                    name: `Bulk Seller ${i}`,
                    description: `High-volume seller ${i}`,
                    specialization: ['market-analysis'],
                    verified: i % 5 === 0
                });
            }

            // Bulk intelligence listing
            const listingStart = Date.now();

            for (const seller of sellers) {
                for (let j = 0; j < intelligencePerSeller; j++) {
                    await intelligenceManager.listIntelligence(seller, {
                        title: `Bulk Intelligence ${seller}-${j}`,
                        description: `Mass-generated intelligence ${j}`,
                        category: 'market-analysis',
                        price: 0.1 + (j % 10) * 0.05 // Varied pricing
                    });
                }
            }

            const listingTime = Date.now() - listingStart;

            expect(listingTime).toBeLessThan(20000); // Should complete within 20 seconds
            expect(intelligenceManager.getIntelligenceCount()).toBe(totalIntelligence);

            // Test search performance with large dataset
            const searchTests = [
                { filter: {}, expectedMinResults: totalIntelligence },
                { filter: { maxPrice: 0.3 }, expectedMinResults: 1 },
                { filter: { category: 'market-analysis' }, expectedMinResults: totalIntelligence }
            ];

            for (const test of searchTests) {
                const searchStart = Date.now();
                const results = intelligenceManager.searchIntelligence(test.filter as any);
                const searchTime = Date.now() - searchStart;

                expect(searchTime).toBeLessThan(200); // Each search should be under 200ms
                expect(results.length).toBeGreaterThanOrEqual(test.expectedMinResults);
            }

            // Test category analytics performance
            const analyticsStart = Date.now();
            const categoryCounts = intelligenceManager.getCategoryCounts();
            const analyticsTime = Date.now() - analyticsStart;

            expect(analyticsTime).toBeLessThan(100); // Analytics should be under 100ms
            expect(categoryCounts['market-analysis']).toBe(totalIntelligence);

            console.log(`Performance metrics for ${totalIntelligence} intelligence:`);
            console.log(`- Listing: ${listingTime}ms`);
            console.log(`- Analytics: ${analyticsTime}ms`);
        });
    });

    describe('High-Volume Transaction Processing', () => {
        it('should process many transactions efficiently', async () => {
            const numSellers = 10;
            const numBuyers = 50;
            const intelligencePerSeller = 5;

            // Setup: Register agents
            const sellers: string[] = [];
            const buyers: string[] = [];
            const intelligenceIds: string[] = [];

            for (let i = 0; i < numSellers; i++) {
                const sellerId = `tx-seller-${i}`;
                sellers.push(sellerId);
                await agentManager.registerAgent(sellerId, {
                    name: `Transaction Seller ${i}`,
                    description: `High-volume transaction seller`,
                    specialization: ['market-analysis'],
                    verified: true
                });

                // Create intelligence for each seller
                for (let j = 0; j < intelligencePerSeller; j++) {
                    const id = await intelligenceManager.listIntelligence(sellerId, {
                        title: `TX Intelligence ${i}-${j}`,
                        description: `Transaction test intelligence`,
                        category: 'market-analysis',
                        price: 0.1 + (j * 0.05)
                    });
                    intelligenceIds.push(id);
                }
            }

            for (let i = 0; i < numBuyers; i++) {
                const buyerId = `tx-buyer-${i}`;
                buyers.push(buyerId);
                await agentManager.registerAgent(buyerId, {
                    name: `Transaction Buyer ${i}`,
                    description: `High-volume transaction buyer`,
                    specialization: ['trading'],
                    verified: false
                });
            }

            // Stress test: Each buyer makes multiple purchases
            const transactionStart = Date.now();
            const purchasesPerBuyer = 10;

            for (const buyer of buyers) {
                for (let i = 0; i < purchasesPerBuyer; i++) {
                    const randomIntelligence = intelligenceIds[Math.floor(Math.random() * intelligenceIds.length)];
                    await transactionManager.purchaseIntelligence(buyer, randomIntelligence);
                }
            }

            const transactionTime = Date.now() - transactionStart;
            const totalTransactions = numBuyers * purchasesPerBuyer;

            expect(transactionTime).toBeLessThan(30000); // Should complete within 30 seconds
            expect(transactionManager.getTransactionCount()).toBe(totalTransactions);

            // Test transaction statistics performance
            const statsStart = Date.now();
            const totalVolume = transactionManager.getTotalVolume();
            const avgPrice = transactionManager.getAveragePrice();
            const statsTime = Date.now() - statsStart;

            expect(statsTime).toBeLessThan(200); // Statistics should be under 200ms
            expect(totalVolume).toBeGreaterThan(0);
            expect(avgPrice).toBeGreaterThan(0);

            console.log(`Performance metrics for ${totalTransactions} transactions:`);
            console.log(`- Processing: ${transactionTime}ms (${(totalTransactions / (transactionTime / 1000)).toFixed(0)} tx/s)`);
            console.log(`- Statistics: ${statsTime}ms`);
        });
    });

    describe('Memory and Resource Management', () => {
        it('should manage memory efficiently under load', async () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Create a large number of objects
            const agentCount = 500;
            const intelligencePerAgent = 10;

            for (let i = 0; i < agentCount; i++) {
                await agentManager.registerAgent(`mem-agent-${i}`, {
                    name: `Memory Test Agent ${i}`,
                    description: `Agent for memory testing with longer description to increase memory usage`,
                    specialization: ['market-analysis', 'defi-strategy'],
                    verified: i % 10 === 0
                });

                // Create multiple intelligence per agent
                for (let j = 0; j < intelligencePerAgent; j++) {
                    await intelligenceManager.listIntelligence(`mem-agent-${i}`, {
                        title: `Memory Intelligence ${i}-${j}`,
                        description: `Memory test intelligence with detailed description to simulate realistic data sizes`,
                        category: ['market-analysis', 'defi-strategy'][j % 2] as any,
                        price: 0.1 + (j * 0.01)
                    });
                }

                // Force garbage collection periodically
                if (i % 50 === 0 && global.gc) {
                    global.gc();
                }
            }

            const afterCreationMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = afterCreationMemory - initialMemory;

            // Verify counts
            expect(agentManager.getAgentCount()).toBe(agentCount);
            expect(intelligenceManager.getIntelligenceCount()).toBe(agentCount * intelligencePerAgent);

            // Memory should not grow excessively (allow for reasonable growth)
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase

            console.log(`Memory usage:`);
            console.log(`- Initial: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
            console.log(`- After creation: ${(afterCreationMemory / 1024 / 1024).toFixed(2)} MB`);
            console.log(`- Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
        });

        it('should handle concurrent operations without race conditions', async () => {
            const concurrentSellers = 20;
            const concurrentBuyers = 30;

            // Register sellers concurrently
            const sellerPromises = [];
            for (let i = 0; i < concurrentSellers; i++) {
                sellerPromises.push(
                    agentManager.registerAgent(`concurrent-seller-${i}`, {
                        name: `Concurrent Seller ${i}`,
                        description: `Seller for concurrency testing`,
                        specialization: ['market-analysis'],
                        verified: i % 5 === 0
                    })
                );
            }

            const sellerResults = await Promise.all(sellerPromises);
            expect(sellerResults.every(result => result === true)).toBe(true);

            // Register buyers concurrently
            const buyerPromises = [];
            for (let i = 0; i < concurrentBuyers; i++) {
                buyerPromises.push(
                    agentManager.registerAgent(`concurrent-buyer-${i}`, {
                        name: `Concurrent Buyer ${i}`,
                        description: `Buyer for concurrency testing`,
                        specialization: ['trading'],
                        verified: false
                    })
                );
            }

            const buyerResults = await Promise.all(buyerPromises);
            expect(buyerResults.every(result => result === true)).toBe(true);

            // Create intelligence concurrently
            const intelligencePromises = [];
            for (let i = 0; i < concurrentSellers; i++) {
                for (let j = 0; j < 3; j++) {
                    intelligencePromises.push(
                        intelligenceManager.listIntelligence(`concurrent-seller-${i}`, {
                            title: `Concurrent Intelligence ${i}-${j}`,
                            description: `Intelligence for concurrent testing`,
                            category: 'market-analysis',
                            price: 0.1 + (j * 0.1)
                        })
                    );
                }
            }

            const intelligenceIds = await Promise.all(intelligencePromises);
            expect(intelligenceIds.length).toBe(concurrentSellers * 3);

            // Execute concurrent purchases
            const purchasePromises = [];
            for (let i = 0; i < concurrentBuyers; i++) {
                const randomIntelligenceId = intelligenceIds[Math.floor(Math.random() * intelligenceIds.length)];
                purchasePromises.push(
                    transactionManager.purchaseIntelligence(`concurrent-buyer-${i}`, randomIntelligenceId)
                );
            }

            const purchaseResults = await Promise.all(purchasePromises);
            expect(purchaseResults.every(result => result.success === true)).toBe(true);

            // Verify final state consistency
            expect(agentManager.getAgentCount()).toBe(concurrentSellers + concurrentBuyers);
            expect(intelligenceManager.getIntelligenceCount()).toBe(concurrentSellers * 3);
            expect(transactionManager.getTransactionCount()).toBe(concurrentBuyers);

            // Verify data integrity - no duplicate agent keys
            const allAgents = agentManager.getAllAgents();
            const agentKeys = allAgents.map(agent => agent.public_key);
            const uniqueKeys = [...new Set(agentKeys)];
            expect(uniqueKeys.length).toBe(agentKeys.length);

            // Verify transaction integrity - all transactions should have valid references
            const transactions = transactionManager.getTransactions();
            for (const tx of transactions) {
                expect(agentManager.hasAgent(tx.buyer)).toBe(true);
                expect(agentManager.hasAgent(tx.seller)).toBe(true);
                expect(intelligenceManager.getIntelligence(tx.intelligence_id)).toBeDefined();
            }
        });
    });

    describe('Edge Cases and Boundary Conditions', () => {
        it('should handle extreme data values by validation', async () => {
            // Test that extreme agent data is properly rejected
            await expect(agentManager.registerAgent('edge-agent-1', {
                name: 'A'.repeat(1000), // Very long name
                description: 'B'.repeat(5000), // Very long description
                specialization: ['market-analysis'],
                verified: false
            })).rejects.toThrow();

            expect(agentManager.hasAgent('edge-agent-1')).toBe(false);

            // Register a valid agent for pricing tests
            await agentManager.registerAgent('pricing-agent', {
                name: 'Valid Pricing Agent',
                description: 'Agent for testing pricing extremes',
                specialization: ['market-analysis'],
                verified: false
            });

            // Test with extreme pricing (price below minimum should be rejected)
            await expect(intelligenceManager.listIntelligence('pricing-agent', {
                title: 'Extreme Price Intelligence',
                description: 'Testing extreme pricing',
                category: 'market-analysis',
                price: 0.0001 // Below minimum
            })).rejects.toThrow();

            // Test with maximum valid price
            const validIntelId = await intelligenceManager.listIntelligence('pricing-agent', {
                title: 'High Price Intelligence',
                description: 'Testing high but valid pricing',
                category: 'defi-strategy',
                price: 999.999 // High but within valid range
            });

            // Test search with extreme filters
            const extremeSearchResults1 = intelligenceManager.searchIntelligence({
                maxPrice: 0.01 // Should find nothing since minimum price is 0.001
            });
            expect(extremeSearchResults1.length).toBe(0);

            const extremeSearchResults2 = intelligenceManager.searchIntelligence({
                maxPrice: 1000 // Should find the valid intelligence
            });
            expect(extremeSearchResults2.length).toBeGreaterThan(0);

            // Test with zero price (should be rejected since minimum is 0.001)
            await expect(intelligenceManager.listIntelligence('pricing-agent', {
                title: 'Free Intelligence',
                description: 'Zero price intelligence',
                category: 'risk-assessment',
                price: 0
            })).rejects.toThrow();
        });

        it('should handle special characters and unicode', async () => {
            // Test with unusual but valid data
            await agentManager.registerAgent('unicode-agent-1', {
                name: 'Agent with 🚀 Emojis 漢字',
                description: 'Description\nwith\nnewlines\tand\ttabs',
                specialization: ['testing'], // Fixed: must have at least one specialization
                verified: true
            });

            expect(agentManager.hasAgent('unicode-agent-1')).toBe(true);

            // Test with special characters in intelligence
            const specialIntelId = await intelligenceManager.listIntelligence('unicode-agent-1', {
                title: '🔥 Hot Intelligence 💎 with unicode: 漢字',
                description: 'Special chars: !@#$%^&*()_+-=[]{}',
                category: 'trend-analysis',
                price: 0.5
            });

            const intelligence = intelligenceManager.getIntelligence(specialIntelId);
            expect(intelligence).toBeDefined();
            expect(intelligence!.title).toContain('🔥');
            expect(intelligence!.title).toContain('漢字');

            // Test search with unicode
            const unicodeResults = intelligenceManager.searchIntelligence({
                seller: 'unicode-agent-1'
            });
            expect(unicodeResults.length).toBe(1);
        });

        it('should maintain performance under sustained load', async () => {
            const duration = 3000; // 3 second sustained test
            const startTime = Date.now();
            let operationCount = 0;

            // Simulate sustained marketplace activity
            while (Date.now() - startTime < duration) {
                const agentId = `sustained-agent-${operationCount}`;

                // Register agent
                await agentManager.registerAgent(agentId, {
                    name: `Sustained Agent ${operationCount}`,
                    description: `Agent for sustained load test`,
                    specialization: ['market-analysis'],
                    verified: operationCount % 10 === 0
                });

                // Create intelligence
                await intelligenceManager.listIntelligence(agentId, {
                    title: `Sustained Intelligence ${operationCount}`,
                    description: `Intelligence for sustained test`,
                    category: 'market-analysis',
                    price: 0.1 + (operationCount % 10) * 0.05
                });

                // Perform search (to test read performance)
                intelligenceManager.searchIntelligence({ maxPrice: 1.0 });

                operationCount++;

                // Brief pause to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 2));
            }

            const actualDuration = Date.now() - startTime;
            const operationsPerSecond = operationCount / (actualDuration / 1000);

            expect(operationCount).toBeGreaterThan(50); // Should complete at least 50 operations
            expect(operationsPerSecond).toBeGreaterThan(5); // Should maintain at least 5 ops/sec

            // Verify all operations completed successfully
            expect(agentManager.getAgentCount()).toBe(operationCount);
            expect(intelligenceManager.getIntelligenceCount()).toBe(operationCount);

            console.log(`Sustained load test results:`);
            console.log(`- Duration: ${actualDuration}ms`);
            console.log(`- Operations: ${operationCount}`);
            console.log(`- Rate: ${operationsPerSecond.toFixed(1)} ops/sec`);
        });

        it('should handle rapid state changes without corruption', async () => {
            const agentKey = 'rapid-changes-agent';
            await agentManager.registerAgent(agentKey, {
                name: 'Rapid Changes Agent',
                description: 'Agent for rapid state change testing',
                specialization: ['market-analysis'],
                verified: false
            });

            const intelligenceId = await intelligenceManager.listIntelligence(agentKey, {
                title: 'Rapid Changes Intelligence',
                description: 'Intelligence for rapid testing',
                category: 'market-analysis',
                price: 0.5
            });

            // Rapid sequence of state-changing operations
            const buyerCount = 10;
            const buyers: string[] = [];

            for (let i = 0; i < buyerCount; i++) {
                const buyerKey = `rapid-buyer-${i}`;
                buyers.push(buyerKey);
                await agentManager.registerAgent(buyerKey, {
                    name: `Rapid Buyer ${i}`,
                    description: `Buyer for rapid testing`,
                    specialization: ['trading'],
                    verified: false
                });

                // Purchase immediately after registration
                await transactionManager.purchaseIntelligence(buyerKey, intelligenceId);

                // Rate immediately after purchase
                await transactionManager.rateIntelligence(buyerKey, intelligenceId, 1 + (i % 5));
            }

            // Verify final state consistency
            const agent = agentManager.getAgent(agentKey)!;
            expect(agent.total_sales).toBe(buyerCount);
            expect(agent.total_earnings).toBe(buyerCount * 0.5);

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.sales_count).toBe(buyerCount);
            expect(intelligence.rating).toBeGreaterThan(0);

            expect(transactionManager.getTransactionCount()).toBe(buyerCount);

            // All transactions should have ratings
            const transactions = transactionManager.getTransactions();
            const ratedTransactions = transactions.filter(tx => tx.rating !== undefined);
            expect(ratedTransactions.length).toBe(buyerCount);
        });
    });

    describe('Resource Cleanup and Limits', () => {
        it('should handle large transaction histories efficiently', async () => {
            // Setup agents
            const sellerId = 'history-seller';
            const numBuyers = 200;

            await agentManager.registerAgent(sellerId, {
                name: 'History Seller',
                description: 'Seller with large transaction history',
                specialization: ['market-analysis'],
                verified: true
            });

            // Create one intelligence that will have many transactions
            const intelligenceId = await intelligenceManager.listIntelligence(sellerId, {
                title: 'Popular Intelligence',
                description: 'Intelligence that becomes very popular',
                category: 'market-analysis',
                price: 0.1
            });

            // Create many buyers and transactions
            for (let i = 0; i < numBuyers; i++) {
                const buyerId = `history-buyer-${i}`;
                await agentManager.registerAgent(buyerId, {
                    name: `History Buyer ${i}`,
                    description: 'Buyer for history testing',
                    specialization: ['trading'],
                    verified: false
                });

                await transactionManager.purchaseIntelligence(buyerId, intelligenceId);

                // Rate every 5th purchase to create varied rating history
                if (i % 5 === 0) {
                    await transactionManager.rateIntelligence(buyerId, intelligenceId, 3 + (i % 3));
                }
            }

            // Test performance with large history
            const statsStart = Date.now();
            const totalVolume = transactionManager.getTotalVolume();
            const avgPrice = transactionManager.getAveragePrice();
            const transactionCount = transactionManager.getTransactionCount();
            const statsTime = Date.now() - statsStart;

            expect(statsTime).toBeLessThan(200); // Should remain fast
            expect(transactionCount).toBe(numBuyers);
            expect(totalVolume).toBeCloseTo(numBuyers * 0.1, 10); // Handle floating point precision
            expect(avgPrice).toBeCloseTo(0.1, 10);

            // Test reputation calculation performance
            const reputationStart = Date.now();
            const seller = agentManager.getAgent(sellerId)!;
            const reputationTime = Date.now() - reputationStart;

            expect(reputationTime).toBeLessThan(100);
            expect(seller.total_sales).toBe(numBuyers);
            expect(seller.reputation_score).toBeGreaterThan(0);

            console.log(`Performance with ${numBuyers} transactions:`);
            console.log(`- Stats calculation: ${statsTime}ms`);
            console.log(`- Reputation calculation: ${reputationTime}ms`);
        });
    });
});