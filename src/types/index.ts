// Types for the NEXUS Agent Intelligence Marketplace
export interface AgentIntelligence {
    id: string;
    seller: string; // Agent's public key
    title: string;
    description: string;
    category: IntelligenceCategory;
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

export type IntelligenceCategory =
    | 'market-analysis'
    | 'defi-strategy'
    | 'price-prediction'
    | 'risk-assessment'
    | 'trend-analysis';

export interface SearchFilters {
    category?: string;
    maxPrice?: number;
    minQuality?: number;
    seller?: string;
}

export interface MarketStats {
    totalIntelligence: number;
    totalAgents: number;
    totalTransactions: number;
    totalVolume: number;
    avgPrice: number;
    categories: Record<string, number>;
}

export interface IntelligenceData {
    [key: string]: any;
    data?: string;
    prediction?: string;
    confidence?: number;
    timeframe?: string;
    key_indicators?: string[];
    strategy?: string;
    pools?: string[];
    expected_apy?: string;
    risk_level?: string;
    instructions?: string;
    asset?: string;
    current_price?: number;
    predicted_price_24h?: number;
    predicted_price_7d?: number;
    confidence_24h?: number;
    confidence_7d?: number;
    risk_score?: number;
    factors?: string[];
    recommendation?: string;
    trend?: string;
    duration?: string;
    strength?: number;
    indicators?: string[];
}

export interface PurchaseResult {
    success: boolean;
    data?: IntelligenceData;
    error?: string;
}

export interface ApiError {
    error: string;
    message?: string;
    code?: string;
}

export interface WalletInfo {
    publicKey: string;
    balance: number;
}

export interface MarketplaceConfig {
    readonly INITIAL_REPUTATION: number;
    readonly MAX_REPUTATION: number;
    readonly MIN_RATING: number;
    readonly MAX_RATING: number;
    readonly AIRDROP_AMOUNT: number;
}

// Utility types for better type safety
export type AgentPublicKey = string;
export type IntelligenceId = string;
export type TransactionId = string;

// Enhanced types for API responses
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    timestamp?: number;
}

// Network-related types
export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet';

export interface NetworkConfig {
    readonly network: SolanaNetwork;
    readonly rpcUrl: string;
    readonly confirmationLevel: 'processed' | 'confirmed' | 'finalized';
}

// Rating constraint type (1-5 stars)
export type Rating = 1 | 2 | 3 | 4 | 5;

// Enhanced agent profile with computed fields
export interface EnhancedAgentProfile extends AgentProfile {
    averageRating?: number;
    recentSales?: number;
    isActive?: boolean;
    lastActivity?: number;
}

// Search result with score
export interface IntelligenceSearchResult extends AgentIntelligence {
    searchScore?: number;
    isRecommended?: boolean;
}

// Detailed transaction info
export interface TransactionDetails extends IntelligenceTransaction {
    intelligence?: Partial<AgentIntelligence>;
    buyer_profile?: Partial<AgentProfile>;
    seller_profile?: Partial<AgentProfile>;
    status: 'pending' | 'completed' | 'failed';
}