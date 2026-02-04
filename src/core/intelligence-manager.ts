import type { AgentIntelligence, SearchFilters, IntelligenceCategory, IntelligenceTransaction } from '../types/index.js';
import { generateIntelligenceData } from '../utils/sample-data.js';
import type { AgentManager } from './agent-manager.js';

export class IntelligenceManager {
    private intelligence: Map<string, AgentIntelligence> = new Map();
    private agentManager: AgentManager;

    constructor(agentManager: AgentManager) {
        this.agentManager = agentManager;
    }

    async listIntelligence(
        sellerKey: string,
        intelligence: Omit<AgentIntelligence, 'id' | 'seller' | 'created_at' | 'sales_count' | 'rating' | 'quality_score'>
    ): Promise<string> {
        if (!this.agentManager.hasAgent(sellerKey)) {
            throw new Error('Agent must be registered first');
        }

        const id = `intel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const seller = this.agentManager.getAgent(sellerKey)!;
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

    getIntelligence(id: string): AgentIntelligence | undefined {
        return this.intelligence.get(id);
    }

    searchIntelligence(filters: SearchFilters = {}): AgentIntelligence[] {
        let results = Array.from(this.intelligence.values());

        // Handle null/undefined filters gracefully
        if (!filters) {
            return results;
        }

        if (filters.category) {
            results = results.filter(intel => intel.category === filters.category);
        }

        if (filters.maxPrice !== undefined && typeof filters.maxPrice === 'number' && !isNaN(filters.maxPrice)) {
            results = results.filter(intel => intel.price <= filters.maxPrice!);
        }

        if (filters.minQuality !== undefined && typeof filters.minQuality === 'number' && !isNaN(filters.minQuality)) {
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

    incrementSalesCount(intelligenceId: string): void {
        const intelligence = this.intelligence.get(intelligenceId);
        if (intelligence) {
            intelligence.sales_count++;
        }
    }

    updateIntelligenceRating(intelligenceId: string, transactions: IntelligenceTransaction[]): void {
        const intelligence = this.intelligence.get(intelligenceId);
        if (!intelligence) return;

        const allRatings = transactions
            .filter(tx => tx.intelligence_id === intelligenceId && tx.rating)
            .map(tx => tx.rating!);

        if (allRatings.length > 0) {
            intelligence.rating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
        }
    }

    generateSampleData(intelligence: AgentIntelligence): any {
        return generateIntelligenceData(intelligence.category);
    }

    getAllIntelligence(): AgentIntelligence[] {
        return Array.from(this.intelligence.values());
    }

    getIntelligenceCount(): number {
        return this.intelligence.size;
    }

    getCategoryCounts(): Record<string, number> {
        return Array.from(this.intelligence.values()).reduce((acc, intel) => {
            acc[intel.category] = (acc[intel.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }
}