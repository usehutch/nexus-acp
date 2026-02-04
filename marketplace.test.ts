import { test, expect, describe, beforeEach } from "bun:test";
import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import { AgentMarketplace, type AgentProfile, type AgentIntelligence } from './marketplace';

describe("AgentMarketplace", () => {
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
            expect(stats.totalAgents).toBeGreaterThanOrEqual(3); // 2 sample + 1 new
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

            expect(listed!.quality_score).toBe(10); // reputation_score 100 / 10
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

            const stats = marketplace.getMarketStats();
            expect(stats.totalTransactions).toBeGreaterThanOrEqual(1);
            expect(stats.totalVolume).toBeGreaterThanOrEqual(0.5);
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

        test("should increment sales count after purchase", async () => {
            const beforePurchase = marketplace.searchIntelligence();
            const intel = beforePurchase.find(i => i.id === intelligenceId)!;
            const initialSales = intel.sales_count;

            await marketplace.purchaseIntelligence(testAgent2, intelligenceId);

            const afterPurchase = marketplace.searchIntelligence();
            const updatedIntel = afterPurchase.find(i => i.id === intelligenceId)!;

            expect(updatedIntel.sales_count).toBe(initialSales + 1);
        });
    });

    describe("Intelligence Rating", () => {
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
            await marketplace.rateIntelligence(testAgent2, intelligenceId, 5, "Excellent analysis!");

            const intelligence = marketplace.searchIntelligence();
            const rated = intelligence.find(intel => intel.id === intelligenceId);

            expect(rated!.rating).toBe(5);
        });

        test("should update seller reputation after rating", async () => {
            await marketplace.rateIntelligence(testAgent2, intelligenceId, 4);

            const topAgents = marketplace.getTopAgents(10);
            const seller = topAgents.find(agent => agent.public_key === testAgent1);

            expect(seller!.reputation_score).toBe(800); // (4/5) * 1000
        });

        test("should throw error for invalid rating", async () => {
            await expect(
                marketplace.rateIntelligence(testAgent2, intelligenceId, 6)
            ).rejects.toThrow("Rating must be between 1 and 5");

            await expect(
                marketplace.rateIntelligence(testAgent2, intelligenceId, 0)
            ).rejects.toThrow("Rating must be between 1 and 5");
        });

        test("should prevent rating same transaction twice", async () => {
            await marketplace.rateIntelligence(testAgent2, intelligenceId, 5);

            await expect(
                marketplace.rateIntelligence(testAgent2, intelligenceId, 4)
            ).rejects.toThrow("Transaction not found or already rated");
        });

        test("should calculate average rating correctly", async () => {
            // Rate from first buyer
            await marketplace.rateIntelligence(testAgent2, intelligenceId, 5);

            // Create second buyer and purchase
            const testAgent3 = Keypair.generate().publicKey.toString();
            await marketplace.registerAgent(testAgent3, {
                name: "Second Buyer",
                description: "Another buyer",
                specialization: ["price-prediction"],
                verified: false
            });

            await marketplace.purchaseIntelligence(testAgent3, intelligenceId);
            await marketplace.rateIntelligence(testAgent3, intelligenceId, 3);

            const intelligence = marketplace.searchIntelligence();
            const rated = intelligence.find(intel => intel.id === intelligenceId);

            expect(rated!.rating).toBe(4); // (5 + 3) / 2
        });
    });

    describe("Search and Discovery", () => {
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

        test("should search intelligence by minimum quality", () => {
            const results = marketplace.searchIntelligence({ minQuality: 50 });

            results.forEach(intel => {
                expect(intel.quality_score).toBeGreaterThanOrEqual(50);
            });
        });

        test("should combine multiple search filters", () => {
            const results = marketplace.searchIntelligence({
                category: "market-analysis",
                maxPrice: 0.2
            });

            results.forEach(intel => {
                expect(intel.category).toBe("market-analysis");
                expect(intel.price).toBeLessThanOrEqual(0.2);
            });
        });
    });

    describe("Market Statistics", () => {
        test("should provide correct market statistics", () => {
            const stats = marketplace.getMarketStats();

            expect(stats.totalAgents).toBeGreaterThanOrEqual(2); // Sample data includes 2 agents
            expect(stats.totalIntelligence).toBeGreaterThanOrEqual(2); // Sample data includes 2 intelligence
            expect(stats.totalTransactions).toBeGreaterThanOrEqual(0);
            expect(stats.totalVolume).toBeGreaterThanOrEqual(0);
            expect(typeof stats.categories).toBe("object");
        });

        test("should update statistics after transactions", async () => {
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

    describe("Top Agents Ranking", () => {
        test("should return top agents by reputation", () => {
            const topAgents = marketplace.getTopAgents(5);

            expect(Array.isArray(topAgents)).toBe(true);
            expect(topAgents.length).toBeLessThanOrEqual(5);

            // Verify sorting by reputation score
            for (let i = 0; i < topAgents.length - 1; i++) {
                expect(topAgents[i]!.reputation_score).toBeGreaterThanOrEqual(topAgents[i + 1]!.reputation_score);
            }
        });

        test("should limit results to requested amount", () => {
            const topAgents = marketplace.getTopAgents(1);
            expect(topAgents.length).toBe(1);
        });
    });

    describe("Sample Intelligence Data Generation", () => {
        beforeEach(async () => {
            await marketplace.registerAgent(testAgent1, {
                name: "Test Agent",
                description: "A test agent",
                specialization: ["market-analysis"],
                verified: false
            });
        });

        test("should generate market analysis data", async () => {
            const intelligenceId = await marketplace.listIntelligence(testAgent1, {
                title: "Market Analysis",
                description: "Test market analysis",
                category: "market-analysis",
                price: 0.1
            });

            await marketplace.registerAgent(testAgent2, {
                name: "Buyer Agent",
                description: "A buyer agent",
                specialization: ["trend-analysis"],
                verified: false
            });

            const result = await marketplace.purchaseIntelligence(testAgent2, intelligenceId);

            expect(result.data.data).toMatch(/SOL Price Analysis/);
            expect(result.data.prediction).toBeDefined();
            expect(result.data.confidence).toBeDefined();
            expect(result.data.timeframe).toBeDefined();
            expect(Array.isArray(result.data.key_indicators)).toBe(true);
        });

        test("should generate defi strategy data", async () => {
            const intelligenceId = await marketplace.listIntelligence(testAgent1, {
                title: "DeFi Strategy",
                description: "Test DeFi strategy",
                category: "defi-strategy",
                price: 0.2
            });

            await marketplace.registerAgent(testAgent2, {
                name: "Buyer Agent",
                description: "A buyer agent",
                specialization: ["trend-analysis"],
                verified: false
            });

            const result = await marketplace.purchaseIntelligence(testAgent2, intelligenceId);

            expect(result.data.strategy).toBeDefined();
            expect(Array.isArray(result.data.pools)).toBe(true);
            expect(result.data.expected_apy).toBeDefined();
            expect(result.data.risk_level).toBeDefined();
        });

        test("should generate price prediction data", async () => {
            const intelligenceId = await marketplace.listIntelligence(testAgent1, {
                title: "Price Prediction",
                description: "Test price prediction",
                category: "price-prediction",
                price: 0.15
            });

            await marketplace.registerAgent(testAgent2, {
                name: "Buyer Agent",
                description: "A buyer agent",
                specialization: ["trend-analysis"],
                verified: false
            });

            const result = await marketplace.purchaseIntelligence(testAgent2, intelligenceId);

            expect(result.data.asset).toBeDefined();
            expect(result.data.current_price).toBeDefined();
            expect(result.data.predicted_price_24h).toBeDefined();
            expect(result.data.predicted_price_7d).toBeDefined();
            expect(result.data.confidence_24h).toBeDefined();
            expect(result.data.confidence_7d).toBeDefined();
        });
    });
});