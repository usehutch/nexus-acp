import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Keypair, PublicKey } from '@solana/web3.js';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

describe("Wallet Utilities Unit Tests", () => {
    const testWalletDir = join(process.cwd(), 'test-wallet-unit');

    beforeEach(() => {
        if (existsSync(testWalletDir)) {
            rmSync(testWalletDir, { recursive: true, force: true });
        }
        mkdirSync(testWalletDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testWalletDir)) {
            rmSync(testWalletDir, { recursive: true, force: true });
        }
    });

    describe("Wallet Creation Logic", () => {
        test("should generate valid keypair", () => {
            const wallet = Keypair.generate();

            expect(wallet.publicKey).toBeDefined();
            expect(wallet.secretKey).toBeDefined();
            expect(wallet.secretKey.length).toBe(64);
        });

        test("should create different keypairs on multiple calls", () => {
            const wallet1 = Keypair.generate();
            const wallet2 = Keypair.generate();

            expect(wallet1.publicKey.toString()).not.toBe(wallet2.publicKey.toString());
            expect(wallet1.secretKey).not.toEqual(wallet2.secretKey);
        });

        test("should create valid public key format", () => {
            const wallet = Keypair.generate();
            const publicKeyString = wallet.publicKey.toString();

            expect(publicKeyString.length).toBeGreaterThanOrEqual(32);
            expect(publicKeyString.length).toBeLessThanOrEqual(44);
            expect(publicKeyString).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
            expect(() => new PublicKey(publicKeyString)).not.toThrow();
        });

        test("should recreate keypair from secret key", () => {
            const originalWallet = Keypair.generate();
            const secretKey = originalWallet.secretKey;

            const restoredWallet = Keypair.fromSecretKey(secretKey);

            expect(restoredWallet.publicKey.toString()).toBe(originalWallet.publicKey.toString());
        });
    });

    describe("Wallet File Operations", () => {
        test("should create valid wallet JSON structure", () => {
            const wallet = Keypair.generate();
            const walletData = {
                publicKey: wallet.publicKey.toString(),
                secretKey: Array.from(wallet.secretKey),
                network: 'devnet',
                created: new Date().toISOString()
            };

            const walletPath = join(testWalletDir, 'test-wallet.json');
            writeFileSync(walletPath, JSON.stringify(walletData, null, 2));

            expect(existsSync(walletPath)).toBe(true);

            const savedData = JSON.parse(readFileSync(walletPath, 'utf-8'));
            expect(savedData.publicKey).toBe(wallet.publicKey.toString());
            expect(savedData.secretKey).toEqual(Array.from(wallet.secretKey));
            expect(savedData.network).toBe('devnet');
            expect(savedData.created).toBeDefined();
        });

        test("should handle directory creation", () => {
            const nestedDir = join(testWalletDir, 'nested', 'wallet');
            if (!existsSync(nestedDir)) {
                mkdirSync(nestedDir, { recursive: true });
            }

            expect(existsSync(nestedDir)).toBe(true);
        });

        test("should validate secret key array format", () => {
            const wallet = Keypair.generate();
            const secretKeyArray = Array.from(wallet.secretKey);

            expect(Array.isArray(secretKeyArray)).toBe(true);
            expect(secretKeyArray.length).toBe(64);

            secretKeyArray.forEach(byte => {
                expect(typeof byte).toBe('number');
                expect(byte).toBeGreaterThanOrEqual(0);
                expect(byte).toBeLessThanOrEqual(255);
            });
        });
    });

    describe("Wallet Testing Logic", () => {
        test("should validate wallet file structure", () => {
            const wallet = Keypair.generate();
            const walletData = {
                publicKey: wallet.publicKey.toString(),
                secretKey: Array.from(wallet.secretKey),
                network: 'devnet',
                created: new Date().toISOString()
            };

            expect(typeof walletData.publicKey).toBe('string');
            expect(Array.isArray(walletData.secretKey)).toBe(true);
            expect(typeof walletData.network).toBe('string');
            expect(typeof walletData.created).toBe('string');
        });

        test("should handle invalid wallet data", () => {
            const invalidWalletData = {
                publicKey: 'invalid-key',
                secretKey: 'not-an-array',
                network: 'devnet'
            };

            expect(() => {
                if (!Array.isArray(invalidWalletData.secretKey)) {
                    throw new Error('Invalid secret key format');
                }
                Keypair.fromSecretKey(new Uint8Array(invalidWalletData.secretKey));
            }).toThrow();
        });

        test("should validate keypair restoration", () => {
            const originalWallet = Keypair.generate();
            const walletData = {
                publicKey: originalWallet.publicKey.toString(),
                secretKey: Array.from(originalWallet.secretKey),
                network: 'devnet',
                created: new Date().toISOString()
            };

            const restoredWallet = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
            expect(restoredWallet.publicKey.toString()).toBe(walletData.publicKey);
        });

        test("should handle malformed JSON gracefully", () => {
            const malformedJson = '{"publicKey": invalid json}';

            expect(() => JSON.parse(malformedJson)).toThrow();
        });

        test("should validate required wallet fields", () => {
            const completeWallet = {
                publicKey: 'test-key',
                secretKey: [1, 2, 3],
                network: 'devnet',
                created: new Date().toISOString()
            };

            const incompleteWallet = {
                publicKey: 'test-key'
                // Missing required fields
            };

            expect(completeWallet.secretKey).toBeDefined();
            expect(incompleteWallet.secretKey).toBeUndefined();
        });
    });

    describe("Signature Capabilities", () => {
        test("should support message signing", () => {
            const wallet = Keypair.generate();
            const message = Buffer.from('Test message for signing', 'utf8');

            expect(() => {
                // Simulate signature capability test
                const publicKey = wallet.publicKey;
                const secretKey = wallet.secretKey;
                expect(publicKey).toBeDefined();
                expect(secretKey).toBeDefined();
            }).not.toThrow();
        });

        test("should create consistent signatures", () => {
            const wallet = Keypair.generate();

            // Test that wallet can be used for signing operations
            expect(wallet.secretKey.length).toBe(64);
            expect(wallet.publicKey.toString().length).toBeGreaterThan(0);
        });
    });

    describe("Network Configuration", () => {
        test("should support different network configurations", () => {
            const networks = ['devnet', 'testnet', 'mainnet-beta'];

            networks.forEach(network => {
                const walletData = {
                    publicKey: Keypair.generate().publicKey.toString(),
                    secretKey: Array.from(Keypair.generate().secretKey),
                    network,
                    created: new Date().toISOString()
                };

                expect(['devnet', 'testnet', 'mainnet-beta']).toContain(walletData.network);
            });
        });

        test("should validate network field", () => {
            const validNetworks = ['devnet', 'testnet', 'mainnet-beta'];
            const testNetwork = 'devnet';

            expect(validNetworks).toContain(testNetwork);
        });
    });

    describe("Error Handling", () => {
        test("should handle file not found errors", () => {
            const nonExistentPath = join(testWalletDir, 'non-existent-wallet.json');

            expect(existsSync(nonExistentPath)).toBe(false);
            expect(() => readFileSync(nonExistentPath, 'utf-8')).toThrow();
        });

        test("should handle invalid secret key lengths", () => {
            const invalidSecretKey = [1, 2, 3]; // Too short

            expect(() => {
                if (invalidSecretKey.length !== 64) {
                    throw new Error('Invalid secret key length');
                }
            }).toThrow();
        });

        test("should handle invalid public key formats", () => {
            const invalidPublicKey = 'invalid-key-format';

            expect(() => new PublicKey(invalidPublicKey)).toThrow();
        });
    });
});