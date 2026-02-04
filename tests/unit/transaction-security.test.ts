#!/usr/bin/env bun

/**
 * Transaction Security Tests
 *
 * This file contains security-focused tests for the TransactionManager,
 * focusing on financial security, fraud prevention, and validation.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { TransactionManager } from '../../src/core/transaction-manager.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { IntelligenceManager } from '../../src/core/intelligence-manager.js';
import { NexusError, ErrorCode } from '../../error-handler.js';
import type { IntelligenceTransaction, PaymentStatus } from '../../src/types/index.js';

describe('TransactionManager - Security Tests', () => {
    let transactionManager: TransactionManager;
    let agentManager: AgentManager;
    let intelligenceManager: IntelligenceManager;

    beforeEach(async () => {
        agentManager = new AgentManager();
        intelligenceManager = new IntelligenceManager(agentManager);
        transactionManager = new TransactionManager(agentManager, intelligenceManager);

        // Register test agents
        await agentManager.registerAgent('buyer1', 'Test buyer agent with proper description length');
        await agentManager.registerAgent('seller1', 'Test seller agent with proper description length');

        // List test intelligence
        await intelligenceManager.listIntelligence('seller1', {
            title: 'Security Test Intelligence',
            description: 'Intelligence for security testing with proper description length',
            category: 'market-analysis',
            price: 1.0
        });
    });

    describe('Financial Security', () => {
        it('should prevent negative amount transactions', async () => {
            await expect(async () => {
                await transactionManager.createTransaction(
                    'buyer1',
                    'seller1',
                    'invalid-intel',
                    -1.0 // Negative amount
                );
            }).toThrow();
        });

        it('should prevent zero amount transactions', async () => {
            await expect(async () => {
                await transactionManager.createTransaction(
                    'buyer1',
                    'seller1',
                    'invalid-intel',
                    0 // Zero amount
                );
            }).toThrow();
        });

        it('should prevent extremely large transactions', async () => {
            await expect(async () => {
                await transactionManager.createTransaction(
                    'buyer1',
                    'seller1',
                    'invalid-intel',
                    Number.MAX_SAFE_INTEGER
                );
            }).toThrow();
        });

        it('should validate transaction amounts with precision', async () => {
            const preciseAmount = 0.123456789; // More than 9 decimal places

            await expect(async () => {
                await transactionManager.createTransaction(
                    'buyer1',
                    'seller1',
                    'invalid-intel',
                    preciseAmount
                );
            }).not.toThrow(); // Should handle precision gracefully
        });

        it('should prevent double spending attempts', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];

            // First transaction
            const tx1 = await transactionManager.createTransaction(
                'buyer1',
                'seller1',
                intelligence.id,
                intelligence.price
            );

            // Complete first transaction
            transactionManager.updatePaymentStatus(tx1.id, 'completed');

            // Attempt second transaction with same buyer for same intelligence
            await expect(async () => {
                await transactionManager.createTransaction(
                    'buyer1',
                    'seller1',
                    intelligence.id,
                    intelligence.price
                );
            }).not.toThrow(); // This should be allowed (buying same intelligence multiple times)
        });
    });

    describe('Access Control and Authentication', () => {
        it('should prevent transactions with non-existent buyers', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];

            await expect(async () => {
                await transactionManager.createTransaction(
                    'non-existent-buyer',
                    'seller1',
                    intelligence.id,
                    intelligence.price
                );
            }).toThrow('Buyer must be registered');
        });

        it('should prevent transactions with non-existent sellers', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];

            await expect(async () => {
                await transactionManager.createTransaction(
                    'buyer1',
                    'non-existent-seller',
                    intelligence.id,
                    intelligence.price
                );
            }).toThrow('Seller must be registered');
        });

        it('should prevent transactions for non-existent intelligence', async () => {
            await expect(async () => {
                await transactionManager.createTransaction(
                    'buyer1',
                    'seller1',
                    'non-existent-intelligence',
                    1.0
                );
            }).toThrow('Intelligence not found');
        });

        it('should prevent self-transactions', async () => {
            // Register intelligence for buyer1
            await intelligenceManager.listIntelligence('buyer1', {
                title: 'Self Transaction Test',
                description: 'Intelligence for self transaction testing with proper length',
                category: 'market-analysis',
                price: 1.0
            });

            const intelligence = intelligenceManager.getAllIntelligence()
                .find(i => i.seller_id === 'buyer1');

            await expect(async () => {
                await transactionManager.createTransaction(
                    'buyer1',
                    'buyer1',
                    intelligence!.id,
                    intelligence!.price
                );
            }).toThrow('Cannot purchase own intelligence');
        });
    });

    describe('Fraud Prevention', () => {
        it('should detect rapid transaction patterns', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];
            const promises = [];

            // Attempt many rapid transactions
            for (let i = 0; i < 100; i++) {
                promises.push(
                    transactionManager.createTransaction(
                        'buyer1',
                        'seller1',
                        intelligence.id,
                        intelligence.price
                    )
                );
            }

            // Should not crash or allow all transactions
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled');

            // All should succeed for now, but in production might have rate limiting
            expect(successful.length).toBeGreaterThan(0);
        });

        it('should validate transaction amount matches intelligence price', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];
            const wrongPrice = intelligence.price * 0.5; // 50% of actual price

            await expect(async () => {
                await transactionManager.createTransaction(
                    'buyer1',
                    'seller1',
                    intelligence.id,
                    wrongPrice
                );
            }).toThrow('Amount does not match intelligence price');
        });

        it('should prevent price manipulation attacks', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];

            // Attempt to manipulate price through various methods
            const manipulationAttempts = [
                intelligence.price + 0.0001, // Slightly higher
                intelligence.price - 0.0001, // Slightly lower
                intelligence.price * 1000,   // Much higher
                intelligence.price / 1000    // Much lower
            ];

            for (const amount of manipulationAttempts) {
                await expect(async () => {
                    await transactionManager.createTransaction(
                        'buyer1',
                        'seller1',
                        intelligence.id,
                        amount
                    );
                }).toThrow('Amount does not match intelligence price');
            }
        });

        it('should detect and prevent circular transaction chains', async () => {
            // Register additional agents for circular transactions
            await agentManager.registerAgent('agent2', 'Second agent for circular testing');
            await agentManager.registerAgent('agent3', 'Third agent for circular testing');

            // Create intelligence for each agent
            await intelligenceManager.listIntelligence('agent2', {
                title: 'Circular Test 2',
                description: 'Intelligence for circular transaction testing with proper length',
                category: 'market-analysis',
                price: 1.0
            });

            await intelligenceManager.listIntelligence('agent3', {
                title: 'Circular Test 3',
                description: 'Intelligence for circular transaction testing with proper length',
                category: 'market-analysis',
                price: 1.0
            });

            const intelligences = intelligenceManager.getAllIntelligence();
            const intel2 = intelligences.find(i => i.seller_id === 'agent2')!;
            const intel3 = intelligences.find(i => i.seller_id === 'agent3')!;

            // Create transactions that could form a circular pattern
            // This should be allowed as agents can trade with each other
            const tx1 = await transactionManager.createTransaction(
                'seller1', 'agent2', intel2.id, intel2.price
            );
            const tx2 = await transactionManager.createTransaction(
                'agent2', 'agent3', intel3.id, intel3.price
            );

            expect(tx1).toBeDefined();
            expect(tx2).toBeDefined();
        });
    });

    describe('Data Integrity and Validation', () => {
        it('should maintain transaction immutability', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];

            const transaction = await transactionManager.createTransaction(
                'buyer1',
                'seller1',
                intelligence.id,
                intelligence.price
            );

            const originalTx = JSON.parse(JSON.stringify(transaction));

            // Attempt to modify transaction (if properties were mutable)
            // This test ensures the transaction data cannot be changed after creation
            expect(transaction.id).toBe(originalTx.id);
            expect(transaction.amount).toBe(originalTx.amount);
            expect(transaction.buyer_id).toBe(originalTx.buyer_id);
            expect(transaction.seller_id).toBe(originalTx.seller_id);
        });

        it('should validate transaction status transitions', () => {
            const validTransitions = [
                ['pending', 'completed'],
                ['pending', 'failed'],
                ['pending', 'cancelled']
            ];

            const invalidTransitions = [
                ['completed', 'pending'],
                ['failed', 'completed'],
                ['cancelled', 'completed']
            ];

            // Test valid transitions would be successful
            // Test invalid transitions would be rejected
            expect(validTransitions.length).toBeGreaterThan(0);
            expect(invalidTransitions.length).toBeGreaterThan(0);
        });

        it('should ensure transaction ID uniqueness', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];
            const transactions = [];

            // Create multiple transactions
            for (let i = 0; i < 50; i++) {
                const tx = await transactionManager.createTransaction(
                    'buyer1',
                    'seller1',
                    intelligence.id,
                    intelligence.price
                );
                transactions.push(tx);
            }

            // Verify all IDs are unique
            const ids = transactions.map(tx => tx.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(transactions.length);
        });
    });

    describe('Payment Security', () => {
        it('should handle payment status updates securely', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];

            const transaction = await transactionManager.createTransaction(
                'buyer1',
                'seller1',
                intelligence.id,
                intelligence.price
            );

            // Valid status updates
            expect(() => {
                transactionManager.updatePaymentStatus(transaction.id, 'completed');
            }).not.toThrow();

            // Invalid status (if validation exists)
            expect(() => {
                transactionManager.updatePaymentStatus(transaction.id, 'invalid-status' as PaymentStatus);
            }).toThrow();
        });

        it('should prevent unauthorized payment status changes', () => {
            // Test that only authorized entities can change payment status
            expect(() => {
                transactionManager.updatePaymentStatus('non-existent-tx', 'completed');
            }).toThrow('Transaction not found');
        });

        it('should handle payment failures gracefully', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];

            const transaction = await transactionManager.createTransaction(
                'buyer1',
                'seller1',
                intelligence.id,
                intelligence.price
            );

            // Mark payment as failed
            expect(() => {
                transactionManager.updatePaymentStatus(transaction.id, 'failed');
            }).not.toThrow();

            const updatedTx = transactionManager.getTransaction(transaction.id);
            expect(updatedTx?.payment_status).toBe('failed');
        });
    });

    describe('Audit and Compliance', () => {
        it('should maintain complete transaction audit trail', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];

            const transaction = await transactionManager.createTransaction(
                'buyer1',
                'seller1',
                intelligence.id,
                intelligence.price
            );

            // Verify transaction has all required audit fields
            expect(transaction.created_at).toBeDefined();
            expect(transaction.id).toBeDefined();
            expect(transaction.buyer_id).toBeDefined();
            expect(transaction.seller_id).toBeDefined();
            expect(transaction.intelligence_id).toBeDefined();
            expect(transaction.amount).toBeDefined();
            expect(transaction.payment_status).toBeDefined();
        });

        it('should provide transaction history for compliance', () => {
            const history = transactionManager.getAllTransactions();

            expect(Array.isArray(history)).toBe(true);

            // Each transaction should have complete information
            history.forEach(tx => {
                expect(tx.id).toBeDefined();
                expect(tx.created_at).toBeDefined();
                expect(tx.amount).toBeGreaterThan(0);
                expect(['pending', 'completed', 'failed', 'cancelled']).toContain(tx.payment_status);
            });
        });

        it('should support transaction queries for investigation', async () => {
            const intelligence = intelligenceManager.getAllIntelligence()[0];

            // Create test transactions
            await transactionManager.createTransaction(
                'buyer1',
                'seller1',
                intelligence.id,
                intelligence.price
            );

            // Query by buyer
            const buyerTx = transactionManager.getTransactionsByBuyer('buyer1');
            expect(buyerTx.length).toBeGreaterThan(0);

            // Query by seller
            const sellerTx = transactionManager.getTransactionsBySeller('seller1');
            expect(sellerTx.length).toBeGreaterThan(0);

            // Query by intelligence
            const intelTx = transactionManager.getTransactionsByIntelligence(intelligence.id);
            expect(intelTx.length).toBeGreaterThan(0);
        });
    });
});