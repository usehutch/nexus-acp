import type {
    AgentIntelligence,
    AgentProfile,
    IntelligenceTransaction,
    RecommendationScore,
    RecommendationReason,
    RecommendationRequest,
    PersonalizedRecommendation,
    IntelligenceCategory
} from '../types/index.js';
import type { AgentManager } from './agent-manager.js';
import type { IntelligenceManager } from './intelligence-manager.js';
import type { TransactionManager } from './transaction-manager.js';

export class RecommendationManager {
    private agentManager: AgentManager;
    private intelligenceManager: IntelligenceManager;
    private transactionManager: TransactionManager;

    constructor(
        agentManager: AgentManager,
        intelligenceManager: IntelligenceManager,
        transactionManager: TransactionManager
    ) {
        this.agentManager = agentManager;
        this.intelligenceManager = intelligenceManager;
        this.transactionManager = transactionManager;
    }

    getPersonalizedRecommendations(request: RecommendationRequest): PersonalizedRecommendation[] {
        const { agentKey, count = 10, excludeOwned = true, minQuality = 0, categories } = request;

        const agent = this.agentManager.getAgent(agentKey);
        if (!agent) {
            return [];
        }

        const allIntelligence = this.intelligenceManager.getAllIntelligence();
        const agentTransactions = this.transactionManager.getAgentTransactions(agentKey);

        // Filter out intelligence that shouldn't be recommended
        let candidates = allIntelligence.filter(intel => {
            if (excludeOwned && intel.seller === agentKey) return false;
            if (intel.quality_score < minQuality) return false;
            if (categories && categories.length > 0 && !categories.includes(intel.category)) return false;
            return true;
        });

        // Calculate recommendation scores for each candidate
        const scoredCandidates: RecommendationScore[] = candidates.map(intel => {
            return this.calculateRecommendationScore(agent, intel, agentTransactions);
        });

        // Sort by score and take top recommendations
        const topScored = scoredCandidates
            .sort((a, b) => b.score - a.score)
            .slice(0, count);

        // Convert to PersonalizedRecommendation objects
        return topScored.map(scored => {
            const intelligence = candidates.find(intel => intel.id === scored.intelligenceId)!;
            return {
                ...intelligence,
                recommendationScore: scored.score,
                reasons: scored.reasons,
                isPersonalized: scored.score > 0.3 // Consider it personalized if score is reasonably high
            };
        });
    }

    private calculateRecommendationScore(
        agent: AgentProfile,
        intelligence: AgentIntelligence,
        agentTransactions: IntelligenceTransaction[]
    ): RecommendationScore {
        const reasons: RecommendationReason[] = [];
        let totalScore = 0;

        // 1. Specialization match (0.4 weight)
        const specializationScore = this.getSpecializationScore(agent, intelligence);
        if (specializationScore > 0) {
            const weight = 0.4;
            totalScore += specializationScore * weight;
            reasons.push({
                type: 'specialization_match',
                weight,
                description: `Matches your specialization in ${intelligence.category}`
            });
        }

        // 2. Quality-based recommendation (0.3 weight)
        const qualityScore = intelligence.quality_score / 100; // Normalize to 0-1
        const avgRating = intelligence.rating / 5; // Normalize to 0-1
        const qualityWeight = 0.3;
        const combinedQuality = (qualityScore + avgRating) / 2;
        totalScore += combinedQuality * qualityWeight;

        if (combinedQuality > 0.7) {
            reasons.push({
                type: 'quality_based',
                weight: qualityWeight,
                description: `High quality intelligence with ${intelligence.rating.toFixed(1)}/5 rating`
            });
        }

        // 3. Category preference based on purchase history (0.2 weight)
        const categoryPreferenceScore = this.getCategoryPreferenceScore(intelligence, agentTransactions);
        if (categoryPreferenceScore > 0) {
            const weight = 0.2;
            totalScore += categoryPreferenceScore * weight;
            reasons.push({
                type: 'category_preference',
                weight,
                description: `You frequently purchase ${intelligence.category} intelligence`
            });
        }

        // 4. Trending intelligence (0.1 weight)
        const trendingScore = this.getTrendingScore(intelligence);
        if (trendingScore > 0) {
            const weight = 0.1;
            totalScore += trendingScore * weight;
            reasons.push({
                type: 'trending',
                weight,
                description: 'Currently trending with recent purchases'
            });
        }

        // Ensure score is between 0 and 1
        totalScore = Math.min(1, Math.max(0, totalScore));

        return {
            intelligenceId: intelligence.id,
            score: totalScore,
            reasons
        };
    }

    private getSpecializationScore(agent: AgentProfile, intelligence: AgentIntelligence): number {
        // Check if agent's specializations align with intelligence category
        const categoryKeywords = this.getCategoryKeywords(intelligence.category);

        const matchCount = agent.specialization.filter(spec =>
            categoryKeywords.some(keyword =>
                spec.toLowerCase().includes(keyword.toLowerCase())
            )
        ).length;

        return Math.min(1, matchCount / agent.specialization.length);
    }

    private getCategoryKeywords(category: IntelligenceCategory): string[] {
        const keywordMap: Record<IntelligenceCategory, string[]> = {
            'market-analysis': ['market', 'analysis', 'trading', 'finance'],
            'defi-strategy': ['defi', 'strategy', 'yield', 'liquidity', 'protocol'],
            'price-prediction': ['price', 'prediction', 'forecast', 'technical'],
            'risk-assessment': ['risk', 'assessment', 'security', 'audit'],
            'trend-analysis': ['trend', 'pattern', 'technical', 'chart']
        };
        return keywordMap[category] || [];
    }

    private getCategoryPreferenceScore(
        intelligence: AgentIntelligence,
        agentTransactions: IntelligenceTransaction[]
    ): number {
        if (agentTransactions.length === 0) return 0;

        // Get intelligence details for past purchases
        const pastIntelligence = agentTransactions
            .map(tx => this.intelligenceManager.getIntelligence(tx.intelligence_id))
            .filter(intel => intel !== null);

        const categoryCount = pastIntelligence.filter(
            intel => intel!.category === intelligence.category
        ).length;

        return categoryCount / pastIntelligence.length;
    }

    private getTrendingScore(intelligence: AgentIntelligence): number {
        // Simple trending score based on recent sales
        const recentSalesThreshold = 5;
        if (intelligence.sales_count >= recentSalesThreshold) {
            return Math.min(1, intelligence.sales_count / (recentSalesThreshold * 2));
        }
        return 0;
    }

    // Get trending intelligence across the marketplace
    getTrendingIntelligence(limit: number = 5): AgentIntelligence[] {
        const allIntelligence = this.intelligenceManager.getAllIntelligence();

        return allIntelligence
            .filter(intel => intel.sales_count > 0)
            .sort((a, b) => {
                // Sort by a combination of recent sales and quality
                const scoreA = (a.sales_count * 0.6) + (a.rating * 0.4);
                const scoreB = (b.sales_count * 0.6) + (b.rating * 0.4);
                return scoreB - scoreA;
            })
            .slice(0, limit);
    }

    // Get intelligence recommendations for similar agents
    getSimilarAgentRecommendations(agentKey: string, limit: number = 5): AgentIntelligence[] {
        const agent = this.agentManager.getAgent(agentKey);
        if (!agent) return [];

        // Find agents with similar specializations
        const similarAgents = this.agentManager.getAllAgents()
            .filter(otherAgent => otherAgent.public_key !== agentKey)
            .filter(otherAgent => {
                const overlap = agent.specialization.filter(spec =>
                    otherAgent.specialization.some(otherSpec =>
                        otherSpec.toLowerCase().includes(spec.toLowerCase()) ||
                        spec.toLowerCase().includes(otherSpec.toLowerCase())
                    )
                ).length;
                return overlap > 0;
            });

        // Get intelligence purchased by similar agents
        const similarAgentTransactions = similarAgents.flatMap(similarAgent =>
            this.transactionManager.getAgentTransactions(similarAgent.public_key)
        );

        // Find most popular intelligence among similar agents
        const intelligencePopularity = new Map<string, number>();
        similarAgentTransactions.forEach(tx => {
            const current = intelligencePopularity.get(tx.intelligence_id) || 0;
            intelligencePopularity.set(tx.intelligence_id, current + 1);
        });

        // Get the intelligence objects and sort by popularity
        const recommendations: AgentIntelligence[] = [];
        for (const [intelligenceId, popularity] of intelligencePopularity.entries()) {
            const intelligence = this.intelligenceManager.getIntelligence(intelligenceId);
            if (intelligence && intelligence.seller !== agentKey) {
                recommendations.push(intelligence);
            }
        }

        return recommendations
            .sort((a, b) => {
                const popularityA = intelligencePopularity.get(a.id) || 0;
                const popularityB = intelligencePopularity.get(b.id) || 0;
                return popularityB - popularityA;
            })
            .slice(0, limit);
    }
}