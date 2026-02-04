import { clusterApiUrl } from '@solana/web3.js';

export const CONFIG = {
    SOLANA: {
        NETWORK: 'devnet' as const,
        RPC_URL: clusterApiUrl('devnet'),
        CONFIRMATION_LEVEL: 'confirmed' as const,
    },

    WALLET: {
        DIRECTORY: 'wallet',
        FILENAME: 'devnet-wallet.json',
    },

    SERVER: {
        PORT: 3000,
        HOST: 'localhost',
    },

    MARKETPLACE: {
        INITIAL_REPUTATION: 100,
        MAX_REPUTATION: 1000,
        MIN_RATING: 1,
        MAX_RATING: 5,
        AIRDROP_AMOUNT: 2, // SOL
    },

    COLOSSEUM: {
        API_BASE: 'https://agents.colosseum.com/api',
        DEFAULT_TAGS: ['progress-update'],
    },
} as const;