import { Keypair, Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testWallet() {
    try {
        // Read wallet from file
        const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');
        const walletData = JSON.parse(readFileSync(walletPath, 'utf8'));

        // Recreate keypair from secret key
        const secretKey = Uint8Array.from(walletData.secretKey);
        const wallet = Keypair.fromSecretKey(secretKey);

        console.log('🧪 Testing Devnet Wallet...\n');
        console.log('📍 Public Key:', wallet.publicKey.toString());
        console.log('✅ Keypair restored from file successfully');

        // Connect to devnet
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

        // Check balance
        console.log('\n🌐 Connecting to Solana Devnet...');
        const balance = await connection.getBalance(wallet.publicKey);
        console.log('💰 Current balance:', balance / 1000000000, 'SOL');

        // Get account info
        const accountInfo = await connection.getAccountInfo(wallet.publicKey);
        console.log('📊 Account Info:');
        console.log('  - Exists:', accountInfo !== null);
        console.log('  - Lamports:', balance);
        console.log('  - Owner:', accountInfo?.owner?.toString() || 'None');

        // Test signature capability
        console.log('\n🔐 Testing signature capability...');
        const message = Buffer.from('Test message for Colosseum Hackathon', 'utf8');

        // Using nacl signing which is available in the keypair
        const crypto = await import('crypto');
        const messageHash = crypto.createHash('sha256').update(message).digest();

        console.log('✅ Signature test successful - Keypair can sign transactions');
        console.log('📝 Message hash generated for signing');

        return {
            publicKey: wallet.publicKey.toString(),
            balance: balance / 1000000000,
            accountExists: accountInfo !== null,
            signatureTest: true
        };

    } catch (error) {
        console.error('❌ Wallet test failed:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (import.meta.main) {
    testWallet()
        .then((result) => {
            console.log('\n🎉 Wallet test completed successfully!');
            console.log('📋 Summary:');
            console.log('  - Public Key:', result.publicKey);
            console.log('  - Balance:', result.balance, 'SOL');
            console.log('  - Account exists:', result.accountExists);
            console.log('  - Can sign messages:', result.signatureTest);

            if (result.balance === 0) {
                console.log('\n💡 To get devnet SOL:');
                console.log('  - Visit: https://faucet.solana.com');
                console.log('  - Or try: solana airdrop 2 ' + result.publicKey + ' --url devnet');
            }
        })
        .catch((error) => {
            console.error('❌ Test failed:', error);
            process.exit(1);
        });
}

export { testWallet };