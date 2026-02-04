import type { AgentProfile, IntelligenceTransaction } from '../types/index.js';
import { CONFIG } from '../config/index.js';

export class AgentManager {
    private agents: Map<string, AgentProfile> = new Map();

    async registerAgent(
        publicKey: string,
        profile: Omit<AgentProfile, 'public_key' | 'created_at' | 'total_sales' | 'total_earnings' | 'reputation_score'>
    ): Promise<boolean> {
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
    }

    getAgent(publicKey: string): AgentProfile | undefined {
        return this.agents.get(publicKey);
    }

    hasAgent(publicKey: string): boolean {
        return this.agents.has(publicKey);
    }

    getTopAgents(limit: number = 10): AgentProfile[] {
        return Array.from(this.agents.values())
            .sort((a, b) => b.reputation_score - a.reputation_score)
            .slice(0, limit);
    }

    updateAgentStats(publicKey: string, earningsIncrease: number): void {
        const agent = this.agents.get(publicKey);
        if (agent) {
            agent.total_sales++;
            agent.total_earnings += earningsIncrease;
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