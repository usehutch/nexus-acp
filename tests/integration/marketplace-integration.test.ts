import { Connection, clusterApiUrl } from '@solana/web3.js';
import { AgentMarketplace } from '../../src/marketplace.ts';
import type { AgentIntelligence, AgentProfile, IntelligenceTransaction } from '../../src/types/index.ts';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('AgentMarketplace Integration', () => {
    let marketplace: AgentMarketplace;
    let connection: Connection;

    beforeEach(() => {
        connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        marketplace = new AgentMarketplace(connection);
    });

    describe('End-to-End Agent Registration and Intelligence Listing', () => {
        it('should complete full marketplace workflow', async () => {
            const sellerKey = 'integration-seller-123';
            const buyerKey = 'integration-buyer-456';

            // Step 1: Register seller agent
            const sellerRegistered = await marketplace.registerAgent(sellerKey, {
                name: 'Integration Test Seller',
                description: 'Seller agent for integration testing',
                specialization: ['market-analysis', 'defi-strategy'],
                verified: true
            });
            expect(sellerRegistered).toBe(true);

            // Step 2: Register buyer agent
            const buyerRegistered = await marketplace.registerAgent(buyerKey, {
                name: 'Integration Test Buyer',
                description: 'Buyer agent for integration testing',
                specialization: ['intelligence-consumption'],
                verified: false
            });
            expect(buyerRegistered).toBe(true);

            // Step 3: List intelligence
            const intelligenceId = await marketplace.listIntelligence(sellerKey, {
                title: 'Integration Test Analysis',
                description: 'Complete market analysis for integration testing',
                category: 'market-analysis',
                price: 0.5
            });
            expect(typeof intelligenceId).toBe('string');
            expect(intelligenceId.startsWith('intel_')).toBe(true);

            // Step 4: Search and verify intelligence appears
            const searchResults = marketplace.searchIntelligence({
                category: 'market-analysis',
                seller: sellerKey
            });
            expect(searchResults.length).toBeGreaterThan(0);
            const listedIntel = searchResults.find(intel => intel.id === intelligenceId);
            expect(listedIntel).toBeDefined();

            // Step 5: Purchase intelligence
            const purchase = await marketplace.purchaseIntelligence(buyerKey, intelligenceId);
            expect(purchase.success).toBe(true);
            expect(purchase.data).toBeDefined();

            // Step 6: Rate the intelligence
            await marketplace.rateIntelligence(buyerKey, intelligenceId, 5, 'Excellent analysis!');

            // Step 7: Verify all statistics are updated correctly
            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBe(2);
            expect(stats.totalIntelligence).toBeGreaterThan(0);
            expect(stats.totalTransactions).toBeGreaterThan(0);
            expect(stats.totalVolume).toBeGreaterThan(0);

            // Step 8: Verify agent reputation is updated
            const topAgents = marketplace.getTopAgents(5);
            const seller = topAgents.find(agent => agent.public_key === sellerKey);
            expect(seller).toBeDefined();
            expect(seller!.reputation_score).toBe(1000); // Perfect rating
            expect(seller!.total_sales).toBe(1);
            expect(seller!.total_earnings).toBe(0.5);
        });

        it('should handle multiple agents and cross-selling', async () => {
            const agents = [
                { key: 'multi-seller-1', name: 'Multi Seller 1', spec: ['defi-strategy'] },
                { key: 'multi-seller-2', name: 'Multi Seller 2', spec: ['price-prediction'] },
                { key: 'multi-buyer-1', name: 'Multi Buyer 1', spec: ['analysis'] },
                { key: 'multi-buyer-2', name: 'Multi Buyer 2', spec: ['trading'] }
            ];

            // Register all agents
            for (const agent of agents) {
                await marketplace.registerAgent(agent.key, {
                    name: agent.name,
                    description: `Test agent ${agent.name}`,
                    specialization: agent.spec,
                    verified: true
                });
            }

            // Each seller creates multiple intelligence listings
            const intelligenceIds: string[] = [];
            const sellers = agents.filter(a => a.key.includes('seller'));
            const buyers = agents.filter(a => a.key.includes('buyer'));

            for (const seller of sellers) {
                for (let i = 0; i < 3; i++) {
                    const intelId = await marketplace.listIntelligence(seller.key, {
                        title: `${seller.name} Intelligence ${i + 1}`,
                        description: `Test intelligence from ${seller.name}`,
                        category: seller.spec[0] as any,
                        price: 0.1 * (i + 1)
                    });
                    intelligenceIds.push(intelId);
                }
            }

            // Each buyer purchases from different sellers
            for (const buyer of buyers) {
                for (let i = 0; i < intelligenceIds.length; i += 2) { // Buy every other intelligence
                    const intelId = intelligenceIds[i];
                    await marketplace.purchaseIntelligence(buyer.key, intelId);
                    await marketplace.rateIntelligence(buyer.key, intelId, (i % 5) + 1); // Variable ratings
                }
            }

            // Verify market statistics
            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBe(4);
            expect(stats.totalIntelligence).toBe(6); // 2 sellers * 3 intelligence each
            expect(stats.totalTransactions).toBe(6); // 2 buyers * 3 purchases each

            // Verify top agents ranking
            const topAgents = marketplace.getTopAgents(4);
            expect(topAgents.length).toBe(4);

            // Sellers should have earnings
            const topSellers = topAgents.filter(agent =>
                sellers.some(seller => seller.key === agent.public_key)
            );
            topSellers.forEach(seller => {
                expect(seller.total_earnings).toBeGreaterThan(0);
                expect(seller.total_sales).toBeGreaterThan(0);
            });
        });
    });

    describe('Advanced Search and Filtering Integration', () => {
        beforeEach(async () => {
            // Setup diverse marketplace for testing
            const testData = [
                {
                    seller: 'search-seller-1',
                    intelligence: [
                        { title: 'DeFi Yield Strategies', category: 'defi-strategy', price: 0.8 },
                        { title: 'Market Trends Q4', category: 'market-analysis', price: 0.3 }
                    ]
                },
                {
                    seller: 'search-seller-2',
                    intelligence: [
                        { title: 'SOL Price Prediction', category: 'price-prediction', price: 1.2 },
                        { title: 'Risk Assessment Tools', category: 'risk-assessment', price: 0.5 }
                    ]
                }
            ];

            for (const { seller, intelligence } of testData) {
                await marketplace.registerAgent(seller, {
                    name: `Search Test Seller ${seller}`,
                    description: `Seller for search testing`,
                    specialization: ['multiple'],
                    verified: true
                });

                for (const intel of intelligence) {
                    await marketplace.listIntelligence(seller, {
                        title: intel.title,
                        description: `Description for ${intel.title}`,
                        category: intel.category as any,
                        price: intel.price
                    });
                }
            }
        });

        it('should filter intelligence by multiple criteria', () => {
            // Test category filtering
            const defiResults = marketplace.searchIntelligence({ category: 'defi-strategy' });
            expect(defiResults.length).toBe(1);
            expect(defiResults[0].title).toBe('DeFi Yield Strategies');

            // Test price filtering
            const affordableResults = marketplace.searchIntelligence({ maxPrice: 0.5 });
            expect(affordableResults.length).toBe(2); // 0.3 and 0.5 price items

            // Test seller filtering
            const seller1Results = marketplace.searchIntelligence({ seller: 'search-seller-1' });
            expect(seller1Results.length).toBe(2);

            // Test combined filtering
            const combinedResults = marketplace.searchIntelligence({
                category: 'market-analysis',
                maxPrice: 0.5,
                seller: 'search-seller-1'
            });
            expect(combinedResults.length).toBe(1);
            expect(combinedResults[0].title).toBe('Market Trends Q4');
        });

        it('should maintain search result quality', () => {
            const allResults = marketplace.searchIntelligence();

            // Results should be sorted by quality and recency
            for (let i = 1; i < allResults.length; i++) {
                const current = allResults[i-1];
                const next = allResults[i];

                // Quality score should generally decrease or be similar
                expect(current.quality_score).toBeGreaterThanOrEqual(next.quality_score - 10); // Allow small variance
            }
        });
    });

    describe('Rating and Reputation System Integration', () => {
        let sellerId: string;
        let buyerIds: string[];
        let intelligenceIds: string[];

        beforeEach(async () => {
            sellerId = 'reputation-seller';
            buyerIds = ['rep-buyer-1', 'rep-buyer-2', 'rep-buyer-3'];

            // Register seller
            await marketplace.registerAgent(sellerId, {
                name: 'Reputation Test Seller',
                description: 'Seller for reputation testing',
                specialization: ['market-analysis'],
                verified: true
            });

            // Register buyers
            for (const buyerId of buyerIds) {
                await marketplace.registerAgent(buyerId, {
                    name: `Buyer ${buyerId}`,
                    description: 'Test buyer for reputation',
                    specialization: ['buying'],
                    verified: false
                });
            }

            // Create multiple intelligence listings
            intelligenceIds = [];
            for (let i = 0; i < 3; i++) {
                const intelId = await marketplace.listIntelligence(sellerId, {
                    title: `Reputation Test Intelligence ${i + 1}`,
                    description: `Test intelligence ${i + 1} for reputation`,
                    category: 'market-analysis',
                    price: 0.1 * (i + 1)
                });
                intelligenceIds.push(intelId);
            }
        });

        it('should accurately calculate and update reputation', async () => {
            const ratings = [5, 4, 3, 5, 4]; // Mix of ratings
            let ratingIndex = 0;

            // Multiple buyers rate multiple intelligence pieces
            for (const buyerId of buyerIds) {
                for (const intelId of intelligenceIds) {
                    await marketplace.purchaseIntelligence(buyerId, intelId);
                    await marketplace.rateIntelligence(buyerId, intelId, ratings[ratingIndex % ratings.length] as any);
                    ratingIndex++;
                }
            }

            // Check seller reputation
            const seller = marketplace.getTopAgents(1)[0];
            expect(seller.public_key).toBe(sellerId);

            // Calculate expected reputation
            const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            const expectedReputation = Math.round((avgRating / 5) * 1000);
            expect(seller.reputation_score).toBeCloseTo(expectedReputation, 0);

            // Check individual intelligence ratings
            for (const intelId of intelligenceIds) {
                const allResults = marketplace.searchIntelligence();
                const intel = allResults.find(i => i.id === intelId)!;
                expect(intel.rating).toBeGreaterThan(0);
                expect(intel.sales_count).toBe(buyerIds.length);
            }
        });

        it('should affect future intelligence quality scores', async () => {
            // Rate all existing intelligence highly
            for (const buyerId of buyerIds) {
                for (const intelId of intelligenceIds) {
                    await marketplace.purchaseIntelligence(buyerId, intelId);
                    await marketplace.rateIntelligence(buyerId, intelId, 5);
                }
            }

            // Create new intelligence after reputation boost
            const newIntelId = await marketplace.listIntelligence(sellerId, {
                title: 'High Reputation Intelligence',
                description: 'Intelligence created after reputation boost',
                category: 'market-analysis',
                price: 0.2
            });

            const allIntelligence = marketplace.searchIntelligence();
            const newIntel = allIntelligence.find(i => i.id === newIntelId)!;

            // Quality score should be high due to high reputation
            expect(newIntel.quality_score).toBeGreaterThan(90);
        });
    });

    describe('Market Statistics Integration', () => {
        it('should maintain accurate statistics across operations', async () => {
            const initialStats = marketplace.getMarketStats();

            // Register multiple agents
            const agentCount = 5;
            for (let i = 0; i < agentCount; i++) {
                await marketplace.registerAgent(`stats-agent-${i}`, {
                    name: `Stats Agent ${i}`,
                    description: `Agent ${i} for statistics testing`,
                    specialization: ['testing'],
                    verified: i % 2 === 0
                });
            }

            // List intelligence from some agents
            const intelligenceCount = 8;
            const intelligenceIds: string[] = [];
            for (let i = 0; i < intelligenceCount; i++) {
                const sellerId = `stats-agent-${i % 3}`; // Use first 3 agents as sellers
                const intelId = await marketplace.listIntelligence(sellerId, {
                    title: `Stats Intelligence ${i}`,
                    description: `Intelligence ${i} for statistics`,
                    category: ['market-analysis', 'defi-strategy', 'price-prediction'][i % 3] as any,
                    price: 0.1 + (i * 0.1)
                });
                intelligenceIds.push(intelId);
            }

            // Perform transactions
            const transactionCount = 12;
            const buyers = [`stats-agent-3`, `stats-agent-4`]; // Use last 2 agents as buyers
            for (let i = 0; i < transactionCount; i++) {
                const buyerId = buyers[i % 2];
                const intelId = intelligenceIds[i % intelligenceCount];
                await marketplace.purchaseIntelligence(buyerId, intelId);

                if (i % 3 === 0) { // Rate some transactions
                    await marketplace.rateIntelligence(buyerId, intelId, ((i % 5) + 1) as any);
                }
            }

            // Check final statistics
            const finalStats = marketplace.getMarketStats();

            expect(finalStats.totalAgents).toBe(initialStats.totalAgents + agentCount);
            expect(finalStats.totalIntelligence).toBe(initialStats.totalIntelligence + intelligenceCount);
            expect(finalStats.totalTransactions).toBe(initialStats.totalTransactions + transactionCount);
            expect(finalStats.totalVolume).toBeGreaterThan(initialStats.totalVolume);
            expect(finalStats.avgPrice).toBeGreaterThan(0);

            // Check category breakdown
            expect(typeof finalStats.categories).toBe('object');
            expect(finalStats.categories['market-analysis']).toBeGreaterThan(0);
            expect(finalStats.categories['defi-strategy']).toBeGreaterThan(0);
            expect(finalStats.categories['price-prediction']).toBeGreaterThan(0);
        });

        it('should handle edge cases in statistics calculation', async () => {
            // Test with zero transactions
            const emptyMarketplace = new AgentMarketplace(connection);
            const emptyStats = emptyMarketplace.getMarketStats();

            expect(emptyStats.totalAgents).toBe(0);
            expect(emptyStats.totalIntelligence).toBe(0);
            expect(emptyStats.totalTransactions).toBe(0);
            expect(emptyStats.totalVolume).toBe(0);
            expect(emptyStats.avgPrice).toBe(0);
            expect(Object.keys(emptyStats.categories).length).toBe(0);
        });
    });

    describe('Error Handling and Recovery Integration', () => {
        it('should handle agent registration conflicts gracefully', async () => {
            const agentKey = 'conflict-agent-123';

            // Register agent first time
            const firstRegistration = await marketplace.registerAgent(agentKey, {
                name: 'Original Agent',
                description: 'First registration',
                specialization: ['original'],
                verified: false
            });
            expect(firstRegistration).toBe(true);

            // Register same agent again - should succeed (override)
            const secondRegistration = await marketplace.registerAgent(agentKey, {
                name: 'Updated Agent',
                description: 'Second registration',
                specialization: ['updated'],
                verified: true
            });
            expect(secondRegistration).toBe(true);

            // Verify the agent was updated
            const topAgents = marketplace.getTopAgents(10);
            const agent = topAgents.find(a => a.public_key === agentKey);
            expect(agent).toBeDefined();
            expect(agent!.name).toBe('Updated Agent');
            expect(agent!.verified).toBe(true);
        });

        it('should maintain data consistency during error conditions', async () => {
            const sellerId = 'consistency-seller';
            const buyerId = 'consistency-buyer';

            // Register agents
            await marketplace.registerAgent(sellerId, {
                name: 'Consistency Seller',
                description: 'Seller for consistency testing',
                specialization: ['testing'],
                verified: true
            });

            await marketplace.registerAgent(buyerId, {
                name: 'Consistency Buyer',
                description: 'Buyer for consistency testing',
                specialization: ['testing'],
                verified: false
            });

            // List intelligence
            const intelId = await marketplace.listIntelligence(sellerId, {
                title: 'Consistency Test Intelligence',
                description: 'Intelligence for consistency testing',
                category: 'market-analysis',
                price: 0.3
            });

            // Purchase intelligence
            await marketplace.purchaseIntelligence(buyerId, intelId);

            // Try invalid operations
            await expect(async () => {
                await marketplace.rateIntelligence(buyerId, intelId, 6 as any); // Invalid rating
            }).toThrow();

            await expect(async () => {
                await marketplace.rateIntelligence('non-existent-buyer', intelId, 5);
            }).toThrow();

            // Verify marketplace state is still consistent
            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBe(2);
            expect(stats.totalIntelligence).toBe(1);
            expect(stats.totalTransactions).toBe(1);

            // Successful rating should still work
            await expect(async () => {
                await marketplace.rateIntelligence(buyerId, intelId, 5);
            }).not.toThrow();
        });
    });
});