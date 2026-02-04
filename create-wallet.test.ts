import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Keypair, Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { createDevnetWallet } from './create-wallet';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe("createDevnetWallet", () => {
    const testWalletDir = join(process.cwd(), 'test-wallet');
    const testWalletPath = join(testWalletDir, 'devnet-wallet.json');

    beforeEach(() => {
        // Create test directory
        if (!existsSync(testWalletDir)) {
            mkdirSync(testWalletDir, { recursive: true });
        }

        // Change working directory temporarily for testing
        process.chdir(testWalletDir);
        process.chdir('..');
    });

    afterEach(() => {
        // Clean up test wallet directory
        if (existsSync(join(process.cwd(), 'wallet'))) {
            rmSync(join(process.cwd(), 'wallet'), { recursive: true, force: true });
        }
        if (existsSync(testWalletDir)) {
            rmSync(testWalletDir, { recursive: true, force: true });
        }
    });

    test("should create a new wallet with valid keypair", async () => {
        const wallet = await createDevnetWallet();

        expect(wallet).toBeDefined();
        expect(typeof wallet.publicKey).toBe('string');
        expect(Array.isArray(wallet.secretKey)).toBe(true);
        expect(wallet.secretKey.length).toBe(64); // Solana secret key is 64 bytes
        expect(typeof wallet.balance).toBe('number');
    });

    test("should create wallet directory if it doesn't exist", async () => {
        const walletDir = join(process.cwd(), 'wallet');

        // Ensure directory doesn't exist initially
        if (existsSync(walletDir)) {
            rmSync(walletDir, { recursive: true });
        }

        await createDevnetWallet();

        expect(existsSync(walletDir)).toBe(true);
    });

    test("should save wallet file with correct structure", async () => {
        await createDevnetWallet();

        const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');
        expect(existsSync(walletPath)).toBe(true);

        const walletData = JSON.parse(readFileSync(walletPath, 'utf-8'));

        expect(walletData).toHaveProperty('publicKey');
        expect(walletData).toHaveProperty('secretKey');
        expect(walletData).toHaveProperty('network');
        expect(walletData).toHaveProperty('created');

        expect(walletData.network).toBe('devnet');
        expect(typeof walletData.publicKey).toBe('string');
        expect(Array.isArray(walletData.secretKey)).toBe(true);
        expect(walletData.secretKey.length).toBe(64);

        // Validate that the created timestamp is recent
        const created = new Date(walletData.created);
        const now = new Date();
        const diffInMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
        expect(diffInMinutes).toBeLessThan(1); // Created within last minute
    });

    test("should create a valid Solana keypair", async () => {
        const wallet = await createDevnetWallet();

        // Recreate keypair from the secret key to verify validity
        const keypair = Keypair.fromSecretKey(new Uint8Array(wallet.secretKey));

        expect(keypair.publicKey.toString()).toBe(wallet.publicKey);
    });

    test("should connect to Solana devnet", async () => {
        const wallet = await createDevnetWallet();

        // The function should complete without throwing connection errors
        expect(wallet.publicKey).toBeDefined();

        // Verify we can create a connection using the same settings
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        expect(connection).toBeDefined();
    });

    test("should handle airdrop failure gracefully", async () => {
        // This test verifies that the function doesn't throw when airdrop fails
        // (which is common on devnet due to rate limiting)
        const wallet = await createDevnetWallet();

        expect(wallet).toBeDefined();
        expect(wallet.balance).toBeGreaterThanOrEqual(0);
    });

    test("should generate unique wallets on multiple calls", async () => {
        const wallet1 = await createDevnetWallet();

        // Remove first wallet to avoid conflict
        const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');
        if (existsSync(walletPath)) {
            rmSync(walletPath);
        }

        const wallet2 = await createDevnetWallet();

        expect(wallet1.publicKey).not.toBe(wallet2.publicKey);
        expect(JSON.stringify(wallet1.secretKey)).not.toBe(JSON.stringify(wallet2.secretKey));
    });

    test("should create wallet with proper public key format", async () => {
        const wallet = await createDevnetWallet();

        // Solana public keys are base58 encoded and typically 32-44 characters
        expect(wallet.publicKey.length).toBeGreaterThanOrEqual(32);
        expect(wallet.publicKey.length).toBeLessThanOrEqual(44);

        // Should not contain invalid base58 characters
        expect(wallet.publicKey).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);

        // Should be a valid PublicKey
        expect(() => new PublicKey(wallet.publicKey)).not.toThrow();
    });

    test("should save wallet with valid JSON structure", async () => {
        await createDevnetWallet();

        const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');
        const walletContent = readFileSync(walletPath, 'utf-8');

        // Should be valid JSON
        expect(() => JSON.parse(walletContent)).not.toThrow();

        const walletData = JSON.parse(walletContent);

        // Verify all required fields are present and have correct types
        expect(typeof walletData.publicKey).toBe('string');
        expect(Array.isArray(walletData.secretKey)).toBe(true);
        expect(typeof walletData.network).toBe('string');
        expect(typeof walletData.created).toBe('string');

        // Verify secret key is array of numbers (0-255)
        walletData.secretKey.forEach((byte: any) => {
            expect(typeof byte).toBe('number');
            expect(byte).toBeGreaterThanOrEqual(0);
            expect(byte).toBeLessThanOrEqual(255);
        });
    });

    test("should return wallet info matching saved file", async () => {
        const wallet = await createDevnetWallet();

        const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');
        const savedData = JSON.parse(readFileSync(walletPath, 'utf-8'));

        expect(wallet.publicKey).toBe(savedData.publicKey);
        expect(JSON.stringify(wallet.secretKey)).toBe(JSON.stringify(savedData.secretKey));
    });
});