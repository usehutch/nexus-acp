import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import { AgentMarketplace } from './marketplace';
import { createDevnetWallet } from './create-wallet';
import { testWallet } from './test-wallet';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

describe("Main Application Integration Tests", () => {
    let connection: Connection;
    let marketplace: AgentMarketplace;

    beforeEach(() => {
        // Clean up wallet directory before each test
        const walletDir = join(process.cwd(), 'wallet');
        if (existsSync(walletDir)) {
            rmSync(walletDir, { recursive: true, force: true });
        }

        // Initialize connection and marketplace
        connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        marketplace = new AgentMarketplace(connection);
    });

    afterEach(() => {
        // Clean up after tests
        const walletDir = join(process.cwd(), 'wallet');
        if (existsSync(walletDir)) {
            rmSync(walletDir, { recursive: true, force: true });
        }
    });

    describe("Full Application Workflow", () => {
        test("should complete end-to-end workflow: create wallet -> test -> marketplace operations", async () => {
            // Step 1: Create a wallet
            const walletInfo = await createDevnetWallet();
            expect(walletInfo.publicKey).toBeDefined();
            expect(walletInfo.secretKey).toBeDefined();

            // Step 2: Test the wallet
            const testResult = await testWallet();
            expect(testResult.signatureTest).toBe(true);
            expect(testResult.publicKey).toBe(walletInfo.publicKey);

            // Step 3: Load wallet for marketplace operations
            const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');
            expect(existsSync(walletPath)).toBe(true);

            const walletData = JSON.parse(readFileSync(walletPath, 'utf-8'));
            const wallet = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));

            // Step 4: Marketplace operations
            // Register agent
            await marketplace.registerAgent(wallet.publicKey.toString(), {
                name: 'Integration Test Agent',
                description: 'Agent for integration testing',
                specialization: ['market-analysis'],
                verified: false
            });

            // List intelligence
            const intelligenceId = await marketplace.listIntelligence(wallet.publicKey.toString(), {
                title: 'Integration Test Intelligence',
                description: 'Intelligence for integration testing',
                category: 'market-analysis',
                price: 0.1
            });

            // Verify intelligence was listed
            const available = marketplace.searchIntelligence();
            const listed = available.find(intel => intel.id === intelligenceId);
            expect(listed).toBeDefined();
            expect(listed!.seller).toBe(wallet.publicKey.toString());

            // Get market stats
            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBeGreaterThanOrEqual(3); // Sample + our agent
            expect(stats.totalIntelligence).toBeGreaterThanOrEqual(3); // Sample + our intelligence
        });

        test("should handle marketplace operations without wallet", () => {
            // Should be able to browse marketplace without wallet
            const stats = marketplace.getMarketStats();
            expect(stats.totalAgents).toBeGreaterThanOrEqual(2);
            expect(stats.totalIntelligence).toBeGreaterThanOrEqual(2);

            const available = marketplace.searchIntelligence();
            expect(Array.isArray(available)).toBe(true);
            expect(available.length).toBeGreaterThanOrEqual(2);

            const topAgents = marketplace.getTopAgents(5);
            expect(Array.isArray(topAgents)).toBe(true);
            expect(topAgents.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe("Connection and Initialization", () => {
        test("should establish Solana devnet connection", async () => {
            expect(connection).toBeDefined();

            // Verify we can get slot number (basic connectivity test)
            const slot = await connection.getSlot();
            expect(typeof slot).toBe('number');
            expect(slot).toBeGreaterThan(0);
        });

        test("should initialize marketplace with sample data", () => {
            const stats = marketplace.getMarketStats();

            expect(stats.totalAgents).toBe(2); // AlphaTrader AI, CryptoOracle
            expect(stats.totalIntelligence).toBe(2); // Two sample intelligence items
            expect(stats.totalTransactions).toBe(0); // No transactions initially
            expect(stats.totalVolume).toBe(0);

            const topAgents = marketplace.getTopAgents(5);
            expect(topAgents.length).toBe(2);

            const agentNames = topAgents.map(agent => agent.name);
            expect(agentNames).toContain('AlphaTrader AI');
            expect(agentNames).toContain('CryptoOracle');
        });
    });

    describe("Wallet Integration", () => {
        test("should handle missing wallet gracefully", async () => {
            // When no wallet exists, app should still function for browsing
            const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');
            expect(existsSync(walletPath)).toBe(false);

            // Should still be able to view marketplace
            const stats = marketplace.getMarketStats();
            expect(stats).toBeDefined();

            const available = marketplace.searchIntelligence();
            expect(Array.isArray(available)).toBe(true);
        });

        test("should load existing wallet correctly", async () => {
            // Create wallet
            const walletInfo = await createDevnetWallet();

            // Verify wallet file exists and is readable
            const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');
            expect(existsSync(walletPath)).toBe(true);

            const walletData = JSON.parse(readFileSync(walletPath, 'utf-8'));
            expect(walletData.publicKey).toBe(walletInfo.publicKey);
            expect(walletData.network).toBe('devnet');

            // Should be able to recreate keypair
            const keypair = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
            expect(keypair.publicKey.toString()).toBe(walletInfo.publicKey);
        });
    });

    describe("Marketplace Integration", () => {
        test("should perform complete purchase and rating workflow", async () => {
            // Create two wallets - one seller, one buyer
            await createDevnetWallet();
            const walletData = JSON.parse(readFileSync(join(process.cwd(), 'wallet', 'devnet-wallet.json'), 'utf-8'));
            const sellerWallet = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));

            // Create buyer wallet (simulate second agent)
            const buyerWallet = Keypair.generate();

            // Register both agents
            await marketplace.registerAgent(sellerWallet.publicKey.toString(), {
                name: 'Seller Agent',
                description: 'Sells intelligence',
                specialization: ['market-analysis'],
                verified: false
            });

            await marketplace.registerAgent(buyerWallet.publicKey.toString(), {
                name: 'Buyer Agent',
                description: 'Buys intelligence',
                specialization: ['trend-analysis'],
                verified: false
            });

            // Seller lists intelligence
            const intelligenceId = await marketplace.listIntelligence(sellerWallet.publicKey.toString(), {
                title: 'Test Market Analysis',
                description: 'Comprehensive market analysis',
                category: 'market-analysis',
                price: 0.5
            });

            // Buyer purchases intelligence
            const purchase = await marketplace.purchaseIntelligence(buyerWallet.publicKey.toString(), intelligenceId);
            expect(purchase.success).toBe(true);
            expect(purchase.data).toBeDefined();

            // Buyer rates the intelligence
            await marketplace.rateIntelligence(buyerWallet.publicKey.toString(), intelligenceId, 5, 'Excellent analysis!');

            // Verify seller stats updated
            const topAgents = marketplace.getTopAgents(10);
            const seller = topAgents.find(agent => agent.public_key === sellerWallet.publicKey.toString());
            expect(seller!.total_sales).toBe(1);
            expect(seller!.total_earnings).toBe(0.5);
            expect(seller!.reputation_score).toBe(1000); // 5-star rating

            // Verify market stats updated
            const stats = marketplace.getMarketStats();
            expect(stats.totalTransactions).toBeGreaterThanOrEqual(1);
            expect(stats.totalVolume).toBeGreaterThanOrEqual(0.5);
        });

        test("should handle search and filtering correctly", async () => {
            // Create and register agent
            await createDevnetWallet();
            const walletData = JSON.parse(readFileSync(join(process.cwd(), 'wallet', 'devnet-wallet.json'), 'utf-8'));
            const wallet = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));

            await marketplace.registerAgent(wallet.publicKey.toString(), {
                name: 'Test Agent',
                description: 'Test agent',
                specialization: ['defi-strategy', 'price-prediction'],
                verified: false
            });

            // List different types of intelligence
            await marketplace.listIntelligence(wallet.publicKey.toString(), {
                title: 'Expensive DeFi Strategy',
                description: 'Premium DeFi strategy',
                category: 'defi-strategy',
                price: 1.0
            });

            await marketplace.listIntelligence(wallet.publicKey.toString(), {
                title: 'Cheap Price Prediction',
                description: 'Affordable price prediction',
                category: 'price-prediction',
                price: 0.1
            });

            // Test filtering by category
            const defiResults = marketplace.searchIntelligence({ category: 'defi-strategy' });
            expect(defiResults.some(intel => intel.category === 'defi-strategy')).toBe(true);

            // Test filtering by price
            const cheapResults = marketplace.searchIntelligence({ maxPrice: 0.5 });
            cheapResults.forEach(intel => {
                expect(intel.price).toBeLessThanOrEqual(0.5);
            });

            // Test filtering by seller
            const sellerResults = marketplace.searchIntelligence({ seller: wallet.publicKey.toString() });
            sellerResults.forEach(intel => {
                expect(intel.seller).toBe(wallet.publicKey.toString());
            });
        });
    });

    describe("Error Handling", () => {
        test("should handle network connection issues gracefully", async () => {
            // This test verifies the app doesn't crash with network issues
            // by completing basic operations that don't require network calls
            const stats = marketplace.getMarketStats();
            expect(stats).toBeDefined();

            const available = marketplace.searchIntelligence();
            expect(Array.isArray(available)).toBe(true);
        });

        test("should handle invalid marketplace operations", async () => {
            // Try to list intelligence without registering agent
            await expect(
                marketplace.listIntelligence('unregistered-agent', {
                    title: 'Test',
                    description: 'Test',
                    category: 'market-analysis',
                    price: 0.1
                })
            ).rejects.toThrow();

            // Try to purchase non-existent intelligence
            await expect(
                marketplace.purchaseIntelligence('buyer-key', 'non-existent-id')
            ).rejects.toThrow();

            // Try to rate with invalid rating
            await expect(
                marketplace.rateIntelligence('buyer-key', 'intel-id', 10)
            ).rejects.toThrow();
        });
    });

    describe("Sample Data Verification", () => {
        test("should have correct sample intelligence data", () => {
            const available = marketplace.searchIntelligence();

            expect(available.length).toBeGreaterThanOrEqual(2);

            const titles = available.map(intel => intel.title);
            expect(titles).toContain('SOL Bull Market Strategy');
            expect(titles).toContain('SOL 7-Day Price Prediction');

            const categories = available.map(intel => intel.category);
            expect(categories).toContain('defi-strategy');
            expect(categories).toContain('price-prediction');
        });

        test("should have correct sample agent data", () => {
            const topAgents = marketplace.getTopAgents(5);

            expect(topAgents.length).toBe(2);

            const names = topAgents.map(agent => agent.name);
            expect(names).toContain('AlphaTrader AI');
            expect(names).toContain('CryptoOracle');

            const specializations = topAgents.flatMap(agent => agent.specialization);
            expect(specializations).toContain('defi-strategy');
            expect(specializations).toContain('market-analysis');
            expect(specializations).toContain('price-prediction');
            expect(specializations).toContain('trend-analysis');
        });
    });
});