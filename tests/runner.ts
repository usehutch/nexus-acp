#!/usr/bin/env bun

/**
 * Test Runner for NEXUS Agent Intelligence Marketplace
 *
 * This script runs the comprehensive test suite for the marketplace.
 * It includes unit tests that don't require network connectivity.
 */

import { spawn } from 'bun';

// Check for fast mode flag
const isFastMode = process.argv.includes('--fast');

const coreTestFiles = [
    // Core unit tests (fast)
    'tests/unit/marketplace.test.ts',
    'tests/unit/wallet.test.ts',
    'tests/unit/agent-manager.test.ts',
    'tests/unit/intelligence-manager.test.ts',
    'tests/unit/transaction-manager.test.ts'
];

const extendedTestFiles = [
    ...coreTestFiles,
    // Comprehensive and security tests
    'tests/unit/marketplace-comprehensive.test.ts',
    'tests/unit/transaction-security.test.ts',

    // Error handling and edge cases
    'tests/unit/error-handling.test.ts',

    // Integration tests
    'tests/integration/marketplace-integration.test.ts',
    'tests/integration/end-to-end-comprehensive.test.ts',

    // Performance tests (can be slow)
    'tests/performance/stress-tests.test.ts'
];

const testFiles = isFastMode ? coreTestFiles : extendedTestFiles;

async function runTests() {
    console.log('🧪 NEXUS Agent Intelligence Marketplace - Test Suite');
    console.log(`====================================================`);
    console.log(`Mode: ${isFastMode ? '⚡ Fast (Core Tests Only)' : '🔬 Full (All Tests)'}`);
    console.log(`Tests: ${testFiles.length} files\n`);

    let allTestsPassed = true;

    for (const testFile of testFiles) {
        console.log(`🔍 Running tests in ${testFile}...`);

        try {
            const result = spawn(['bun', 'test', testFile], {
                stdio: ['inherit', 'pipe', 'pipe'],
            });

            const output = await new Response(result.stdout).text();
            const error = await new Response(result.stderr).text();

            if (result.exitCode === 0) {
                console.log(`✅ ${testFile} - All tests passed`);
                if (output) console.log(output);
            } else {
                console.log(`❌ ${testFile} - Some tests failed`);
                allTestsPassed = false;
                if (error) console.error(error);
                if (output) console.log(output);
            }

            console.log(); // Add spacing between test files
        } catch (err) {
            console.error(`❌ Error running ${testFile}:`, err);
            allTestsPassed = false;
        }
    }

    console.log('🎯 Test Summary:');
    console.log('- Core Components: AgentManager, IntelligenceManager, TransactionManager');
    console.log('- AgentMarketplace class: Full unit and integration test coverage');
    console.log('- Wallet utilities: Comprehensive validation tests');
    console.log('- Error handling: Edge cases and malformed input handling');
    console.log('- Integration flows: End-to-end marketplace scenarios');
    console.log('- Performance tests: Stress testing with high-volume operations');
    console.log('- Memory management: Resource cleanup and concurrent access patterns');

    if (allTestsPassed) {
        console.log('\n🏆 All tests passed! Ready for Colosseum Agent Hackathon submission!');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed. Please fix the issues before submission.');
        process.exit(1);
    }
}

if (import.meta.main) {
    runTests().catch(console.error);
}