import { Connection, Keypair } from '@solana/web3.js';
import { AgentMarketplace } from './marketplace.js';
import type { AgentIntelligence } from './types/index.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CONFIG } from './config/index.js';
import { createWallet, type WalletData } from './utils/wallet.js';

async function main() {
    console.log('🚀 NEXUS Agent Intelligence Marketplace');
    console.log('=====================================\n');

    // Connect to Solana
    const connection = new Connection(CONFIG.SOLANA.RPC_URL, CONFIG.SOLANA.CONFIRMATION_LEVEL);
    console.log(`🌐 Connected to Solana ${CONFIG.SOLANA.NETWORK}`);

    // Load or create wallet
    const wallet = await loadOrCreateWallet();

    if (wallet) {
        const balance = await connection.getBalance(wallet.publicKey);
        console.log(`💰 Wallet balance: ${balance / 1e9} SOL\n`);
    }

    // Initialize marketplace
    const marketplace = new AgentMarketplace(connection);
    console.log('🏪 Agent Intelligence Marketplace initialized\n');

    // Demo the marketplace functionality
    await demonstrateMarketplace(marketplace, wallet);
}

async function loadOrCreateWallet(): Promise<Keypair | null> {
    const walletPath = join(process.cwd(), CONFIG.WALLET.DIRECTORY, CONFIG.WALLET.FILENAME);

    if (existsSync(walletPath)) {
        const walletData: WalletData = JSON.parse(readFileSync(walletPath, 'utf-8'));
        const wallet = createWallet(new Uint8Array(walletData.secretKey));
        console.log('💼 Loaded wallet:', wallet.publicKey.toString());
        return wallet;
    } else {
        console.log('⚠️ No wallet found. Run: bun run create-wallet.ts\n');
        return null;
    }
}

async function demonstrateMarketplace(marketplace: AgentMarketplace, wallet: Keypair | null) {
    console.log('🎯 === MARKETPLACE DEMONSTRATION ===\n');

    try {
        // Show market statistics
        console.log('📊 Market Statistics:');
        const stats = marketplace.getMarketStats();
        console.log('   Total Intelligence Listings:', stats.totalIntelligence);
        console.log('   Total Registered Agents:', stats.totalAgents);
        console.log('   Total Transactions:', stats.totalTransactions);
        console.log('   Total Volume:', stats.totalVolume.toFixed(2), 'SOL');
        console.log('   Categories:', Object.entries(stats.categories).map(([k, v]) => `${k}: ${v}`).join(', '));
        console.log();

        // Search available intelligence
        console.log('🔍 Available Intelligence:');
        const available = marketplace.searchIntelligence();
        available.forEach((intel, i) => {
            console.log(`   ${i + 1}. "${intel.title}" by ${intel.seller.substr(0, 8)}...`);
            console.log(`      Category: ${intel.category} | Price: ${intel.price} SOL | Quality: ${intel.quality_score}/100`);
            console.log(`      Sales: ${intel.sales_count} | Rating: ${intel.rating > 0 ? intel.rating.toFixed(1) + '/5⭐' : 'No ratings yet'}`);
            console.log();
        });

        // If we have a wallet, demonstrate purchases
        if (wallet && available.length > 0) {
            const firstIntelligence = available[0];
            if (firstIntelligence) {
                await demonstratePurchase(marketplace, wallet, firstIntelligence);
            }
            await demonstrateAgentRegistration(marketplace, wallet);
        }

        // Show top agents
        console.log('🏆 Top Agents by Reputation:');
        const topAgents = marketplace.getTopAgents(5);
        topAgents.forEach((agent, i) => {
            console.log(`   ${i + 1}. ${agent.name} (${agent.public_key.substr(0, 8)}...)`);
            console.log(`      Reputation: ${agent.reputation_score}/1000 | Sales: ${agent.total_sales} | Earnings: ${agent.total_earnings.toFixed(2)} SOL`);
            console.log(`      Specialization: ${agent.specialization.join(', ')}`);
            if (agent.verified) console.log('      ✅ Verified');
            console.log();
        });

        console.log('🎉 NEXUS Agent Intelligence Marketplace Demo Complete!');
        console.log('💡 This is the first marketplace where AI agents can buy and sell intelligence autonomously!');

    } catch (error) {
        console.error('❌ Demo error:', error);
    }
}

async function demonstratePurchase(marketplace: AgentMarketplace, wallet: Keypair, intel: AgentIntelligence) {
    console.log('💳 Making test purchase...');
    try {
        const purchase = await marketplace.purchaseIntelligence(
            wallet.publicKey.toString(),
            intel.id
        );

        if (purchase.success) {
            console.log('✅ Purchase successful!');
            console.log('📦 Intelligence Data Received:');
            console.log(JSON.stringify(purchase.data, null, 2));
            console.log();

            // Rate the intelligence
            console.log('⭐ Rating the intelligence...');
            await marketplace.rateIntelligence(
                wallet.publicKey.toString(),
                intel.id,
                5,
                'Excellent analysis, very helpful!'
            );
            console.log('✅ Rating submitted!\n');
        }
    } catch (error) {
        console.log('❌ Purchase failed:', error);
    }
}

async function demonstrateAgentRegistration(marketplace: AgentMarketplace, wallet: Keypair) {
    console.log('🤖 Registering as agent...');
    await marketplace.registerAgent(wallet.publicKey.toString(), {
        name: 'NEXUS Intelligence Agent',
        description: 'Advanced AI agent specializing in market analysis and strategic insights',
        specialization: ['market-analysis', 'defi-strategy', 'trend-analysis'],
        verified: false
    });

    // List our own intelligence
    console.log('📋 Listing intelligence for sale...');
    const intelligenceId = await marketplace.listIntelligence(wallet.publicKey.toString(), {
        title: 'Solana Ecosystem Growth Analysis',
        description: 'Comprehensive analysis of Solana DeFi protocols and growth opportunities',
        category: 'market-analysis',
        price: 0.25
    });
    console.log(`✅ Intelligence listed with ID: ${intelligenceId}\n`);
}

// Run the application
if (import.meta.main) {
    main().catch(console.error);
}