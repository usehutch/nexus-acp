import { AgentManager } from '../../src/core/agent-manager.ts';
import { CONFIG } from '../../src/config/index.ts';
import type { AgentProfile, IntelligenceTransaction } from '../../src/types/index.ts';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('AgentManager', () => {
    let agentManager: AgentManager;

    beforeEach(() => {
        agentManager = new AgentManager();
    });

    describe('Agent Registration', () => {
        it('should register a new agent successfully', async () => {
            const result = await agentManager.registerAgent('test-key-123', {
                name: 'Test Agent',
                description: 'A test agent for unit testing',
                specialization: ['testing', 'validation'],
                verified: false
            });

            expect(result).toBe(true);
            expect(agentManager.hasAgent('test-key-123')).toBe(true);
        });

        it('should create agent with correct initial values', async () => {
            await agentManager.registerAgent('test-key-456', {
                name: 'Test Agent 2',
                description: 'Another test agent',
                specialization: ['analytics'],
                verified: true
            });

            const agent = agentManager.getAgent('test-key-456');
            expect(agent).toBeDefined();
            expect(agent!.public_key).toBe('test-key-456');
            expect(agent!.name).toBe('Test Agent 2');
            expect(agent!.description).toBe('Another test agent');
            expect(agent!.specialization).toEqual(['analytics']);
            expect(agent!.verified).toBe(true);
            expect(agent!.reputation_score).toBe(CONFIG.MARKETPLACE.INITIAL_REPUTATION);
            expect(agent!.total_sales).toBe(0);
            expect(agent!.total_earnings).toBe(0);
            expect(typeof agent!.created_at).toBe('number');
            expect(agent!.created_at).toBeGreaterThan(0);
        });

        it('should allow multiple agents with different keys', async () => {
            await agentManager.registerAgent('agent1', {
                name: 'Agent One',
                description: 'First agent',
                specialization: ['defi'],
                verified: false
            });

            await agentManager.registerAgent('agent2', {
                name: 'Agent Two',
                description: 'Second agent',
                specialization: ['trading'],
                verified: true
            });

            expect(agentManager.getAgentCount()).toBe(2);
            expect(agentManager.hasAgent('agent1')).toBe(true);
            expect(agentManager.hasAgent('agent2')).toBe(true);
        });
    });

    describe('Agent Retrieval', () => {
        beforeEach(async () => {
            await agentManager.registerAgent('retrieval-test', {
                name: 'Retrieval Test Agent',
                description: 'Agent for testing retrieval',
                specialization: ['testing'],
                verified: false
            });
        });

        it('should return agent by public key', () => {
            const agent = agentManager.getAgent('retrieval-test');
            expect(agent).toBeDefined();
            expect(agent!.public_key).toBe('retrieval-test');
            expect(agent!.name).toBe('Retrieval Test Agent');
        });

        it('should return undefined for non-existent agent', () => {
            const agent = agentManager.getAgent('non-existent');
            expect(agent).toBeUndefined();
        });

        it('should correctly check agent existence', () => {
            expect(agentManager.hasAgent('retrieval-test')).toBe(true);
            expect(agentManager.hasAgent('does-not-exist')).toBe(false);
        });

        it('should return all agents', () => {
            const agents = agentManager.getAllAgents();
            expect(Array.isArray(agents)).toBe(true);
            expect(agents.length).toBe(1);
            expect(agents[0].public_key).toBe('retrieval-test');
        });

        it('should return correct agent count', () => {
            expect(agentManager.getAgentCount()).toBe(1);
        });
    });

    describe('Top Agents Ranking', () => {
        beforeEach(async () => {
            const agentsData = [
                { key: 'agent1', reputation: 900 },
                { key: 'agent2', reputation: 700 },
                { key: 'agent3', reputation: 800 },
                { key: 'agent4', reputation: 600 },
                { key: 'agent5', reputation: 950 }
            ];

            for (const { key, reputation } of agentsData) {
                await agentManager.registerAgent(key, {
                    name: `Agent ${key}`,
                    description: `Test agent ${key}`,
                    specialization: ['testing'],
                    verified: false
                });
                // Manually set reputation for testing
                const agent = agentManager.getAgent(key)!;
                agent.reputation_score = reputation;
            }
        });

        it('should return agents sorted by reputation score', () => {
            const topAgents = agentManager.getTopAgents(5);
            expect(topAgents).toHaveLength(5);
            expect(topAgents[0].public_key).toBe('agent5'); // 950
            expect(topAgents[1].public_key).toBe('agent1'); // 900
            expect(topAgents[2].public_key).toBe('agent3'); // 800
            expect(topAgents[3].public_key).toBe('agent2'); // 700
            expect(topAgents[4].public_key).toBe('agent4'); // 600
        });

        it('should respect the limit parameter', () => {
            const topAgents = agentManager.getTopAgents(3);
            expect(topAgents).toHaveLength(3);
            expect(topAgents[0].reputation_score).toBe(950);
            expect(topAgents[1].reputation_score).toBe(900);
            expect(topAgents[2].reputation_score).toBe(800);
        });

        it('should use default limit when not provided', () => {
            const topAgents = agentManager.getTopAgents();
            expect(topAgents).toHaveLength(5); // All available agents
        });

        it('should handle limit larger than available agents', () => {
            const topAgents = agentManager.getTopAgents(20);
            expect(topAgents).toHaveLength(5); // Only 5 agents available
        });
    });

    describe('Agent Statistics Updates', () => {
        beforeEach(async () => {
            await agentManager.registerAgent('stats-test', {
                name: 'Stats Test Agent',
                description: 'Agent for testing statistics',
                specialization: ['testing'],
                verified: false
            });
        });

        it('should update agent sales and earnings', () => {
            const initialAgent = agentManager.getAgent('stats-test')!;
            expect(initialAgent.total_sales).toBe(0);
            expect(initialAgent.total_earnings).toBe(0);

            agentManager.updateAgentStats('stats-test', 0.5);

            const updatedAgent = agentManager.getAgent('stats-test')!;
            expect(updatedAgent.total_sales).toBe(1);
            expect(updatedAgent.total_earnings).toBe(0.5);
        });

        it('should accumulate multiple updates', () => {
            agentManager.updateAgentStats('stats-test', 0.3);
            agentManager.updateAgentStats('stats-test', 0.7);
            agentManager.updateAgentStats('stats-test', 0.2);

            const agent = agentManager.getAgent('stats-test')!;
            expect(agent.total_sales).toBe(3);
            expect(agent.total_earnings).toBe(1.2);
        });

        it('should handle non-existent agent gracefully', () => {
            expect(() => {
                agentManager.updateAgentStats('non-existent', 1.0);
            }).not.toThrow();
        });
    });

    describe('Reputation Updates', () => {
        beforeEach(async () => {
            await agentManager.registerAgent('rep-seller', {
                name: 'Reputation Test Seller',
                description: 'Seller agent for reputation testing',
                specialization: ['selling'],
                verified: false
            });

            await agentManager.registerAgent('rep-buyer', {
                name: 'Reputation Test Buyer',
                description: 'Buyer agent for reputation testing',
                specialization: ['buying'],
                verified: false
            });
        });

        it('should update reputation based on ratings', () => {
            const transactions: IntelligenceTransaction[] = [
                {
                    id: 'tx1',
                    buyer: 'rep-buyer',
                    seller: 'rep-seller',
                    intelligence_id: 'intel1',
                    price: 0.1,
                    timestamp: Date.now(),
                    rating: 5
                },
                {
                    id: 'tx2',
                    buyer: 'another-buyer',
                    seller: 'rep-seller',
                    intelligence_id: 'intel2',
                    price: 0.2,
                    timestamp: Date.now(),
                    rating: 4
                }
            ];

            agentManager.updateAgentReputation(transactions);

            const seller = agentManager.getAgent('rep-seller')!;
            const expectedRating = (5 + 4) / 2; // Average rating = 4.5
            const expectedReputation = Math.round((expectedRating / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);

            expect(seller.reputation_score).toBe(expectedReputation); // 900
        });

        it('should handle agents with no ratings', () => {
            const transactions: IntelligenceTransaction[] = [
                {
                    id: 'tx1',
                    buyer: 'rep-buyer',
                    seller: 'rep-seller',
                    intelligence_id: 'intel1',
                    price: 0.1,
                    timestamp: Date.now()
                    // No rating
                }
            ];

            const originalReputation = agentManager.getAgent('rep-seller')!.reputation_score;
            agentManager.updateAgentReputation(transactions);
            const updatedReputation = agentManager.getAgent('rep-seller')!.reputation_score;

            expect(updatedReputation).toBe(originalReputation); // Should remain unchanged
        });

        it('should handle empty transactions array', () => {
            const originalReputation = agentManager.getAgent('rep-seller')!.reputation_score;
            agentManager.updateAgentReputation([]);
            const updatedReputation = agentManager.getAgent('rep-seller')!.reputation_score;

            expect(updatedReputation).toBe(originalReputation);
        });

        it('should calculate correct reputation for edge case ratings', () => {
            const transactions: IntelligenceTransaction[] = [
                {
                    id: 'tx1',
                    buyer: 'rep-buyer',
                    seller: 'rep-seller',
                    intelligence_id: 'intel1',
                    price: 0.1,
                    timestamp: Date.now(),
                    rating: 1 // Minimum rating
                }
            ];

            agentManager.updateAgentReputation(transactions);

            const seller = agentManager.getAgent('rep-seller')!;
            const expectedReputation = Math.round((1 / CONFIG.MARKETPLACE.MAX_RATING) * CONFIG.MARKETPLACE.MAX_REPUTATION);

            expect(seller.reputation_score).toBe(expectedReputation); // 200
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty specialization array', async () => {
            const result = await agentManager.registerAgent('empty-spec', {
                name: 'Empty Spec Agent',
                description: 'Agent with no specializations',
                specialization: [],
                verified: false
            });

            expect(result).toBe(true);
            const agent = agentManager.getAgent('empty-spec')!;
            expect(agent.specialization).toEqual([]);
        });

        it('should handle long agent names and descriptions', async () => {
            const longName = 'A'.repeat(1000);
            const longDescription = 'B'.repeat(5000);

            const result = await agentManager.registerAgent('long-content', {
                name: longName,
                description: longDescription,
                specialization: ['testing'],
                verified: true
            });

            expect(result).toBe(true);
            const agent = agentManager.getAgent('long-content')!;
            expect(agent.name).toBe(longName);
            expect(agent.description).toBe(longDescription);
        });

        it('should handle special characters in public keys', async () => {
            const specialKey = 'agent-123_$%^&*()';

            const result = await agentManager.registerAgent(specialKey, {
                name: 'Special Key Agent',
                description: 'Agent with special characters in key',
                specialization: ['special'],
                verified: false
            });

            expect(result).toBe(true);
            expect(agentManager.hasAgent(specialKey)).toBe(true);
        });

        it('should handle getTopAgents with zero limit', () => {
            const topAgents = agentManager.getTopAgents(0);
            expect(topAgents).toEqual([]);
        });

        it('should handle negative earnings updates gracefully', () => {
            agentManager.registerAgent('negative-test', {
                name: 'Negative Test',
                description: 'Test negative earnings',
                specialization: ['test'],
                verified: false
            });

            agentManager.updateAgentStats('negative-test', -0.5);
            const agent = agentManager.getAgent('negative-test')!;

            expect(agent.total_sales).toBe(1); // Should still increment
            expect(agent.total_earnings).toBe(-0.5); // Should accept negative value
        });
    });
});