import type { AgentIntelligence, IntelligenceCategory, IntelligenceData } from '../types/index.js';

export const SAMPLE_AGENTS = [
    {
        publicKey: '11111111111111111111111111111111',
        profile: {
            name: 'AlphaTrader AI',
            description: 'Specialized in DeFi yield strategies and market analysis',
            specialization: ['defi-strategy', 'market-analysis'],
            verified: true
        }
    },
    {
        publicKey: '22222222222222222222222222222222',
        profile: {
            name: 'CryptoOracle',
            description: 'Advanced price prediction using ML models',
            specialization: ['price-prediction', 'trend-analysis'],
            verified: true
        }
    }
];

export const SAMPLE_INTELLIGENCE = [
    {
        sellerKey: '11111111111111111111111111111111',
        intelligence: {
            title: 'SOL Bull Market Strategy',
            description: 'Optimized DeFi yield farming strategy for SOL ecosystem',
            category: 'defi-strategy' as IntelligenceCategory,
            price: 0.5
        }
    },
    {
        sellerKey: '22222222222222222222222222222222',
        intelligence: {
            title: 'SOL 7-Day Price Prediction',
            description: 'ML-based price prediction with 78% historical accuracy',
            category: 'price-prediction' as IntelligenceCategory,
            price: 0.1
        }
    }
];

export function generateIntelligenceData(category: IntelligenceCategory): IntelligenceData {
    const samples: Record<IntelligenceCategory, IntelligenceData> = {
        'market-analysis': {
            data: `SOL Price Analysis - ${new Date().toISOString()}`,
            prediction: `Bullish trend expected over next 24h based on volume patterns`,
            confidence: 0.85,
            timeframe: '24h',
            key_indicators: ['Volume surge +45%', 'RSI oversold recovery', 'Whale accumulation detected']
        },
        'defi-strategy': {
            strategy: 'Yield farming optimization',
            pools: ['SOL-USDC', 'RAY-SOL', 'ORCA-USDC'],
            expected_apy: '12.5%',
            risk_level: 'Medium',
            instructions: 'Rotate between pools based on TVL changes'
        },
        'price-prediction': {
            asset: 'SOL',
            current_price: 98.5,
            predicted_price_24h: 105.2,
            predicted_price_7d: 115.8,
            confidence_24h: 0.78,
            confidence_7d: 0.65
        },
        'risk-assessment': {
            asset: 'SOL',
            risk_score: 6.5,
            factors: ['Market volatility', 'Liquidity risk', 'Smart contract risk'],
            recommendation: 'Medium risk - suitable for balanced portfolios'
        },
        'trend-analysis': {
            trend: 'Bullish',
            duration: '7 days',
            strength: 0.78,
            indicators: ['Moving averages', 'Volume profile', 'Social sentiment']
        }
    };

    return samples[category] || { generic_data: 'Intelligence data payload' };
}