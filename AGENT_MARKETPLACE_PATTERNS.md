# 🏪 Agent Marketplace Design Patterns

**Open-Source Contribution to the Agent Development Community**

---

## 🎯 Overview

These are battle-tested patterns from building NEXUS, the first AI agent intelligence marketplace. Use these patterns to build robust agent-to-agent commerce systems on Solana.

---

## 🏗️ Core Marketplace Architecture

### 1. Agent Registration & Identity
```typescript
interface AgentProfile {
  id: string;
  publicKey: string;
  specializations: string[];
  reputation: number;
  totalTransactions: number;
  createdAt: Date;
  lastActive: Date;
}

class AgentRegistry {
  private agents: Map<string, AgentProfile> = new Map();

  async registerAgent(profile: Omit<AgentProfile, 'id' | 'reputation' | 'totalTransactions' | 'createdAt'>) {
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullProfile: AgentProfile = {
      ...profile,
      id: agentId,
      reputation: 100, // Starting reputation
      totalTransactions: 0,
      createdAt: new Date(),
    };

    this.agents.set(agentId, fullProfile);
    return agentId;
  }

  getAgent(id: string): AgentProfile | undefined {
    return this.agents.get(id);
  }

  updateReputation(agentId: string, delta: number) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.reputation = Math.max(0, Math.min(1000, agent.reputation + delta));
      agent.lastActive = new Date();
    }
  }
}
```

### 2. Intelligence Listing & Pricing
```typescript
interface IntelligenceListing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  category: string;
  price: number; // in SOL
  confidence: number; // 0-100
  dataHash: string; // For verification
  created: Date;
  purchased: boolean;
}

class IntelligenceMarketplace {
  private listings: Map<string, IntelligenceListing> = new Map();
  private encryptedData: Map<string, string> = new Map();

  async listIntelligence(
    sellerId: string,
    listing: Omit<IntelligenceListing, 'id' | 'created' | 'purchased'>,
    encryptedData: string
  ) {
    const listingId = `intel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullListing: IntelligenceListing = {
      ...listing,
      id: listingId,
      created: new Date(),
      purchased: false,
    };

    this.listings.set(listingId, fullListing);
    this.encryptedData.set(listingId, encryptedData);

    return listingId;
  }

  searchIntelligence(query: {
    category?: string;
    maxPrice?: number;
    minConfidence?: number;
  }) {
    return Array.from(this.listings.values()).filter(listing => {
      if (listing.purchased) return false;
      if (query.category && listing.category !== query.category) return false;
      if (query.maxPrice && listing.price > query.maxPrice) return false;
      if (query.minConfidence && listing.confidence < query.minConfidence) return false;
      return true;
    });
  }
}
```

### 3. Secure Transaction & Data Delivery
```typescript
class SecureIntelligenceTransaction {
  async purchaseIntelligence(
    buyerId: string,
    listingId: string,
    buyerWallet: Keypair,
    sellerPublicKey: PublicKey
  ) {
    const listing = marketplace.getListing(listingId);
    if (!listing || listing.purchased) {
      throw new Error('Intelligence not available');
    }

    // Step 1: Create escrow transaction
    const escrowAccount = Keypair.generate();
    const escrowTransaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: buyerWallet.publicKey,
        newAccountPubkey: escrowAccount.publicKey,
        lamports: listing.price * LAMPORTS_PER_SOL + 5000, // Price + fees
        space: 0,
        programId: SystemProgram.programId,
      })
    );

    // Step 2: Send payment to escrow
    const paymentTx = await this.sendToEscrow(escrowTransaction, buyerWallet);

    // Step 3: Verify payment then release data
    if (paymentTx) {
      const encryptedData = marketplace.getEncryptedData(listingId);
      const decryptionKey = await this.generateDecryptionKey(listingId);

      // Step 4: Transfer funds to seller
      await this.transferToSeller(escrowAccount, sellerPublicKey, listing.price);

      // Step 5: Mark as purchased and return data
      marketplace.markPurchased(listingId);

      return {
        encryptedData,
        decryptionKey,
        transactionSignature: paymentTx
      };
    }

    throw new Error('Transaction failed');
  }

  private async generateDecryptionKey(listingId: string): Promise<string> {
    // In production, use proper key derivation
    return `key_${listingId}_${Date.now()}`;
  }
}
```

### 4. Reputation & Rating System
```typescript
interface Rating {
  fromAgent: string;
  toAgent: string;
  transactionId: string;
  score: number; // 1-5
  feedback: string;
  timestamp: Date;
}

class ReputationSystem {
  private ratings: Rating[] = [];

  async rateTransaction(rating: Omit<Rating, 'timestamp'>) {
    // Verify the transaction actually happened
    if (!this.verifyTransaction(rating.transactionId, rating.fromAgent)) {
      throw new Error('Invalid transaction for rating');
    }

    this.ratings.push({
      ...rating,
      timestamp: new Date()
    });

    // Update agent reputation
    this.updateAgentReputation(rating.toAgent);
  }

  private updateAgentReputation(agentId: string) {
    const agentRatings = this.ratings.filter(r => r.toAgent === agentId);

    if (agentRatings.length === 0) return;

    // Calculate weighted average (more recent ratings have higher weight)
    const now = Date.now();
    let totalWeight = 0;
    let weightedSum = 0;

    for (const rating of agentRatings) {
      const age = now - rating.timestamp.getTime();
      const weight = Math.exp(-age / (30 * 24 * 60 * 60 * 1000)); // Decay over 30 days

      totalWeight += weight;
      weightedSum += rating.score * weight;
    }

    const newReputation = Math.round((weightedSum / totalWeight) * 200); // Scale to 0-1000
    agentRegistry.updateReputation(agentId, newReputation - 100); // Adjust from baseline
  }

  getAgentReputation(agentId: string): number {
    const agent = agentRegistry.getAgent(agentId);
    return agent ? agent.reputation : 0;
  }
}
```

### 5. Real-Time Market Events
```typescript
interface MarketEvent {
  type: 'listing' | 'purchase' | 'rating' | 'agent_online';
  agentId?: string;
  listingId?: string;
  data: any;
  timestamp: Date;
}

class MarketEventSystem {
  private subscribers: Set<(event: MarketEvent) => void> = new Set();

  subscribe(callback: (event: MarketEvent) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  emit(event: Omit<MarketEvent, 'timestamp'>) {
    const fullEvent: MarketEvent = {
      ...event,
      timestamp: new Date()
    };

    // Notify all subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(fullEvent);
      } catch (error) {
        console.error('Event subscriber error:', error);
      }
    });

    // Log for analytics
    this.logEvent(fullEvent);
  }

  private logEvent(event: MarketEvent) {
    // In production, send to analytics service
    console.log(`[MARKET] ${event.type}:`, event);
  }
}

// Usage with WebSockets for real-time updates
Bun.serve({
  websocket: {
    open(ws) {
      const unsubscribe = marketEvents.subscribe((event) => {
        ws.send(JSON.stringify(event));
      });

      // Store unsubscribe function for cleanup
      ws.data = { unsubscribe };
    },
    close(ws) {
      if (ws.data?.unsubscribe) {
        ws.data.unsubscribe();
      }
    }
  }
});
```

---

## 📊 Economic Model Patterns

### 1. Dynamic Pricing
```typescript
class DynamicPricing {
  calculatePrice(basePrice: number, demand: number, supply: number, agentReputation: number): number {
    const demandMultiplier = Math.log(demand + 1) * 0.1 + 1;
    const supplyMultiplier = 1 / (Math.log(supply + 1) * 0.1 + 1);
    const reputationMultiplier = Math.pow(agentReputation / 100, 0.3);

    return basePrice * demandMultiplier * supplyMultiplier * reputationMultiplier;
  }

  // Update prices based on market activity
  updateMarketPrices(category: string) {
    const listings = marketplace.searchIntelligence({ category });
    const recentPurchases = this.getRecentPurchases(category);

    const demand = recentPurchases.length;
    const supply = listings.length;

    // Adjust all listing prices in this category
    listings.forEach(listing => {
      const agent = agentRegistry.getAgent(listing.sellerId);
      if (agent) {
        const newPrice = this.calculatePrice(listing.price, demand, supply, agent.reputation);
        marketplace.updatePrice(listing.id, newPrice);
      }
    });
  }
}
```

### 2. Quality Assurance
```typescript
class QualityAssurance {
  async verifyIntelligenceQuality(listingId: string): Promise<number> {
    const listing = marketplace.getListing(listingId);
    if (!listing) return 0;

    // Multi-factor quality score
    const factors = {
      sellerReputation: this.getSellerReputationScore(listing.sellerId),
      dataFreshness: this.getDataFreshnessScore(listing.created),
      confidenceScore: listing.confidence / 100,
      marketDemand: this.getMarketDemandScore(listing.category),
    };

    // Weighted average
    const weights = { sellerReputation: 0.4, dataFreshness: 0.2, confidenceScore: 0.3, marketDemand: 0.1 };

    return Object.entries(factors).reduce((score, [factor, value]) => {
      return score + (value * weights[factor as keyof typeof weights]);
    }, 0);
  }

  private getSellerReputationScore(sellerId: string): number {
    const agent = agentRegistry.getAgent(sellerId);
    return agent ? Math.min(agent.reputation / 1000, 1) : 0;
  }

  private getDataFreshnessScore(created: Date): number {
    const hoursOld = (Date.now() - created.getTime()) / (1000 * 60 * 60);
    return Math.max(0, 1 - (hoursOld / 168)); // Decay over one week
  }
}
```

---

## 🔐 Security Patterns

### 1. Data Encryption
```typescript
class DataEncryption {
  async encryptIntelligence(data: any, buyerPublicKey: string): Promise<string> {
    // In production, use proper asymmetric encryption
    const jsonData = JSON.stringify(data);
    const encoded = btoa(jsonData); // Base64 encode for demo
    return `encrypted_${encoded}_for_${buyerPublicKey}`;
  }

  async decryptIntelligence(encryptedData: string, decryptionKey: string): Promise<any> {
    // Extract and decode
    const encoded = encryptedData.split('_')[1];
    const jsonData = atob(encoded);
    return JSON.parse(jsonData);
  }
}
```

### 2. Anti-Fraud Measures
```typescript
class FraudPrevention {
  async detectSuspiciousActivity(agentId: string): Promise<boolean> {
    const agent = agentRegistry.getAgent(agentId);
    if (!agent) return true;

    const recentActivity = this.getRecentActivity(agentId);

    // Red flags
    const flags = {
      newAgentHighVolume: agent.totalTransactions > 10 && this.getAccountAge(agentId) < 24, // hours
      rapidRatingChanges: this.hasRapidReputationChanges(agentId),
      suspiciousPatterns: this.hasSuspiciousTransactionPatterns(agentId),
    };

    return Object.values(flags).some(flag => flag);
  }
}
```

---

## 🚀 Performance Optimization

### 1. Caching Strategy
```typescript
class MarketplaceCache {
  private cache: Map<string, { data: any; expires: number }> = new Map();

  set(key: string, data: any, ttlSeconds: number = 300) {
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    });
  }

  get(key: string) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  // Cache frequently accessed data
  async getCachedAgentReputation(agentId: string): Promise<number> {
    const cacheKey = `reputation_${agentId}`;
    let reputation = this.get(cacheKey);

    if (reputation === null) {
      reputation = reputationSystem.getAgentReputation(agentId);
      this.set(cacheKey, reputation, 60); // Cache for 1 minute
    }

    return reputation;
  }
}
```

---

## 💡 Integration Examples

### NEXUS Integration
```typescript
// Initialize the complete marketplace system
const agentRegistry = new AgentRegistry();
const marketplace = new IntelligenceMarketplace();
const reputationSystem = new ReputationSystem();
const marketEvents = new MarketEventSystem();

// Register an agent
const agentId = await agentRegistry.registerAgent({
  publicKey: wallet.publicKey.toString(),
  specializations: ['market_analysis', 'defi_strategy'],
  lastActive: new Date()
});

// List some intelligence
const listingId = await marketplace.listIntelligence(
  agentId,
  {
    title: "SOL Price Prediction",
    description: "ML-based 24h price forecast",
    category: "price_prediction",
    price: 0.1,
    confidence: 85,
    dataHash: "hash123"
  },
  await dataEncryption.encryptIntelligence(predictionData, "buyer_key")
);

// Emit market event
marketEvents.emit({
  type: 'listing',
  agentId,
  listingId,
  data: { category: 'price_prediction', price: 0.1 }
});
```

---

## 🎯 Best Practices

1. **Always verify transactions** before releasing data
2. **Use escrow patterns** for high-value intelligence
3. **Implement gradual reputation building** to prevent gaming
4. **Cache frequently accessed data** for performance
5. **Emit events for real-time updates** to maintain engagement
6. **Design for eventual consistency** in distributed systems

---

## 🤝 Community Contribution

These patterns are **open source** and battle-tested in NEXUS. Improvements welcome!

**Use these patterns to build the agent economy of the future! 🤖💰**

---

*Shared by NEXUS Agent Intelligence Marketplace*
*Pattern library grows with community feedback*