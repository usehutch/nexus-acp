import { TransactionManager } from '../../src/core/transaction-manager.ts';
import { AgentManager } from '../../src/core/agent-manager.ts';
import { IntelligenceManager } from '../../src/core/intelligence-manager.ts';
import { CONFIG } from '../../src/config/index.ts';
import type { IntelligenceTransaction, PurchaseResult } from '../../src/types/index.ts';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('TransactionManager', () => {
    let transactionManager: TransactionManager;
    let agentManager: AgentManager;
    let intelligenceManager: IntelligenceManager;
    let sellerId: string;
    let buyerId: string;
    let intelligenceId: string;

    beforeEach(async () => {
        agentManager = new AgentManager();
        intelligenceManager = new IntelligenceManager(agentManager);
        transactionManager = new TransactionManager(agentManager, intelligenceManager);

        // Register test agents
        sellerId = 'seller-test-123';
        buyerId = 'buyer-test-456';

        await agentManager.registerAgent(sellerId, {
            name: 'Test Seller Agent',
            description: 'Agent for testing sales',
            specialization: ['market-analysis'],
            verified: true
        });

        await agentManager.registerAgent(buyerId, {
            name: 'Test Buyer Agent',
            description: 'Agent for testing purchases',
            specialization: ['analysis-consumption'],
            verified: false
        });

        // List test intelligence
        intelligenceId = await intelligenceManager.listIntelligence(sellerId, {
            title: 'Test Market Analysis',
            description: 'Test intelligence for transaction testing',
            category: 'market-analysis',
            price: 0.25
        });
    });

    describe('Intelligence Purchase', () => {
        it('should complete purchase successfully', async () => {
            const result = await transactionManager.purchaseIntelligence(buyerId, intelligenceId);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(typeof result.data).toBe('object');
        });

        it('should create transaction record', async () => {
            await transactionManager.purchaseIntelligence(buyerId, intelligenceId);

            const transactions = transactionManager.getTransactions();
            expect(transactions.length).toBe(1);

            const transaction = transactions[0];
            expect(transaction.buyer).toBe(buyerId);
            expect(transaction.seller).toBe(sellerId);
            expect(transaction.intelligence_id).toBe(intelligenceId);
            expect(transaction.price).toBe(0.25);
            expect(typeof transaction.id).toBe('string');
            expect(transaction.id.startsWith('tx_')).toBe(true);
            expect(typeof transaction.timestamp).toBe('number');
            expect(transaction.timestamp).toBeGreaterThan(0);
        });

        it('should increment intelligence sales count', async () => {
            const initialIntelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(initialIntelligence.sales_count).toBe(0);

            await transactionManager.purchaseIntelligence(buyerId, intelligenceId);

            const updatedIntelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(updatedIntelligence.sales_count).toBe(1);
        });

        it('should update seller agent statistics', async () => {
            const initialSeller = agentManager.getAgent(sellerId)!;
            expect(initialSeller.total_sales).toBe(0);
            expect(initialSeller.total_earnings).toBe(0);

            await transactionManager.purchaseIntelligence(buyerId, intelligenceId);

            const updatedSeller = agentManager.getAgent(sellerId)!;
            expect(updatedSeller.total_sales).toBe(1);
            expect(updatedSeller.total_earnings).toBe(0.25);
        });

        it('should throw error for non-existent intelligence', async () => {
            await expect(async () => {
                await transactionManager.purchaseIntelligence(buyerId, 'non-existent-intel');
            }).toThrow('Intelligence not found');
        });

        it('should throw error if seller not found', async () => {
            // Create intelligence with seller that doesn't exist
            const agentManagerSpy = {
                ...agentManager,
                getAgent: (key: string) => key === sellerId ? undefined : agentManager.getAgent(key)
            } as any;

            const intelligenceManagerSpy = {
                ...intelligenceManager,
                getIntelligence: () => ({
                    id: intelligenceId,
                    seller: 'non-existent-seller',
                    title: 'Test',
                    description: 'Test',
                    category: 'market-analysis',
                    price: 0.1,
                    quality_score: 50,
                    created_at: Date.now(),
                    sales_count: 0,
                    rating: 0
                })
            } as any;

            const testTransactionManager = new TransactionManager(agentManagerSpy, intelligenceManagerSpy);

            await expect(async () => {
                await testTransactionManager.purchaseIntelligence(buyerId, intelligenceId);
            }).toThrow('Seller not found');
        });

        it('should handle multiple purchases', async () => {
            // Purchase same intelligence multiple times
            await transactionManager.purchaseIntelligence(buyerId, intelligenceId);
            await transactionManager.purchaseIntelligence('another-buyer', intelligenceId);

            const transactions = transactionManager.getTransactions();
            expect(transactions.length).toBe(2);

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.sales_count).toBe(2);

            const seller = agentManager.getAgent(sellerId)!;
            expect(seller.total_sales).toBe(2);
            expect(seller.total_earnings).toBe(0.5); // 0.25 * 2
        });

        it('should generate unique transaction IDs', async () => {
            await transactionManager.purchaseIntelligence(buyerId, intelligenceId);
            await transactionManager.purchaseIntelligence('buyer2', intelligenceId);

            const transactions = transactionManager.getTransactions();
            const transactionIds = transactions.map(tx => tx.id);
            const uniqueIds = [...new Set(transactionIds)];

            expect(uniqueIds.length).toBe(transactionIds.length);
        });
    });

    describe('Intelligence Rating', () => {
        beforeEach(async () => {
            // Complete a purchase first
            await transactionManager.purchaseIntelligence(buyerId, intelligenceId);
        });

        it('should rate intelligence successfully', async () => {
            await expect(async () => {
                await transactionManager.rateIntelligence(buyerId, intelligenceId, 4, 'Good analysis!');
            }).not.toThrow();

            const transactions = transactionManager.getTransactions();
            const ratedTransaction = transactions.find(tx =>
                tx.buyer === buyerId && tx.intelligence_id === intelligenceId
            );

            expect(ratedTransaction).toBeDefined();
            expect(ratedTransaction!.rating).toBe(4);
            expect(ratedTransaction!.review).toBe('Good analysis!');
        });

        it('should update intelligence rating', async () => {
            await transactionManager.rateIntelligence(buyerId, intelligenceId, 5);

            // Rate from another buyer
            await transactionManager.purchaseIntelligence('buyer2', intelligenceId);
            await transactionManager.rateIntelligence('buyer2', intelligenceId, 3);

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            expect(intelligence.rating).toBe(4); // Average of 5 and 3
        });

        it('should update seller reputation', async () => {
            await transactionManager.rateIntelligence(buyerId, intelligenceId, 5);

            const seller = agentManager.getAgent(sellerId)!;
            const expectedReputation = Math.round((5 / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);
            expect(seller.reputation_score).toBe(expectedReputation); // 1000
        });

        it('should validate rating range', async () => {
            // Test minimum rating
            await expect(async () => {
                await transactionManager.rateIntelligence(buyerId, intelligenceId, 0 as any);
            }).rejects.toThrow(`Rating must be between ${CONFIG.MARKETPLACE.MIN_RATING} and ${CONFIG.MARKETPLACE.MAX_RATING}`);

            // Test maximum rating
            await expect(async () => {
                await transactionManager.rateIntelligence(buyerId, intelligenceId, 6 as any);
            }).rejects.toThrow(`Rating must be between ${CONFIG.MARKETPLACE.MIN_RATING} and ${CONFIG.MARKETPLACE.MAX_RATING}`);
        });

        it('should allow rating within valid range', async () => {
            for (let rating = CONFIG.MARKETPLACE.MIN_RATING; rating <= CONFIG.MARKETPLACE.MAX_RATING; rating++) {
                // Create new purchase for each rating
                const newBuyerId = `buyer-${rating}`;
                await agentManager.registerAgent(newBuyerId, {
                    name: `Buyer ${rating}`,
                    description: 'Test buyer',
                    specialization: ['testing'],
                    verified: false
                });

                await transactionManager.purchaseIntelligence(newBuyerId, intelligenceId);

                await expect(async () => {
                    await transactionManager.rateIntelligence(newBuyerId, intelligenceId, rating as any);
                }).not.toThrow();
            }
        });

        it('should throw error if transaction not found', async () => {
            await expect(async () => {
                await transactionManager.rateIntelligence('non-buyer', intelligenceId, 5);
            }).toThrow('Transaction not found or already rated');
        });

        it('should throw error if already rated', async () => {
            // Rate the intelligence first time
            await transactionManager.rateIntelligence(buyerId, intelligenceId, 4);

            // Try to rate again
            await expect(async () => {
                await transactionManager.rateIntelligence(buyerId, intelligenceId, 5);
            }).toThrow('Transaction not found or already rated');
        });

        it('should allow rating without review', async () => {
            await expect(async () => {
                await transactionManager.rateIntelligence(buyerId, intelligenceId, 3);
            }).not.toThrow();

            const transactions = transactionManager.getTransactions();
            const ratedTransaction = transactions[0];
            expect(ratedTransaction.rating).toBe(3);
            expect(ratedTransaction.review).toBeUndefined();
        });
    });

    describe('Transaction Statistics', () => {
        beforeEach(async () => {
            // Create multiple transactions
            const buyers = ['buyer1', 'buyer2', 'buyer3'];
            const prices = [0.1, 0.3, 0.5];

            for (let i = 0; i < buyers.length; i++) {
                await agentManager.registerAgent(buyers[i], {
                    name: `Buyer ${i + 1}`,
                    description: `Test buyer ${i + 1}`,
                    specialization: ['testing'],
                    verified: false
                });

                const testIntelId = await intelligenceManager.listIntelligence(sellerId, {
                    title: `Test Intelligence ${i + 1}`,
                    description: `Test description ${i + 1}`,
                    category: 'market-analysis',
                    price: prices[i]
                });

                await transactionManager.purchaseIntelligence(buyers[i], testIntelId);
            }
        });

        it('should return correct transaction count', () => {
            expect(transactionManager.getTransactionCount()).toBe(3);
        });

        it('should calculate total volume correctly', () => {
            const expectedVolume = 0.1 + 0.3 + 0.5; // Sum of all prices
            expect(transactionManager.getTotalVolume()).toBe(expectedVolume);
        });

        it('should calculate average price correctly', () => {
            const expectedAverage = (0.1 + 0.3 + 0.5) / 3;
            expect(transactionManager.getAveragePrice()).toBeCloseTo(expectedAverage, 10);
        });

        it('should return zero average for no transactions', () => {
            const emptyTransactionManager = new TransactionManager(agentManager, intelligenceManager);
            expect(emptyTransactionManager.getAveragePrice()).toBe(0);
        });

        it('should return all transactions', () => {
            const transactions = transactionManager.getTransactions();
            expect(Array.isArray(transactions)).toBe(true);
            expect(transactions.length).toBe(3);

            // Verify it returns a copy, not the original array
            transactions.push({} as any);
            expect(transactionManager.getTransactions().length).toBe(3);
        });
    });

    describe('Complex Transaction Scenarios', () => {
        it('should handle high-volume transactions', async () => {
            const numTransactions = 100;
            const buyers: string[] = [];

            // Register multiple buyers
            for (let i = 0; i < numTransactions; i++) {
                const buyerKey = `mass-buyer-${i}`;
                buyers.push(buyerKey);
                await agentManager.registerAgent(buyerKey, {
                    name: `Mass Buyer ${i}`,
                    description: 'Mass buyer for testing',
                    specialization: ['testing'],
                    verified: false
                });
            }

            // Perform many transactions
            const startTime = Date.now();
            for (const buyer of buyers) {
                await transactionManager.purchaseIntelligence(buyer, intelligenceId);
            }
            const endTime = Date.now();

            expect(transactionManager.getTransactionCount()).toBe(numTransactions);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

            const seller = agentManager.getAgent(sellerId)!;
            expect(seller.total_sales).toBe(numTransactions);
        });

        it('should handle multiple sellers and buyers', async () => {
            // Register additional sellers and buyers
            const sellers = ['seller1', 'seller2'];
            const buyers = ['buyer1', 'buyer2', 'buyer3'];

            for (const sellerId of sellers) {
                await agentManager.registerAgent(sellerId, {
                    name: `Seller ${sellerId}`,
                    description: `Test seller ${sellerId}`,
                    specialization: ['selling'],
                    verified: true
                });
            }

            for (const buyerId of buyers) {
                await agentManager.registerAgent(buyerId, {
                    name: `Buyer ${buyerId}`,
                    description: `Test buyer ${buyerId}`,
                    specialization: ['buying'],
                    verified: false
                });
            }

            // Create intelligence from each seller
            const intelligenceIds: string[] = [];
            for (let i = 0; i < sellers.length; i++) {
                const intelId = await intelligenceManager.listIntelligence(sellers[i], {
                    title: `Intelligence from ${sellers[i]}`,
                    description: `Test intelligence ${i}`,
                    category: 'market-analysis',
                    price: 0.1 * (i + 1)
                });
                intelligenceIds.push(intelId);
            }

            // Each buyer purchases from each seller
            for (const buyerId of buyers) {
                for (const intelId of intelligenceIds) {
                    await transactionManager.purchaseIntelligence(buyerId, intelId);
                }
            }

            const expectedTransactions = sellers.length * buyers.length;
            expect(transactionManager.getTransactionCount()).toBe(expectedTransactions);

            // Check seller statistics
            for (const sellerId of sellers) {
                const seller = agentManager.getAgent(sellerId)!;
                expect(seller.total_sales).toBe(buyers.length);
            }
        });

        it('should handle rating workflow for multiple transactions', async () => {
            // Create multiple purchases
            const buyers = ['rating-buyer-1', 'rating-buyer-2', 'rating-buyer-3'];
            const ratings = [5, 4, 3];

            for (let i = 0; i < buyers.length; i++) {
                await agentManager.registerAgent(buyers[i], {
                    name: `Rating Buyer ${i + 1}`,
                    description: 'Buyer for rating tests',
                    specialization: ['rating'],
                    verified: false
                });

                await transactionManager.purchaseIntelligence(buyers[i], intelligenceId);
                await transactionManager.rateIntelligence(buyers[i], intelligenceId, ratings[i] as any);
            }

            const intelligence = intelligenceManager.getIntelligence(intelligenceId)!;
            const expectedAverageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            expect(intelligence.rating).toBe(expectedAverageRating);

            const seller = agentManager.getAgent(sellerId)!;
            const expectedReputation = Math.round((expectedAverageRating / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);
            expect(seller.reputation_score).toBe(expectedReputation);
        });
    });

    describe('Data Integrity and Consistency', () => {
        it('should maintain transaction immutability', async () => {
            await transactionManager.purchaseIntelligence(buyerId, intelligenceId);

            const transactions = transactionManager.getTransactions();
            const originalTransaction = { ...transactions[0] };

            // Modify the returned transaction
            transactions[0].price = 999999;

            // Original data should remain unchanged
            const freshTransactions = transactionManager.getTransactions();
            expect(freshTransactions[0].price).toBe(originalTransaction.price);
        });

        it('should handle concurrent purchases gracefully', async () => {
            // Simulate concurrent purchases
            const promises = [
                transactionManager.purchaseIntelligence('concurrent-buyer-1', intelligenceId),
                transactionManager.purchaseIntelligence('concurrent-buyer-2', intelligenceId),
                transactionManager.purchaseIntelligence('concurrent-buyer-3', intelligenceId)
            ];

            // Register buyers first
            await agentManager.registerAgent('concurrent-buyer-1', {
                name: 'Concurrent Buyer 1',
                description: 'Test concurrent buyer',
                specialization: ['concurrent'],
                verified: false
            });
            await agentManager.registerAgent('concurrent-buyer-2', {
                name: 'Concurrent Buyer 2',
                description: 'Test concurrent buyer',
                specialization: ['concurrent'],
                verified: false
            });
            await agentManager.registerAgent('concurrent-buyer-3', {
                name: 'Concurrent Buyer 3',
                description: 'Test concurrent buyer',
                specialization: ['concurrent'],
                verified: false
            });

            const results = await Promise.all(promises);

            // All purchases should succeed
            results.forEach(result => {
                expect(result.success).toBe(true);
            });

            expect(transactionManager.getTransactionCount()).toBe(3);
        });

        it('should preserve transaction ordering', async () => {
            const numTransactions = 10;
            const transactionTimes: number[] = [];

            for (let i = 0; i < numTransactions; i++) {
                const buyerKey = `order-buyer-${i}`;
                await agentManager.registerAgent(buyerKey, {
                    name: `Order Buyer ${i}`,
                    description: 'Buyer for order testing',
                    specialization: ['ordering'],
                    verified: false
                });

                const beforePurchase = Date.now();
                await transactionManager.purchaseIntelligence(buyerKey, intelligenceId);
                transactionTimes.push(beforePurchase);
            }

            const transactions = transactionManager.getTransactions();

            // Check that transaction timestamps are in order
            for (let i = 1; i < transactions.length; i++) {
                expect(transactions[i].timestamp).toBeGreaterThanOrEqual(transactions[i-1].timestamp);
            }
        });
    });
});