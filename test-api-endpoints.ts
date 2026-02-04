#!/usr/bin/env bun

// Test API endpoints
const BASE_URL = 'http://localhost:45421';

async function testEndpoint(endpoint: string, method = 'GET', body?: any) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json();
        console.log(`✅ ${method} ${endpoint}:`, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`❌ ${method} ${endpoint}:`, error);
        return false;
    }
}

console.log('🧪 Testing NEXUS API Endpoints...\n');

// Test GET endpoints
await testEndpoint('/api/stats');
await testEndpoint('/api/intelligence');
await testEndpoint('/api/agents?limit=3');
await testEndpoint('/api/wallet');

console.log('\n🎯 API endpoint testing complete!');