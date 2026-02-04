import { Connection, Keypair } from '@solana/web3.js';
import { AgentMarketplace } from './marketplace.js';
import type { AgentIntelligence } from './types/index.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CONFIG } from './config/index.js';
import { createWallet, type WalletData } from './utils/wallet.js';
import { errorHandler, ErrorCode, NexusError, withRetry } from '../error-handler.js';

async function main() {
    console.log('🚀 NEXUS Agent Intelligence Marketplace');
    console.log('=====================================\n');

    try {
        // Connect to Solana with retry mechanism
        const connection = await withRetry(
            () => Promise.resolve(new Connection(CONFIG.SOLANA.RPC_URL, CONFIG.SOLANA.CONFIRMATION_LEVEL)),
            'Solana connection initialization',
            { maxRetries: 3, baseDelay: 2000 }
        );
        console.log(`🌐 Connected to Solana ${CONFIG.SOLANA.NETWORK}`);

        // Load or create wallet
        const wallet = await loadOrCreateWallet();

        if (wallet) {
            const balance = await withRetry(
                () => connection.getBalance(wallet.publicKey),
                'wallet balance fetch',
                { maxRetries: 2, baseDelay: 1000 }
            );
            console.log(`💰 Wallet balance: ${balance / 1e9} SOL\n`);
        }

        // Initialize marketplace
        const marketplace = new AgentMarketplace(connection);
        console.log('🏪 Agent Intelligence Marketplace initialized\n');

        // Demo the marketplace functionality
        await demonstrateMarketplace(marketplace, wallet);
    } catch (error) {
        const nexusError = errorHandler.normalizeError(error, 'main application');
        errorHandler.logError(nexusError, 'main');

        if (nexusError.code === ErrorCode.NETWORK_ERROR) {
            console.error('\n❌ Network connection failed. Please check your internet connection and Solana RPC endpoint.');
        } else if (nexusError.code === ErrorCode.SOLANA_CONNECTION_FAILED) {
            console.error('\n❌ Failed to connect to Solana network. Please verify the RPC URL is correct.');
        } else {
            console.error('\n❌ Application failed to start:', nexusError.message);
        }

        process.exit(1);
    }
}

async function loadOrCreateWallet(): Promise<Keypair | null> {
    const walletPath = join(process.cwd(), CONFIG.WALLET.DIRECTORY, CONFIG.WALLET.FILENAME);

    try {
        if (!existsSync(walletPath)) {
            console.log('⚠️ No wallet found. Run: bun run create-wallet.ts\n');
            return null;
        }

        const walletData: WalletData = await withRetry(
            () => Promise.resolve(JSON.parse(readFileSync(walletPath, 'utf-8'))),
            'wallet file read',
            { maxRetries: 1 }
        );

        errorHandler.validateRequired(
            walletData,
            ['secretKey'],
            'wallet data validation'
        );

        if (!Array.isArray(walletData.secretKey) || walletData.secretKey.length !== 64) {
            throw new NexusError(
                ErrorCode.KEYPAIR_INVALID,
                'Invalid wallet format: secretKey must be a 64-element array',
                { provided: walletData.secretKey }
            );
        }

        const wallet = createWallet(new Uint8Array(walletData.secretKey));
        console.log('💼 Loaded wallet:', wallet.publicKey.toString());
        return wallet;
    } catch (error) {
        if (error instanceof NexusError) {
            throw error;
        }

        const nexusError = errorHandler.normalizeError(error, 'wallet loading');
        errorHandler.logError(nexusError, 'loadOrCreateWallet');

        if (nexusError.code === ErrorCode.FILE_NOT_FOUND) {
            throw new NexusError(
                ErrorCode.WALLET_NOT_FOUND,
                'Wallet file not found. Please create a wallet first.',
                { walletPath }
            );
        } else if (nexusError.code === ErrorCode.FILE_READ_ERROR) {
            throw new NexusError(
                ErrorCode.WALLET_CREATION_FAILED,
                'Failed to read wallet file. File may be corrupted.',
                { walletPath, originalError: error }
            );
        }

        throw nexusError;
    }
}

async function demonstrateMarketplace(marketplace: AgentMarketplace, wallet: Keypair | null) {
    console.log('🎯 === MARKETPLACE DEMONSTRATION ===\n');

    try {
        // Show market statistics
        console.log('📊 Market Statistics:');
        const stats = await withRetry(
            () => Promise.resolve(marketplace.getMarketStats()),
            'market statistics fetch'
        );
        console.log('   Total Intelligence Listings:', stats.totalIntelligence);
        console.log('   Total Registered Agents:', stats.totalAgents);
        console.log('   Total Transactions:', stats.totalTransactions);
        console.log('   Total Volume:', stats.totalVolume.toFixed(2), 'SOL');
        console.log('   Categories:', Object.entries(stats.categories).map(([k, v]) => `${k}: ${v}`).join(', '));
        console.log();

        // Search available intelligence
        console.log('🔍 Available Intelligence:');
        const available = await withRetry(
            () => Promise.resolve(marketplace.searchIntelligence()),
            'intelligence search'
        );

        if (available.length === 0) {
            console.log('   No intelligence listings available yet.');
        } else {
            available.forEach((intel, i) => {
                console.log(`   ${i + 1}. "${intel.title}" by ${intel.seller.substr(0, 8)}...`);
                console.log(`      Category: ${intel.category} | Price: ${intel.price} SOL | Quality: ${intel.quality_score}/100`);
                console.log(`      Sales: ${intel.sales_count} | Rating: ${intel.rating > 0 ? intel.rating.toFixed(1) + '/5⭐' : 'No ratings yet'}`);
                console.log();
            });
        }

        // If we have a wallet, register as agent first, then demonstrate purchases
        if (wallet) {
            await demonstrateAgentRegistration(marketplace, wallet);

            if (available.length > 0) {
                const firstIntelligence = available[0];
                if (firstIntelligence) {
                    await demonstratePurchase(marketplace, wallet, firstIntelligence);
                }
            }
        }

        // Show top agents
        console.log('🏆 Top Agents by Reputation:');
        const topAgents = await withRetry(
            () => Promise.resolve(marketplace.getTopAgents(5)),
            'top agents fetch'
        );

        if (topAgents.length === 0) {
            console.log('   No agents registered yet.');
        } else {
            topAgents.forEach((agent, i) => {
                console.log(`   ${i + 1}. ${agent.name} (${agent.public_key.substr(0, 8)}...)`);
                console.log(`      Reputation: ${agent.reputation_score}/1000 | Sales: ${agent.total_sales} | Earnings: ${agent.total_earnings.toFixed(2)} SOL`);
                console.log(`      Specialization: ${agent.specialization.join(', ')}`);
                if (agent.verified) console.log('      ✅ Verified');
                console.log();
            });
        }

        console.log('🎉 NEXUS Agent Intelligence Marketplace Demo Complete!');
        console.log('💡 This is the first marketplace where AI agents can buy and sell intelligence autonomously!');

    } catch (error) {
        const nexusError = errorHandler.normalizeError(error, 'marketplace demonstration');
        errorHandler.logError(nexusError, 'demonstrateMarketplace');
        console.error('❌ Demo failed:', nexusError.message);

        if (nexusError.retryable) {
            console.log('💡 This error is retryable. The demo may work if you try again.');
        }
    }
}

async function demonstratePurchase(marketplace: AgentMarketplace, wallet: Keypair, intel: AgentIntelligence) {
    console.log('💳 Making test purchase...');
    try {
        // Validate purchase parameters
        errorHandler.validateRequired(
            { wallet: wallet.publicKey.toString(), intelligenceId: intel.id },
            ['wallet', 'intelligenceId'],
            'purchase parameters'
        );

        const purchase = await withRetry(
            () => marketplace.purchaseIntelligence(
                wallet.publicKey.toString(),
                intel.id
            ),
            'intelligence purchase',
            { maxRetries: 2, baseDelay: 1500 }
        );

        if (purchase.success) {
            console.log('✅ Purchase successful!');
            console.log('📦 Intelligence Data Received:');
            console.log(JSON.stringify(purchase.data, null, 2));
            console.log();

            // Rate the intelligence
            console.log('⭐ Rating the intelligence...');
            await withRetry(
                () => marketplace.rateIntelligence(
                    wallet.publicKey.toString(),
                    intel.id,
                    5,
                    'Excellent analysis, very helpful!'
                ),
                'intelligence rating',
                { maxRetries: 1 }
            );
            console.log('✅ Rating submitted!\n');
        } else {
            throw new NexusError(
                ErrorCode.TRANSACTION_FAILED,
                'Purchase completed but was not successful',
                { purchase }
            );
        }
    } catch (error) {
        const nexusError = errorHandler.normalizeError(error, 'purchase demonstration');
        errorHandler.logError(nexusError, 'demonstratePurchase');

        if (nexusError.code === ErrorCode.INSUFFICIENT_BALANCE) {
            console.log('❌ Purchase failed: Insufficient SOL balance');
        } else if (nexusError.code === ErrorCode.INTELLIGENCE_NOT_FOUND) {
            console.log('❌ Purchase failed: Intelligence listing no longer available');
        } else {
            console.log('❌ Purchase failed:', nexusError.message);
        }
    }
}

async function demonstrateAgentRegistration(marketplace: AgentMarketplace, wallet: Keypair) {
    try {
        console.log('🤖 Registering as agent...');

        const agentProfile = {
            name: 'NEXUS Intelligence Agent',
            description: 'Advanced AI agent specializing in market analysis and strategic insights',
            specialization: ['market-analysis', 'defi-strategy', 'trend-analysis'],
            verified: false
        };

        // Validate agent profile
        errorHandler.validateRequired(
            agentProfile,
            ['name', 'description', 'specialization'],
            'agent registration'
        );

        await withRetry(
            () => marketplace.registerAgent(wallet.publicKey.toString(), agentProfile),
            'agent registration',
            { maxRetries: 2 }
        );

        // List our own intelligence
        console.log('📋 Listing intelligence for sale...');

        const intelligenceData = {
            title: 'Solana Ecosystem Growth Analysis',
            description: 'Comprehensive analysis of Solana DeFi protocols and growth opportunities',
            category: 'market-analysis' as const,
            price: 0.25
        };

        // Validate intelligence data
        errorHandler.validateRequired(
            intelligenceData,
            ['title', 'description', 'category', 'price'],
            'intelligence listing'
        );

        errorHandler.validateRange(
            intelligenceData.price,
            0.001,
            100,
            'price',
            'intelligence listing'
        );

        const intelligenceId = await withRetry(
            () => marketplace.listIntelligence(wallet.publicKey.toString(), intelligenceData),
            'intelligence listing',
            { maxRetries: 2 }
        );

        console.log(`✅ Intelligence listed with ID: ${intelligenceId}\n`);
    } catch (error) {
        const nexusError = errorHandler.normalizeError(error, 'agent registration demonstration');
        errorHandler.logError(nexusError, 'demonstrateAgentRegistration');

        if (nexusError.code === ErrorCode.AGENT_NOT_REGISTERED) {
            console.log('❌ Agent registration failed: Agent may already be registered or invalid data provided');
        } else if (nexusError.code === ErrorCode.INVALID_INPUT) {
            console.log('❌ Registration failed: Invalid input data -', nexusError.message);
        } else {
            console.log('❌ Agent registration failed:', nexusError.message);
        }
    }
}

// Run the application
if (import.meta.main) {
    main().catch(console.error);
}