# Solana Devnet Wallet

A Solana devnet wallet setup for the Colosseum Agent Hackathon 2026.

## 🚀 Quick Start

The wallet has been created and is ready to use!

**Public Key**: `EaCRn7vY8u7mrcmbh593fgNBizjikdyyeVvrcz2pFsCf`

## 📁 Files

- `create-wallet.ts` - Script to create a new devnet wallet
- `test-wallet.ts` - Script to test wallet functionality
- `wallet/devnet-wallet.json` - Wallet credentials (keep secure!)

## 🛠 Usage

### Create a new wallet
```bash
bun run create-wallet.ts
```

### Test existing wallet
```bash
bun run test-wallet.ts
```

## 💰 Getting SOL

Since the airdrop service is unreliable, get devnet SOL manually:

1. **Solana Faucet**: Visit https://faucet.solana.com
2. **Solana CLI** (if installed):
   ```bash
   solana airdrop 2 EaCRn7vY8u7mrcmbh593fgNBizjikdyyeVvrcz2pFsCf --url devnet
   ```

## 🔧 Integration

### Load wallet in your code

```typescript
import { Keypair } from '@solana/web3.js';
import { readFileSync } from 'fs';

// Load wallet
const walletData = JSON.parse(readFileSync('./wallet/devnet-wallet.json', 'utf8'));
const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));

console.log('Loaded wallet:', wallet.publicKey.toString());
```

### Connect to Solana devnet

```typescript
import { Connection, clusterApiUrl } from '@solana/web3.js';

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const balance = await connection.getBalance(wallet.publicKey);
console.log('Balance:', balance / 1000000000, 'SOL');
```

## 🏆 Hackathon Notes

Based on the [Colosseum Agent Hackathon analysis](./colosseum_agent_hackathon_analysis.md), consider focusing on:

1. **Agent Governance & DAO Tools** ⭐️ (Highest opportunity)
2. **Cross-Chain Agent Interoperability** ⭐️
3. **Physical World Integration**

These categories are underserved and offer the best chance for differentiation.

## 🔒 Security

- The wallet is for **devnet only** - never use for mainnet
- Keep `wallet/devnet-wallet.json` secure
- Add `wallet/` to `.gitignore` if committing to public repos

## 📦 Dependencies

- `@solana/web3.js` - Solana JavaScript SDK
- `bun` - JavaScript runtime (already installed)

## 🎯 Next Steps

1. Get devnet SOL from faucet
2. Build your hackathon project
3. Use wallet for on-chain interactions
4. Deploy to Solana devnet

Good luck with the hackathon! 🚀