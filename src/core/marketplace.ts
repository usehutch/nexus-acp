import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { AgentIntelligence, AgentProfile, IntelligenceTransaction } from '../types/index.js';
import { generateIntelligenceData } from '../utils/sample-data.js';

export class AgentMarketplace {
    private connection: Connection;
    private agents: Map<string, AgentProfile> = new Map();
    private intelligence: Map<string, AgentIntelligence> = new Map();
    private transactions: IntelligenceTransaction[] = [];

    constructor(connection: Connection) {
        this.connection = connection;
        this.loadSampleData();
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

    // Purchase Intelligence
    async purchaseIntelligence(buyerKey: string, intelligenceId: string): Promise<{success: boolean, data?: any}> {
        const intelligence = this.intelligence.get(intelligenceId);
        if (!intelligence) {
            throw new Error('Intelligence not found');
        }

        const seller = this.agents.get(intelligence.seller);
        if (!seller) {
            throw new Error('Seller not found');
        }

        // Simulate payment (in real implementation, this would be a Solana transaction)
        const transaction: IntelligenceTransaction = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            buyer: buyerKey,
            seller: intelligence.seller,
            intelligence_id: intelligenceId,
            price: intelligence.price,
            timestamp: Date.now()
        };

        // Update statistics
        intelligence.sales_count++;
        seller.total_sales++;
        seller.total_earnings += intelligence.price;

        this.transactions.push(transaction);

        // Return the intelligence data (this would be encrypted/decrypted in production)
        const intelligenceData = generateIntelligenceData(intelligence.category);

        console.log(`💰 Purchase completed: ${buyerKey.substr(0, 8)}... bought "${intelligence.title}" for ${intelligence.price} SOL`);
        return { success: true, data: intelligenceData };
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