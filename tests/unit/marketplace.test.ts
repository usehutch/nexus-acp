import { Connection, clusterApiUrl } from '@solana/web3.js';
import { AgentMarketplace } from '../../src/marketplace.ts';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('AgentMarketplace', () => {
    let marketplace: AgentMarketplace;
    let connection: Connection;

    beforeEach(() => {
        connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        marketplace = new AgentMarketplace(connection);
    });

    describe('Agent Registration', () => {
        it('should register a new agent successfully', async () => {
            const result = await marketplace.registerAgent('test-key-123', {
                name: 'Test Agent',
                description: 'A test agent for unit testing',
                specialization: ['testing', 'validation'],
                verified: false
            });

            expect(result).toBe(true);
        });

        it('should get top agents', () => {
            const agents = marketplace.getTopAgents(5);
            expect(Array.isArray(agents)).toBe(true);
            expect(agents.length).toBeGreaterThan(0);
        });
    });

    describe('Intelligence Listing', () => {
        beforeEach(async () => {
            // Register an agent first
            await marketplace.registerAgent('test-seller', {
                name: 'Seller Agent',
                description: 'Agent for testing intelligence listing',
                specialization: ['market-analysis'],
                verified: false
            });
        });

        it('should list intelligence successfully', async () => {
            const id = await marketplace.listIntelligence('test-seller', {
                title: 'Test Analysis',
                description: 'Test intelligence for unit testing',
                category: 'market-analysis',
                price: 0.1
            });

            expect(typeof id).toBe('string');
            expect(id.startsWith('intel_')).toBe(true);
        });

        it('should throw error if agent not registered', async () => {
            expect(async () => {
                await marketplace.listIntelligence('unregistered-agent', {
                    title: 'Test Analysis',
                    description: 'Test intelligence',
                    category: 'market-analysis',
                    price: 0.1
                });
            }).toThrow();
        });
    });

    describe('Intelligence Search', () => {
        it('should search without filters', () => {
            const results = marketplace.searchIntelligence();
            expect(Array.isArray(results)).toBe(true);
        });

        it('should filter by category', () => {
            const results = marketplace.searchIntelligence({ category: 'defi-strategy' });
            expect(Array.isArray(results)).toBe(true);
            results.forEach(intel => {
                expect(intel.category).toBe('defi-strategy');
            });
        });

        it('should filter by max price', () => {
            const maxPrice = 0.2;
            const results = marketplace.searchIntelligence({ maxPrice });
            expect(Array.isArray(results)).toBe(true);
            results.forEach(intel => {
                expect(intel.price).toBeLessThanOrEqual(maxPrice);
            });
        });
    });

    describe('Market Statistics', () => {
        it('should provide market stats', () => {
            const stats = marketplace.getMarketStats();

            expect(typeof stats.totalIntelligence).toBe('number');
            expect(typeof stats.totalAgents).toBe('number');
            expect(typeof stats.totalTransactions).toBe('number');
            expect(typeof stats.totalVolume).toBe('number');
            expect(typeof stats.avgPrice).toBe('number');
            expect(typeof stats.categories).toBe('object');
        });
    });

    describe('Purchase and Rating', () => {
        let intelligenceId: string;

        beforeEach(async () => {
            // Register agent and list intelligence
            await marketplace.registerAgent('test-seller-2', {
                name: 'Seller Agent 2',
                description: 'Another test agent',
                specialization: ['price-prediction'],
                verified: false
            });

            intelligenceId = await marketplace.listIntelligence('test-seller-2', {
                title: 'Price Prediction',
                description: 'Test price prediction',
                category: 'price-prediction',
                price: 0.05
            });
        });

        it('should purchase intelligence successfully', async () => {
            const result = await marketplace.purchaseIntelligence('buyer-123', intelligenceId);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should rate intelligence after purchase', async () => {
            // Purchase first
            await marketplace.purchaseIntelligence('buyer-456', intelligenceId);

            // Then rate - should not throw
            try {
                await marketplace.rateIntelligence('buyer-456', intelligenceId, 5, 'Excellent!');
                expect(true).toBe(true); // Test passes if no error thrown
            } catch (error) {
                expect(error).toBeUndefined(); // Should not throw
            }
        });

        it('should throw error for invalid rating', async () => {
            await marketplace.purchaseIntelligence('buyer-789', intelligenceId);

            await expect(async () => {
                await marketplace.rateIntelligence('buyer-789', intelligenceId, 6); // Invalid rating
            }).rejects.toThrow();
        });
    });
});