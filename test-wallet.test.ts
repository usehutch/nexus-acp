import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Keypair, Connection, clusterApiUrl } from '@solana/web3.js';
import { testWallet } from './test-wallet';
import { createDevnetWallet } from './create-wallet';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

describe("testWallet", () => {
    beforeEach(() => {
        // Clean up any existing wallet directory
        const walletDir = join(process.cwd(), 'wallet');
        if (existsSync(walletDir)) {
            rmSync(walletDir, { recursive: true, force: true });
        }
    });

    afterEach(() => {
        // Clean up after tests
        const walletDir = join(process.cwd(), 'wallet');
        if (existsSync(walletDir)) {
            rmSync(walletDir, { recursive: true, force: true });
        }
    });

    test("should successfully test a valid wallet", async () => {
        // First create a wallet to test
        await createDevnetWallet({ testMode: true });

        const result = await testWallet({ testMode: true });

        expect(result).toBeDefined();
        expect(typeof result.publicKey).toBe('string');
        expect(typeof result.balance).toBe('number');
        expect(typeof result.accountExists).toBe('boolean');
        expect(result.signatureTest).toBe(true);
    });

    test("should throw error when wallet file doesn't exist", async () => {
        await expect(testWallet({ testMode: true })).rejects.toThrow();
    });

    test("should correctly read wallet data from file", async () => {
        // Create a wallet first
        const createdWallet = await createDevnetWallet({ testMode: true });

        const testResult = await testWallet({ testMode: true });

        expect(testResult.publicKey).toBe(createdWallet.publicKey);
    });

    test("should validate keypair restoration from secret key", async () => {
        // Create a wallet first
        await createDevnetWallet({ testMode: true });

        // Test wallet should successfully restore the keypair
        const result = await testWallet({ testMode: true });

        expect(result.signatureTest).toBe(true);
        expect(typeof result.publicKey).toBe('string');
    });

    test("should connect to Solana devnet successfully", async () => {
        // Create a wallet first
        await createDevnetWallet({ testMode: true });

        const result = await testWallet({ testMode: true });

        // If the function completes without error, devnet connection worked
        expect(result).toBeDefined();
        expect(typeof result.balance).toBe('number');
    });

    test("should handle wallet with zero balance", async () => {
        // Create a wallet first
        await createDevnetWallet({ testMode: true });

        const result = await testWallet({ testMode: true });

        // Balance can be zero (common on devnet when airdrop fails)
        expect(result.balance).toBeGreaterThanOrEqual(0);
        expect(typeof result.accountExists).toBe('boolean');
    });

    test("should return correct wallet information structure", async () => {
        // Create a wallet first
        await createDevnetWallet({ testMode: true });

        const result = await testWallet({ testMode: true });

        expect(result).toHaveProperty('publicKey');
        expect(result).toHaveProperty('balance');
        expect(result).toHaveProperty('accountExists');
        expect(result).toHaveProperty('signatureTest');

        expect(typeof result.publicKey).toBe('string');
        expect(typeof result.balance).toBe('number');
        expect(typeof result.accountExists).toBe('boolean');
        expect(typeof result.signatureTest).toBe('boolean');
    });

    test("should handle corrupted wallet file", async () => {
        // Create wallet directory
        const walletDir = join(process.cwd(), 'wallet');
        mkdirSync(walletDir, { recursive: true });

        // Write invalid JSON to wallet file
        const walletPath = join(walletDir, 'devnet-wallet.json');
        writeFileSync(walletPath, 'invalid json content');

        await expect(testWallet({ testMode: true })).rejects.toThrow();
    });

    test("should handle wallet file with missing secretKey", async () => {
        // Create wallet directory
        const walletDir = join(process.cwd(), 'wallet');
        mkdirSync(walletDir, { recursive: true });

        // Write wallet data without secretKey
        const walletPath = join(walletDir, 'devnet-wallet.json');
        const invalidWalletData = {
            publicKey: 'SomePublicKey',
            network: 'devnet',
            created: new Date().toISOString()
            // Missing secretKey
        };
        writeFileSync(walletPath, JSON.stringify(invalidWalletData));

        await expect(testWallet({ testMode: true })).rejects.toThrow();
    });

    test("should handle wallet file with invalid secretKey format", async () => {
        // Create wallet directory
        const walletDir = join(process.cwd(), 'wallet');
        mkdirSync(walletDir, { recursive: true });

        // Write wallet data with invalid secretKey
        const walletPath = join(walletDir, 'devnet-wallet.json');
        const invalidWalletData = {
            publicKey: 'SomePublicKey',
            secretKey: 'not-an-array',
            network: 'devnet',
            created: new Date().toISOString()
        };
        writeFileSync(walletPath, JSON.stringify(invalidWalletData));

        await expect(testWallet({ testMode: true })).rejects.toThrow();
    });

    test("should validate public key format in result", async () => {
        // Create a wallet first
        await createDevnetWallet({ testMode: true });

        const result = await testWallet({ testMode: true });

        // Solana public keys are base58 encoded
        expect(result.publicKey).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
        expect(result.publicKey.length).toBeGreaterThanOrEqual(32);
        expect(result.publicKey.length).toBeLessThanOrEqual(44);
    });

    test("should complete signature test successfully", async () => {
        // Create a wallet first
        await createDevnetWallet({ testMode: true });

        const result = await testWallet({ testMode: true });

        expect(result.signatureTest).toBe(true);
    });

    test("should report account existence correctly", async () => {
        // Create a wallet first
        await createDevnetWallet({ testMode: true });

        const result = await testWallet({ testMode: true });

        // Account existence can be true or false depending on whether
        // the wallet has been used on devnet before
        expect(typeof result.accountExists).toBe('boolean');
    });

    test("should handle network connection timeouts gracefully", async () => {
        // Create a wallet first
        await createDevnetWallet({ testMode: true });

        // This test ensures the function doesn't hang indefinitely
        const startTime = Date.now();
        const result = await testWallet({ testMode: true });
        const endTime = Date.now();

        // Should complete within reasonable time (30 seconds)
        expect(endTime - startTime).toBeLessThan(30000);
        expect(result).toBeDefined();
    });

    test("should use correct devnet connection settings", async () => {
        // Create a wallet first
        await createDevnetWallet({ testMode: true });

        // This test verifies the connection parameters are correct
        // by ensuring the test completes without connection errors
        const result = await testWallet({ testMode: true });

        expect(result).toBeDefined();
        expect(typeof result.balance).toBe('number');
    });
});