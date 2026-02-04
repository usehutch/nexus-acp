import { test, expect, describe, beforeEach } from "bun:test";
import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import { AgentMarketplace } from './marketplace';

describe("AgentMarketplace Unit Tests", () => {
    let marketplace: AgentMarketplace;
    let connection: Connection;
    let testAgent1: string;
    let testAgent2: string;

    beforeEach(() => {
        connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        marketplace = new AgentMarketplace(connection);
        testAgent1 = Keypair.generate().publicKey.toString();
        testAgent2 = Keypair.generate().publicKey.toString();
    });

    describe("Agent Registration", () => {
        test("should register a new agent successfully", async () => {
            const agentProfile = {
                name: "Test Agent",
                description: "A test agent for marketplace testing",
                specialization: ["market-analysis", "defi-strategy"],
                verified: false
            };

            const result = await marketplace.registerAgent(testAgent1, agentProfile);
            expect(result).toBe(true);

            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBeGreaterThanOrEqual(3);
        });

        test("should set correct initial values for new agent", async () => {
            const agentProfile = {
                name: "Test Agent",
                description: "A test agent",
                specialization: ["trend-analysis"],
                verified: false
            };

            await marketplace.registerAgent(testAgent1, agentProfile);

            const topAgents = marketplace.getTopAgents(10);
            const registeredAgent = topAgents.find(agent => agent.public_key === testAgent1);

            expect(registeredAgent).toBeDefined();
            expect(registeredAgent!.name).toBe("Test Agent");
            expect(registeredAgent!.reputation_score).toBe(100);
            expect(registeredAgent!.total_sales).toBe(0);
            expect(registeredAgent!.total_earnings).toBe(0);
        });
    });

    describe("Intelligence Listing", () => {
        beforeEach(async () => {
            await marketplace.registerAgent(testAgent1, {
                name: "Test Agent",
                description: "A test agent",
                specialization: ["market-analysis"],
                verified: false
            });
        });

        test("should list intelligence for sale successfully", async () => {
            const intelligence = {
                title: "Test Market Analysis",
                description: "Comprehensive test analysis",
                category: "market-analysis" as const,
                price: 0.25
            };

            const intelligenceId = await marketplace.listIntelligence(testAgent1, intelligence);

            expect(intelligenceId).toMatch(/^intel_/);

            const available = marketplace.searchIntelligence();
            const listed = available.find(intel => intel.id === intelligenceId);

            expect(listed).toBeDefined();
            expect(listed!.title).toBe("Test Market Analysis");
            expect(listed!.price).toBe(0.25);
            expect(listed!.seller).toBe(testAgent1);
        });

        test("should throw error when listing intelligence without agent registration", async () => {
            const intelligence = {
                title: "Test Analysis",
                description: "Test description",
                category: "market-analysis" as const,
                price: 0.1
            };

            await expect(
                marketplace.listIntelligence("unregistered-agent", intelligence)
            ).rejects.toThrow("Agent must be registered first");
        });

        test("should set quality score based on seller reputation", async () => {
            const intelligence = {
                title: "Test Analysis",
                description: "Test description",
                category: "market-analysis" as const,
                price: 0.1
            };

            const intelligenceId = await marketplace.listIntelligence(testAgent1, intelligence);
            const available = marketplace.searchIntelligence();
            const listed = available.find(intel => intel.id === intelligenceId);

            expect(listed!.quality_score).toBe(10);
        });
    });

    describe("Intelligence Purchase", () => {
        let intelligenceId: string;

        beforeEach(async () => {
            await marketplace.registerAgent(testAgent1, {
                name: "Seller Agent",
                description: "A seller agent",
                specialization: ["market-analysis"],
                verified: false
            });

            await marketplace.registerAgent(testAgent2, {
                name: "Buyer Agent",
                description: "A buyer agent",
                specialization: ["trend-analysis"],
                verified: false
            });

            intelligenceId = await marketplace.listIntelligence(testAgent1, {
                title: "Test Intelligence",
                description: "Test intelligence for purchase",
                category: "market-analysis",
                price: 0.5
            });
        });

        test("should purchase intelligence successfully", async () => {
            const result = await marketplace.purchaseIntelligence(testAgent2, intelligenceId);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.data).toMatch(/SOL Price Analysis/);
        });

        test("should update seller statistics after purchase", async () => {
            await marketplace.purchaseIntelligence(testAgent2, intelligenceId);

            const topAgents = marketplace.getTopAgents(10);
            const seller = topAgents.find(agent => agent.public_key === testAgent1);

            expect(seller!.total_sales).toBe(1);
            expect(seller!.total_earnings).toBe(0.5);
        });

        test("should throw error when purchasing non-existent intelligence", async () => {
            await expect(
                marketplace.purchaseIntelligence(testAgent2, "non-existent-id")
            ).rejects.toThrow("Intelligence not found");
        });
    });

    describe("Search and Filtering", () => {
        beforeEach(async () => {
            await marketplace.registerAgent(testAgent1, {
                name: "Test Agent",
                description: "A test agent",
                specialization: ["market-analysis"],
                verified: false
            });

            await marketplace.listIntelligence(testAgent1, {
                title: "Cheap Analysis",
                description: "Affordable analysis",
                category: "market-analysis",
                price: 0.1
            });

            await marketplace.listIntelligence(testAgent1, {
                title: "Expensive Strategy",
                description: "Premium strategy",
                category: "defi-strategy",
                price: 1.0
            });
        });

        test("should search intelligence by category", () => {
            const results = marketplace.searchIntelligence({ category: "market-analysis" });
            expect(results.length).toBeGreaterThanOrEqual(1);
            results.forEach(intel => {
                expect(intel.category).toBe("market-analysis");
            });
        });

        test("should search intelligence by max price", () => {
            const results = marketplace.searchIntelligence({ maxPrice: 0.5 });
            results.forEach(intel => {
                expect(intel.price).toBeLessThanOrEqual(0.5);
            });
        });

        test("should search intelligence by seller", () => {
            const results = marketplace.searchIntelligence({ seller: testAgent1 });
            results.forEach(intel => {
                expect(intel.seller).toBe(testAgent1);
            });
        });
    });

    describe("Market Statistics", () => {
        test("should provide correct initial market statistics", () => {
            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBe(2);
            expect(stats.totalIntelligence).toBe(2);
            expect(stats.totalTransactions).toBe(0);
            expect(stats.totalVolume).toBe(0);
        });

        test("should update statistics after operations", async () => {
            const initialStats = marketplace.getMarketStats();

            await marketplace.registerAgent(testAgent1, {
                name: "Test Agent",
                description: "A test agent",
                specialization: ["market-analysis"],
                verified: false
            });

            const intelligenceId = await marketplace.listIntelligence(testAgent1, {
                title: "Test Intelligence",
                description: "Test intelligence",
                category: "price-prediction",
                price: 0.3
            });

            await marketplace.registerAgent(testAgent2, {
                name: "Buyer Agent",
                description: "A buyer agent",
                specialization: ["trend-analysis"],
                verified: false
            });

            await marketplace.purchaseIntelligence(testAgent2, intelligenceId);

            const newStats = marketplace.getMarketStats();
            expect(newStats.totalAgents).toBe(initialStats.totalAgents + 2);
            expect(newStats.totalIntelligence).toBe(initialStats.totalIntelligence + 1);
            expect(newStats.totalTransactions).toBe(initialStats.totalTransactions + 1);
            expect(newStats.totalVolume).toBe(initialStats.totalVolume + 0.3);
        });
    });

    describe("Rating System", () => {
        let intelligenceId: string;

        beforeEach(async () => {
            await marketplace.registerAgent(testAgent1, {
                name: "Seller Agent",
                description: "A seller agent",
                specialization: ["market-analysis"],
                verified: false
            });

            await marketplace.registerAgent(testAgent2, {
                name: "Buyer Agent",
                description: "A buyer agent",
                specialization: ["trend-analysis"],
                verified: false
            });

            intelligenceId = await marketplace.listIntelligence(testAgent1, {
                title: "Test Intelligence",
                description: "Test intelligence for rating",
                category: "market-analysis",
                price: 0.25
            });

            await marketplace.purchaseIntelligence(testAgent2, intelligenceId);
        });

        test("should rate intelligence successfully", async () => {
            await marketplace.rateIntelligence(testAgent2, intelligenceId, 5, "Excellent!");

            const intelligence = marketplace.searchIntelligence();
            const rated = intelligence.find(intel => intel.id === intelligenceId);
            expect(rated!.rating).toBe(5);
        });

        test("should update seller reputation after rating", async () => {
            await marketplace.rateIntelligence(testAgent2, intelligenceId, 4);

            const topAgents = marketplace.getTopAgents(10);
            const seller = topAgents.find(agent => agent.public_key === testAgent1);
            expect(seller!.reputation_score).toBe(800);
        });

        test("should prevent invalid ratings", async () => {
            await expect(
                marketplace.rateIntelligence(testAgent2, intelligenceId, 6)
            ).rejects.toThrow("Rating must be between 1 and 5");
        });
    });
});