import type { Connection } from '@solana/web3.js';
import type { AgentProfile, AgentIntelligence, SearchFilters, MarketStats, PurchaseResult, Rating, RecommendationRequest, PersonalizedRecommendation } from './types/index.js';
import { AgentManager } from './core/agent-manager.js';
import { IntelligenceManager } from './core/intelligence-manager.js';
import { TransactionManager } from './core/transaction-manager.js';
import { RecommendationManager } from './core/recommendation-manager.js';
import { SAMPLE_AGENTS, SAMPLE_INTELLIGENCE } from './utils/sample-data.js';

export class AgentMarketplace {
    private connection: Connection;
    private agentManager: AgentManager;
    private intelligenceManager: IntelligenceManager;
    private transactionManager: TransactionManager;
    private recommendationManager: RecommendationManager;

    constructor(connection: Connection) {
        this.connection = connection;
        this.agentManager = new AgentManager();
        this.intelligenceManager = new IntelligenceManager(this.agentManager);
        this.transactionManager = new TransactionManager(this.agentManager, this.intelligenceManager);
        this.recommendationManager = new RecommendationManager(this.agentManager, this.intelligenceManager, this.transactionManager);
        this.loadSampleData();
    }

    // Agent Management
    async registerAgent(
        publicKey: string,
        profile: Omit<AgentProfile, 'public_key' | 'created_at' | 'total_sales' | 'total_earnings' | 'reputation_score'>
    ): Promise<boolean> {
        return this.agentManager.registerAgent(publicKey, profile);
    }

    getTopAgents(limit: number = 10): AgentProfile[] {
        return this.agentManager.getTopAgents(limit);
    }

    // Intelligence Management
    async listIntelligence(
        sellerKey: string,
        intelligence: Omit<AgentIntelligence, 'id' | 'seller' | 'created_at' | 'sales_count' | 'rating' | 'quality_score'>
    ): Promise<string> {
        return this.intelligenceManager.listIntelligence(sellerKey, intelligence);
    }

    searchIntelligence(filters: SearchFilters = {}): AgentIntelligence[] {
        return this.intelligenceManager.searchIntelligence(filters);
    }

    // Transaction Management
    async purchaseIntelligence(buyerKey: string, intelligenceId: string): Promise<PurchaseResult> {
        return this.transactionManager.purchaseIntelligence(buyerKey, intelligenceId);
    }

    async rateIntelligence(buyerKey: string, intelligenceId: string, rating: number, review?: string): Promise<void> {
        return this.transactionManager.rateIntelligence(buyerKey, intelligenceId, rating as Rating, review);
    }

    // Statistics
    getMarketStats(): MarketStats {
        return {
            totalIntelligence: this.intelligenceManager.getIntelligenceCount(),
            totalAgents: this.agentManager.getAgentCount(),
            totalTransactions: this.transactionManager.getTransactionCount(),
            totalVolume: this.transactionManager.getTotalVolume(),
            avgPrice: this.transactionManager.getAveragePrice(),
            categories: this.intelligenceManager.getCategoryCounts()
        };
    }

    // Recommendation Engine - NEW FEATURE
    getPersonalizedRecommendations(request: RecommendationRequest): PersonalizedRecommendation[] {
        return this.recommendationManager.getPersonalizedRecommendations(request);
    }

    getTrendingIntelligence(limit: number = 5): AgentIntelligence[] {
        return this.recommendationManager.getTrendingIntelligence(limit);
    }

    getSimilarAgentRecommendations(agentKey: string, limit: number = 5): AgentIntelligence[] {
        return this.recommendationManager.getSimilarAgentRecommendations(agentKey, limit);
    }

    // Quick recommendation for an agent based on their profile
    getQuickRecommendations(agentKey: string, count: number = 5): PersonalizedRecommendation[] {
        return this.getPersonalizedRecommendations({
            agentKey,
            count,
            excludeOwned: true,
            minQuality: 50 // Only recommend quality intelligence
        });
    }

    // Load sample data for demo
    private loadSampleData(): void {
        // Load sample agents
        for (const { publicKey, profile } of SAMPLE_AGENTS) {
            this.agentManager.registerAgent(publicKey, profile);
        }

        // Load sample intelligence
        for (const { sellerKey, intelligence } of SAMPLE_INTELLIGENCE) {
            this.intelligenceManager.listIntelligence(sellerKey, intelligence);
        }
    }
}