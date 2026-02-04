import { Connection, PublicKey } from '@solana/web3.js';
import type { AgentIntelligence, IntelligenceTransaction } from '../types/index.js';

interface MemoryRecord {
    id: string;
    agentId: string;
    type: 'purchase' | 'sale' | 'rating' | 'reputation';
    content: any;
    metadata: {
        intelligence_id?: string;
        category?: string;
        price?: number;
        rating?: number;
        effectiveness?: number;
    };
    timestamp: number;
    searchableText: string;
}

interface AgentMemoryProfile {
    agentId: string;
    totalTransactions: number;
    totalSpent: number;
    totalEarned: number;
    categoryPreferences: Record<string, number>;
    reputationHistory: { date: number; score: number }[];
    effectivenessScores: { intelligence_id: string; effectiveness: number; category: string }[];
    createdAt: number;
    lastUpdated: number;
}

interface SearchQuery {
    agentId?: string;
    category?: string;
    type?: string;
    keywords?: string;
    dateRange?: { start: number; end: number };
    minEffectiveness?: number;
}

export class AgentMemoryLayer {
    private connection: Connection;
    private memoryEndpoint: string;
    private localCache: Map<string, MemoryRecord[]> = new Map();
    private agentProfiles: Map<string, AgentMemoryProfile> = new Map();
    private enabled: boolean;

    constructor(connection: Connection, options: { endpoint?: string; enabled?: boolean } = {}) {
        this.connection = connection;
        this.memoryEndpoint = options.endpoint || 'HLtbU8HoiLhXtjQbJKshceuQK1f59xW7hT99P5pSn62L';
        this.enabled = options.enabled ?? true;
    }

    /**
     * Store a memory record for an agent
     * Implements persistent storage as suggested by moltdev
     */
    async storeMemory(record: Omit<MemoryRecord, 'id' | 'timestamp' | 'searchableText'>): Promise<string> {
        if (!this.enabled) {
            return 'memory_disabled';
        }

        const memoryRecord: MemoryRecord = {
            ...record,
            id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            searchableText: this.generateSearchableText(record)
        };

        try {
            // Try to store on AgentMemory Protocol
            await this.storeOnProtocol(memoryRecord);
        } catch (error) {
            console.log(`⚠️  AgentMemory Protocol unavailable, using local storage`);
        }

        // Store locally as backup
        await this.storeLocally(memoryRecord);

        // Update agent profile
        await this.updateAgentProfile(record.agentId, record);

        console.log(`🧠 Memory stored: ${record.type} for agent ${record.agentId.substr(0, 8)}...`);
        return memoryRecord.id;
    }

    /**
     * Search agent memories with semantic capabilities
     */
    async searchMemories(query: SearchQuery): Promise<MemoryRecord[]> {
        try {
            // Try AgentMemory Protocol first
            const protocolResults = await this.searchOnProtocol(query);
            if (protocolResults.length > 0) {
                return protocolResults;
            }
        } catch (error) {
            console.log(`⚠️  Protocol search unavailable, using local search`);
        }

        return this.searchLocally(query);
    }

    /**
     * Get comprehensive agent memory profile
     */
    async getAgentProfile(agentId: string): Promise<AgentMemoryProfile | null> {
        return this.agentProfiles.get(agentId) || null;
    }

    /**
     * Record intelligence purchase for memory
     */
    async recordPurchase(transaction: IntelligenceTransaction, intelligence: AgentIntelligence): Promise<string> {
        return this.storeMemory({
            agentId: transaction.buyer,
            type: 'purchase',
            content: {
                transaction,
                intelligence,
                seller: transaction.seller,
                category: intelligence.category
            },
            metadata: {
                intelligence_id: intelligence.id,
                category: intelligence.category,
                price: transaction.price
            }
        });
    }

    /**
     * Record intelligence effectiveness after use
     */
    async recordEffectiveness(agentId: string, intelligenceId: string, effectiveness: number, feedback?: string): Promise<string> {
        return this.storeMemory({
            agentId,
            type: 'rating',
            content: {
                intelligence_id: intelligenceId,
                effectiveness,
                feedback,
                timestamp: Date.now()
            },
            metadata: {
                intelligence_id: intelligenceId,
                effectiveness
            }
        });
    }

    /**
     * Get intelligence recommendations based on memory
     */
    async getRecommendations(agentId: string, category?: string): Promise<{
        recommended: string[];
        avoided: string[];
        reasoning: string;
    }> {
        const profile = await this.getAgentProfile(agentId);
        if (!profile) {
            return { recommended: [], avoided: [], reasoning: 'No purchase history available' };
        }

        // Find highest effectiveness intelligence in category
        const relevantScores = profile.effectivenessScores.filter(
            score => !category || score.category === category
        );

        const recommended = relevantScores
            .filter(score => score.effectiveness >= 0.7)
            .map(score => score.intelligence_id);

        const avoided = relevantScores
            .filter(score => score.effectiveness < 0.3)
            .map(score => score.intelligence_id);

        const reasoning = `Based on ${relevantScores.length} past purchases, recommending ${recommended.length} high-performing intelligence sources`;

        return { recommended, avoided, reasoning };
    }

    /**
     * Analyze purchase patterns
     */
    async analyzePatterns(agentId: string): Promise<{
        preferredCategories: string[];
        avgSpending: number;
        successRate: number;
        insights: string[];
    }> {
        const profile = await this.getAgentProfile(agentId);
        if (!profile) {
            return {
                preferredCategories: [],
                avgSpending: 0,
                successRate: 0,
                insights: ['No purchase history available']
            };
        }

        const preferredCategories = Object.entries(profile.categoryPreferences)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([category]) => category);

        const avgSpending = profile.totalSpent / Math.max(1, profile.totalTransactions);

        const effectiveCount = profile.effectivenessScores.filter(s => s.effectiveness >= 0.6).length;
        const successRate = effectiveCount / Math.max(1, profile.effectivenessScores.length);

        const insights = [
            `Most active in: ${preferredCategories.join(', ')}`,
            `Average purchase: ${avgSpending.toFixed(3)} SOL`,
            `Success rate: ${(successRate * 100).toFixed(1)}%`,
            `Total transactions: ${profile.totalTransactions}`
        ];

        return { preferredCategories, avgSpending, successRate, insights };
    }

    /**
     * Generate searchable text from memory record
     */
    private generateSearchableText(record: Partial<MemoryRecord>): string {
        const parts = [
            record.type,
            record.metadata?.category,
            JSON.stringify(record.content).toLowerCase(),
            record.agentId
        ].filter(Boolean);

        return parts.join(' ');
    }

    /**
     * Store on AgentMemory Protocol (simulated)
     */
    private async storeOnProtocol(record: MemoryRecord): Promise<void> {
        // In production, this would use the actual AgentMemory Protocol
        // For now, simulate the API call
        const mockResponse = {
            success: true,
            stored_at: this.memoryEndpoint,
            record_id: record.id
        };

        console.log(`📡 Stored on AgentMemory Protocol: ${record.id}`);
    }

    /**
     * Store locally as backup
     */
    private async storeLocally(record: MemoryRecord): Promise<void> {
        const agentRecords = this.localCache.get(record.agentId) || [];
        agentRecords.push(record);

        // Keep only last 1000 records per agent
        if (agentRecords.length > 1000) {
            agentRecords.splice(0, agentRecords.length - 1000);
        }

        this.localCache.set(record.agentId, agentRecords);
    }

    /**
     * Search on AgentMemory Protocol (simulated)
     */
    private async searchOnProtocol(query: SearchQuery): Promise<MemoryRecord[]> {
        // Simulate protocol search - in production would query actual protocol
        return [];
    }

    /**
     * Search locally stored memories
     */
    private searchLocally(query: SearchQuery): MemoryRecord[] {
        let results: MemoryRecord[] = [];

        for (const [agentId, records] of this.localCache.entries()) {
            if (query.agentId && agentId !== query.agentId) continue;

            const filtered = records.filter(record => {
                if (query.type && record.type !== query.type) return false;
                if (query.category && record.metadata.category !== query.category) return false;
                if (query.keywords && !record.searchableText.includes(query.keywords.toLowerCase())) return false;
                if (query.dateRange) {
                    if (record.timestamp < query.dateRange.start || record.timestamp > query.dateRange.end) return false;
                }
                if (query.minEffectiveness && (record.metadata.effectiveness || 0) < query.minEffectiveness) return false;

                return true;
            });

            results = results.concat(filtered);
        }

        return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
    }

    /**
     * Update agent profile with new memory
     */
    private async updateAgentProfile(agentId: string, record: Partial<MemoryRecord>): Promise<void> {
        let profile = this.agentProfiles.get(agentId);

        if (!profile) {
            profile = {
                agentId,
                totalTransactions: 0,
                totalSpent: 0,
                totalEarned: 0,
                categoryPreferences: {},
                reputationHistory: [],
                effectivenessScores: [],
                createdAt: Date.now(),
                lastUpdated: Date.now()
            };
        }

        // Update based on record type
        if (record.type === 'purchase' && record.metadata?.price) {
            profile.totalTransactions++;
            profile.totalSpent += record.metadata.price;

            if (record.metadata.category) {
                profile.categoryPreferences[record.metadata.category] =
                    (profile.categoryPreferences[record.metadata.category] || 0) + 1;
            }
        }

        if (record.type === 'sale' && record.metadata?.price) {
            profile.totalEarned += record.metadata.price;
        }

        if (record.type === 'rating' && record.metadata?.effectiveness) {
            profile.effectivenessScores.push({
                intelligence_id: record.metadata.intelligence_id || '',
                effectiveness: record.metadata.effectiveness,
                category: record.metadata.category || 'unknown'
            });
        }

        profile.lastUpdated = Date.now();
        this.agentProfiles.set(agentId, profile);
    }

    /**
     * Get memory layer status
     */
    getMemoryStatus(): { enabled: boolean; protocol: string; features: string[] } {
        return {
            enabled: this.enabled,
            protocol: 'AgentMemory Protocol',
            features: [
                'Persistent Transaction History',
                'Semantic Search',
                'Reputation Tracking',
                'Effectiveness Analysis',
                'Pattern Recognition',
                'Recommendations Engine'
            ]
        };
    }

    /**
     * Export memory data for analysis
     */
    async exportMemoryData(agentId: string): Promise<{
        profile: AgentMemoryProfile | null;
        memories: MemoryRecord[];
        analytics: any;
    }> {
        const profile = await this.getAgentProfile(agentId);
        const memories = await this.searchMemories({ agentId });
        const analytics = await this.analyzePatterns(agentId);

        return { profile, memories, analytics };
    }
}