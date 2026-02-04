import { createWallet, createDevnetWallet } from '../../src/utils/wallet.ts';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../../src/config/index.ts';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('Wallet Utilities', () => {
    const testWalletPath = join(process.cwd(), CONFIG.WALLET.DIRECTORY, CONFIG.WALLET.FILENAME);

    afterEach(() => {
        // Clean up test wallet file
        if (existsSync(testWalletPath)) {
            unlinkSync(testWalletPath);
        }
    });

    describe('createWallet', () => {
        it('should create a new wallet', () => {
            const wallet = createWallet();

            expect(wallet).toBeDefined();
            expect(wallet.publicKey).toBeDefined();
            expect(wallet.secretKey).toBeDefined();
        });

        it('should create wallet from existing secret key', () => {
            const originalWallet = createWallet();
            const recreatedWallet = createWallet(originalWallet.secretKey);

            expect(originalWallet.publicKey.toString()).toBe(recreatedWallet.publicKey.toString());
        });
    });

    describe('createDevnetWallet', () => {
        it('should create wallet in test mode', async () => {
            const result = await createDevnetWallet({ testMode: true });

            expect(typeof result.publicKey).toBe('string');
            expect(Array.isArray(result.secretKey)).toBe(true);
            expect(typeof result.balance).toBe('number');
            expect(result.balance).toBe(0); // Should be 0 in test mode
        });

        it('should save wallet file', async () => {
            await createDevnetWallet({ testMode: true });

            expect(existsSync(testWalletPath)).toBe(true);
        });

        it('should create valid wallet data structure', async () => {
            const result = await createDevnetWallet({ testMode: true });

            // Read the saved wallet file
            const fs = require('fs');
            const walletData = JSON.parse(fs.readFileSync(testWalletPath, 'utf-8'));

            expect(walletData.publicKey).toBe(result.publicKey);
            expect(walletData.secretKey).toEqual(result.secretKey);
            expect(walletData.network).toBe(CONFIG.SOLANA.NETWORK);
            expect(walletData.created).toBeDefined();
        });
    });
});