// Types for our marketplace
export interface AgentIntelligence {
    id: string;
    seller: string; // Agent's public key
    title: string;
    description: string;
    category: 'market-analysis' | 'defi-strategy' | 'price-prediction' | 'risk-assessment' | 'trend-analysis';
    price: number; // In SOL
    quality_score: number; // 0-100 reputation based
    created_at: number;
    sales_count: number;
    rating: number; // Average rating from buyers
}

export interface AgentProfile {
    public_key: string;
    name: string;
    description: string;
    specialization: string[];
    reputation_score: number; // 0-1000
    total_sales: number;
    total_earnings: number; // In SOL
    verified: boolean;
    created_at: number;
}

export interface IntelligenceTransaction {
    id: string;
    buyer: string;
    seller: string;
    intelligence_id: string;
    price: number;
    timestamp: number;
    rating?: number; // 1-5 stars
    review?: string;
}