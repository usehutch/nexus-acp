import { Connection, PublicKey } from '@solana/web3.js';
import type { AgentIntelligence, IntelligenceTransaction } from '../types/index.js';

interface ReasoningCommit {
    id: string;
    agentId: string;
    intelligenceId: string;
    commitHash: string;
    timestamp: number;
    status: 'committed' | 'revealed' | 'expired';
}

interface ReasoningReveal {
    commitId: string;
    reasoning: {
        decision: 'buy' | 'sell' | 'rate';
        factors: string[];
        confidence: number;
        expectedValue: number;
        riskAssessment: string;
        methodology: string;
    };
    proof: string;
    timestamp: number;
}

interface TransparencyConfig {
    endpoint: string;
    enabled: boolean;
    commitTimeoutMs: number;
    requireProof: boolean;
}

export class TransparencyLayer {
    private connection: Connection;
    private config: TransparencyConfig;
    private commits: Map<string, ReasoningCommit> = new Map();
    private reveals: Map<string, ReasoningReveal> = new Map();

    constructor(connection: Connection, config: Partial<TransparencyConfig> = {}) {
        this.connection = connection;
        this.config = {
            endpoint: 'https://www.solprism.app/api',
            enabled: true,
            commitTimeoutMs: 300000, // 5 minutes
            requireProof: true,
            ...config
        };
    }

    /**
     * Commit reasoning before making a trade decision
     * Implements SOLPRISM's commit-reveal scheme as suggested by Mereum
     */
    async commitReasoning(
        agentId: string,
        intelligenceId: string,
        reasoning: ReasoningReveal['reasoning']
    ): Promise<string> {
        if (!this.config.enabled) {
            return 'transparency_disabled';
        }

        const commitId = `commit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const commitHash = this.generateCommitHash(reasoning, commitId);

        const commit: ReasoningCommit = {
            id: commitId,
            agentId,
            intelligenceId,
            commitHash,
            timestamp: Date.now(),
            status: 'committed'
        };

        try {
            // Try to commit to SOLPRISM
            await this.commitToSOLPRISM(commit);
        } catch (error) {
            console.log(`⚠️  SOLPRISM API unavailable, using local commit`);
        }

        this.commits.set(commitId, commit);

        // Set timeout for automatic expiration
        setTimeout(() => {
            const storedCommit = this.commits.get(commitId);
            if (storedCommit && storedCommit.status === 'committed') {
                storedCommit.status = 'expired';
                console.log(`⏰ Commit ${commitId} expired without reveal`);
            }
        }, this.config.commitTimeoutMs);

        console.log(`📝 Reasoning committed: ${commitId} for intelligence ${intelligenceId.substr(0, 8)}...`);
        return commitId;
    }

    /**
     * Reveal reasoning after trade execution
     */
    async revealReasoning(
        commitId: string,
        reasoning: ReasoningReveal['reasoning'],
        transactionId?: string
    ): Promise<boolean> {
        const commit = this.commits.get(commitId);
        if (!commit) {
            throw new Error('Commit not found');
        }

        if (commit.status !== 'committed') {
            throw new Error(`Cannot reveal: commit status is ${commit.status}`);
        }

        // Verify the reasoning matches the commit
        const computedHash = this.generateCommitHash(reasoning, commitId);
        if (computedHash !== commit.commitHash) {
            throw new Error('Reasoning does not match commit hash');
        }

        const reveal: ReasoningReveal = {
            commitId,
            reasoning,
            proof: this.generateProof(reasoning, commit),
            timestamp: Date.now()
        };

        try {
            // Try to reveal to SOLPRISM
            await this.revealToSOLPRISM(reveal, transactionId);
        } catch (error) {
            console.log(`⚠️  SOLPRISM API unavailable, using local reveal`);
        }

        this.reveals.set(commitId, reveal);
        commit.status = 'revealed';

        console.log(`🔍 Reasoning revealed: ${commitId}`);
        console.log(`   Decision: ${reasoning.decision}`);
        console.log(`   Confidence: ${reasoning.confidence}%`);
        console.log(`   Expected Value: ${reasoning.expectedValue} SOL`);

        return true;
    }

    /**
     * Audit an agent's decision-making process
     */
    async auditAgent(agentId: string, timeRange?: { start: number; end: number }): Promise<{
        commits: number;
        reveals: number;
        transparency_score: number;
        decision_patterns: any;
        audit_report: string[];
    }> {
        const agentCommits = Array.from(this.commits.values()).filter(commit => {
            if (commit.agentId !== agentId) return false;
            if (timeRange) {
                return commit.timestamp >= timeRange.start && commit.timestamp <= timeRange.end;
            }
            return true;
        });

        const agentReveals = Array.from(this.reveals.values()).filter(reveal => {
            const commit = this.commits.get(reveal.commitId);
            return commit?.agentId === agentId;
        });

        const commits = agentCommits.length;
        const reveals = agentReveals.length;
        const transparency_score = commits > 0 ? (reveals / commits) * 100 : 0;

        // Analyze decision patterns
        const decisions = agentReveals.map(r => r.reasoning);
        const decision_patterns = {
            avg_confidence: decisions.length > 0 ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length : 0,
            decision_types: decisions.reduce((acc, d) => {
                acc[d.decision] = (acc[d.decision] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            common_factors: this.extractCommonFactors(decisions),
            risk_profile: this.analyzeRiskProfile(decisions)
        };

        const audit_report = [
            `Agent ${agentId.substr(0, 8)}... transparency audit:`,
            `- Total decisions: ${commits}`,
            `- Revealed reasoning: ${reveals} (${transparency_score.toFixed(1)}%)`,
            `- Average confidence: ${decision_patterns.avg_confidence.toFixed(1)}%`,
            `- Most common decision type: ${Object.entries(decision_patterns.decision_types).sort(([,a], [,b]) => b-a)[0]?.[0] || 'None'}`,
            `- Risk profile: ${decision_patterns.risk_profile}`
        ];

        return { commits, reveals, transparency_score, decision_patterns, audit_report };
    }

    /**
     * Get transparency statistics for the marketplace
     */
    getTransparencyStats(): {
        total_commits: number;
        total_reveals: number;
        transparency_rate: number;
        top_transparent_agents: { agentId: string; score: number }[];
    } {
        const total_commits = this.commits.size;
        const total_reveals = this.reveals.size;
        const transparency_rate = total_commits > 0 ? (total_reveals / total_commits) * 100 : 0;

        // Calculate agent transparency scores
        const agentScores = new Map<string, { commits: number; reveals: number }>();

        this.commits.forEach(commit => {
            const score = agentScores.get(commit.agentId) || { commits: 0, reveals: 0 };
            score.commits++;
            agentScores.set(commit.agentId, score);
        });

        this.reveals.forEach(reveal => {
            const commit = this.commits.get(reveal.commitId);
            if (commit) {
                const score = agentScores.get(commit.agentId) || { commits: 0, reveals: 0 };
                score.reveals++;
                agentScores.set(commit.agentId, score);
            }
        });

        const top_transparent_agents = Array.from(agentScores.entries())
            .map(([agentId, score]) => ({
                agentId,
                score: score.commits > 0 ? (score.reveals / score.commits) * 100 : 0
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        return { total_commits, total_reveals, transparency_rate, top_transparent_agents };
    }

    /**
     * Verify a specific transaction's reasoning
     */
    async verifyTransaction(commitId: string): Promise<{
        verified: boolean;
        reasoning?: ReasoningReveal['reasoning'];
        trust_score: number;
        verification_details: string[];
    }> {
        const commit = this.commits.get(commitId);
        const reveal = this.reveals.get(commitId);

        if (!commit || !reveal) {
            return {
                verified: false,
                trust_score: 0,
                verification_details: ['Commit or reveal not found']
            };
        }

        const verified = commit.status === 'revealed';
        const verification_details = [
            `Commit hash: ${commit.commitHash}`,
            `Reveal timestamp: ${new Date(reveal.timestamp).toISOString()}`,
            `Decision: ${reveal.reasoning.decision}`,
            `Confidence: ${reveal.reasoning.confidence}%`,
            `Methodology: ${reveal.reasoning.methodology}`
        ];

        // Calculate trust score based on various factors
        const trust_score = this.calculateTrustScore(commit, reveal);

        return {
            verified,
            reasoning: reveal.reasoning,
            trust_score,
            verification_details
        };
    }

    /**
     * Generate commit hash for reasoning
     */
    private generateCommitHash(reasoning: ReasoningReveal['reasoning'], salt: string): string {
        const data = JSON.stringify({
            ...reasoning,
            salt
        });

        // Simple hash for demo - in production would use proper cryptographic hash
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        return Math.abs(hash).toString(16).padStart(16, '0');
    }

    /**
     * Generate proof of reasoning integrity
     */
    private generateProof(reasoning: ReasoningReveal['reasoning'], commit: ReasoningCommit): string {
        const proofData = {
            commit: commit.commitHash,
            timestamp: commit.timestamp,
            agent: commit.agentId,
            reasoning_hash: this.generateCommitHash(reasoning, commit.id)
        };

        return Buffer.from(JSON.stringify(proofData)).toString('base64');
    }

    /**
     * Commit to SOLPRISM protocol (simulated)
     */
    private async commitToSOLPRISM(commit: ReasoningCommit): Promise<void> {
        // In production, would use actual SOLPRISM SDK
        // npm install @solprism/sdk
        try {
            const response = await fetch(`${this.config.endpoint}/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(commit)
            });

            if (response.ok) {
                console.log(`📡 Committed to SOLPRISM: ${commit.id}`);
            }
        } catch (error) {
            throw new Error('SOLPRISM commit failed');
        }
    }

    /**
     * Reveal to SOLPRISM protocol (simulated)
     */
    private async revealToSOLPRISM(reveal: ReasoningReveal, transactionId?: string): Promise<void> {
        try {
            const response = await fetch(`${this.config.endpoint}/reveal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...reveal, transactionId })
            });

            if (response.ok) {
                console.log(`🔍 Revealed to SOLPRISM: ${reveal.commitId}`);
            }
        } catch (error) {
            throw new Error('SOLPRISM reveal failed');
        }
    }

    /**
     * Extract common decision factors
     */
    private extractCommonFactors(decisions: ReasoningReveal['reasoning'][]): string[] {
        const factorCounts = new Map<string, number>();

        decisions.forEach(decision => {
            decision.factors.forEach(factor => {
                factorCounts.set(factor, (factorCounts.get(factor) || 0) + 1);
            });
        });

        return Array.from(factorCounts.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([factor]) => factor);
    }

    /**
     * Analyze risk profile from decisions
     */
    private analyzeRiskProfile(decisions: ReasoningReveal['reasoning'][]): string {
        if (decisions.length === 0) return 'Unknown';

        const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;
        const avgExpectedValue = decisions.reduce((sum, d) => sum + d.expectedValue, 0) / decisions.length;

        const riskKeywords = decisions.flatMap(d => d.riskAssessment.toLowerCase().split(' '));
        const highRiskCount = riskKeywords.filter(word => ['high', 'risky', 'volatile'].includes(word)).length;
        const lowRiskCount = riskKeywords.filter(word => ['low', 'safe', 'stable'].includes(word)).length;

        if (avgConfidence > 80 && lowRiskCount > highRiskCount) return 'Conservative';
        if (avgConfidence > 70 && avgExpectedValue > 0.1) return 'Moderate';
        if (highRiskCount > lowRiskCount) return 'Aggressive';

        return 'Balanced';
    }

    /**
     * Calculate trust score for a commit/reveal pair
     */
    private calculateTrustScore(commit: ReasoningCommit, reveal: ReasoningReveal): number {
        let score = 100;

        // Deduct points for late reveal
        const revealDelay = reveal.timestamp - commit.timestamp;
        if (revealDelay > this.config.commitTimeoutMs * 0.8) score -= 20;

        // Deduct points for low confidence
        if (reveal.reasoning.confidence < 50) score -= 30;

        // Add points for detailed reasoning
        if (reveal.reasoning.factors.length >= 3) score += 10;
        if (reveal.reasoning.methodology.length > 50) score += 10;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get transparency layer status
     */
    getTransparencyStatus(): { enabled: boolean; protocol: string; features: string[] } {
        return {
            enabled: this.config.enabled,
            protocol: 'SOLPRISM',
            features: [
                'Commit-Reveal Scheme',
                'Decision Auditing',
                'Trust Scoring',
                'Reasoning Verification',
                'Agent Transparency Ranking'
            ]
        };
    }
}