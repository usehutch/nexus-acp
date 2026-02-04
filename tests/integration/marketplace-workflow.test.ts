import { AgentManager } from '../../src/core/agent-manager.ts';
import { IntelligenceManager } from '../../src/core/intelligence-manager.ts';
import { TransactionManager } from '../../src/core/transaction-manager.ts';
import { CONFIG } from '../../src/config/index.ts';
import type { AgentProfile, AgentIntelligence } from '../../src/types/index.ts';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('Marketplace Integration Workflow', () => {
    let agentManager: AgentManager;
    let intelligenceManager: IntelligenceManager;
    let transactionManager: TransactionManager;

    beforeEach(() => {
        agentManager = new AgentManager();
        intelligenceManager = new IntelligenceManager(agentManager);
        transactionManager = new TransactionManager(agentManager, intelligenceManager);
    });

    describe('Complete Agent Lifecycle', () => {
        it('should handle full agent registration to sales workflow', async () => {
            // Step 1: Register agent
            const sellerKey = 'lifecycle-seller';
            const success = await agentManager.registerAgent(sellerKey, {
                name: 'Lifecycle Test Seller',
                description: 'Agent for testing complete lifecycle',
                specialization: ['market-analysis', 'defi-strategy'],
                verified: false
            });

            expect(success).toBe(true);

            const agent = agentManager.getAgent(sellerKey);
            expect(agent).toBeDefined();
            expect(agent!.total_sales).toBe(0);
            expect(agent!.total_earnings).toBe(0);
            expect(agent!.reputation_score).toBe(CONFIG.MARKETPLACE.INITIAL_REPUTATION);

            // Step 2: List intelligence
            const intelligenceId = await intelligenceManager.listIntelligence(sellerKey, {
                title: 'Comprehensive Market Analysis',
                description: 'Deep dive into current market conditions',
                category: 'market-analysis',
                price: 0.8
            });

            const intelligence = intelligenceManager.getIntelligence(intelligenceId);
            expect(intelligence).toBeDefined();
            expect(intelligence!.seller).toBe(sellerKey);
            expect(intelligence!.sales_count).toBe(0);
            expect(intelligence!.rating).toBe(0);

            // Step 3: Register buyer and make purchase
            const buyerKey = 'lifecycle-buyer';
            await agentManager.registerAgent(buyerKey, {
                name: 'Lifecycle Test Buyer',
                description: 'Buyer for lifecycle testing',
                specialization: ['analysis-consumption'],
                verified: false
            });

            const purchaseResult = await transactionManager.purchaseIntelligence(buyerKey, intelligenceId);

            expect(purchaseResult.success).toBe(true);
            expect(purchaseResult.data).toBeDefined();

            // Step 4: Verify state after purchase
            const updatedIntelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(updatedIntelligence.sales_count).toBe(1);

            const updatedSeller = agentManager.getAgent(sellerKey)!;
            expect(updatedSeller.total_sales).toBe(1);
            expect(updatedSeller.total_earnings).toBe(0.8);

            const transactions = transactionManager.getTransactions();
            expect(transactions.length).toBe(1);
            expect(transactions[0].buyer).toBe(buyerKey);
            expect(transactions[0].seller).toBe(sellerKey);

            // Step 5: Rate the intelligence
            await transactionManager.rateIntelligence(buyerKey, intelligenceId, 4, 'Very insightful analysis');

            const finalIntelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(finalIntelligence.rating).toBe(4);

            const finalSeller = agentManager.getAgent(sellerKey)!;
            const expectedReputation = Math.round((4 / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);
            expect(finalSeller.reputation_score).toBe(expectedReputation);

            const finalTransaction = transactionManager.getTransactions()[0];
            expect(finalTransaction.rating).toBe(4);
            expect(finalTransaction.review).toBe('Very insightful analysis');
        });

        it('should handle multiple agents and cross-trading', async () => {
            // Register multiple agents
            const agents = [
                { key: 'trader1', specialization: ['market-analysis'] },
                { key: 'trader2', specialization: ['defi-strategy'] },
                { key: 'trader3', specialization: ['price-prediction'] }
            ];

            for (const agent of agents) {
                await agentManager.registerAgent(agent.key, {
                    name: `Trader ${agent.key}`,
                    description: `Professional trader specializing in ${agent.specialization.join(', ')}`,
                    specialization: agent.specialization,
                    verified: true
                });
            }

            // Each agent lists intelligence in their specialty
            const intelligenceIds: string[] = [];

            intelligenceIds.push(await intelligenceManager.listIntelligence('trader1', {
                title: 'Weekly Market Outlook',
                description: 'Comprehensive weekly market analysis',
                category: 'market-analysis',
                price: 0.5
            }));

            intelligenceIds.push(await intelligenceManager.listIntelligence('trader2', {
                title: 'DeFi Yield Optimization',
                description: 'Advanced yield farming strategies',
                category: 'defi-strategy',
                price: 0.7
            }));

            intelligenceIds.push(await intelligenceManager.listIntelligence('trader3', {
                title: 'SOL Price Prediction Model',
                description: 'ML-based price prediction for SOL token',
                category: 'price-prediction',
                price: 0.3
            }));

            // Cross-trading: each agent buys from the others
            const tradingMatrix = [
                { buyer: 'trader1', purchases: [intelligenceIds[1], intelligenceIds[2]] },
                { buyer: 'trader2', purchases: [intelligenceIds[0], intelligenceIds[2]] },
                { buyer: 'trader3', purchases: [intelligenceIds[0], intelligenceIds[1]] }
            ];

            for (const trade of tradingMatrix) {
                for (const intelligenceId of trade.purchases) {
                    await transactionManager.purchaseIntelligence(trade.buyer, intelligenceId);
                }
            }

            // Verify transactions
            const allTransactions = transactionManager.getTransactions();
            expect(allTransactions.length).toBe(6); // 3 agents × 2 purchases each

            // Each agent should have made sales and purchases
            for (const agent of agents) {
                const agentData = agentManager.getAgent(agent.key)!;
                expect(agentData.total_sales).toBe(2); // Sold to 2 other agents
                expect(agentData.total_earnings).toBeGreaterThan(0);
            }

            // Verify market statistics
            expect(transactionManager.getTransactionCount()).toBe(6);
            expect(transactionManager.getTotalVolume()).toBe(3.0); // Sum of all transactions

            // Rate some intelligence
            await transactionManager.rateIntelligence('trader1', intelligenceIds[1], 5, 'Excellent DeFi strategy');
            await transactionManager.rateIntelligence('trader2', intelligenceIds[0], 4, 'Good market insights');
            await transactionManager.rateIntelligence('trader3', intelligenceIds[0], 4, 'Reliable analysis');

            // Check updated ratings and reputations
            const marketAnalysisIntel = intelligenceManager.getIntelligence(intelligenceIds[0])!;
            expect(marketAnalysisIntel.rating).toBe(4); // Average of 4 and 4

            const trader1 = agentManager.getAgent('trader1')!;
            expect(trader1.reputation_score).toBeGreaterThan(CONFIG.MARKETPLACE.INITIAL_REPUTATION);
        });

        it('should handle agent reputation progression over time', async () => {
            const sellerKey = 'reputation-seller';
            const buyerKeys = ['rep-buyer1', 'rep-buyer2', 'rep-buyer3', 'rep-buyer4', 'rep-buyer5'];

            // Register seller
            await agentManager.registerAgent(sellerKey, {
                name: 'Reputation Test Seller',
                description: 'Seller for reputation progression testing',
                specialization: ['market-analysis'],
                verified: false
            });

            // Register buyers
            for (const buyerKey of buyerKeys) {
                await agentManager.registerAgent(buyerKey, {
                    name: `Buyer ${buyerKey}`,
                    description: 'Test buyer',
                    specialization: ['trading'],
                    verified: false
                });
            }

            const intelligenceIds: string[] = [];
            const ratings = [5, 4, 5, 3, 5]; // Gradually build reputation

            // Create and sell multiple intelligence
            for (let i = 0; i < buyerKeys.length; i++) {
                const intelligenceId = await intelligenceManager.listIntelligence(sellerKey, {
                    title: `Market Analysis ${i + 1}`,
                    description: `Analysis number ${i + 1}`,
                    category: 'market-analysis',
                    price: 0.2
                });
                intelligenceIds.push(intelligenceId);

                await transactionManager.purchaseIntelligence(buyerKeys[i], intelligenceId);
                await transactionManager.rateIntelligence(buyerKeys[i], intelligenceId, ratings[i]);

                const seller = agentManager.getAgent(sellerKey)!;
                console.log(`After sale ${i + 1}: reputation = ${seller.reputation_score}`);

                // Reputation should increase with good ratings
                if (i > 0) {
                    const expectedAvgRating = ratings.slice(0, i + 1).reduce((a, b) => a + b) / (i + 1);
                    const expectedReputation = Math.round((expectedAvgRating / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);
                    expect(seller.reputation_score).toBe(expectedReputation);
                }
            }

            const finalSeller = agentManager.getAgent(sellerKey)!;
            expect(finalSeller.total_sales).toBe(5);
            expect(finalSeller.total_earnings).toBe(1.0); // 5 × 0.2

            // Calculate expected final reputation
            const avgRating = ratings.reduce((a, b) => a + b) / ratings.length; // 4.4
            const expectedFinalReputation = Math.round((avgRating / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);
            expect(finalSeller.reputation_score).toBe(expectedFinalReputation);
        });
    });

    describe('Search and Discovery Integration', () => {
        beforeEach(async () => {
            // Set up diverse marketplace with multiple agents and intelligence
            const agentProfiles = [
                {
                    key: 'expert1',
                    profile: { name: 'DeFi Expert', specialization: ['defi-strategy'], verified: true },
                    reputation: 900
                },
                {
                    key: 'expert2',
                    profile: { name: 'Market Analyst', specialization: ['market-analysis'], verified: true },
                    reputation: 750
                },
                {
                    key: 'expert3',
                    profile: { name: 'Risk Assessor', specialization: ['risk-assessment'], verified: false },
                    reputation: 600
                },
                {
                    key: 'newcomer1',
                    profile: { name: 'New Trader', specialization: ['price-prediction'], verified: false },
                    reputation: 200
                }
            ];

            for (const { key, profile, reputation } of agentProfiles) {
                await agentManager.registerAgent(key, profile);
                const agent = agentManager.getAgent(key)!;
                agent.reputation_score = reputation; // Manually set for testing
            }

            // Create diverse intelligence offerings
            const intelligenceData = [
                { seller: 'expert1', title: 'Advanced DeFi Strategy', category: 'defi-strategy', price: 1.5 },
                { seller: 'expert1', title: 'Yield Farming Guide', category: 'defi-strategy', price: 0.8 },
                { seller: 'expert2', title: 'Q4 Market Outlook', category: 'market-analysis', price: 1.2 },
                { seller: 'expert2', title: 'Sector Rotation Analysis', category: 'market-analysis', price: 0.6 },
                { seller: 'expert3', title: 'Portfolio Risk Assessment', category: 'risk-assessment', price: 0.4 },
                { seller: 'newcomer1', title: 'Basic Price Prediction', category: 'price-prediction', price: 0.2 }
            ];

            for (const intel of intelligenceData) {
                await intelligenceManager.listIntelligence(intel.seller, {
                    title: intel.title,
                    description: `Professional ${intel.category} by ${intel.seller}`,
                    category: intel.category as any,
                    price: intel.price
                });
            }
        });

        it('should provide comprehensive search and filtering capabilities', () => {
            // Test 1: Basic search without filters
            const allIntelligence = intelligenceManager.searchIntelligence();
            expect(allIntelligence.length).toBe(6);

            // Test 2: Filter by category
            const defiIntelligence = intelligenceManager.searchIntelligence({ category: 'defi-strategy' });
            expect(defiIntelligence.length).toBe(2);
            defiIntelligence.forEach(intel => {
                expect(intel.category).toBe('defi-strategy');
            });

            // Test 3: Filter by price range
            const affordableIntelligence = intelligenceManager.searchIntelligence({ maxPrice: 0.5 });
            expect(affordableIntelligence.length).toBe(2); // 0.4 and 0.2 price items

            // Test 4: Filter by minimum quality
            const highQualityIntelligence = intelligenceManager.searchIntelligence({ minQuality: 70 });
            expect(highQualityIntelligence.length).toBeGreaterThan(0);
            highQualityIntelligence.forEach(intel => {
                expect(intel.quality_score).toBeGreaterThanOrEqual(70);
            });

            // Test 5: Filter by seller
            const expert1Intelligence = intelligenceManager.searchIntelligence({ seller: 'expert1' });
            expect(expert1Intelligence.length).toBe(2);
            expert1Intelligence.forEach(intel => {
                expect(intel.seller).toBe('expert1');
            });

            // Test 6: Combined filters
            const premiumDefi = intelligenceManager.searchIntelligence({
                category: 'defi-strategy',
                minQuality: 80,
                seller: 'expert1'
            });
            expect(premiumDefi.length).toBeGreaterThan(0);
            premiumDefi.forEach(intel => {
                expect(intel.category).toBe('defi-strategy');
                expect(intel.seller).toBe('expert1');
                expect(intel.quality_score).toBeGreaterThanOrEqual(80);
            });
        });

        it('should rank and sort search results appropriately', () => {
            const searchResults = intelligenceManager.searchIntelligence();

            // Results should be sorted by quality and recency
            // Higher quality and newer content should appear first
            expect(searchResults.length).toBe(6);

            for (let i = 1; i < searchResults.length; i++) {
                const current = searchResults[i - 1];
                const next = searchResults[i];

                // Calculate the scoring logic used in the search
                const currentScore = current.quality_score * 0.7 + (Date.now() - current.created_at) / 86400000 * 0.3;
                const nextScore = next.quality_score * 0.7 + (Date.now() - next.created_at) / 86400000 * 0.3;

                expect(currentScore).toBeGreaterThanOrEqual(nextScore);
            }
        });

        it('should provide accurate agent rankings', () => {
            const topAgents = agentManager.getTopAgents(10);

            expect(topAgents.length).toBe(4);
            expect(topAgents[0].reputation_score).toBe(900); // expert1
            expect(topAgents[1].reputation_score).toBe(750); // expert2
            expect(topAgents[2].reputation_score).toBe(600); // expert3
            expect(topAgents[3].reputation_score).toBe(200); // newcomer1

            // Test limited results
            const top2Agents = agentManager.getTopAgents(2);
            expect(top2Agents.length).toBe(2);
            expect(top2Agents[0].reputation_score).toBe(900);
            expect(top2Agents[1].reputation_score).toBe(750);
        });

        it('should integrate category analytics', () => {
            const categoryCounts = intelligenceManager.getCategoryCounts();

            expect(categoryCounts['defi-strategy']).toBe(2);
            expect(categoryCounts['market-analysis']).toBe(2);
            expect(categoryCounts['risk-assessment']).toBe(1);
            expect(categoryCounts['price-prediction']).toBe(1);
            expect(categoryCounts['trend-analysis']).toBeUndefined();
        });
    });

    describe('Market Statistics and Analytics', () => {
        it('should provide comprehensive market statistics', async () => {
            // Set up marketplace with transactions
            const sellers = ['stats-seller1', 'stats-seller2'];
            const buyers = ['stats-buyer1', 'stats-buyer2', 'stats-buyer3'];

            // Register agents
            for (const seller of sellers) {
                await agentManager.registerAgent(seller, {
                    name: `Stats Seller ${seller}`,
                    description: 'Seller for stats testing',
                    specialization: ['market-analysis', 'defi-strategy'],
                    verified: true
                });
            }

            for (const buyer of buyers) {
                await agentManager.registerAgent(buyer, {
                    name: `Stats Buyer ${buyer}`,
                    description: 'Buyer for stats testing',
                    specialization: ['trading'],
                    verified: false
                });
            }

            // Create intelligence and make purchases
            const transactions = [
                { seller: 'stats-seller1', buyer: 'stats-buyer1', category: 'market-analysis', price: 0.5 },
                { seller: 'stats-seller1', buyer: 'stats-buyer2', category: 'defi-strategy', price: 0.8 },
                { seller: 'stats-seller2', buyer: 'stats-buyer1', category: 'market-analysis', price: 0.3 },
                { seller: 'stats-seller2', buyer: 'stats-buyer3', category: 'defi-strategy', price: 1.2 }
            ];

            for (const tx of transactions) {
                const intelligenceId = await intelligenceManager.listIntelligence(tx.seller, {
                    title: `${tx.category} Intelligence`,
                    description: 'Intelligence for stats testing',
                    category: tx.category as any,
                    price: tx.price
                });

                await transactionManager.purchaseIntelligence(tx.buyer, intelligenceId);
            }

            // Verify transaction statistics
            expect(transactionManager.getTransactionCount()).toBe(4);
            expect(transactionManager.getTotalVolume()).toBe(2.8); // 0.5 + 0.8 + 0.3 + 1.2
            expect(transactionManager.getAveragePrice()).toBe(0.7); // 2.8 / 4

            // Verify agent statistics
            const seller1 = agentManager.getAgent('stats-seller1')!;
            expect(seller1.total_sales).toBe(2);
            expect(seller1.total_earnings).toBe(1.3); // 0.5 + 0.8

            const seller2 = agentManager.getAgent('stats-seller2')!;
            expect(seller2.total_sales).toBe(2);
            expect(seller2.total_earnings).toBe(1.5); // 0.3 + 1.2

            // Verify intelligence statistics
            expect(intelligenceManager.getIntelligenceCount()).toBe(4);

            const categoryCounts = intelligenceManager.getCategoryCounts();
            expect(categoryCounts['market-analysis']).toBe(2);
            expect(categoryCounts['defi-strategy']).toBe(2);
        });

        it('should maintain consistency across all statistics', async () => {
            // Create a complex scenario with multiple transactions and ratings
            const agents = ['consistency-seller', 'consistency-buyer1', 'consistency-buyer2'];

            for (const agent of agents) {
                await agentManager.registerAgent(agent, {
                    name: `Consistency Agent ${agent}`,
                    description: 'Agent for consistency testing',
                    specialization: ['market-analysis'],
                    verified: false
                });
            }

            const intelligenceIds: string[] = [];

            // Create multiple intelligence
            for (let i = 0; i < 3; i++) {
                const id = await intelligenceManager.listIntelligence('consistency-seller', {
                    title: `Consistency Intelligence ${i + 1}`,
                    description: 'Intelligence for consistency testing',
                    category: 'market-analysis',
                    price: 0.5
                });
                intelligenceIds.push(id);
            }

            // Make purchases and ratings
            for (const intelligenceId of intelligenceIds) {
                // Buyer 1 purchases all
                await transactionManager.purchaseIntelligence('consistency-buyer1', intelligenceId);
                await transactionManager.rateIntelligence('consistency-buyer1', intelligenceId, 4);

                // Buyer 2 purchases all
                await transactionManager.purchaseIntelligence('consistency-buyer2', intelligenceId);
                await transactionManager.rateIntelligence('consistency-buyer2', intelligenceId, 5);
            }

            // Verify consistency across all systems
            const seller = agentManager.getAgent('consistency-seller')!;
            expect(seller.total_sales).toBe(6); // 3 intelligence × 2 buyers

            const totalEarnings = seller.total_earnings;
            expect(totalEarnings).toBe(3.0); // 6 × 0.5

            // Transaction manager should have all transactions
            const transactions = transactionManager.getTransactions();
            expect(transactions.length).toBe(6);
            expect(transactionManager.getTotalVolume()).toBe(3.0);

            // All intelligence should have updated ratings
            for (const intelligenceId of intelligenceIds) {
                const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
                expect(intelligence.sales_count).toBe(2);
                expect(intelligence.rating).toBe(4.5); // Average of 4 and 5
            }

            // Seller reputation should be updated based on all ratings
            const expectedAvgRating = 4.5; // All intelligence rated 4.5
            const expectedReputation = Math.round((expectedAvgRating / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);
            expect(seller.reputation_score).toBe(expectedReputation);
        });
    });

    describe('Error Handling and Edge Cases in Integration', () => {
        it('should handle cascading failures gracefully', async () => {
            // Register agents
            const sellerKey = 'failure-seller';
            const buyerKey = 'failure-buyer';

            await agentManager.registerAgent(sellerKey, {
                name: 'Failure Test Seller',
                description: 'Seller for failure testing',
                specialization: ['market-analysis'],
                verified: false
            });

            await agentManager.registerAgent(buyerKey, {
                name: 'Failure Test Buyer',
                description: 'Buyer for failure testing',
                specialization: ['trading'],
                verified: false
            });

            // Try to purchase non-existent intelligence
            await expect(async () => {
                await transactionManager.purchaseIntelligence(buyerKey, 'non-existent-intelligence');
            }).toThrow('Intelligence not found');

            // Try to rate without purchase
            await expect(async () => {
                await transactionManager.rateIntelligence(buyerKey, 'some-intelligence', 5);
            }).toThrow('Transaction not found or already rated');

            // Verify that failed operations don't affect system state
            expect(transactionManager.getTransactionCount()).toBe(0);
            expect(agentManager.getAgent(sellerKey)!.total_sales).toBe(0);
            expect(intelligenceManager.getIntelligenceCount()).toBe(0);
        });

        it('should maintain data integrity during partial failures', async () => {
            const sellerKey = 'integrity-seller';
            const buyerKey = 'integrity-buyer';

            await agentManager.registerAgent(sellerKey, {
                name: 'Integrity Seller',
                description: 'Seller for integrity testing',
                specialization: ['market-analysis'],
                verified: false
            });

            await agentManager.registerAgent(buyerKey, {
                name: 'Integrity Buyer',
                description: 'Buyer for integrity testing',
                specialization: ['trading'],
                verified: false
            });

            // Create intelligence
            const intelligenceId = await intelligenceManager.listIntelligence(sellerKey, {
                title: 'Integrity Test Intelligence',
                description: 'Intelligence for integrity testing',
                category: 'market-analysis',
                price: 0.5
            });

            // Successful purchase
            const purchaseResult = await transactionManager.purchaseIntelligence(buyerKey, intelligenceId);
            expect(purchaseResult.success).toBe(true);

            // Verify state is consistent
            expect(transactionManager.getTransactionCount()).toBe(1);
            expect(agentManager.getAgent(sellerKey)!.total_sales).toBe(1);
            expect(intelligenceManager.getIntelligence(intelligenceId)!.sales_count).toBe(1);

            // Successful rating
            await transactionManager.rateIntelligence(buyerKey, intelligenceId, 4, 'Good work');

            // Try to rate again (should fail)
            await expect(async () => {
                await transactionManager.rateIntelligence(buyerKey, intelligenceId, 5);
            }).toThrow('Transaction not found or already rated');

            // Verify that the failed rating attempt didn't corrupt data
            const transaction = transactionManager.getTransactions()[0];
            expect(transaction.rating).toBe(4);
            expect(transaction.review).toBe('Good work');

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.rating).toBe(4);

            const seller = agentManager.getAgent(sellerKey)!;
            const expectedReputation = Math.round((4 / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);
            expect(seller.reputation_score).toBe(expectedReputation);
        });
    });

    describe('Performance and Scalability Integration', () => {
        it('should handle high-volume marketplace activity efficiently', async () => {
            const startTime = Date.now();

            // Create 20 agents (10 sellers, 10 buyers)
            const sellers: string[] = [];
            const buyers: string[] = [];

            for (let i = 0; i < 10; i++) {
                const sellerId = `perf-seller-${i}`;
                const buyerId = `perf-buyer-${i}`;

                sellers.push(sellerId);
                buyers.push(buyerId);

                await agentManager.registerAgent(sellerId, {
                    name: `Performance Seller ${i}`,
                    description: `High-volume seller ${i}`,
                    specialization: ['market-analysis'],
                    verified: i % 2 === 0
                });

                await agentManager.registerAgent(buyerId, {
                    name: `Performance Buyer ${i}`,
                    description: `High-volume buyer ${i}`,
                    specialization: ['trading'],
                    verified: false
                });
            }

            // Each seller creates 5 intelligence offerings
            const intelligenceIds: string[] = [];
            for (const seller of sellers) {
                for (let j = 0; j < 5; j++) {
                    const id = await intelligenceManager.listIntelligence(seller, {
                        title: `Performance Intelligence ${seller}-${j}`,
                        description: `High-volume intelligence ${j}`,
                        category: 'market-analysis',
                        price: 0.1 + (j * 0.1)
                    });
                    intelligenceIds.push(id);
                }
            }

            // Each buyer purchases from multiple sellers
            let transactionCount = 0;
            for (const buyer of buyers) {
                // Each buyer purchases 20 random intelligence (with replacement possible)
                for (let k = 0; k < 20; k++) {
                    const randomIntelligenceId = intelligenceIds[Math.floor(Math.random() * intelligenceIds.length)];
                    await transactionManager.purchaseIntelligence(buyer, randomIntelligenceId);
                    transactionCount++;
                }
            }

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Performance assertions
            expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
            expect(agentManager.getAgentCount()).toBe(20);
            expect(intelligenceManager.getIntelligenceCount()).toBe(50);
            expect(transactionManager.getTransactionCount()).toBe(transactionCount);

            // Test search performance
            const searchStart = Date.now();
            const searchResults = intelligenceManager.searchIntelligence();
            const searchEnd = Date.now();

            expect(searchResults.length).toBe(50);
            expect(searchEnd - searchStart).toBeLessThan(100); // Search should be under 100ms

            // Test analytics performance
            const analyticsStart = Date.now();
            const topAgents = agentManager.getTopAgents(10);
            const categoryCounts = intelligenceManager.getCategoryCounts();
            const totalVolume = transactionManager.getTotalVolume();
            const analyticsEnd = Date.now();

            expect(analyticsEnd - analyticsStart).toBeLessThan(50); // Analytics should be under 50ms
            expect(topAgents.length).toBe(10);
            expect(categoryCounts['market-analysis']).toBe(50);
            expect(totalVolume).toBeGreaterThan(0);
        });

        it('should maintain consistency under concurrent operations', async () => {
            // Set up agents
            const concurrentSeller = 'concurrent-seller';
            const concurrentBuyers = ['conc-buyer1', 'conc-buyer2', 'conc-buyer3'];

            await agentManager.registerAgent(concurrentSeller, {
                name: 'Concurrent Seller',
                description: 'Seller for concurrency testing',
                specialization: ['market-analysis'],
                verified: true
            });

            for (const buyer of concurrentBuyers) {
                await agentManager.registerAgent(buyer, {
                    name: `Concurrent Buyer ${buyer}`,
                    description: 'Buyer for concurrency testing',
                    specialization: ['trading'],
                    verified: false
                });
            }

            // Create intelligence
            const intelligenceId = await intelligenceManager.listIntelligence(concurrentSeller, {
                title: 'Concurrent Test Intelligence',
                description: 'Intelligence for concurrency testing',
                category: 'market-analysis',
                price: 0.5
            });

            // Execute concurrent purchases
            const purchasePromises = concurrentBuyers.map(buyer =>
                transactionManager.purchaseIntelligence(buyer, intelligenceId)
            );

            const results = await Promise.all(purchasePromises);

            // All purchases should succeed
            results.forEach(result => {
                expect(result.success).toBe(true);
            });

            // Verify final state consistency
            expect(transactionManager.getTransactionCount()).toBe(3);
            expect(intelligenceManager.getIntelligence(intelligenceId)!.sales_count).toBe(3);
            expect(agentManager.getAgent(concurrentSeller)!.total_sales).toBe(3);
            expect(agentManager.getAgent(concurrentSeller)!.total_earnings).toBe(1.5);

            // Execute concurrent ratings
            const ratingPromises = concurrentBuyers.map((buyer, index) =>
                transactionManager.rateIntelligence(buyer, intelligenceId, 3 + index) // 3, 4, 5
            );

            await Promise.all(ratingPromises);

            // Verify rating consistency
            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.rating).toBe(4); // Average of 3, 4, 5

            const seller = agentManager.getAgent(concurrentSeller)!;
            const expectedReputation = Math.round((4 / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);
            expect(seller.reputation_score).toBe(expectedReputation);
        });
    });
});