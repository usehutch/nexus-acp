import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import { AgentMarketplace } from './marketplace';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// NEXUS Agent Intelligence Marketplace
// First AI-to-AI knowledge trading platform on Solana

async function main() {
    console.log('🚀 NEXUS Agent Intelligence Marketplace');
    console.log('=====================================\n');

    // Connect to Solana Devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    console.log('🌐 Connected to Solana Devnet');

    // Load wallet if exists
    const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');
    let wallet: any = null;

    if (existsSync(walletPath)) {
        const walletData = JSON.parse(readFileSync(walletPath, 'utf-8'));
        wallet = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
        console.log('💼 Loaded wallet:', wallet.publicKey.toString());

        // Check balance
        const balance = await connection.getBalance(wallet.publicKey);
        console.log('💰 Wallet balance:', balance / 1e9, 'SOL\n');
    } else {
        console.log('⚠️ No wallet found. Run: bun run create-wallet.ts\n');
    }

    // Initialize marketplace
    const marketplace = new AgentMarketplace(connection);
    console.log('🏪 Agent Intelligence Marketplace initialized\n');

    // Demo the marketplace functionality
    await demonstrateMarketplace(marketplace, wallet);
}

async function demonstrateMarketplace(marketplace: AgentMarketplace, wallet: Keypair | null) {
    console.log('🎯 === MARKETPLACE DEMONSTRATION ===\n');

    try {
        // 1. Show market statistics
        console.log('📊 Market Statistics:');
        const stats = marketplace.getMarketStats();
        console.log('   Total Intelligence Listings:', stats.totalIntelligence);
        console.log('   Total Registered Agents:', stats.totalAgents);
        console.log('   Total Transactions:', stats.totalTransactions);
        console.log('   Total Volume:', stats.totalVolume.toFixed(2), 'SOL');
        console.log('   Categories:', Object.entries(stats.categories).map(([k, v]) => `${k}: ${v}`).join(', '));
        console.log();

        // 2. Search available intelligence
        console.log('🔍 Available Intelligence:');
        const available = marketplace.searchIntelligence();
        available.forEach((intel, i) => {
            console.log(`   ${i + 1}. "${intel.title}" by ${intel.seller.substr(0, 8)}...`);
            console.log(`      Category: ${intel.category} | Price: ${intel.price} SOL | Quality: ${intel.quality_score}/100`);
            console.log(`      Sales: ${intel.sales_count} | Rating: ${intel.rating > 0 ? intel.rating.toFixed(1) + '/5⭐' : 'No ratings yet'}`);
            console.log();
        });

        // 3. If we have a wallet, make a purchase
        if (wallet && available.length > 0) {
            console.log('💳 Making test purchase...');
            const targetIntelligence = available[0]; // Buy the first one

            if (targetIntelligence) {
                try {
                    const purchase = await marketplace.purchaseIntelligence(
                        wallet.publicKey.toString(),
                        targetIntelligence.id
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
                            targetIntelligence.id,
                            5,
                            'Excellent analysis, very helpful!'
                        );
                        console.log('✅ Rating submitted!\n');
                    }
                } catch (error) {
                    console.log('❌ Purchase failed:', error);
                }
            }
        }

        // 4. Register our wallet as an agent
        if (wallet) {
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

        // 5. Show top agents
        console.log('🏆 Top Agents by Reputation:');
        const topAgents = marketplace.getTopAgents(5);
        topAgents.forEach((agent, i) => {
            console.log(`   ${i + 1}. ${agent.name} (${agent.public_key.substr(0, 8)}...)`);
            console.log(`      Reputation: ${agent.reputation_score}/1000 | Sales: ${agent.total_sales} | Earnings: ${agent.total_earnings.toFixed(2)} SOL`);
            console.log(`      Specialization: ${agent.specialization.join(', ')}`);
            if (agent.verified) console.log('      ✅ Verified');
            console.log();
        });

        // 6. Updated market stats
        console.log('📈 Updated Market Statistics:');
        const newStats = marketplace.getMarketStats();
        console.log('   Total Intelligence Listings:', newStats.totalIntelligence);
        console.log('   Total Registered Agents:', newStats.totalAgents);
        console.log('   Total Transactions:', newStats.totalTransactions);
        console.log('   Total Volume:', newStats.totalVolume.toFixed(2), 'SOL');
        console.log();

        console.log('🎉 NEXUS Agent Intelligence Marketplace Demo Complete!');
        console.log('💡 This is the first marketplace where AI agents can buy and sell intelligence autonomously!');

    } catch (error) {
        console.error('❌ Demo error:', error);
    }
}

// Run the application
if (import.meta.main) {
    main().catch(console.error);
}