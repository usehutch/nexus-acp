#!/usr/bin/env bun

// Test full marketplace workflow
const BASE_URL = 'http://localhost:45421';

async function testPostEndpoint(endpoint: string, body: any) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log(`✅ POST ${endpoint}:`, JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error(`❌ POST ${endpoint}:`, error);
        return null;
    }
}

console.log('🧪 Testing Full NEXUS Marketplace Workflow...\n');

// 1. Get initial stats
console.log('📊 Initial marketplace stats:');
const statsResponse = await fetch(`${BASE_URL}/api/stats`);
const initialStats = await statsResponse.json();
console.log(JSON.stringify(initialStats.data, null, 2));

// 2. Get available intelligence
console.log('\n🔍 Available intelligence:');
const intelResponse = await fetch(`${BASE_URL}/api/intelligence`);
const intelligence = await intelResponse.json();
console.log(`Found ${intelligence.data.length} intelligence items`);

// Use the actual wallet public key from our devnet wallet
const WALLET_PUBLIC_KEY = 'E33t3aF8VcHh3ENfb69WC6zjSvhVo7VxnoURpLfq7d4r';

// 3. Test purchase (simulate buying the first intelligence)
if (intelligence.data.length > 0) {
    console.log('\n💳 Testing purchase...');
    const purchaseResult = await testPostEndpoint('/api/purchase', {
        intelligenceId: intelligence.data[0].id,
        buyerKey: WALLET_PUBLIC_KEY
    });

    if (purchaseResult?.success) {
        console.log('\n⭐ Testing rating...');
        await testPostEndpoint('/api/rate', {
            intelligenceId: intelligence.data[0].id,
            buyerKey: WALLET_PUBLIC_KEY,
            rating: 5,
            review: 'Excellent intelligence, very valuable!'
        });
    }
}

// 4. Test agent registration
console.log('\n🤖 Testing agent registration...');
await testPostEndpoint('/api/register', {
    publicKey: WALLET_PUBLIC_KEY,
    name: 'Test Agent Demo',
    description: 'Test agent for demo purposes',
    specialization: ['market-analysis', 'testing']
});

// 5. Test intelligence listing
console.log('\n📋 Testing intelligence listing...');
const listResult = await testPostEndpoint('/api/list', {
    sellerKey: WALLET_PUBLIC_KEY,
    title: 'Test Intelligence Demo',
    description: 'Sample intelligence for testing purposes',
    category: 'market-analysis',
    price: 0.05
});

// 6. Test simulation endpoint
console.log('\n🎮 Testing simulation...');
await testPostEndpoint('/api/simulate', {});

// 7. Get final stats
console.log('\n📈 Final marketplace stats:');
const finalStatsResponse = await fetch(`${BASE_URL}/api/stats`);
const finalStats = await finalStatsResponse.json();
console.log(JSON.stringify(finalStats.data, null, 2));

console.log('\n🎯 Full workflow testing complete!');