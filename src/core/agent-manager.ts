import type { AgentProfile, IntelligenceTransaction } from '../types/index.js';
import { CONFIG } from '../config/index.js';
import { errorHandler, ErrorCode, NexusError } from '../../error-handler.js';

export class AgentManager {
    private agents: Map<string, AgentProfile> = new Map();

    async registerAgent(
        publicKey: string,
        profile: Omit<AgentProfile, 'public_key' | 'created_at' | 'total_sales' | 'total_earnings' | 'reputation_score'>
    ): Promise<boolean> {
        try {
            // Validate required fields
            errorHandler.validateRequired(
                profile,
                ['name', 'description', 'specialization'],
                'agent registration'
            );

            errorHandler.validateRequired(
                { publicKey },
                ['publicKey'],
                'agent registration'
            );

            // Check if agent already exists
            if (this.agents.has(publicKey)) {
                throw new NexusError(
                    ErrorCode.AGENT_NOT_REGISTERED,
                    'Agent with this public key is already registered',
                    { publicKey, existingAgent: this.agents.get(publicKey)?.name }
                );
            }

            // Validate profile data
            if (profile.name.length < 3 || profile.name.length > 50) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Agent name must be between 3 and 50 characters',
                    { provided: profile.name }
                );
            }

            if (profile.description.length < 10 || profile.description.length > 500) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Agent description must be between 10 and 500 characters',
                    { provided: profile.description }
                );
            }

            if (!Array.isArray(profile.specialization) || profile.specialization.length === 0) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Agent must have at least one specialization',
                    { provided: profile.specialization }
                );
            }

            const agentProfile: AgentProfile = {
                ...profile,
                public_key: publicKey,
                reputation_score: CONFIG.MARKETPLACE.INITIAL_REPUTATION,
                total_sales: 0,
                total_earnings: 0,
                created_at: Date.now()
            };

            this.agents.set(publicKey, agentProfile);
            console.log(`✅ Agent registered: ${profile.name} (${publicKey})`);
            return true;
        } catch (error) {
            if (error instanceof NexusError) {
                throw error;
            }

            const nexusError = errorHandler.normalizeError(error, 'agent registration');
            errorHandler.logError(nexusError, 'AgentManager.registerAgent');
            throw nexusError;
        }
    }

    getAgent(publicKey: string): AgentProfile | undefined {
        try {
            if (!publicKey) {
                throw new NexusError(
                    ErrorCode.MISSING_REQUIRED_FIELD,
                    'Public key is required to get agent',
                    { provided: publicKey }
                );
            }

            return this.agents.get(publicKey);
        } catch (error) {
            const nexusError = errorHandler.normalizeError(error, 'agent lookup');
            errorHandler.logError(nexusError, 'AgentManager.getAgent');
            throw nexusError;
        }
    }

    hasAgent(publicKey: string): boolean {
        return this.agents.has(publicKey);
    }

    getTopAgents(limit: number = 10): AgentProfile[] {
        try {
            if (limit < 1 || limit > 100) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Limit must be between 1 and 100',
                    { provided: limit }
                );
            }

            return Array.from(this.agents.values())
                .sort((a, b) => b.reputation_score - a.reputation_score)
                .slice(0, limit);
        } catch (error) {
            if (error instanceof NexusError) {
                throw error;
            }

            const nexusError = errorHandler.normalizeError(error, 'top agents fetch');
            errorHandler.logError(nexusError, 'AgentManager.getTopAgents');
            throw nexusError;
        }
    }

    updateAgentStats(publicKey: string, earningsIncrease: number): void {
        try {
            errorHandler.validateRequired(
                { publicKey, earningsIncrease },
                ['publicKey', 'earningsIncrease'],
                'agent stats update'
            );

            if (earningsIncrease < 0) {
                throw new NexusError(
                    ErrorCode.INVALID_INPUT,
                    'Earnings increase cannot be negative',
                    { earningsIncrease }
                );
            }

            const agent = this.agents.get(publicKey);
            if (!agent) {
                throw new NexusError(
                    ErrorCode.AGENT_NOT_REGISTERED,
                    'Cannot update stats: Agent not found',
                    { publicKey }
                );
            }

            agent.total_sales++;
            agent.total_earnings += earningsIncrease;
        } catch (error) {
            if (error instanceof NexusError) {
                throw error;
            }

            const nexusError = errorHandler.normalizeError(error, 'agent stats update');
            errorHandler.logError(nexusError, 'AgentManager.updateAgentStats');
            throw nexusError;
        }
    }

    updateAgentReputation(transactions: IntelligenceTransaction[]): void {
        for (const [publicKey, agent] of this.agents) {
            const sellerRatings = transactions
                .filter(tx => tx.seller === publicKey && tx.rating)
                .map(tx => tx.rating!);

            if (sellerRatings.length > 0) {
                const avgRating = sellerRatings.reduce((a, b) => a + b, 0) / sellerRatings.length;
                agent.reputation_score = Math.round((avgRating / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);
            }
        }
    }

    getAllAgents(): AgentProfile[] {
        return Array.from(this.agents.values());
    }

    getAgentCount(): number {
        return this.agents.size;
    }
}