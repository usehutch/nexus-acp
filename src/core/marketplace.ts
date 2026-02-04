import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { AgentIntelligence, AgentProfile, IntelligenceTransaction } from '../types/index.js';
import { generateIntelligenceData } from '../utils/sample-data.js';
import { PrivacyLayer } from './privacy-layer.js';
import { AgentMemoryLayer } from './memory-layer.js';
import { TransparencyLayer } from './transparency-layer.js';

export class AgentMarketplace {
    private connection: Connection;
    private agents: Map<string, AgentProfile> = new Map();
    private intelligence: Map<string, AgentIntelligence> = new Map();
    private transactions: IntelligenceTransaction[] = [];

    // Enhanced layers based on community feedback
    private privacyLayer: PrivacyLayer;
    private memoryLayer: AgentMemoryLayer;
    private transparencyLayer: TransparencyLayer;

    constructor(connection: Connection) {
        this.connection = connection;

        // Initialize enhancement layers
        this.privacyLayer = new PrivacyLayer(connection);
        this.memoryLayer = new AgentMemoryLayer(connection);
        this.transparencyLayer = new TransparencyLayer(connection);

        this.loadSampleData();

        console.log(`🚀 NEXUS Enhanced Marketplace initialized with:`);
        console.log(`   🛡️  MEV Protection (Sipher Protocol)`);
        console.log(`   🧠 Agent Memory (AgentMemory Protocol)`);
        console.log(`   🔍 Trade Transparency (SOLPRISM)`);
    }

    // Agent Registration
    async registerAgent(publicKey: string, profile: Omit<AgentProfile, 'public_key' | 'created_at' | 'total_sales' | 'total_earnings' | 'reputation_score'>): Promise<boolean> {
        const agentProfile: AgentProfile = {
            ...profile,
            public_key: publicKey,
            reputation_score: 100, // Starting reputation
            total_sales: 0,
            total_earnings: 0,
            created_at: Date.now()
        };

        this.agents.set(publicKey, agentProfile);
        console.log(`✅ Agent registered: ${profile.name} (${publicKey})`);
        return true;
    }

    // List Intelligence for Sale
    async listIntelligence(sellerKey: string, intelligence: Omit<AgentIntelligence, 'id' | 'seller' | 'created_at' | 'sales_count' | 'rating' | 'quality_score'>): Promise<string> {
        if (!this.agents.has(sellerKey)) {
            throw new Error('Agent must be registered first');
        }

        const id = `intel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Quality score based on seller's reputation
        const seller = this.agents.get(sellerKey)!;
        const quality_score = Math.min(100, seller.reputation_score / 10);

        const fullIntelligence: AgentIntelligence = {
            ...intelligence,
            id,
            seller: sellerKey,
            quality_score,
            created_at: Date.now(),
            sales_count: 0,
            rating: 0
        };

        this.intelligence.set(id, fullIntelligence);
        console.log(`📊 Intelligence listed: ${intelligence.title} for ${intelligence.price} SOL`);
        return id;
    }

    // Purchase Intelligence (Enhanced with Community Feedback)
    async purchaseIntelligence(buyerKey: string, intelligenceId: string): Promise<{success: boolean, data?: any, transparency?: any, privacy?: any}> {
        const intelligence = this.intelligence.get(intelligenceId);
        if (!intelligence) {
            throw new Error('Intelligence not found');
        }

        const seller = this.agents.get(intelligence.seller);
        if (!seller) {
            throw new Error('Seller not found');
        }

        // 1. COMMIT REASONING (SOLPRISM Integration)
        const reasoning = {
            decision: 'buy' as const,
            factors: [
                `Quality score: ${intelligence.quality_score}/100`,
                `Seller reputation: ${seller.reputation_score}/1000`,
                `Price assessment: ${intelligence.price} SOL`,
                `Category relevance: ${intelligence.category}`,
                `Sales history: ${intelligence.sales_count} previous sales`
            ],
            confidence: Math.min(95, intelligence.quality_score + seller.reputation_score / 20),
            expectedValue: intelligence.price * (intelligence.quality_score / 100),
            riskAssessment: intelligence.price > 0.5 ? 'high value purchase' : 'low risk trade',
            methodology: 'NEXUS automated quality assessment with reputation weighting'
        };

        const commitId = await this.transparencyLayer.commitReasoning(buyerKey, intelligenceId, reasoning);

        // 2. SHIELD TRANSACTION (Sipher Integration)
        const privacyResult = await this.privacyLayer.shieldTransaction({
            amount: intelligence.price,
            recipient: intelligence.seller,
            memo: `NEXUS Intelligence: ${intelligence.title}`
        });

        // 3. EXECUTE TRANSACTION
        const transaction: IntelligenceTransaction = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            buyer: buyerKey,
            seller: intelligence.seller,
            intelligence_id: intelligenceId,
            price: intelligence.price,
            timestamp: Date.now(),
            privacy_tx_id: privacyResult.transactionId,
            transparency_commit_id: commitId
        };

        // 4. UPDATE STATISTICS
        intelligence.sales_count++;
        seller.total_sales++;
        seller.total_earnings += intelligence.price;

        this.transactions.push(transaction);

        // 5. STORE IN AGENT MEMORY (AgentMemory Protocol Integration)
        await this.memoryLayer.recordPurchase(transaction, intelligence);

        // 6. REVEAL REASONING (SOLPRISM Integration)
        await this.transparencyLayer.revealReasoning(commitId, reasoning, transaction.id);

        // 7. RETURN INTELLIGENCE DATA
        const intelligenceData = generateIntelligenceData(intelligence.category);

        console.log(`💰 Enhanced Purchase Completed:`);
        console.log(`   🛡️  Privacy: Transaction shielded via ${privacyResult.stealthAddress?.substr(0, 8)}...`);
        console.log(`   🧠 Memory: Purchase recorded for future recommendations`);
        console.log(`   🔍 Transparency: Reasoning committed and revealed`);
        console.log(`   📦 Data: Intelligence delivered to buyer`);

        return {
            success: true,
            data: intelligenceData,
            transparency: { commitId, reasoning },
            privacy: privacyResult
        };
    }

    // Rate Intelligence After Purchase
    async rateIntelligence(buyerKey: string, intelligenceId: string, rating: number, review?: string): Promise<void> {
        if (rating < 1 || rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

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
        const intelligence = this.intelligence.get(intelligenceId)!;
        const allRatings = this.transactions
            .filter(tx => tx.intelligence_id === intelligenceId && tx.rating)
            .map(tx => tx.rating!);

        intelligence.rating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

        // Update seller reputation
        const seller = this.agents.get(intelligence.seller)!;
        const sellerRatings = this.transactions
            .filter(tx => tx.seller === intelligence.seller && tx.rating)
            .map(tx => tx.rating!);

        if (sellerRatings.length > 0) {
            const avgRating = sellerRatings.reduce((a, b) => a + b, 0) / sellerRatings.length;
            seller.reputation_score = Math.round((avgRating / 5) * 1000);
        }

        console.log(`⭐ Intelligence rated: ${rating}/5 stars`);
    }

    // Discovery and Search
    searchIntelligence(filters: {
        category?: string;
        maxPrice?: number;
        minQuality?: number;
        seller?: string;
    } = {}): AgentIntelligence[] {
        let results = Array.from(this.intelligence.values());

        if (filters.category) {
            results = results.filter(intel => intel.category === filters.category);
        }

        if (filters.maxPrice !== undefined) {
            results = results.filter(intel => intel.price <= filters.maxPrice!);
        }

        if (filters.minQuality !== undefined) {
            results = results.filter(intel => intel.quality_score >= filters.minQuality!);
        }

        if (filters.seller) {
            results = results.filter(intel => intel.seller === filters.seller);
        }

        // Sort by quality score and recency
        return results.sort((a, b) => {
            const scoreA = a.quality_score * 0.7 + (Date.now() - a.created_at) / 86400000 * 0.3;
            const scoreB = b.quality_score * 0.7 + (Date.now() - b.created_at) / 86400000 * 0.3;
            return scoreB - scoreA;
        });
    }

    // Get Agent Rankings
    getTopAgents(limit: number = 10): AgentProfile[] {
        return Array.from(this.agents.values())
            .sort((a, b) => b.reputation_score - a.reputation_score)
            .slice(0, limit);
    }

    // Market Statistics (Enhanced)
    getMarketStats() {
        const totalIntelligence = this.intelligence.size;
        const totalAgents = this.agents.size;
        const totalTransactions = this.transactions.length;
        const totalVolume = this.transactions.reduce((sum, tx) => sum + tx.price, 0);

        const categories = Array.from(this.intelligence.values()).reduce((acc, intel) => {
            acc[intel.category] = (acc[intel.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Enhanced stats with new layers
        const privacyStats = this.privacyLayer.getPrivacyStatus();
        const memoryStats = this.memoryLayer.getMemoryStatus();
        const transparencyStats = this.transparencyLayer.getTransparencyStats();

        return {
            totalIntelligence,
            totalAgents,
            totalTransactions,
            totalVolume,
            avgPrice: totalTransactions > 0 ? totalVolume / totalTransactions : 0,
            categories,
            enhancements: {
                privacy: privacyStats,
                memory: memoryStats,
                transparency: {
                    ...transparencyStats,
                    rate: transparencyStats.transparency_rate
                }
            }
        };
    }

    // ENHANCED METHODS BASED ON COMMUNITY FEEDBACK

    /**
     * Get agent recommendations based on memory analysis (AgentMemory Protocol)
     */
    async getAgentRecommendations(agentId: string, category?: string): Promise<{
        recommended: string[];
        patterns: any;
        insights: string[];
    }> {
        const recommendations = await this.memoryLayer.getRecommendations(agentId, category);
        const patterns = await this.memoryLayer.analyzePatterns(agentId);

        return {
            recommended: recommendations.recommended,
            patterns,
            insights: patterns.insights
        };
    }

    /**
     * Audit agent transparency and decision-making (SOLPRISM Integration)
     */
    async auditAgentTransparency(agentId: string): Promise<{
        transparency_score: number;
        audit_report: string[];
        decision_patterns: any;
    }> {
        const audit = await this.transparencyLayer.auditAgent(agentId);
        return {
            transparency_score: audit.transparency_score,
            audit_report: audit.audit_report,
            decision_patterns: audit.decision_patterns
        };
    }

    /**
     * Get comprehensive agent analytics (All Layers)
     */
    async getAgentAnalytics(agentId: string): Promise<{
        memory: any;
        transparency: any;
        reputation: any;
        trading_profile: any;
    }> {
        const memoryProfile = await this.memoryLayer.getAgentProfile(agentId);
        const transparencyAudit = await this.transparencyLayer.auditAgent(agentId);
        const agent = this.agents.get(agentId);

        const agentTransactions = this.transactions.filter(tx =>
            tx.buyer === agentId || tx.seller === agentId
        );

        return {
            memory: memoryProfile,
            transparency: transparencyAudit,
            reputation: {
                score: agent?.reputation_score || 0,
                total_sales: agent?.total_sales || 0,
                total_earnings: agent?.total_earnings || 0
            },
            trading_profile: {
                total_transactions: agentTransactions.length,
                avg_transaction_size: agentTransactions.length > 0 ?
                    agentTransactions.reduce((sum, tx) => sum + tx.price, 0) / agentTransactions.length : 0,
                categories_active: [...new Set(agentTransactions.map(tx =>
                    this.intelligence.get(tx.intelligence_id)?.category
                ).filter(Boolean))]
            }
        };
    }

    /**
     * Verify transaction integrity across all layers
     */
    async verifyTransaction(transactionId: string): Promise<{
        verified: boolean;
        privacy_check: any;
        transparency_check: any;
        memory_record: any;
    }> {
        const transaction = this.transactions.find(tx => tx.id === transactionId);
        if (!transaction) {
            return {
                verified: false,
                privacy_check: { error: 'Transaction not found' },
                transparency_check: { error: 'Transaction not found' },
                memory_record: { error: 'Transaction not found' }
            };
        }

        const privacy_check = transaction.privacy_tx_id ?
            await this.privacyLayer.verifyShielding(transaction.privacy_tx_id) : false;

        const transparency_check = transaction.transparency_commit_id ?
            await this.transparencyLayer.verifyTransaction(transaction.transparency_commit_id) :
            { verified: false, error: 'No transparency commit' };

        const memory_record = await this.memoryLayer.searchMemories({
            agentId: transaction.buyer,
            type: 'purchase'
        });

        return {
            verified: privacy_check && transparency_check.verified,
            privacy_check: { shielded: privacy_check },
            transparency_check,
            memory_record: memory_record.find(record =>
                record.content.transaction?.id === transactionId
            )
        };
    }

    // Load sample data for demo
    private loadSampleData() {
        // Sample agents
        this.registerAgent('11111111111111111111111111111111', {
            name: 'AlphaTrader AI',
            description: 'Specialized in DeFi yield strategies and market analysis',
            specialization: ['defi-strategy', 'market-analysis'],
            verified: true
        });

        this.registerAgent('22222222222222222222222222222222', {
            name: 'CryptoOracle',
            description: 'Advanced price prediction using ML models',
            specialization: ['price-prediction', 'trend-analysis'],
            verified: true
        });

        // Sample intelligence listings
        this.listIntelligence('11111111111111111111111111111111', {
            title: 'SOL Bull Market Strategy',
            description: 'Optimized DeFi yield farming strategy for SOL ecosystem',
            category: 'defi-strategy',
            price: 0.5
        });

        this.listIntelligence('22222222222222222222222222222222', {
            title: 'SOL 7-Day Price Prediction',
            description: 'ML-based price prediction with 78% historical accuracy',
            category: 'price-prediction',
            price: 0.1
        });
    }
}