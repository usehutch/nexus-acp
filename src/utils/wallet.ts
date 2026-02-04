import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config/index.js';
import { errorHandler, ErrorCode, NexusError, withRetry } from '../../error-handler.js';

export function createWallet(secretKey?: Uint8Array): Keypair {
    try {
        if (secretKey) {
            if (!secretKey || secretKey.length !== 64) {
                throw new NexusError(
                    ErrorCode.KEYPAIR_INVALID,
                    'Invalid secret key: must be 64 bytes',
                    { provided: secretKey?.length }
                );
            }
            return Keypair.fromSecretKey(secretKey);
        }
        return Keypair.generate();
    } catch (error) {
        if (error instanceof NexusError) {
            throw error;
        }

        const nexusError = errorHandler.normalizeError(error, 'wallet creation');
        errorHandler.logError(nexusError, 'createWallet');
        throw new NexusError(
            ErrorCode.WALLET_CREATION_FAILED,
            'Failed to create wallet keypair',
            { originalError: error }
        );
    }
}

export interface WalletData {
    publicKey: string;
    secretKey: number[];
    network: string;
    created: string;
}

export async function createDevnetWallet(options: { testMode?: boolean } = {}): Promise<{
    publicKey: string;
    secretKey: number[];
    balance: number;
}> {
    try {
        console.log('🚀 Creating Solana Devnet Wallet...\n');

        // Create wallet with error handling
        const wallet = await withRetry(
            () => Promise.resolve(createWallet()),
            'wallet keypair generation'
        );

        const publicKey = wallet.publicKey.toString();
        const secretKey = Array.from(wallet.secretKey);

        console.log('📍 Public Key:', publicKey);

        // Save wallet to file with error handling
        const walletDir = join(process.cwd(), CONFIG.WALLET.DIRECTORY);

        await withRetry(
            () => {
                if (!existsSync(walletDir)) {
                    mkdirSync(walletDir, { recursive: true });
                }
                return Promise.resolve();
            },
            'wallet directory creation'
        );

        const walletData: WalletData = {
            publicKey,
            secretKey,
            network: CONFIG.SOLANA.NETWORK,
            created: new Date().toISOString()
        };

        await withRetry(
            () => {
                writeFileSync(
                    join(walletDir, CONFIG.WALLET.FILENAME),
                    JSON.stringify(walletData, null, 2)
                );
                return Promise.resolve();
            },
            'wallet file save'
        );

        console.log(`💾 Wallet saved to: ./${CONFIG.WALLET.DIRECTORY}/${CONFIG.WALLET.FILENAME}\n`);

        // Skip network operations in test mode
        if (options.testMode) {
            return { publicKey, secretKey, balance: 0 };
        }

        // Connect to devnet and request airdrop with enhanced error handling
        console.log(`🌐 Connecting to Solana ${CONFIG.SOLANA.NETWORK}...`);

        const connection = await withRetry(
            () => {
                const conn = new Connection(CONFIG.SOLANA.RPC_URL, CONFIG.SOLANA.CONFIRMATION_LEVEL);
                return Promise.resolve(conn);
            },
            'Solana connection',
            { maxRetries: 3, baseDelay: 2000 }
        );

        try {
            console.log(`💰 Requesting airdrop of ${CONFIG.MARKETPLACE.AIRDROP_AMOUNT} SOL...`);

            // Request airdrop with retry
            const signature = await withRetry(
                () => connection.requestAirdrop(
                    wallet.publicKey,
                    CONFIG.MARKETPLACE.AIRDROP_AMOUNT * LAMPORTS_PER_SOL
                ),
                'airdrop request',
                { maxRetries: 2, baseDelay: 3000 }
            );

            // Confirm transaction with retry
            await withRetry(
                () => connection.confirmTransaction(signature),
                'airdrop confirmation',
                { maxRetries: 3, baseDelay: 2000 }
            );

            const balance = await withRetry(
                () => connection.getBalance(wallet.publicKey),
                'balance fetch',
                { maxRetries: 2, baseDelay: 1000 }
            );

            console.log('✅ Airdrop successful!');
            console.log('💰 Current balance:', balance / LAMPORTS_PER_SOL, 'SOL\n');

            return {
                publicKey,
                secretKey,
                balance: balance / LAMPORTS_PER_SOL
            };
        } catch (airdropError) {
            // Handle airdrop failure gracefully - this is common on devnet
            const nexusError = errorHandler.normalizeError(airdropError, 'airdrop request');

            if (nexusError.code === ErrorCode.NETWORK_ERROR || nexusError.code === ErrorCode.API_TIMEOUT) {
                console.log('⚠️ Airdrop failed due to network issues (this is common on devnet)');
                console.log('💡 You can manually request SOL at: https://faucet.solana.com\n');
            } else {
                console.log('⚠️ Airdrop failed:', nexusError.message);
                console.log('💡 You can manually request SOL at: https://faucet.solana.com\n');
            }

            return { publicKey, secretKey, balance: 0 };
        }
    } catch (error) {
        if (error instanceof NexusError) {
            throw error;
        }

        const nexusError = errorHandler.normalizeError(error, 'devnet wallet creation');
        errorHandler.logError(nexusError, 'createDevnetWallet');

        if (nexusError.code === ErrorCode.FILE_WRITE_ERROR) {
            throw new NexusError(
                ErrorCode.WALLET_CREATION_FAILED,
                'Failed to save wallet file. Check write permissions.',
                { walletDir: join(process.cwd(), CONFIG.WALLET.DIRECTORY) }
            );
        } else if (nexusError.code === ErrorCode.SOLANA_CONNECTION_FAILED) {
            throw new NexusError(
                ErrorCode.SOLANA_CONNECTION_FAILED,
                'Failed to connect to Solana network. Check your internet connection and RPC URL.',
                { rpcUrl: CONFIG.SOLANA.RPC_URL }
            );
        }

        throw nexusError;
    }
}