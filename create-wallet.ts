import { Keypair, Connection, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  ErrorCode,
  NexusError,
  errorHandler,
  withRetry,
  validateRequired
} from './error-handler.js';

async function saveWalletToFile(wallet: Keypair, publicKey: string, secretKey: number[]): Promise<void> {
    return withRetry(async () => {
        const walletDir = join(process.cwd(), 'wallet');

        // Check if wallet already exists
        const walletPath = join(walletDir, 'devnet-wallet.json');
        if (existsSync(walletPath)) {
            console.log('⚠️ Wallet file already exists at:', walletPath);
            const shouldOverwrite = process.argv.includes('--force') || process.argv.includes('-f');

            if (!shouldOverwrite) {
                throw new NexusError(
                    ErrorCode.FILE_WRITE_ERROR,
                    'Wallet file already exists. Use --force to overwrite',
                    { existingFile: walletPath }
                );
            }
            console.log('🔄 Overwriting existing wallet...');
        }

        // Create directory if it doesn't exist
        try {
            if (!existsSync(walletDir)) {
                mkdirSync(walletDir, { recursive: true });
            }
        } catch (error) {
            throw new NexusError(
                ErrorCode.PERMISSION_DENIED,
                'Failed to create wallet directory',
                {
                    walletDir,
                    error: error instanceof Error ? error.message : error
                }
            );
        }

        // Prepare wallet data
        const walletData = {
            publicKey: publicKey,
            secretKey: secretKey,
            network: 'devnet',
            created: new Date().toISOString(),
            version: '1.0.0'
        };

        // Write wallet file with error handling
        try {
            writeFileSync(walletPath, JSON.stringify(walletData, null, 2), {
                mode: 0o600 // Restrict file permissions for security
            });
        } catch (error) {
            throw new NexusError(
                ErrorCode.FILE_WRITE_ERROR,
                'Failed to write wallet file',
                {
                    walletPath,
                    error: error instanceof Error ? error.message : error
                }
            );
        }
    }, 'wallet file saving');
}

async function createDevnetWallet(options: { testMode?: boolean } = {}) {
    return errorHandler.withErrorHandling(async () => {
        console.log('🚀 Creating Solana Devnet Wallet...\n');

        // Create a new keypair with error handling
        let wallet: Keypair;
        try {
            wallet = Keypair.generate();
        } catch (error) {
            throw new NexusError(
                ErrorCode.WALLET_CREATION_FAILED,
                'Failed to generate new keypair',
                { error: error instanceof Error ? error.message : error }
            );
        }

        // Get wallet info
        const publicKey = wallet.publicKey.toString();
        const secretKey = Array.from(wallet.secretKey);

        console.log('📍 Public Key:', publicKey);

        // Save wallet to file with error handling
        await saveWalletToFile(wallet, publicKey, secretKey);

        console.log('💾 Wallet saved to: ./wallet/devnet-wallet.json\n');

        // Skip network operations in test mode
        if (options.testMode) {
            return {
                publicKey,
                secretKey,
                balance: 0
            };
        }

        // Connect to devnet and request airdrop with retry logic
        const balance = await performNetworkOperations(wallet);

        return {
            publicKey,
            secretKey,
            balance
        };
    }, 'wallet creation');
}

async function performNetworkOperations(wallet: Keypair): Promise<number> {
    console.log('🌐 Connecting to Solana Devnet...');

    const connection = await withRetry(async () => {
        const conn = new Connection(clusterApiUrl('devnet'), 'confirmed');
        // Test the connection
        await conn.getVersion();
        return conn;
    }, 'Solana devnet connection', { maxRetries: 3 });

    // Request airdrop with retry and better error handling
    try {
        console.log('💰 Requesting airdrop of 2 SOL...');

        const airdropAmount = 2 * LAMPORTS_PER_SOL;
        const signature = await withRetry(async () => {
            return await connection.requestAirdrop(wallet.publicKey, airdropAmount);
        }, 'airdrop request', {
            maxRetries: 3,
            baseDelay: 2000,
            maxDelay: 8000
        });

        // Confirm transaction with retry
        await withRetry(async () => {
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            if (confirmation.value.err) {
                throw new NexusError(
                    ErrorCode.TRANSACTION_FAILED,
                    'Airdrop transaction failed',
                    { signature, error: confirmation.value.err }
                );
            }
        }, 'airdrop confirmation', { maxRetries: 5 });

        // Check final balance
        const balance = await withRetry(async () => {
            return await connection.getBalance(wallet.publicKey);
        }, 'balance check', { maxRetries: 2 });

        console.log('✅ Airdrop successful!');
        console.log('💰 Current balance:', balance / LAMPORTS_PER_SOL, 'SOL\n');

        return balance / LAMPORTS_PER_SOL;

    } catch (error) {
        const nexusError = errorHandler.normalizeError(error, 'airdrop operation');

        if (nexusError.code === ErrorCode.NETWORK_ERROR ||
            nexusError.code === ErrorCode.API_TIMEOUT ||
            nexusError.message.includes('429') ||
            nexusError.message.includes('rate limit')) {

            console.log('⚠️ Airdrop failed (rate limited or network issue):', nexusError.message);
            console.log('💡 You can manually request SOL at: https://faucet.solana.com');
            console.log('💡 Or try again later when the rate limit resets\n');

            return 0;
        } else {
            console.log('⚠️ Airdrop failed with unexpected error:', nexusError.message);
            console.log('💡 The wallet was created successfully, but funding failed');
            console.log('💡 You can manually request SOL at: https://faucet.solana.com\n');

            return 0;
        }
    }
}

// Run if this file is executed directly
if (import.meta.main) {
    const args = process.argv.slice(2);
    const helpRequested = args.includes('--help') || args.includes('-h');

    if (helpRequested) {
        console.log('NEXUS Wallet Creation Tool\n');
        console.log('Usage: bun create-wallet.ts [options]\n');
        console.log('Options:');
        console.log('  --force, -f    Overwrite existing wallet file');
        console.log('  --help, -h     Show this help message');
        console.log('\nExample:');
        console.log('  bun create-wallet.ts --force');
        process.exit(0);
    }

    createDevnetWallet()
        .then((wallet) => {
            console.log('🎉 Devnet wallet created successfully!');
            console.log('📝 Wallet details saved to ./wallet/devnet-wallet.json');
            console.log('🔗 Use this address on Solana Devnet:', wallet.publicKey);

            if (wallet.balance === 0) {
                console.log('\n🔄 Next steps:');
                console.log('   1. Request SOL from: https://faucet.solana.com');
                console.log('   2. Or run the marketplace: bun run index.ts');
            } else {
                console.log('\n🚀 Ready to run the marketplace: bun run index.ts');
            }
        })
        .catch((error) => {
            const nexusError = errorHandler.normalizeError(error, 'wallet creation CLI');
            errorHandler.logError(nexusError, 'wallet creation CLI');

            console.error('❌ Error creating wallet:', nexusError.message);

            // Provide helpful error-specific guidance
            if (nexusError.code === ErrorCode.FILE_WRITE_ERROR) {
                console.error('💡 Check file permissions and try with --force if overwriting');
            } else if (nexusError.code === ErrorCode.PERMISSION_DENIED) {
                console.error('💡 Try running with appropriate permissions');
            } else if (nexusError.code === ErrorCode.NETWORK_ERROR) {
                console.error('💡 Check your internet connection and try again');
            }

            process.exit(1);
        });
}

export { createDevnetWallet };