import type { AgentIntelligence, SearchFilters, IntelligenceCategory, IntelligenceTransaction } from '../types/index.js';
import { generateIntelligenceData } from '../utils/sample-data.js';
import type { AgentManager } from './agent-manager.js';
import { errorHandler, ErrorCode, NexusError } from '../../error-handler.js';

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
        try {
            // Validate required fields
            errorHandler.validateRequired(
                intelligence,
                ['title', 'description', 'category', 'price'],
                'intelligence listing'
            );

            errorHandler.validateRequired(
                { sellerKey },
                ['sellerKey'],
                'intelligence listing'
            );

            // Check if agent is registered
            if (!this.agentManager.hasAgent(sellerKey)) {
                throw new NexusError(
                    ErrorCode.AGENT_NOT_REGISTERED,
                    'Seller must be registered as an agent first',
                    { sellerKey }
                );
            }

            // Validate intelligence data
            if (intelligence.title.length < 5 || intelligence.title.length > 100) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Intelligence title must be between 5 and 100 characters',
                    { provided: intelligence.title }
                );
            }

            if (intelligence.description.length < 20 || intelligence.description.length > 1000) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Intelligence description must be between 20 and 1000 characters',
                    { provided: intelligence.description }
                );
            }

            errorHandler.validateRange(
                intelligence.price,
                0.001,
                1000,
                'price',
                'intelligence listing'
            );

            // Validate category is non-empty
            if (!intelligence.category || intelligence.category.trim().length === 0) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Intelligence category is required',
                    { provided: intelligence.category }
                );
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
        } catch (error) {
            if (error instanceof NexusError) {
                throw error;
            }

            const nexusError = errorHandler.normalizeError(error, 'intelligence listing');
            errorHandler.logError(nexusError, 'IntelligenceManager.listIntelligence');
            throw nexusError;
        }
    }

    getIntelligence(id: string): AgentIntelligence | undefined {
        try {
            if (!id) {
                throw new NexusError(
                    ErrorCode.MISSING_REQUIRED_FIELD,
                    'Intelligence ID is required',
                    { provided: id }
                );
            }

            return this.intelligence.get(id);
        } catch (error) {
            const nexusError = errorHandler.normalizeError(error, 'intelligence lookup');
            errorHandler.logError(nexusError, 'IntelligenceManager.getIntelligence');
            throw nexusError;
        }
    }

    searchIntelligence(filters: SearchFilters = {}): AgentIntelligence[] {
        try {
            let results = Array.from(this.intelligence.values());

            // Handle null/undefined filters gracefully
            if (!filters) {
                return results;
            }

            // Validate filter values if provided
            if (filters.maxPrice !== undefined) {
                if (typeof filters.maxPrice !== 'number' || isNaN(filters.maxPrice) || filters.maxPrice < 0) {
                    throw new NexusError(
                        ErrorCode.INVALID_INPUT,
                        'Max price filter must be a positive number',
                        { provided: filters.maxPrice }
                    );
                }
                results = results.filter(intel => intel.price <= filters.maxPrice!);
            }

            if (filters.minQuality !== undefined) {
                if (typeof filters.minQuality !== 'number' || isNaN(filters.minQuality) || filters.minQuality < 0 || filters.minQuality > 100) {
                    throw new NexusError(
                        ErrorCode.INVALID_INPUT,
                        'Min quality filter must be a number between 0 and 100',
                        { provided: filters.minQuality }
                    );
                }
                results = results.filter(intel => intel.quality_score >= filters.minQuality!);
            }

            if (filters.category) {
                if (typeof filters.category !== 'string' || filters.category.trim().length === 0) {
                    throw new NexusError(
                        ErrorCode.INVALID_INPUT,
                        'Category filter must be a non-empty string',
                        { provided: filters.category }
                    );
                }
                results = results.filter(intel => intel.category === filters.category);
            }

            if (filters.seller) {
                if (typeof filters.seller !== 'string' || filters.seller.trim().length === 0) {
                    throw new NexusError(
                        ErrorCode.INVALID_INPUT,
                        'Seller filter must be a non-empty string',
                        { provided: filters.seller }
                    );
                }
                results = results.filter(intel => intel.seller === filters.seller);
            }

            // Sort by quality score and recency
            return results.sort((a, b) => {
                const scoreA = a.quality_score * 0.7 + (Date.now() - a.created_at) / 86400000 * 0.3;
                const scoreB = b.quality_score * 0.7 + (Date.now() - b.created_at) / 86400000 * 0.3;
                return scoreB - scoreA;
            });
        } catch (error) {
            if (error instanceof NexusError) {
                throw error;
            }

            const nexusError = errorHandler.normalizeError(error, 'intelligence search');
            errorHandler.logError(nexusError, 'IntelligenceManager.searchIntelligence');
            throw nexusError;
        }
    }

    incrementSalesCount(intelligenceId: string): void {
        try {
            if (!intelligenceId) {
                throw new NexusError(
                    ErrorCode.MISSING_REQUIRED_FIELD,
                    'Intelligence ID is required to increment sales count',
                    { provided: intelligenceId }
                );
            }

            const intelligence = this.intelligence.get(intelligenceId);
            if (!intelligence) {
                throw new NexusError(
                    ErrorCode.INTELLIGENCE_NOT_FOUND,
                    'Cannot increment sales: Intelligence not found',
                    { intelligenceId }
                );
            }

            intelligence.sales_count++;
        } catch (error) {
            if (error instanceof NexusError) {
                throw error;
            }

            const nexusError = errorHandler.normalizeError(error, 'sales count increment');
            errorHandler.logError(nexusError, 'IntelligenceManager.incrementSalesCount');
            throw nexusError;
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