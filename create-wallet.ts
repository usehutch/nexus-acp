import { Keypair, Connection, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function createDevnetWallet(options: { testMode?: boolean } = {}) {
    // Create a new keypair
    const wallet = Keypair.generate();

    // Get wallet info
    const publicKey = wallet.publicKey.toString();
    const secretKey = Array.from(wallet.secretKey);

    console.log('🚀 Creating Solana Devnet Wallet...\n');
    console.log('📍 Public Key:', publicKey);
    console.log('🔑 Secret Key:', JSON.stringify(secretKey));

    // Save wallet to file
    const walletDir = join(process.cwd(), 'wallet');
    if (!existsSync(walletDir)) {
        mkdirSync(walletDir, { recursive: true });
    }

    const walletData = {
        publicKey: publicKey,
        secretKey: secretKey,
        network: 'devnet',
        created: new Date().toISOString()
    };

    writeFileSync(
        join(walletDir, 'devnet-wallet.json'),
        JSON.stringify(walletData, null, 2)
    );

    console.log('💾 Wallet saved to: ./wallet/devnet-wallet.json\n');

    // Skip network operations in test mode
    if (options.testMode) {
        return {
            publicKey,
            secretKey,
            balance: 0
        };
    }

    // Connect to devnet and request airdrop
    console.log('🌐 Connecting to Solana Devnet...');
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    try {
        console.log('💰 Requesting airdrop of 2 SOL...');
        const signature = await connection.requestAirdrop(
            wallet.publicKey,
            2 * LAMPORTS_PER_SOL
        );

        await connection.confirmTransaction(signature);

        // Check balance
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

        return {
            publicKey,
            secretKey,
            balance: 0
        };
    }
}

// Run if this file is executed directly
if (import.meta.main) {
    createDevnetWallet()
        .then((wallet) => {
            console.log('🎉 Devnet wallet created successfully!');
            console.log('📝 Wallet details saved to ./wallet/devnet-wallet.json');
            console.log('🔗 Use this address on Solana Devnet:', wallet.publicKey);
        })
        .catch((error) => {
            console.error('❌ Error creating wallet:', error);
            process.exit(1);
        });
}

export { createDevnetWallet };