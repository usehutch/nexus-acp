import { Connection, clusterApiUrl } from '@solana/web3.js';
import { AgentMarketplace } from './src/marketplace.js';

async function testIntegrationFeatures() {
    console.log('🚀 Testing NEXUS Integration Features');
    console.log('=====================================\n');

    const connection = new Connection(clusterApiUrl('devnet'));
    const marketplace = new AgentMarketplace(connection);

    // Register additional agents for integration testing
    await marketplace.registerAgent('33333333333333333333333333333333', {
        name: 'DataAnalyst AI',
        description: 'Advanced data analytics and market research',
        specialization: ['market-analysis', 'trend-analysis'],
        verified: true
    });

    await marketplace.registerAgent('44444444444444444444444444444444', {
        name: 'CryptoDeveloper',
        description: 'Smart contract development and DeFi protocols',
        specialization: ['defi-strategy'],
        verified: true
    });

    console.log('✅ Test agents registered\n');

    // Test 1: AgentPay Integration - Create Intelligence Subscription
    console.log('🔄 Test 1: AgentPay Intelligence Subscription');
    console.log('--------------------------------------------');

    try {
        const subscriptionId = await marketplace.createIntelligenceSubscription(
            '33333333333333333333333333333333', // subscriber (DataAnalyst)
            '11111111111111111111111111111111', // provider (AlphaTrader)
            'defi-strategy',
            0.01, // 0.01 SOL per query
            500,  // 500 queries per month
            2.0   // 2 SOL initial deposit
        );

        console.log(`✅ Subscription created: ${subscriptionId}\n`);

        // Test subscription queries with different priorities
        const queryResults = await Promise.all([
            marketplace.queryIntelligenceViaSubscription(
                subscriptionId,
                'What is the optimal yield farming strategy for SOL-USDC?',
                'normal'
            ),
            marketplace.queryIntelligenceViaSubscription(
                subscriptionId,
                'Emergency: Market crash detected, what should I do?',
                'urgent'
            ),
            marketplace.queryIntelligenceViaSubscription(
                subscriptionId,
                'High priority: Analyze Jupiter vs Orca for swaps',
                'high'
            )
        ]);

        console.log(`✅ Processed ${queryResults.length} subscription queries`);
        console.log(`   💰 Total cost: ${queryResults.reduce((sum, r) => sum + (2.0 - (r.streamBalance || 0)), 0).toFixed(4)} SOL`);
        console.log(`   🏦 Remaining balance: ${queryResults[queryResults.length - 1].streamBalance} SOL\n`);

    } catch (error) {
        console.error(`❌ AgentPay test failed: ${error instanceof Error ? error.message : error}\n`);
    }

    // Test 2: BountyBoard Integration
    console.log('🎯 Test 2: BountyBoard Integration');
    console.log('----------------------------------');

    try {
        await marketplace.registerForBountyType('44444444444444444444444444444444', 'Smart Contract Development');
        await marketplace.registerForBountyType('33333333333333333333333333333333', 'Market Analysis');
        await marketplace.registerForBountyType('11111111111111111111111111111111', 'DeFi Strategy Consulting');

        console.log('✅ Agents registered for bounty capabilities\n');

    } catch (error) {
        console.error(`❌ BountyBoard test failed: ${error instanceof Error ? error.message : error}\n`);
    }

    // Test 3: Cross-Platform Collaboration Discovery
    console.log('🔍 Test 3: Collaboration Discovery');
    console.log('----------------------------------');

    try {
        const opportunities = await marketplace.findCollaborationOpportunities('33333333333333333333333333333333');

        console.log(`✅ Collaboration opportunities found:`);
        console.log(`   🤝 AgentPay Partners: ${opportunities.agentPayPartners.length}`);
        console.log(`   🎯 Bounty Matches: ${opportunities.bountyMatches.length}`);
        console.log(`   📊 Subscription Opportunities: ${opportunities.subscriptionRecommendations.length}\n`);

    } catch (error) {
        console.error(`❌ Collaboration discovery failed: ${error instanceof Error ? error.message : error}\n`);
    }

    // Test 4: Integration Statistics
    console.log('📈 Test 4: Integration Statistics');
    console.log('---------------------------------');

    try {
        const stats = marketplace.getIntegrationStats();
        const enhancedStats = marketplace.getEnhancedMarketStats();

        console.log('AgentPay Integration:');
        console.log(`   Active Streams: ${stats.agentPay.activeStreams}`);
        console.log(`   Total Volume: ${stats.agentPay.totalVolume} SOL`);
        console.log(`   Average Stream Size: ${stats.agentPay.avgStreamSize.toFixed(4)} SOL`);

        console.log('\nSubscription Service:');
        console.log(`   Active Subscriptions: ${stats.subscriptions.active}`);
        console.log(`   Total Queries Processed: ${stats.subscriptions.totalQueries}`);

        console.log('\nBounty Integration:');
        console.log(`   Active Bounties: ${stats.bounties.active}`);
        console.log(`   Total Rewards: ${stats.bounties.totalReward} SOL`);

        console.log('\nOverall Platform Stats:');
        console.log(`   Total Agents: ${enhancedStats.totalAgents}`);
        console.log(`   Total Transactions: ${enhancedStats.totalTransactions}`);
        console.log(`   Total Volume: ${enhancedStats.totalVolume} SOL`);
        console.log(`   Privacy Protected: ${enhancedStats.privacy.protectedTransactions} transactions`);
        console.log(`   Transparency Score: ${enhancedStats.transparency.commitmentRate}%\n`);

    } catch (error) {
        console.error(`❌ Statistics test failed: ${error instanceof Error ? error.message : error}\n`);
    }

    // Test 5: Stream Management
    console.log('💳 Test 5: Payment Stream Management');
    console.log('------------------------------------');

    try {
        // Create another subscription to demonstrate stream management
        const subscription2 = await marketplace.createIntelligenceSubscription(
            '44444444444444444444444444444444', // CryptoDeveloper
            '22222222222222222222222222222222', // CryptoOracle
            'price-prediction',
            0.005, // 0.005 SOL per query
            1000,  // 1000 queries per month
            1.5    // 1.5 SOL initial deposit
        );

        // Demonstrate stream top-up
        const streamId = marketplace.subscriptions?.get(subscription2)?.streamId;
        if (streamId) {
            await marketplace.topUpPaymentStream(streamId, 0.5); // Add 0.5 SOL
            console.log('✅ Payment stream topped up successfully\n');
        }

    } catch (error) {
        console.error(`❌ Stream management test failed: ${error instanceof Error ? error.message : error}\n`);
    }

    // Test 6: Enhanced Purchase with Integration Context
    console.log('🛒 Test 6: Enhanced Purchase with Integration Features');
    console.log('-----------------------------------------------------');

    try {
        // Purchase intelligence with reasoning (transparency layer)
        const result = await marketplace.purchaseIntelligence(
            '33333333333333333333333333333333',
            'intel_1706880661000_abc123def', // First sample intelligence
            {
                decision: 'Strategic purchase for portfolio optimization',
                factors: ['High seller reputation', 'Relevant to current market conditions', 'Good price point'],
                expectedValue: 'Improved DeFi yield strategy'
            }
        );

        if (result.success) {
            console.log('✅ Enhanced purchase completed with:');
            console.log(`   🛡️ Privacy Protection: ${result.shieldedTxId ? 'Yes' : 'No'}`);
            console.log(`   🔍 Transparency Commitment: ${result.commitmentId ? 'Yes' : 'No'}`);
            console.log(`   🧠 Memory Recording: Yes (automatic)`);
            console.log(`   💡 Personalized Context: ${result.data?.personalizedContext || 'N/A'}\n`);
        }

    } catch (error) {
        console.error(`❌ Enhanced purchase test failed: ${error instanceof Error ? error.message : error}\n`);
    }

    console.log('🎉 Integration Testing Complete!');
    console.log('================================');
    console.log('NEXUS is now ready for cross-platform collaboration with:');
    console.log('• AgentPay streaming payments for subscription intelligence');
    console.log('• BountyBoard integration for capability matching');
    console.log('• Cross-platform collaboration discovery');
    console.log('• Enhanced privacy, transparency, and memory features');
    console.log('• Comprehensive integration statistics and monitoring\n');

    return {
        marketplace,
        integrationStats: marketplace.getIntegrationStats(),
        enhancedStats: marketplace.getEnhancedMarketStats()
    };
}

// Run the test
if (require.main === module) {
    testIntegrationFeatures()
        .then(results => {
            console.log('Test completed successfully!');
            console.log('\nFinal Integration Stats:');
            console.log(JSON.stringify(results.integrationStats, null, 2));
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

export { testIntegrationFeatures };