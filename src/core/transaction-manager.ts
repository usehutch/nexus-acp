import type { IntelligenceTransaction, PurchaseResult, Rating, TransactionId, AgentPublicKey, IntelligenceId } from '../types/index.js';
import { CONFIG } from '../config/index.js';
import type { AgentManager } from './agent-manager.js';
import type { IntelligenceManager } from './intelligence-manager.js';

export class TransactionManager {
    private transactions: IntelligenceTransaction[] = [];
    private agentManager: AgentManager;
    private intelligenceManager: IntelligenceManager;

    constructor(agentManager: AgentManager, intelligenceManager: IntelligenceManager) {
        this.agentManager = agentManager;
        this.intelligenceManager = intelligenceManager;
    }

    async purchaseIntelligence(buyerKey: AgentPublicKey, intelligenceId: IntelligenceId): Promise<PurchaseResult> {
        const intelligence = this.intelligenceManager.getIntelligence(intelligenceId);
        if (!intelligence) {
            throw new Error('Intelligence not found');
        }

        const seller = this.agentManager.getAgent(intelligence.seller);
        if (!seller) {
            throw new Error('Seller not found');
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

        // Update statistics
        this.intelligenceManager.incrementSalesCount(intelligenceId);
        this.agentManager.updateAgentStats(intelligence.seller, intelligence.price);

        this.transactions.push(transaction);

        // Return the intelligence data
        const intelligenceData = this.intelligenceManager.generateSampleData(intelligence);

        console.log(`💰 Purchase completed: ${buyerKey.substr(0, 8)}... bought "${intelligence.title}" for ${intelligence.price} SOL`);
        return { success: true, data: intelligenceData };
    }

    async rateIntelligence(buyerKey: AgentPublicKey, intelligenceId: IntelligenceId, rating: Rating, review?: string): Promise<void> {

        // Find the transaction
        const transaction = this.transactions.find(tx =>
            tx.buyer === buyerKey && tx.intelligence_id === intelligenceId && !tx.rating
        );

        if (!transaction) {
            throw new Error('Transaction not found or already rated');
        }

        transaction.rating = rating;
        transaction.review = review;

        // Update intelligence rating
        this.intelligenceManager.updateIntelligenceRating(intelligenceId, this.transactions);

        // Update agent reputation
        this.agentManager.updateAgentReputation(this.transactions);

        console.log(`⭐ Intelligence rated: ${rating}/${CONFIG.MARKETPLACE.MAX_RATING} stars`);
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
}