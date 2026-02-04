import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { NexusError, ErrorCode, errorHandler, validateRequired } from './error-handler';
import { PrivacyLayer, PrivateMarketplaceUtils } from './privacy-layer';
import { AgentMemoryLayer } from './memory-layer';
import { TransparencyLayer, ReasoningData } from './transparency-layer';

// Integration interfaces for external platforms
export interface AgentPayStream {
    id: string;
    serviceId: string;
    payer: string;
    recipient: string;
    ratePerCall: number;
    totalDeposited: number;
    totalUsed: number;
    isActive: boolean;
    createdAt: number;
}

export interface BountyIntegration {
    bountyId: string;
    requiredCapability: string;
    reward: number;
    deadline: number;
    agentResponses: string[];
}

export interface IntelligenceSubscription {
    id: string;
    subscriber: string;
    provider: string;
    category: string;
    streamId: string; // AgentPay stream ID
    pricePerQuery: number;
    monthlyLimit: number;
    queriesUsed: number;
    isActive: boolean;
    startDate: number;
    nextBillingDate: number;
}

// Types for our marketplace
export interface AgentIntelligence {
    id: string;
    seller: string; // Agent's public key
    title: string;
    description: string;
    category: 'market-analysis' | 'defi-strategy' | 'price-prediction' | 'risk-assessment' | 'trend-analysis';
    price: number; // In SOL
    quality_score: number; // 0-100 reputation based
    created_at: number;
    sales_count: number;
    rating: number; // Average rating from buyers
}

export interface AgentProfile {
    public_key: string;
    name: string;
    description: string;
    specialization: string[];
    reputation_score: number; // 0-1000
    total_sales: number;
    total_earnings: number; // In SOL
    verified: boolean;
    created_at: number;
}

export interface IntelligenceTransaction {
    id: string;
    buyer: string;
    seller: string;
    intelligence_id: string;
    price: number;
    timestamp: number;
    rating?: number; // 1-5 stars
    review?: string;
}

export interface MarketSearchFilters {
    category?: string;
    maxPrice?: number;
    minQuality?: number;
    seller?: string;
}

export interface MarketStats {
    totalIntelligence: number;
    totalAgents: number;
    totalTransactions: number;
    totalVolume: number;
    avgPrice: number;
    categories: Record<string, number>;
}

export interface PurchaseResult {
    success: boolean;
    data?: any;
}

export class AgentMarketplace {
    private connection: Connection;
    private agents: Map<string, AgentProfile> = new Map();
    private intelligence: Map<string, AgentIntelligence> = new Map();
    private transactions: IntelligenceTransaction[] = [];

    // Enhanced layers for security, memory, and transparency
    private privacyLayer: PrivacyLayer;
    private memoryLayer: AgentMemoryLayer;
    private transparencyLayer: TransparencyLayer;

    // Integration layers
    private agentPayStreams: Map<string, AgentPayStream> = new Map();
    private subscriptions: Map<string, IntelligenceSubscription> = new Map();
    private bountyIntegrations: Map<string, BountyIntegration> = new Map();

    constructor(connection: Connection, options?: {
        enablePrivacy?: boolean;
        enableMemory?: boolean;
        enableTransparency?: boolean;
    }) {
        this.connection = connection;

        // Initialize enhanced layers
        this.privacyLayer = new PrivacyLayer(connection);
        this.memoryLayer = new AgentMemoryLayer(connection);
        this.transparencyLayer = new TransparencyLayer(connection);

        console.log('🚀 NEXUS Enhanced Marketplace initialized with:');
        console.log('   🛡️  Privacy Layer (Sipher integration)');
        console.log('   🧠 Memory Layer (AgentMemory integration)');
        console.log('   🔍 Transparency Layer (SOLPRISM integration)');

        this.loadSampleData();
    }

    // Agent Registration
    async registerAgent(publicKey: string, profile: Omit<AgentProfile, 'public_key' | 'created_at' | 'total_sales' | 'total_earnings' | 'reputation_score'>): Promise<boolean> {
        return errorHandler.withErrorHandling(async () => {
            // Validate required fields
            validateRequired({ publicKey, name: profile.name, description: profile.description },
                ['publicKey', 'name', 'description'], 'registerAgent');

            // Validate public key format (basic validation)
            if (typeof publicKey !== 'string' || publicKey.length < 32 || publicKey.length > 44) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Invalid public key format',
                    { publicKey }
                );
            }

            // Validate specialization
            if (!Array.isArray(profile.specialization) || profile.specialization.length === 0) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Specialization must be a non-empty array',
                    { specialization: profile.specialization }
                );
            }

            // Check if agent already exists
            if (this.agents.has(publicKey)) {
                throw new NexusError(
                    ErrorCode.AGENT_NOT_REGISTERED, // Reusing closest available code
                    `Agent with public key ${publicKey} is already registered`,
                    { publicKey }
                );
            }

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
        }, 'agent registration');
    }

    // List Intelligence for Sale
    async listIntelligence(sellerKey: string, intelligence: Omit<AgentIntelligence, 'id' | 'seller' | 'created_at' | 'sales_count' | 'rating' | 'quality_score'>): Promise<string> {
        return errorHandler.withErrorHandling(async () => {
            // Validate required fields
            validateRequired({
                sellerKey,
                title: intelligence.title,
                description: intelligence.description,
                category: intelligence.category,
                price: intelligence.price
            }, ['sellerKey', 'title', 'description', 'category', 'price'], 'listIntelligence');

            // Validate public key format
            if (typeof sellerKey !== 'string' || sellerKey.length < 32 || sellerKey.length > 44) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Invalid seller key format',
                    { sellerKey }
                );
            }

            // Validate category
            const validCategories = ['market-analysis', 'defi-strategy', 'price-prediction', 'risk-assessment', 'trend-analysis'];
            if (!validCategories.includes(intelligence.category)) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    `Invalid category. Must be one of: ${validCategories.join(', ')}`,
                    { category: intelligence.category, validCategories }
                );
            }

            // Validate price
            if (typeof intelligence.price !== 'number' || intelligence.price <= 0 || intelligence.price > 1000) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Price must be a positive number between 0 and 1000 SOL',
                    { price: intelligence.price }
                );
            }

            // Check if seller is registered
            if (!this.agents.has(sellerKey)) {
                throw new NexusError(
                    ErrorCode.AGENT_NOT_REGISTERED,
                    'Agent must be registered before listing intelligence',
                    { sellerKey }
                );
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
        }, 'intelligence listing');
    }

    // Enhanced Purchase Intelligence with Privacy, Memory, and Transparency
    async purchaseIntelligence(
        buyerKey: string,
        intelligenceId: string,
        reasoning?: ReasoningData
    ): Promise<{success: boolean, data?: any, shieldedTxId?: string, commitmentId?: string}> {
        return errorHandler.withErrorHandling(async () => {
            // Validate required fields
            validateRequired({ buyerKey, intelligenceId }, ['buyerKey', 'intelligenceId'], 'purchaseIntelligence');

            // Validate buyer key format
            if (typeof buyerKey !== 'string' || buyerKey.length < 32 || buyerKey.length > 44) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Invalid buyer key format',
                    { buyerKey }
                );
            }

            // Check if intelligence exists
            const intelligence = this.intelligence.get(intelligenceId);
            if (!intelligence) {
                throw new NexusError(
                    ErrorCode.INTELLIGENCE_NOT_FOUND,
                    `Intelligence not found with ID: ${intelligenceId}`,
                    { intelligenceId }
                );
            }

            // Check if seller still exists
            const seller = this.agents.get(intelligence.seller);
            if (!seller) {
                throw new NexusError(
                    ErrorCode.AGENT_NOT_REGISTERED,
                    'Seller agent not found',
                    { sellerKey: intelligence.seller }
                );
            }

            // Prevent self-purchase
            if (buyerKey === intelligence.seller) {
                throw new NexusError(
                    ErrorCode.INVALID_TRANSACTION,
                    'Cannot purchase your own intelligence',
                    { buyerKey, sellerKey: intelligence.seller }
                );
            }

            // Get buyer profile for privacy and memory decisions
            const buyer = this.agents.get(buyerKey);
            const buyerReputation = buyer?.reputation_score || 0;

            // TRANSPARENCY: Commit reasoning before transaction
            let commitmentId: string | undefined;
            if (reasoning) {
                commitmentId = await this.transparencyLayer.commitReasoning(
                    buyerKey,
                    reasoning,
                    `Purchase decision for intelligence: ${intelligence.title}`
                );
                console.log(`🔒 Reasoning committed for transaction`);
            }

            // PRIVACY: Determine if transaction should be shielded
            let shieldedTxId: string | undefined;
            if (PrivateMarketplaceUtils.shouldShieldTransaction(intelligence.price, buyerReputation)) {
                shieldedTxId = await this.privacyLayer.shieldTransaction(
                    buyerKey,
                    intelligence.seller,
                    intelligence.price,
                    intelligenceId
                );

                // Execute shielded transaction
                await this.privacyLayer.executeShieldedTransaction(shieldedTxId);
                console.log(`🛡️ Transaction executed with privacy protection`);
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

            // Link commitment to transaction
            if (commitmentId) {
                await this.transparencyLayer.linkCommitmentToTransaction(commitmentId, transaction.id);
            }

            // MEMORY: Record transaction in persistent memory
            await this.memoryLayer.recordTransaction(transaction, { success: true });

            // Update statistics
            intelligence.sales_count++;
            seller.total_sales++;
            seller.total_earnings += intelligence.price;

            this.transactions.push(transaction);

            // TRANSPARENCY: Auto-reveal reasoning after successful transaction
            if (commitmentId) {
                try {
                    await this.transparencyLayer.revealReasoning(commitmentId);
                    console.log(`🔍 Reasoning automatically revealed post-transaction`);
                } catch (error) {
                    console.warn(`⚠️ Could not auto-reveal reasoning: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // PRIVACY: Reveal transaction details if shielded
            if (shieldedTxId) {
                await this.privacyLayer.revealTransaction(shieldedTxId, intelligence.seller);
            }

            // MEMORY: Search buyer's past similar purchases for personalized experience
            const similarPurchases = await this.memoryLayer.searchAgentMemory(
                buyerKey,
                `${intelligence.category} ${intelligence.title}`,
                3
            );

            if (similarPurchases.length > 0) {
                console.log(`🧠 Found ${similarPurchases.length} similar past purchases in agent memory`);
            }

            // Return the intelligence data (enhanced with context)
            const intelligenceData = {
                ...this.generateSampleIntelligenceData(intelligence),
                personalizedContext: similarPurchases.length > 0 ? 'Based on your past purchases' : 'New category for you',
                privacyProtected: !!shieldedTxId,
                transparencyCommitted: !!commitmentId
            };

            console.log(`💰 Enhanced purchase completed: ${buyerKey.substr(0, 8)}... bought "${intelligence.title}" for ${intelligence.price} SOL`);
            if (shieldedTxId) console.log(`   🛡️ Privacy protected with Sipher`);
            if (commitmentId) console.log(`   🔍 Transparency ensured with SOLPRISM`);
            console.log(`   🧠 Memory recorded with AgentMemory`);

            return {
                success: true,
                data: intelligenceData,
                shieldedTxId,
                commitmentId
            };
        }, 'enhanced intelligence purchase');
    }

    // Rate Intelligence After Purchase
    async rateIntelligence(buyerKey: string, intelligenceId: string, rating: number, review?: string): Promise<void> {
        return errorHandler.withErrorHandling(async () => {
            // Validate required fields
            validateRequired({ buyerKey, intelligenceId, rating }, ['buyerKey', 'intelligenceId', 'rating'], 'rateIntelligence');

            // Validate buyer key format
            if (typeof buyerKey !== 'string' || buyerKey.length < 32 || buyerKey.length > 44) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Invalid buyer key format',
                    { buyerKey }
                );
            }

            // Validate rating range
            errorHandler.validateRange(rating, 1, 5, 'rating', 'rateIntelligence');
            if (!Number.isInteger(rating)) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Rating must be an integer between 1 and 5',
                    { rating }
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

            // Verify intelligence still exists
            const intelligence = this.intelligence.get(intelligenceId);
            if (!intelligence) {
                throw new NexusError(
                    ErrorCode.INTELLIGENCE_NOT_FOUND,
                    `Intelligence not found with ID: ${intelligenceId}`,
                    { intelligenceId }
                );
            }

            // Verify seller still exists
            const seller = this.agents.get(intelligence.seller);
            if (!seller) {
                throw new NexusError(
                    ErrorCode.AGENT_NOT_REGISTERED,
                    'Seller agent not found',
                    { sellerKey: intelligence.seller }
                );
            }

            transaction.rating = rating;
            transaction.review = review;

            // Update intelligence rating
            const allRatings = this.transactions
                .filter(tx => tx.intelligence_id === intelligenceId && tx.rating)
                .map(tx => tx.rating!);

            intelligence.rating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

            // Update seller reputation
            const sellerRatings = this.transactions
                .filter(tx => tx.seller === intelligence.seller && tx.rating)
                .map(tx => tx.rating!);

            if (sellerRatings.length > 0) {
                const avgRating = sellerRatings.reduce((a, b) => a + b, 0) / sellerRatings.length;
                seller.reputation_score = Math.round((avgRating / 5) * 1000);
            }

            console.log(`⭐ Intelligence rated: ${rating}/5 stars`);
        }, 'intelligence rating');
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

    // Market Statistics
    getMarketStats() {
        const totalIntelligence = this.intelligence.size;
        const totalAgents = this.agents.size;
        const totalTransactions = this.transactions.length;
        const totalVolume = this.transactions.reduce((sum, tx) => sum + tx.price, 0);

        const categories = Array.from(this.intelligence.values()).reduce((acc, intel) => {
            acc[intel.category] = (acc[intel.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalIntelligence,
            totalAgents,
            totalTransactions,
            totalVolume,
            avgPrice: totalTransactions > 0 ? totalVolume / totalTransactions : 0,
            categories
        };
    }

    // Helper to generate sample intelligence data
    private generateSampleIntelligenceData(intelligence: AgentIntelligence): any {
        return generateIntelligenceData(intelligence);
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

    // ============ ENHANCED FEATURES ============

    // Memory Layer Access
    async getAgentMemoryHistory(agentKey: string): Promise<any> {
        return this.memoryLayer.getTransactionHistory(agentKey);
    }

    async searchAgentMemory(agentKey: string, query: string): Promise<any> {
        return this.memoryLayer.searchAgentMemory(agentKey, query);
    }

    getAgentAnalytics(agentKey: string): any {
        return this.memoryLayer.getIntelligenceAnalytics(agentKey);
    }

    // Privacy Layer Access
    getPrivacyStatus(shieldedTxId: string): string | undefined {
        return this.privacyLayer.getTransactionStatus(shieldedTxId);
    }

    getPendingPrivateTransactions(): any[] {
        return this.privacyLayer.getPendingTransactions();
    }

    // Transparency Layer Access
    getAgentCommitments(agentKey: string): any[] {
        return this.transparencyLayer.getAgentCommitments(agentKey);
    }

    async auditTransactionTransparency(transactionId: string): Promise<any> {
        return this.transparencyLayer.auditTransaction(transactionId);
    }

    getMarketplaceTransparencyStats(): any {
        return this.transparencyLayer.getTransparencyStats();
    }

    generateTransparencyReport(): string {
        return this.transparencyLayer.generateTransparencyReport();
    }

    // Enhanced Market Statistics
    getEnhancedMarketStats(): any {
        const baseStats = this.getMarketStats();
        const transparencyStats = this.transparencyLayer.getTransparencyStats();
        const memoryStats = this.memoryLayer.getMemoryStats();

        return {
            ...baseStats,
            privacy: {
                protectedTransactions: this.privacyLayer.getPendingTransactions().length,
                privacyScore: 95 // Simplified for demo
            },
            transparency: {
                commitmentRate: transparencyStats.transparencyScore,
                totalCommitments: transparencyStats.totalCommitments,
                revealRate: transparencyStats.revealedCommitments / Math.max(1, transparencyStats.totalCommitments) * 100
            },
            memory: {
                totalRecords: memoryStats.totalRecords,
                agentsWithHistory: memoryStats.agentsWithMemory
            }
        };
    }

    // System maintenance
    performSystemMaintenance(): void {
        console.log('🔧 Performing NEXUS system maintenance...');

        // Cleanup privacy layer
        this.privacyLayer.cleanupCompletedTransactions();

        // Cleanup transparency layer
        this.transparencyLayer.cleanupExpiredCommitments();

        // Sync with external protocols
        this.memoryLayer.syncWithAgentMemory();

        console.log('✅ System maintenance completed');
    }

    // ============ INTEGRATION FEATURES ============

    // AgentPay Integration - Create streaming payment for intelligence subscriptions
    async createIntelligenceSubscription(
        subscriberKey: string,
        providerKey: string,
        category: string,
        pricePerQuery: number,
        monthlyLimit: number = 1000,
        initialDeposit: number = 1.0
    ): Promise<string> {
        return errorHandler.withErrorHandling(async () => {
            validateRequired({
                subscriberKey, providerKey, category, pricePerQuery, initialDeposit
            }, ['subscriberKey', 'providerKey', 'category', 'pricePerQuery', 'initialDeposit'], 'createIntelligenceSubscription');

            // Check if both agents are registered
            if (!this.agents.has(subscriberKey) || !this.agents.has(providerKey)) {
                throw new NexusError(ErrorCode.AGENT_NOT_REGISTERED, 'Both agents must be registered', {
                    subscriberExists: this.agents.has(subscriberKey),
                    providerExists: this.agents.has(providerKey)
                });
            }

            // Create AgentPay stream
            const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const stream: AgentPayStream = {
                id: streamId,
                serviceId: `nexus_intelligence_${category}`,
                payer: subscriberKey,
                recipient: providerKey,
                ratePerCall: pricePerQuery,
                totalDeposited: initialDeposit,
                totalUsed: 0,
                isActive: true,
                createdAt: Date.now()
            };

            this.agentPayStreams.set(streamId, stream);

            // Create subscription record
            const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const subscription: IntelligenceSubscription = {
                id: subscriptionId,
                subscriber: subscriberKey,
                provider: providerKey,
                category,
                streamId,
                pricePerQuery,
                monthlyLimit,
                queriesUsed: 0,
                isActive: true,
                startDate: Date.now(),
                nextBillingDate: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
            };

            this.subscriptions.set(subscriptionId, subscription);

            console.log(`💳 AgentPay subscription created: ${category} intelligence from ${providerKey.substr(0,8)}... to ${subscriberKey.substr(0,8)}...`);
            console.log(`   📊 Rate: ${pricePerQuery} SOL per query, Limit: ${monthlyLimit} queries/month`);
            console.log(`   💰 Initial deposit: ${initialDeposit} SOL`);

            return subscriptionId;
        }, 'intelligence subscription creation');
    }

    // Query intelligence via subscription (AgentPay streaming payment)
    async queryIntelligenceViaSubscription(
        subscriptionId: string,
        query: string,
        priority: 'normal' | 'high' | 'urgent' = 'normal'
    ): Promise<{success: boolean, data?: any, streamBalance?: number}> {
        return errorHandler.withErrorHandling(async () => {
            const subscription = this.subscriptions.get(subscriptionId);
            if (!subscription || !subscription.isActive) {
                throw new NexusError(ErrorCode.INVALID_TRANSACTION, 'Subscription not found or inactive', { subscriptionId });
            }

            // Check monthly limit
            if (subscription.queriesUsed >= subscription.monthlyLimit) {
                throw new NexusError(ErrorCode.INVALID_TRANSACTION, 'Monthly query limit reached', {
                    queriesUsed: subscription.queriesUsed,
                    limit: subscription.monthlyLimit
                });
            }

            // Get and validate stream
            const stream = this.agentPayStreams.get(subscription.streamId);
            if (!stream || !stream.isActive) {
                throw new NexusError(ErrorCode.INVALID_TRANSACTION, 'Payment stream not active', { streamId: subscription.streamId });
            }

            // Calculate cost (priority affects pricing)
            const costMultiplier = priority === 'urgent' ? 2.0 : priority === 'high' ? 1.5 : 1.0;
            const queryCost = subscription.pricePerQuery * costMultiplier;

            // Check stream balance
            const availableBalance = stream.totalDeposited - stream.totalUsed;
            if (availableBalance < queryCost) {
                throw new NexusError(ErrorCode.INVALID_TRANSACTION, 'Insufficient stream balance', {
                    required: queryCost,
                    available: availableBalance
                });
            }

            // Process payment via stream
            stream.totalUsed += queryCost;
            subscription.queriesUsed++;

            // Update provider earnings
            const provider = this.agents.get(subscription.provider)!;
            provider.total_earnings += queryCost;

            // Record transaction
            const transaction: IntelligenceTransaction = {
                id: `tx_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                buyer: subscription.subscriber,
                seller: subscription.provider,
                intelligence_id: `subscription_query_${subscription.category}`,
                price: queryCost,
                timestamp: Date.now()
            };

            this.transactions.push(transaction);

            // Generate intelligence based on category and query
            const intelligenceData = this.generateSubscriptionIntelligence(subscription.category, query, priority);

            console.log(`🔄 Subscription query processed: ${subscription.category} via AgentPay stream`);
            console.log(`   💸 Cost: ${queryCost} SOL (${priority} priority), Remaining balance: ${availableBalance - queryCost} SOL`);
            console.log(`   📈 Queries used: ${subscription.queriesUsed}/${subscription.monthlyLimit}`);

            return {
                success: true,
                data: intelligenceData,
                streamBalance: availableBalance - queryCost
            };
        }, 'subscription intelligence query');
    }

    // BountyBoard Integration - Register agent capabilities for bounties
    async registerForBountyType(agentKey: string, capability: string): Promise<boolean> {
        return errorHandler.withErrorHandling(async () => {
            validateRequired({ agentKey, capability }, ['agentKey', 'capability'], 'registerForBountyType');

            if (!this.agents.has(agentKey)) {
                throw new NexusError(ErrorCode.AGENT_NOT_REGISTERED, 'Agent must be registered', { agentKey });
            }

            const agent = this.agents.get(agentKey)!;

            // Create mock bounty integration
            const bountyId = `bounty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const bountyIntegration: BountyIntegration = {
                bountyId,
                requiredCapability: capability,
                reward: 0.05, // Standard BountyBoard reward
                deadline: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
                agentResponses: [agentKey]
            };

            this.bountyIntegrations.set(bountyId, bountyIntegration);

            console.log(`🎯 Agent registered for bounty capability: ${capability}`);
            console.log(`   🏆 Potential reward: ${bountyIntegration.reward} SOL`);
            console.log(`   ⏰ Deadline: ${new Date(bountyIntegration.deadline).toISOString()}`);

            return true;
        }, 'bounty capability registration');
    }

    // Cross-platform collaboration discovery
    async findCollaborationOpportunities(agentKey: string): Promise<{
        agentPayPartners: string[],
        bountyMatches: string[],
        subscriptionRecommendations: string[]
    }> {
        return errorHandler.withErrorHandling(async () => {
            const agent = this.agents.get(agentKey);
            if (!agent) {
                throw new NexusError(ErrorCode.AGENT_NOT_REGISTERED, 'Agent not found', { agentKey });
            }

            // Find potential AgentPay partners (complementary specializations)
            const agentPayPartners: string[] = [];
            for (const [key, otherAgent] of this.agents) {
                if (key === agentKey) continue;

                // Look for complementary specializations
                const hasComplementarySpec = agent.specialization.some(spec =>
                    !otherAgent.specialization.includes(spec) &&
                    otherAgent.specialization.length > 0
                );

                if (hasComplementarySpec && otherAgent.reputation_score > 500) {
                    agentPayPartners.push(key);
                }
            }

            // Find matching bounty opportunities
            const bountyMatches: string[] = [];
            for (const [bountyId, bounty] of this.bountyIntegrations) {
                if (agent.specialization.some(spec =>
                    bounty.requiredCapability.toLowerCase().includes(spec.toLowerCase())
                )) {
                    bountyMatches.push(bountyId);
                }
            }

            // Find subscription recommendations
            const subscriptionRecommendations: string[] = [];
            for (const [key, otherAgent] of this.agents) {
                if (key === agentKey) continue;

                // Recommend subscriptions to high-quality agents in different categories
                const isDifferentSpecialization = !agent.specialization.some(spec =>
                    otherAgent.specialization.includes(spec)
                );

                if (isDifferentSpecialization && otherAgent.reputation_score > 700 && otherAgent.total_sales > 5) {
                    subscriptionRecommendations.push(key);
                }
            }

            console.log(`🔍 Collaboration opportunities for ${agent.name}:`);
            console.log(`   🤝 AgentPay partners: ${agentPayPartners.length}`);
            console.log(`   🎯 Bounty matches: ${bountyMatches.length}`);
            console.log(`   📊 Subscription opportunities: ${subscriptionRecommendations.length}`);

            return {
                agentPayPartners: agentPayPartners.slice(0, 5),
                bountyMatches: bountyMatches.slice(0, 3),
                subscriptionRecommendations: subscriptionRecommendations.slice(0, 3)
            };
        }, 'collaboration opportunity discovery');
    }

    // Top-up AgentPay stream
    async topUpPaymentStream(streamId: string, amount: number): Promise<boolean> {
        return errorHandler.withErrorHandling(async () => {
            const stream = this.agentPayStreams.get(streamId);
            if (!stream) {
                throw new NexusError(ErrorCode.INVALID_TRANSACTION, 'Stream not found', { streamId });
            }

            stream.totalDeposited += amount;
            console.log(`💰 Stream topped up: +${amount} SOL (Total: ${stream.totalDeposited} SOL)`);
            return true;
        }, 'stream top-up');
    }

    // Get integration statistics
    getIntegrationStats(): any {
        const activeStreams = Array.from(this.agentPayStreams.values()).filter(s => s.isActive).length;
        const totalStreamVolume = Array.from(this.agentPayStreams.values()).reduce((sum, s) => sum + s.totalUsed, 0);
        const activeSubscriptions = Array.from(this.subscriptions.values()).filter(s => s.isActive).length;
        const activeBounties = this.bountyIntegrations.size;

        return {
            agentPay: {
                activeStreams,
                totalVolume: totalStreamVolume,
                avgStreamSize: activeStreams > 0 ?
                    Array.from(this.agentPayStreams.values()).reduce((sum, s) => sum + s.totalDeposited, 0) / activeStreams : 0
            },
            subscriptions: {
                active: activeSubscriptions,
                totalQueries: Array.from(this.subscriptions.values()).reduce((sum, s) => sum + s.queriesUsed, 0)
            },
            bounties: {
                active: activeBounties,
                totalReward: Array.from(this.bountyIntegrations.values()).reduce((sum, b) => sum + b.reward, 0)
            }
        };
    }

    // Generate intelligence for subscription queries
    private generateSubscriptionIntelligence(category: string, query: string, priority: string): any {
        const baseData = generateIntelligenceData({ category } as AgentIntelligence);

        return {
            ...baseData,
            query,
            priority,
            timestamp: Date.now(),
            subscriptionDelivery: true,
            enhancedForPriority: priority !== 'normal'
        };
    }
}

// Utility functions
export function generateIntelligenceData(intelligence: AgentIntelligence): any {
    const samples: Record<string, any> = {
        'market-analysis': {
            data: `SOL Price Analysis - ${new Date().toISOString()}`,
            prediction: `Bullish trend expected over next 24h based on volume patterns`,
            confidence: 0.85,
            timeframe: '24h',
            key_indicators: ['Volume surge +45%', 'RSI oversold recovery', 'Whale accumulation detected']
        },
        'defi-strategy': {
            strategy: 'Yield farming optimization',
            pools: ['SOL-USDC', 'RAY-SOL', 'ORCA-USDC'],
            expected_apy: '12.5%',
            risk_level: 'Medium',
            instructions: 'Rotate between pools based on TVL changes'
        },
        'price-prediction': {
            asset: 'SOL',
            current_price: 98.5,
            predicted_price_24h: 105.2,
            predicted_price_7d: 115.8,
            confidence_24h: 0.78,
            confidence_7d: 0.65
        },
        'risk-assessment': {
            asset: 'SOL',
            risk_score: 6.5,
            factors: ['Market volatility', 'Liquidity risk', 'Smart contract risk'],
            recommendation: 'Medium risk - suitable for balanced portfolios'
        },
        'trend-analysis': {
            trend: 'Bullish',
            duration: '7 days',
            strength: 0.78,
            indicators: ['Moving averages', 'Volume profile', 'Social sentiment']
        }
    };

    return samples[intelligence.category] || { generic_data: 'Intelligence data payload' };
}