import type { IntelligenceTransaction, PurchaseResult, Rating, TransactionId, AgentPublicKey, IntelligenceId } from '../types/index.js';
import { CONFIG } from '../config/index.js';
import type { AgentManager } from './agent-manager.js';
import type { IntelligenceManager } from './intelligence-manager.js';
import { errorHandler, ErrorCode, NexusError, withRetry } from '../../error-handler.js';

export class TransactionManager {
    private transactions: IntelligenceTransaction[] = [];
    private agentManager: AgentManager;
    private intelligenceManager: IntelligenceManager;

    constructor(agentManager: AgentManager, intelligenceManager: IntelligenceManager) {
        this.agentManager = agentManager;
        this.intelligenceManager = intelligenceManager;
    }

    async purchaseIntelligence(buyerKey: AgentPublicKey, intelligenceId: IntelligenceId): Promise<PurchaseResult> {
        try {
            // Validate inputs
            errorHandler.validateRequired(
                { buyerKey, intelligenceId },
                ['buyerKey', 'intelligenceId'],
                'intelligence purchase'
            );

            // Check if buyer exists
            if (!this.agentManager.hasAgent(buyerKey)) {
                throw new NexusError(
                    ErrorCode.AGENT_NOT_REGISTERED,
                    'Buyer must be registered as an agent first',
                    { buyerKey }
                );
            }

            const intelligence = this.intelligenceManager.getIntelligence(intelligenceId);
            if (!intelligence) {
                throw new NexusError(
                    ErrorCode.INTELLIGENCE_NOT_FOUND,
                    'Intelligence listing not found',
                    { intelligenceId }
                );
            }

            // Prevent self-purchase
            if (intelligence.seller === buyerKey) {
                throw new NexusError(
                    ErrorCode.INVALID_TRANSACTION,
                    'Cannot purchase your own intelligence',
                    { buyerKey, intelligenceId }
                );
            }

            const seller = this.agentManager.getAgent(intelligence.seller);
            if (!seller) {
                throw new NexusError(
                    ErrorCode.AGENT_NOT_REGISTERED,
                    'Seller agent not found',
                    { sellerKey: intelligence.seller, intelligenceId }
                );
            }

            // Validate price
            if (intelligence.price <= 0) {
                throw new NexusError(
                    ErrorCode.INVALID_TRANSACTION,
                    'Invalid intelligence price',
                    { price: intelligence.price, intelligenceId }
                );
            }

            // Create transaction record
            const transaction: IntelligenceTransaction = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                buyer: buyerKey,
                seller: intelligence.seller,
                intelligence_id: intelligenceId,
                price: intelligence.price,
                timestamp: Date.now()
            };

            // Execute transaction with retry mechanism for critical operations
            await withRetry(
                async () => {
                    // Update statistics
                    this.intelligenceManager.incrementSalesCount(intelligenceId);
                    this.agentManager.updateAgentStats(intelligence.seller, intelligence.price);
                    this.transactions.push(transaction);
                },
                'transaction execution',
                { maxRetries: 2, baseDelay: 500 }
            );

            // Generate and return intelligence data
            const intelligenceData = await withRetry(
                () => Promise.resolve(this.intelligenceManager.generateSampleData(intelligence)),
                'intelligence data generation'
            );

            console.log(`💰 Purchase completed: ${buyerKey.substr(0, 8)}... bought "${intelligence.title}" for ${intelligence.price} SOL`);
            return { success: true, data: intelligenceData };
        } catch (error) {
            if (error instanceof NexusError) {
                throw error;
            }

            const nexusError = errorHandler.normalizeError(error, 'intelligence purchase');
            errorHandler.logError(nexusError, 'TransactionManager.purchaseIntelligence');
            throw nexusError;
        }
    }

    async rateIntelligence(buyerKey: AgentPublicKey, intelligenceId: IntelligenceId, rating: Rating, review?: string): Promise<void> {
        try {
            // Validate inputs
            errorHandler.validateRequired(
                { buyerKey, intelligenceId, rating },
                ['buyerKey', 'intelligenceId', 'rating'],
                'intelligence rating'
            );

            errorHandler.validateRange(
                rating,
                1,
                CONFIG.MARKETPLACE.MAX_RATING,
                'rating',
                'intelligence rating'
            );

            if (review && review.length > 500) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Review cannot exceed 500 characters',
                    { reviewLength: review.length }
                );
            }

            // Find the transaction
            const transaction = this.transactions.find(tx =>
                tx.buyer === buyerKey && tx.intelligence_id === intelligenceId && !tx.rating
            );

            if (!transaction) {
                throw new NexusError(
                    ErrorCode.INVALID_TRANSACTION,
                    'Transaction not found or already rated',
                    { buyerKey, intelligenceId }
                );
            }

            // Ensure buyer owns this transaction
            if (transaction.buyer !== buyerKey) {
                throw new NexusError(
                    ErrorCode.UNAUTHORIZED,
                    'Only the buyer can rate this intelligence',
                    { buyerKey, transactionBuyer: transaction.buyer }
                );
            }

            // Update rating with retry mechanism
            await withRetry(
                async () => {
                    transaction.rating = rating;
                    transaction.review = review;

                    // Update intelligence rating
                    this.intelligenceManager.updateIntelligenceRating(intelligenceId, this.transactions);

                    // Update agent reputation
                    this.agentManager.updateAgentReputation(this.transactions);
                },
                'rating update',
                { maxRetries: 1 }
            );

            console.log(`⭐ Intelligence rated: ${rating}/${CONFIG.MARKETPLACE.MAX_RATING} stars`);
        } catch (error) {
            if (error instanceof NexusError) {
                throw error;
            }

            const nexusError = errorHandler.normalizeError(error, 'intelligence rating');
            errorHandler.logError(nexusError, 'TransactionManager.rateIntelligence');
            throw nexusError;
        }
    }

    getTransactions(): IntelligenceTransaction[] {
        return this.transactions.map(tx => ({ ...tx }));
    }

    getTransactionCount(): number {
        return this.transactions.length;
    }

    getTotalVolume(): number {
        return this.transactions.reduce((sum, tx) => sum + tx.price, 0);
    }

    getAveragePrice(): number {
        const count = this.transactions.length;
        return count > 0 ? this.getTotalVolume() / count : 0;
    }

    getAgentTransactions(agentKey: string): IntelligenceTransaction[] {
        return this.transactions.filter(tx => tx.buyer === agentKey || tx.seller === agentKey);
    }
}