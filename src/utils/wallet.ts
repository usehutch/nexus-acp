import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config/index.js';

export function createWallet(secretKey?: Uint8Array): Keypair {
    if (secretKey) {
        return Keypair.fromSecretKey(secretKey);
    }
    return Keypair.generate();
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
    const wallet = createWallet();
    const publicKey = wallet.publicKey.toString();
    const secretKey = Array.from(wallet.secretKey);

    console.log('🚀 Creating Solana Devnet Wallet...\n');
    console.log('📍 Public Key:', publicKey);

    // Save wallet to file
    const walletDir = join(process.cwd(), CONFIG.WALLET.DIRECTORY);
    if (!existsSync(walletDir)) {
        mkdirSync(walletDir, { recursive: true });
    }

    const walletData: WalletData = {
        publicKey,
        secretKey,
        network: CONFIG.SOLANA.NETWORK,
        created: new Date().toISOString()
    };

    writeFileSync(
        join(walletDir, CONFIG.WALLET.FILENAME),
        JSON.stringify(walletData, null, 2)
    );

    console.log(`💾 Wallet saved to: ./${CONFIG.WALLET.DIRECTORY}/${CONFIG.WALLET.FILENAME}\n`);

    // Skip network operations in test mode
    if (options.testMode) {
        return { publicKey, secretKey, balance: 0 };
    }

    // Connect to devnet and request airdrop
    console.log(`🌐 Connecting to Solana ${CONFIG.SOLANA.NETWORK}...`);
    const connection = new Connection(CONFIG.SOLANA.RPC_URL, CONFIG.SOLANA.CONFIRMATION_LEVEL);

    try {
        console.log(`💰 Requesting airdrop of ${CONFIG.MARKETPLACE.AIRDROP_AMOUNT} SOL...`);
        const signature = await connection.requestAirdrop(
            wallet.publicKey,
            CONFIG.MARKETPLACE.AIRDROP_AMOUNT * LAMPORTS_PER_SOL
        );

        await connection.confirmTransaction(signature);

        const balance = await connection.getBalance(wallet.publicKey);
        console.log('✅ Airdrop successful!');
        console.log('💰 Current balance:', balance / LAMPORTS_PER_SOL, 'SOL\n');

        return {
            publicKey,
            secretKey,
            balance: balance / LAMPORTS_PER_SOL
        };
    } catch (error) {
        console.log('⚠️ Airdrop failed (this is common on devnet):', error);
        console.log('💡 You can manually request SOL at: https://faucet.solana.com\n');

        return { publicKey, secretKey, balance: 0 };
    }
}