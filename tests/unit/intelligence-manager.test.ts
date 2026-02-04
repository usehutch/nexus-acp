import { IntelligenceManager } from '../../src/core/intelligence-manager.ts';
import { AgentManager } from '../../src/core/agent-manager.ts';
import type { AgentIntelligence, SearchFilters, IntelligenceTransaction } from '../../src/types/index.ts';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('IntelligenceManager', () => {
    let intelligenceManager: IntelligenceManager;
    let agentManager: AgentManager;

    beforeEach(async () => {
        agentManager = new AgentManager();
        intelligenceManager = new IntelligenceManager(agentManager);

        // Register test agents
        await agentManager.registerAgent('seller1', {
            name: 'Test Seller 1',
            description: 'First test seller',
            specialization: ['market-analysis', 'defi-strategy'],
            verified: true
        });

        await agentManager.registerAgent('seller2', {
            name: 'Test Seller 2',
            description: 'Second test seller',
            specialization: ['price-prediction', 'risk-assessment'],
            verified: false
        });
    });

    describe('Intelligence Listing', () => {
        it('should list intelligence successfully for registered agent', async () => {
            const intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: 'DeFi Market Analysis',
                description: 'Comprehensive analysis of DeFi protocols',
                category: 'market-analysis',
                price: 0.5
            });

            expect(typeof intelligenceId).toBe('string');
            expect(intelligenceId.startsWith('intel_')).toBe(true);
        });

        it('should create intelligence with correct properties', async () => {
            const intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: 'Price Prediction Model',
                description: 'Advanced ML model for price prediction',
                category: 'price-prediction',
                price: 1.2
            });

            const intelligence = intelligenceManager.getIntelligence(intelligenceId);
            expect(intelligence).toBeDefined();
            expect(intelligence!.id).toBe(intelligenceId);
            expect(intelligence!.seller).toBe('seller1');
            expect(intelligence!.title).toBe('Price Prediction Model');
            expect(intelligence!.description).toBe('Advanced ML model for price prediction');
            expect(intelligence!.category).toBe('price-prediction');
            expect(intelligence!.price).toBe(1.2);
            expect(intelligence!.sales_count).toBe(0);
            expect(intelligence!.rating).toBe(0);
            expect(typeof intelligence!.quality_score).toBe('number');
            expect(intelligence!.quality_score).toBeGreaterThanOrEqual(0);
            expect(intelligence!.quality_score).toBeLessThanOrEqual(100);
            expect(typeof intelligence!.created_at).toBe('number');
            expect(intelligence!.created_at).toBeGreaterThan(0);
        });

        it('should calculate quality score based on seller reputation', async () => {
            // Update seller1's reputation
            const seller1 = agentManager.getAgent('seller1')!;
            seller1.reputation_score = 500; // Mid-range reputation

            const intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: 'Test Intelligence',
                description: 'Test intelligence',
                category: 'market-analysis',
                price: 0.1
            });

            const intelligence = intelligenceManager.getIntelligence(intelligenceId);
            const expectedQuality = Math.min(100, 500 / 10); // reputation_score / 10
            expect(intelligence!.quality_score).toBe(expectedQuality);
        });

        it('should throw error for unregistered agent', async () => {
            await expect(async () => {
                await intelligenceManager.listIntelligence('unregistered-agent', {
                    title: 'Test Intelligence',
                    description: 'Test description',
                    category: 'market-analysis',
                    price: 0.1
                });
            }).toThrow('Agent must be registered first');
        });

        it('should generate unique IDs for multiple listings', async () => {
            const id1 = await intelligenceManager.listIntelligence('seller1', {
                title: 'Intelligence 1',
                description: 'First intelligence',
                category: 'market-analysis',
                price: 0.1
            });

            const id2 = await intelligenceManager.listIntelligence('seller1', {
                title: 'Intelligence 2',
                description: 'Second intelligence',
                category: 'defi-strategy',
                price: 0.2
            });

            expect(id1).not.toBe(id2);
            expect(id1.startsWith('intel_')).toBe(true);
            expect(id2.startsWith('intel_')).toBe(true);
        });
    });

    describe('Intelligence Retrieval', () => {
        let intelligenceId: string;

        beforeEach(async () => {
            intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: 'Test Retrieval Intelligence',
                description: 'Intelligence for testing retrieval',
                category: 'trend-analysis',
                price: 0.3
            });
        });

        it('should retrieve intelligence by ID', () => {
            const intelligence = intelligenceManager.getIntelligence(intelligenceId);
            expect(intelligence).toBeDefined();
            expect(intelligence!.id).toBe(intelligenceId);
            expect(intelligence!.title).toBe('Test Retrieval Intelligence');
        });

        it('should return undefined for non-existent ID', () => {
            const intelligence = intelligenceManager.getIntelligence('non-existent-id');
            expect(intelligence).toBeUndefined();
        });

        it('should return all intelligence', async () => {
            // Add another intelligence
            await intelligenceManager.listIntelligence('seller2', {
                title: 'Another Intelligence',
                description: 'Another test intelligence',
                category: 'risk-assessment',
                price: 0.4
            });

            const allIntelligence = intelligenceManager.getAllIntelligence();
            expect(Array.isArray(allIntelligence)).toBe(true);
            expect(allIntelligence.length).toBe(2);
        });

        it('should return correct count', async () => {
            expect(intelligenceManager.getIntelligenceCount()).toBe(1);

            await intelligenceManager.listIntelligence('seller2', {
                title: 'Count Test',
                description: 'For count testing',
                category: 'market-analysis',
                price: 0.1
            });

            expect(intelligenceManager.getIntelligenceCount()).toBe(2);
        });
    });

    describe('Intelligence Search and Filtering', () => {
        beforeEach(async () => {
            // Create diverse intelligence for testing filters
            const intelligenceData = [
                { seller: 'seller1', title: 'Market Analysis 1', category: 'market-analysis', price: 0.1 },
                { seller: 'seller1', title: 'DeFi Strategy 1', category: 'defi-strategy', price: 0.3 },
                { seller: 'seller2', title: 'Price Prediction 1', category: 'price-prediction', price: 0.8 },
                { seller: 'seller2', title: 'Risk Assessment 1', category: 'risk-assessment', price: 0.2 },
                { seller: 'seller1', title: 'Market Analysis 2', category: 'market-analysis', price: 0.5 }
            ];

            for (const intel of intelligenceData) {
                await intelligenceManager.listIntelligence(intel.seller, {
                    title: intel.title,
                    description: `Description for ${intel.title}`,
                    category: intel.category as any,
                    price: intel.price
                });
            }
        });

        it('should return all intelligence without filters', () => {
            const results = intelligenceManager.searchIntelligence();
            expect(results.length).toBe(5);
        });

        it('should filter by category', () => {
            const marketAnalysisResults = intelligenceManager.searchIntelligence({
                category: 'market-analysis'
            });
            expect(marketAnalysisResults.length).toBe(2);
            marketAnalysisResults.forEach(intel => {
                expect(intel.category).toBe('market-analysis');
            });

            const defiResults = intelligenceManager.searchIntelligence({
                category: 'defi-strategy'
            });
            expect(defiResults.length).toBe(1);
            expect(defiResults[0].category).toBe('defi-strategy');
        });

        it('should filter by max price', () => {
            const cheapResults = intelligenceManager.searchIntelligence({ maxPrice: 0.3 });
            expect(cheapResults.length).toBe(3); // 0.1, 0.3, 0.2 prices

            cheapResults.forEach(intel => {
                expect(intel.price).toBeLessThanOrEqual(0.3);
            });
        });

        it('should filter by seller', () => {
            const seller1Results = intelligenceManager.searchIntelligence({ seller: 'seller1' });
            expect(seller1Results.length).toBe(3);
            seller1Results.forEach(intel => {
                expect(intel.seller).toBe('seller1');
            });

            const seller2Results = intelligenceManager.searchIntelligence({ seller: 'seller2' });
            expect(seller2Results.length).toBe(2);
            seller2Results.forEach(intel => {
                expect(intel.seller).toBe('seller2');
            });
        });

        it('should filter by minimum quality', async () => {
            // Set different reputation scores
            const seller1 = agentManager.getAgent('seller1')!;
            const seller2 = agentManager.getAgent('seller2')!;
            seller1.reputation_score = 800; // Quality score will be 80
            seller2.reputation_score = 200; // Quality score will be 20

            // Re-list intelligence to get updated quality scores
            await intelligenceManager.listIntelligence('seller1', {
                title: 'High Quality Intelligence',
                description: 'High quality test',
                category: 'market-analysis',
                price: 0.1
            });

            await intelligenceManager.listIntelligence('seller2', {
                title: 'Low Quality Intelligence',
                description: 'Low quality test',
                category: 'market-analysis',
                price: 0.1
            });

            const highQualityResults = intelligenceManager.searchIntelligence({ minQuality: 50 });

            // Should include the new high-quality intelligence
            const highQualityIntel = highQualityResults.find(intel =>
                intel.title === 'High Quality Intelligence'
            );
            expect(highQualityIntel).toBeDefined();
            expect(highQualityIntel!.quality_score).toBeGreaterThanOrEqual(50);
        });

        it('should combine multiple filters', () => {
            const results = intelligenceManager.searchIntelligence({
                category: 'market-analysis',
                maxPrice: 0.3,
                seller: 'seller1'
            });

            expect(results.length).toBe(1); // Only one matches all criteria
            expect(results[0].category).toBe('market-analysis');
            expect(results[0].price).toBeLessThanOrEqual(0.3);
            expect(results[0].seller).toBe('seller1');
        });

        it('should sort results by quality and recency', () => {
            const results = intelligenceManager.searchIntelligence();

            // Results should be sorted (newer and higher quality first)
            for (let i = 1; i < results.length; i++) {
                const current = results[i-1];
                const next = results[i];

                // Calculate scoring logic
                const currentScore = current.quality_score * 0.7 + (Date.now() - current.created_at) / 86400000 * 0.3;
                const nextScore = next.quality_score * 0.7 + (Date.now() - next.created_at) / 86400000 * 0.3;

                expect(currentScore).toBeGreaterThanOrEqual(nextScore);
            }
        });
    });

    describe('Sales Count and Rating Updates', () => {
        let intelligenceId: string;

        beforeEach(async () => {
            intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: 'Sales Test Intelligence',
                description: 'Intelligence for testing sales',
                category: 'market-analysis',
                price: 0.2
            });
        });

        it('should increment sales count', () => {
            const initialIntelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(initialIntelligence.sales_count).toBe(0);

            intelligenceManager.incrementSalesCount(intelligenceId);

            const updatedIntelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(updatedIntelligence.sales_count).toBe(1);
        });

        it('should accumulate multiple sales', () => {
            intelligenceManager.incrementSalesCount(intelligenceId);
            intelligenceManager.incrementSalesCount(intelligenceId);
            intelligenceManager.incrementSalesCount(intelligenceId);

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.sales_count).toBe(3);
        });

        it('should handle non-existent intelligence ID gracefully', () => {
            expect(() => {
                intelligenceManager.incrementSalesCount('non-existent');
            }).not.toThrow();
        });

        it('should update intelligence rating from transactions', () => {
            const transactions: IntelligenceTransaction[] = [
                {
                    id: 'tx1',
                    buyer: 'buyer1',
                    seller: 'seller1',
                    intelligence_id: intelligenceId,
                    price: 0.2,
                    timestamp: Date.now(),
                    rating: 5
                },
                {
                    id: 'tx2',
                    buyer: 'buyer2',
                    seller: 'seller1',
                    intelligence_id: intelligenceId,
                    price: 0.2,
                    timestamp: Date.now(),
                    rating: 4
                },
                {
                    id: 'tx3',
                    buyer: 'buyer3',
                    seller: 'seller1',
                    intelligence_id: intelligenceId,
                    price: 0.2,
                    timestamp: Date.now(),
                    rating: 3
                }
            ];

            intelligenceManager.updateIntelligenceRating(intelligenceId, transactions);

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            const expectedRating = (5 + 4 + 3) / 3; // Average = 4
            expect(intelligence.rating).toBe(expectedRating);
        });

        it('should handle transactions without ratings', () => {
            const transactions: IntelligenceTransaction[] = [
                {
                    id: 'tx1',
                    buyer: 'buyer1',
                    seller: 'seller1',
                    intelligence_id: intelligenceId,
                    price: 0.2,
                    timestamp: Date.now()
                    // No rating
                }
            ];

            const originalRating = intelligenceManager.getIntelligence(intelligenceId)!.rating;
            intelligenceManager.updateIntelligenceRating(intelligenceId, transactions);
            const updatedRating = intelligenceManager.getIntelligence(intelligenceId)!.rating;

            expect(updatedRating).toBe(originalRating);
        });

        it('should ignore transactions for other intelligence', () => {
            const transactions: IntelligenceTransaction[] = [
                {
                    id: 'tx1',
                    buyer: 'buyer1',
                    seller: 'seller1',
                    intelligence_id: 'different-intelligence-id',
                    price: 0.2,
                    timestamp: Date.now(),
                    rating: 5
                }
            ];

            const originalRating = intelligenceManager.getIntelligence(intelligenceId)!.rating;
            intelligenceManager.updateIntelligenceRating(intelligenceId, transactions);
            const updatedRating = intelligenceManager.getIntelligence(intelligenceId)!.rating;

            expect(updatedRating).toBe(originalRating);
        });
    });

    describe('Category Statistics', () => {
        beforeEach(async () => {
            const intelligenceData = [
                { category: 'market-analysis', count: 3 },
                { category: 'defi-strategy', count: 2 },
                { category: 'price-prediction', count: 1 },
                { category: 'risk-assessment', count: 2 }
            ];

            let counter = 1;
            for (const { category, count } of intelligenceData) {
                for (let i = 0; i < count; i++) {
                    await intelligenceManager.listIntelligence('seller1', {
                        title: `Intelligence ${counter++}`,
                        description: `Test intelligence ${counter}`,
                        category: category as any,
                        price: 0.1
                    });
                }
            }
        });

        it('should return correct category counts', () => {
            const categoryCounts = intelligenceManager.getCategoryCounts();

            expect(categoryCounts['market-analysis']).toBe(3);
            expect(categoryCounts['defi-strategy']).toBe(2);
            expect(categoryCounts['price-prediction']).toBe(1);
            expect(categoryCounts['risk-assessment']).toBe(2);
            expect(categoryCounts['trend-analysis']).toBeUndefined();
        });

        it('should handle empty intelligence list', () => {
            const emptyManager = new IntelligenceManager(agentManager);
            const categoryCounts = emptyManager.getCategoryCounts();
            expect(categoryCounts).toEqual({});
        });
    });

    describe('Sample Data Generation', () => {
        let intelligence: AgentIntelligence;

        beforeEach(async () => {
            const intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: 'Data Generation Test',
                description: 'Intelligence for testing data generation',
                category: 'market-analysis',
                price: 0.1
            });
            intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
        });

        it('should generate sample data for intelligence', () => {
            const sampleData = intelligenceManager.generateSampleData(intelligence);
            expect(sampleData).toBeDefined();
            expect(typeof sampleData).toBe('object');
        });

        it('should generate different data for different categories', () => {
            const categories = ['market-analysis', 'defi-strategy', 'price-prediction', 'risk-assessment', 'trend-analysis'];
            const generatedData: any[] = [];

            for (const category of categories) {
                const testIntel = { ...intelligence, category: category as any };
                const data = intelligenceManager.generateSampleData(testIntel);
                generatedData.push(data);
                expect(data).toBeDefined();
            }

            // Verify data is generated (structure may vary by category)
            generatedData.forEach(data => {
                expect(typeof data).toBe('object');
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty title and description', async () => {
            const intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: '',
                description: '',
                category: 'market-analysis',
                price: 0.1
            });

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.title).toBe('');
            expect(intelligence.description).toBe('');
        });

        it('should handle zero price intelligence', async () => {
            const intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: 'Free Intelligence',
                description: 'Free intelligence for testing',
                category: 'market-analysis',
                price: 0
            });

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.price).toBe(0);
        });

        it('should handle very large prices', async () => {
            const largePrice = 999999.999999;
            const intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: 'Expensive Intelligence',
                description: 'Very expensive intelligence',
                category: 'market-analysis',
                price: largePrice
            });

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.price).toBe(largePrice);
        });

        it('should handle special characters in titles and descriptions', async () => {
            const specialTitle = 'Title with 🚀 emojis & special chars!@#$%^&*()';
            const specialDescription = 'Description with\nnewlines\tand\ttabs & unicode: 漢字';

            const intelligenceId = await intelligenceManager.listIntelligence('seller1', {
                title: specialTitle,
                description: specialDescription,
                category: 'market-analysis',
                price: 0.1
            });

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.title).toBe(specialTitle);
            expect(intelligence.description).toBe(specialDescription);
        });

        it('should handle search with invalid filters gracefully', () => {
            const results = intelligenceManager.searchIntelligence({
                category: 'non-existent-category',
                maxPrice: -1,
                minQuality: 200,
                seller: 'non-existent-seller'
            });

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });
    });
});