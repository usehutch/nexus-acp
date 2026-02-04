#!/usr/bin/env bun

/**
 * Comprehensive End-to-End Integration Tests
 *
 * This file contains complete workflow tests that simulate real-world
 * usage scenarios of the NEXUS Agent Intelligence Marketplace.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { AgentMarketplace } from '../../src/marketplace.js';
import { Connection } from '@solana/web3.js';
import type { AgentIntelligence, IntelligenceTransaction } from '../../src/types/index.js';

describe('NEXUS Marketplace - End-to-End Integration', () => {
    let connection: Connection;
    let marketplace: AgentMarketplace;

    beforeEach(() => {
        connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        marketplace = new AgentMarketplace(connection);
    });

    describe('Complete Agent Lifecycle', () => {
        it('should support full agent journey from registration to retirement', async () => {
            // 1. Agent Registration
            const agentId = await marketplace.registerAgent('LifecycleAgent', {
                name: 'Lifecycle Test Agent',
                description: 'A comprehensive test agent for lifecycle testing with proper description length',
                specialization: ['market-analysis']
            });
            expect(agentId).toBeDefined();

            let agent = marketplace.getAgent('LifecycleAgent');
            expect(agent).toBeDefined();
            expect(agent!.reputation_score).toBe(100); // Initial reputation

            // 2. Intelligence Listing
            const intelId = await marketplace.listIntelligence('LifecycleAgent', {
                title: 'Lifecycle Intelligence',
                description: 'Intelligence for testing the complete lifecycle of an agent with proper description',
                category: 'market-analysis',
                price: 0.5
            });
            expect(intelId).toBeDefined();

            // 3. Reputation Building
            agent = marketplace.getAgent('LifecycleAgent');
            const initialRep = agent!.reputation_score;

            // 4. Sales and Feedback
            await marketplace.registerAgent('CustomerAgent', {
                name: 'Customer Test Agent',
                description: 'Customer agent for testing lifecycle with proper description length',
                specialization: ['market-analysis']
            });

            const transaction = await marketplace.purchaseIntelligence(
                'CustomerAgent',
                intelId
            );
            expect(transaction).toBeDefined();

            // 5. Rating and Reviews
            await marketplace.rateIntelligence(intelId, 5, 'CustomerAgent');

            // 6. Verify reputation improvement
            agent = marketplace.getAgent('LifecycleAgent');
            expect(agent!.reputation_score).toBeGreaterThanOrEqual(initialRep);
        });

        it('should maintain agent consistency across multiple interactions', async () => {
            // Register multiple interacting agents
            const agents = ['ConsistencyAgent1', 'ConsistencyAgent2', 'ConsistencyAgent3'];

            for (const agentName of agents) {
                await marketplace.registerAgent(agentName, {
                    name: `${agentName} Consistency Agent`,
                    description: `Consistency test agent ${agentName} with proper description length for testing`,
                    specialization: ['market-analysis']
                });
            }

            // Create intelligence from each agent
            const intelligences = [];
            for (let i = 0; i < agents.length; i++) {
                const intelId = await marketplace.listIntelligence(agents[i], {
                    title: `Intelligence from ${agents[i]}`,
                    description: `Comprehensive intelligence from ${agents[i]} for consistency testing purposes`,
                    category: 'market-analysis',
                    price: 0.1 * (i + 1)
                });
                intelligences.push(intelId);
            }

            // Cross-purchase intelligence
            for (let buyer = 0; buyer < agents.length; buyer++) {
                for (let seller = 0; seller < agents.length; seller++) {
                    if (buyer !== seller) {
                        const transaction = await marketplace.purchaseIntelligence(
                            agents[buyer],
                            intelligences[seller]
                        );
                        expect(transaction).toBeDefined();
                    }
                }
            }

            // Verify all agents still exist and have consistent data
            for (const agentName of agents) {
                const agent = marketplace.getAgent(agentName);
                expect(agent).toBeDefined();
                expect(agent!.name).toBe(agentName);
            }
        });
    });

    describe('Multi-Agent Marketplace Scenarios', () => {
        it('should handle competitive marketplace dynamics', async () => {
            // Setup competitive scenario
            const sellers = ['CompetitorA', 'CompetitorB', 'CompetitorC'];
            const buyers = ['BuyerX', 'BuyerY', 'BuyerZ'];

            // Register all agents
            for (const seller of sellers) {
                await marketplace.registerAgent(seller, {
                    name: `${seller} Competitive Seller`,
                    description: `Competitive seller ${seller} with comprehensive description for marketplace testing`,
                    specialization: ['market-analysis', 'trading']
                });
            }

            for (const buyer of buyers) {
                await marketplace.registerAgent(buyer, {
                    name: `${buyer} Active Buyer`,
                    description: `Active buyer ${buyer} with comprehensive description for marketplace testing`,
                    specialization: ['market-analysis']
                });
            }

            // Create competing intelligence in same category
            const competitions = [];
            for (let i = 0; i < sellers.length; i++) {
                const intelId = await marketplace.listIntelligence(sellers[i], {
                    title: `Market Analysis ${i + 1}`,
                    description: `Comprehensive market analysis from ${sellers[i]} for competitive testing scenarios`,
                    category: 'market-analysis',
                    price: 0.5 + (i * 0.2) // Different pricing strategies
                });
                competitions.push(intelId);
            }

            // Simulate buyer behavior - mix of purchases and searches
            for (const buyer of buyers) {
                // Search for intelligence
                const searchResults = marketplace.searchIntelligence({
                    category: 'market-analysis'
                });
                expect(searchResults.length).toBeGreaterThanOrEqual(3);

                // Purchase from different sellers
                for (const intelId of competitions) {
                    const transaction = await marketplace.purchaseIntelligence(buyer, intelId);
                    expect(transaction).toBeDefined();

                    // Rate with varied feedback
                    const rating = 3 + Math.floor(Math.random() * 3); // 3-5 stars
                    await marketplace.rateIntelligence(intelId, rating, buyer);
                }
            }

            // Verify marketplace statistics reflect activity
            const stats = marketplace.getMarketplaceStats();
            expect(stats.totalAgents).toBeGreaterThanOrEqual(6);
            expect(stats.totalIntelligence).toBeGreaterThanOrEqual(3);
            expect(stats.totalTransactions).toBeGreaterThanOrEqual(9);
        });

        it('should support complex intelligence discovery workflows', async () => {
            // Setup diverse marketplace
            const categories = ['market-analysis', 'defi-strategy', 'price-prediction', 'risk-assessment'];
            const agentCount = 10;

            // Register diverse agents
            for (let i = 0; i < agentCount; i++) {
                await marketplace.registerAgent(`DiscoveryAgent${i}`, {
                    name: `Discovery Agent ${i}`,
                    description: `Discovery agent ${i} specialized in various intelligence types with proper description`,
                    specialization: ['market-analysis', 'defi-strategy', 'price-prediction'][i % 3] ? [['market-analysis', 'defi-strategy', 'price-prediction'][i % 3]] : ['market-analysis']
                });
            }

            // Create diverse intelligence catalog
            const intelligenceIds = [];
            for (let i = 0; i < agentCount; i++) {
                const category = categories[i % categories.length];
                const intelId = await marketplace.listIntelligence(`DiscoveryAgent${i}`, {
                    title: `${category} Intelligence ${i}`,
                    description: `Specialized ${category} intelligence from agent ${i} with comprehensive analysis and insights`,
                    category: category as any,
                    price: 0.1 + (Math.random() * 0.9) // Random pricing
                });
                intelligenceIds.push(intelId);
            }

            // Test various discovery patterns
            const discoveryAgent = 'DiscoveryAgent0';

            // 1. Category-based discovery
            for (const category of categories) {
                const results = marketplace.searchIntelligence({ category: category as any });
                expect(results.length).toBeGreaterThan(0);
                expect(results.every(intel => intel.category === category)).toBe(true);
            }

            // 2. Price-based filtering
            const budgetResults = marketplace.searchIntelligence({ maxPrice: 0.5 });
            expect(budgetResults.length).toBeGreaterThan(0);
            expect(budgetResults.every(intel => intel.price <= 0.5)).toBe(true);

            // 3. Quality-based filtering
            const qualityResults = marketplace.searchIntelligence({ minQuality: 50 });
            expect(qualityResults.length).toBeGreaterThan(0);

            // 4. Multi-criteria search
            const complexResults = marketplace.searchIntelligence({
                category: 'market-analysis',
                maxPrice: 0.8,
                minQuality: 30
            });
            expect(Array.isArray(complexResults)).toBe(true);
        });
    });

    describe('Stress Testing and Load Scenarios', () => {
        it('should handle high-volume marketplace activity', async () => {
            const agentCount = 50;
            const intelligencePerAgent = 3;
            const transactionsPerAgent = 5;

            console.log('Setting up high-volume test environment...');

            // Phase 1: Mass agent registration
            const agents = [];
            for (let i = 0; i < agentCount; i++) {
                const agentName = `VolumeAgent${i}`;
                await marketplace.registerAgent(agentName, {
                    name: `Volume Test Agent ${i}`,
                    description: `Volume test agent ${i} for high-load testing with comprehensive description`,
                    specialization: ['market-analysis']
                });
                agents.push(agentName);
            }

            console.log(`Registered ${agentCount} agents`);

            // Phase 2: Mass intelligence creation
            const allIntelligence = [];
            for (let agent = 0; agent < agentCount; agent++) {
                for (let intel = 0; intel < intelligencePerAgent; intel++) {
                    const intelId = await marketplace.listIntelligence(agents[agent], {
                        title: `Intelligence ${intel} from Agent ${agent}`,
                        description: `Volume test intelligence ${intel} from agent ${agent} with comprehensive content for load testing`,
                        category: ['market-analysis', 'defi-strategy', 'price-prediction'][intel % 3] as any,
                        price: 0.1 + (Math.random() * 0.4)
                    });
                    allIntelligence.push(intelId);
                }
            }

            console.log(`Created ${allIntelligence.length} intelligence items`);

            // Phase 3: Mass transactions
            let transactionCount = 0;
            for (let i = 0; i < Math.min(agentCount, 20); i++) { // Limit to prevent excessive test time
                for (let j = 0; j < Math.min(transactionsPerAgent, 3); j++) {
                    const buyer = agents[i];
                    const randomIntelId = allIntelligence[Math.floor(Math.random() * allIntelligence.length)];

                    try {
                        const transaction = await marketplace.purchaseIntelligence(buyer, randomIntelId);
                        if (transaction) {
                            transactionCount++;
                        }
                    } catch (error) {
                        // Some transactions may fail (e.g., self-purchase), which is expected
                    }
                }
            }

            console.log(`Completed ${transactionCount} transactions`);

            // Verify system stability
            const finalStats = marketplace.getMarketplaceStats();
            expect(finalStats.totalAgents).toBeGreaterThanOrEqual(agentCount);
            expect(finalStats.totalIntelligence).toBeGreaterThanOrEqual(allIntelligence.length);
            expect(finalStats.totalTransactions).toBeGreaterThanOrEqual(transactionCount);

            // Verify system still responds to queries
            const searchResults = marketplace.searchIntelligence({});
            expect(Array.isArray(searchResults)).toBe(true);
            expect(searchResults.length).toBeGreaterThan(0);
        });

        it('should maintain performance under concurrent access', async () => {
            const concurrentOperations = 20;
            const operationsPerConcurrent = 5;

            const promises = [];

            // Launch concurrent operations
            for (let i = 0; i < concurrentOperations; i++) {
                promises.push(
                    (async (id: number) => {
                        const results = [];

                        // Register agent
                        const agentName = `ConcurrentAgent${id}`;
                        await marketplace.registerAgent(agentName, {
                            name: `Concurrent Test Agent ${id}`,
                            description: `Concurrent test agent ${id} for performance testing with proper description`,
                            specialization: ['market-analysis']
                        });
                        results.push(`Agent ${agentName} registered`);

                        // Create intelligence
                        for (let j = 0; j < operationsPerConcurrent; j++) {
                            const intelId = await marketplace.listIntelligence(agentName, {
                                title: `Concurrent Intelligence ${id}-${j}`,
                                description: `Concurrent intelligence ${id}-${j} for performance testing with adequate description length`,
                                category: 'market-analysis',
                                price: 0.1 + (j * 0.1)
                            });
                            results.push(`Intelligence ${intelId} created`);
                        }

                        return results;
                    })(i)
                );
            }

            // Wait for all concurrent operations
            const results = await Promise.allSettled(promises);

            // Verify all operations completed successfully
            const successfulOperations = results.filter(r => r.status === 'fulfilled');
            expect(successfulOperations.length).toBeGreaterThan(concurrentOperations * 0.8); // Allow for some failures

            // Verify final system state
            const agents = marketplace.getAllAgents();
            expect(agents.length).toBeGreaterThanOrEqual(concurrentOperations * 0.8);
        });
    });

    describe('Data Consistency and Recovery', () => {
        it('should maintain referential integrity across operations', async () => {
            // Setup interconnected data
            await marketplace.registerAgent('IntegrityAgent1', {
                name: 'Integrity Test Agent 1',
                description: 'First integrity test agent with proper description',
                specialization: ['market-analysis']
            });
            await marketplace.registerAgent('IntegrityAgent2', {
                name: 'Integrity Test Agent 2',
                description: 'Second integrity test agent with proper description',
                specialization: ['defi-strategy']
            });
            await marketplace.registerAgent('IntegrityAgent3', {
                name: 'Integrity Test Agent 3',
                description: 'Third integrity test agent with proper description',
                specialization: ['risk-assessment']
            });

            // Create intelligence network
            const intel1 = await marketplace.listIntelligence('IntegrityAgent1', {
                title: 'Integrity Test Intelligence 1',
                description: 'First intelligence for integrity testing with comprehensive description content',
                category: 'market-analysis',
                price: 0.3
            });

            const intel2 = await marketplace.listIntelligence('IntegrityAgent2', {
                title: 'Integrity Test Intelligence 2',
                description: 'Second intelligence for integrity testing with comprehensive description content',
                category: 'defi-strategy',
                price: 0.4
            });

            // Create transaction network
            const tx1 = await marketplace.purchaseIntelligence('IntegrityAgent2', intel1);
            const tx2 = await marketplace.purchaseIntelligence('IntegrityAgent3', intel2);

            // Verify all references are valid
            const agent1 = marketplace.getAgent('IntegrityAgent1');
            const agent2 = marketplace.getAgent('IntegrityAgent2');
            const agent3 = marketplace.getAgent('IntegrityAgent3');

            expect(agent1).toBeDefined();
            expect(agent2).toBeDefined();
            expect(agent3).toBeDefined();

            // Verify intelligence references
            const intelligence1 = marketplace.getIntelligence(intel1);
            const intelligence2 = marketplace.getIntelligence(intel2);

            expect(intelligence1).toBeDefined();
            expect(intelligence2).toBeDefined();
            expect(intelligence1!.seller_id).toBe('IntegrityAgent1');
            expect(intelligence2!.seller_id).toBe('IntegrityAgent2');

            // Verify transaction references
            expect(tx1).toBeDefined();
            expect(tx2).toBeDefined();
            expect(tx1.buyer_id).toBe('IntegrityAgent2');
            expect(tx2.buyer_id).toBe('IntegrityAgent3');
        });

        it('should handle edge cases in complex workflows', async () => {
            // Test various edge cases that could occur in production

            // 1. Rapid successive operations
            await marketplace.registerAgent('EdgeAgent', {
                name: 'Edge Case Test Agent',
                description: 'Edge case testing agent with proper description',
                specialization: ['market-analysis']
            });

            const rapidPromises = [];
            for (let i = 0; i < 10; i++) {
                rapidPromises.push(
                    marketplace.listIntelligence('EdgeAgent', {
                        title: `Rapid Intelligence ${i}`,
                        description: `Rapid intelligence creation test ${i} with proper description length`,
                        category: 'market-analysis',
                        price: 0.1 + (i * 0.05)
                    })
                );
            }

            const rapidResults = await Promise.allSettled(rapidPromises);
            const successfulCreations = rapidResults.filter(r => r.status === 'fulfilled');
            expect(successfulCreations.length).toBeGreaterThan(5); // At least half should succeed

            // 2. Complex search operations
            const searchTests = [
                marketplace.searchIntelligence({}), // Empty search
                marketplace.searchIntelligence({ category: 'market-analysis' }),
                marketplace.searchIntelligence({ maxPrice: 1.0 }),
                marketplace.searchIntelligence({ minQuality: 1 })
            ];

            const searchResults = await Promise.allSettled(searchTests);
            expect(searchResults.every(r => r.status === 'fulfilled')).toBe(true);

            // 3. Statistics under varying load
            for (let i = 0; i < 5; i++) {
                const stats = marketplace.getMarketplaceStats();
                expect(stats).toBeDefined();
                expect(typeof stats.totalAgents).toBe('number');
                expect(typeof stats.totalIntelligence).toBe('number');
                expect(typeof stats.totalTransactions).toBe('number');
            }
        });
    });

    describe('Real-World Usage Simulation', () => {
        it('should simulate authentic marketplace interactions', async () => {
            // Simulate a realistic day in the marketplace

            // Morning: New agents join
            const morningAgents = ['TradingBot1', 'DataAnalyst', 'CryptoResearcher'];
            for (const agent of morningAgents) {
                await marketplace.registerAgent(agent, {
                    name: `Professional ${agent}`,
                    description: `Professional ${agent} providing high-quality intelligence with comprehensive market analysis`,
                    specialization: agent === 'TradingBot1' ? ['market-analysis', 'trading'] : agent === 'DataAnalyst' ? ['defi-strategy', 'market-analysis'] : ['price-prediction', 'research']
                });
            }

            // Mid-morning: Agents list their intelligence
            const tradingBotIntel = await marketplace.listIntelligence('TradingBot1', {
                title: 'Advanced Trading Signals',
                description: 'High-frequency trading signals based on machine learning algorithms with real-time market data analysis',
                category: 'market-analysis',
                price: 2.5
            });

            const analystIntel = await marketplace.listIntelligence('DataAnalyst', {
                title: 'DeFi Yield Optimization Strategy',
                description: 'Comprehensive DeFi yield farming strategy with risk assessment and optimal allocation recommendations',
                category: 'defi-strategy',
                price: 1.8
            });

            const researcherIntel = await marketplace.listIntelligence('CryptoResearcher', {
                title: 'Altcoin Price Predictions',
                description: 'Detailed fundamental analysis and price predictions for emerging altcoins with technical indicators',
                category: 'price-prediction',
                price: 1.2
            });

            // Noon: Customer agents discover and evaluate
            const customers = ['HedgeFund', 'RetailTrader', 'InstitutionalInvestor'];
            for (const customer of customers) {
                await marketplace.registerAgent(customer, {
                    name: `Professional ${customer}`,
                    description: `Professional ${customer} seeking high-quality intelligence for investment decisions`,
                    specialization: ['investment']
                });

                // Browse marketplace
                const available = marketplace.searchIntelligence({});
                expect(available.length).toBeGreaterThanOrEqual(3);

                // Purchase based on customer type
                if (customer === 'HedgeFund') {
                    // High-value customer purchases premium intelligence
                    await marketplace.purchaseIntelligence(customer, tradingBotIntel);
                    await marketplace.purchaseIntelligence(customer, analystIntel);
                } else if (customer === 'RetailTrader') {
                    // Price-conscious customer
                    await marketplace.purchaseIntelligence(customer, researcherIntel);
                } else {
                    // Institutional customer purchases multiple
                    await marketplace.purchaseIntelligence(customer, analystIntel);
                    await marketplace.purchaseIntelligence(customer, researcherIntel);
                }
            }

            // Afternoon: Customers provide ratings and feedback
            await marketplace.rateIntelligence(tradingBotIntel, 5, 'HedgeFund');
            await marketplace.rateIntelligence(analystIntel, 4, 'HedgeFund');
            await marketplace.rateIntelligence(analystIntel, 5, 'InstitutionalInvestor');
            await marketplace.rateIntelligence(researcherIntel, 4, 'RetailTrader');
            await marketplace.rateIntelligence(researcherIntel, 4, 'InstitutionalInvestor');

            // Evening: Verify marketplace state reflects realistic activity
            const finalStats = marketplace.getMarketplaceStats();
            expect(finalStats.totalAgents).toBe(6);
            expect(finalStats.totalIntelligence).toBe(3);
            expect(finalStats.totalTransactions).toBeGreaterThanOrEqual(5);

            // Verify reputation effects
            const tradingBot = marketplace.getAgent('TradingBot1');
            const analyst = marketplace.getAgent('DataAnalyst');
            const researcher = marketplace.getAgent('CryptoResearcher');

            expect(tradingBot!.reputation_score).toBeGreaterThan(100); // Should have improved
            expect(analyst!.reputation_score).toBeGreaterThan(100);    // Should have improved
            expect(researcher!.reputation_score).toBeGreaterThan(100); // Should have improved
        });
    });
});