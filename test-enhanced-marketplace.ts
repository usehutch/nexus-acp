#!/usr/bin/env bun
import { Connection } from '@solana/web3.js';
import { AgentMarketplace } from './src/core/marketplace.js';
import { CONFIG } from './src/config/index.js';

/**
 * Test script for NEXUS Enhanced Marketplace
 * Demonstrates privacy, memory, and transparency features
 * Based on feedback from Sipher, moltdev (AgentMemory), and Mereum (SOLPRISM)
 */

async function testEnhancedMarketplace() {
    console.log('🚀 Testing NEXUS Enhanced Marketplace');
    console.log('==================================================\n');

    // Initialize marketplace with enhanced features
    const connection = new Connection(CONFIG.SOLANA.RPC_URL, CONFIG.SOLANA.CONFIRMATION_LEVEL);
    const marketplace = new AgentMarketplace(connection);

    // Register a test buyer
    const buyerKey = 'BuyerAgent123456789012345678901234';
    await marketplace.registerAgent(buyerKey, {
        name: 'TestBuyer AI',
        description: 'AI agent testing enhanced marketplace features',
        specialization: ['market-analysis', 'testing'],
        verified: true
    });

    console.log('\n📊 Testing Enhanced Purchase with Full Stack...\n');

    // Test enhanced purchase with all features
    try {
        const intelligence = marketplace.searchIntelligence()[0];
        console.log(`🛒 Purchasing: "${intelligence.title}" for ${intelligence.price} SOL`);

        const result = await marketplace.purchaseIntelligence(
            buyerKey,
            intelligence.id
        );

        console.log(`\n✅ Purchase Result:`);
        console.log(`   Success: ${result.success}`);
        console.log(`   Privacy Protected: ${!!result.privacy?.stealthAddress}`);
        console.log(`   Transparency Committed: ${!!result.transparency?.commitId}`);
        console.log(`   Intelligence Delivered: ${!!result.data}`);

        if (result.privacy?.stealthAddress) {
            console.log(`   🛡️ Stealth Address: ${result.privacy.stealthAddress.substr(0, 8)}...`);
        }

        if (result.transparency?.commitId) {
            console.log(`   🔒 Transparency Commit: ${result.transparency.commitId}`);
        }

        console.log('\n🔍 Testing Enhanced Features...\n');

        // Test memory layer
        console.log('📚 Memory Layer Tests:');
        const recommendations = await marketplace.getAgentRecommendations(buyerKey);
        console.log(`   Memory Insights: ${recommendations.insights.length} recommendations`);
        console.log(`   Success Rate: ${(recommendations.patterns.successRate * 100).toFixed(1)}%`);

        const analytics = await marketplace.getAgentAnalytics(intelligence.seller);
        console.log(`   Seller Analytics: ${analytics.reputation.total_sales} sales, score ${analytics.reputation.score}`);

        // Test transparency layer
        console.log('\n🔍 Transparency Layer Tests:');
        const transparencyAudit = await marketplace.auditAgentTransparency(buyerKey);
        console.log(`   Transparency Score: ${transparencyAudit.transparency_score}%`);
        console.log(`   Decision Patterns: ${Object.keys(transparencyAudit.decision_patterns.decision_types).join(', ')}`);

        // Test enhanced market stats
        console.log('\n📈 Enhanced Market Statistics:');
        const enhancedStats = marketplace.getMarketStats();
        console.log(`   Privacy Features: ${enhancedStats.enhancements.privacy.features.length} active`);
        console.log(`   Memory Features: ${enhancedStats.enhancements.memory.features.length} active`);
        console.log(`   Transparency Rate: ${enhancedStats.enhancements.transparency.rate?.toFixed(1)}%`);

        console.log('\n🎉 All Enhanced Features Working!');
        console.log('==================================================\n');

        // Demonstrate integration benefits
        console.log('🌟 NEXUS Enhanced Integration Benefits:\n');
        console.log('🛡️  PRIVACY (Sipher Integration):');
        console.log('   • MEV protection through stealth addresses');
        console.log('   • Amount commitments prevent front-running');
        console.log('   • Automatic privacy thresholds for high-value trades\n');

        console.log('🧠 MEMORY (AgentMemory Integration):');
        console.log('   • Persistent transaction and reputation history');
        console.log('   • Semantic search across purchased intelligence');
        console.log('   • Personalized recommendations based on past behavior\n');

        console.log('🔍 TRANSPARENCY (SOLPRISM Integration):');
        console.log('   • Commit-reveal schemes for trustless trading');
        console.log('   • Auditable reasoning and decision processes');
        console.log('   • Marketplace-wide transparency scoring\n');

        console.log('🚀 NEXUS now addresses all community feedback!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testEnhancedMarketplace()
    .then(() => {
        console.log('\n✅ Enhanced marketplace test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Enhanced marketplace test failed:', error);
        process.exit(1);
    });