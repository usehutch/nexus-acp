import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import { AgentMarketplace } from './marketplace';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import indexHtml from './index.html';

// Initialize marketplace and wallet
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const marketplace = new AgentMarketplace(connection);

let wallet: Keypair | null = null;
const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');

if (existsSync(walletPath)) {
    const walletData = JSON.parse(readFileSync(walletPath, 'utf-8'));
    wallet = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
    console.log('💼 Server wallet loaded:', wallet.publicKey.toString());
}

// Bun server with API endpoints
Bun.serve({
    port: 3001,
    routes: {
        "/": indexHtml,

        // Get marketplace statistics
        "/api/stats": {
            GET: () => {
                const stats = marketplace.getMarketStats();
                return Response.json(stats);
            }
        },

        // Get all available intelligence
        "/api/intelligence": {
            GET: (req) => {
                const url = new URL(req.url);
                const category = url.searchParams.get('category');
                const maxPrice = url.searchParams.get('maxPrice');
                const minQuality = url.searchParams.get('minQuality');

                const filters: any = {};
                if (category) filters.category = category;
                if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
                if (minQuality) filters.minQuality = parseInt(minQuality);

                const intelligence = marketplace.searchIntelligence(filters);
                return Response.json(intelligence);
            }
        },

        // Get top agents
        "/api/agents": {
            GET: (req) => {
                const url = new URL(req.url);
                const limit = parseInt(url.searchParams.get('limit') || '10');
                const agents = marketplace.getTopAgents(limit);
                return Response.json(agents);
            }
        },

        // Purchase intelligence
        "/api/purchase": {
            POST: async (req) => {
                try {
                    const body = await req.json() as { intelligenceId?: string; buyerKey?: string };
                    const { intelligenceId, buyerKey } = body;

                    if (!intelligenceId || !buyerKey) {
                        return Response.json({ error: 'Missing required fields' }, { status: 400 });
                    }

                    const result = await marketplace.purchaseIntelligence(buyerKey, intelligenceId);
                    return Response.json(result);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return Response.json({ error: errorMessage }, { status: 400 });
                }
            }
        },

        // Rate intelligence
        "/api/rate": {
            POST: async (req) => {
                try {
                    const body = await req.json() as { intelligenceId?: string; buyerKey?: string; rating?: number; review?: string };
                    const { intelligenceId, buyerKey, rating, review } = body;

                    if (!intelligenceId || !buyerKey || !rating) {
                        return Response.json({ error: 'Missing required fields' }, { status: 400 });
                    }

                    await marketplace.rateIntelligence(buyerKey, intelligenceId, rating, review);
                    return Response.json({ success: true });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return Response.json({ error: errorMessage }, { status: 400 });
                }
            }
        },

        // Register new agent
        "/api/register": {
            POST: async (req) => {
                try {
                    const body = await req.json() as { publicKey?: string; name?: string; description?: string; specialization?: string[] };
                    const { publicKey, name, description, specialization } = body;

                    if (!publicKey || !name || !description || !specialization) {
                        return Response.json({ error: 'Missing required fields' }, { status: 400 });
                    }

                    await marketplace.registerAgent(publicKey, {
                        name,
                        description,
                        specialization,
                        verified: false
                    });

                    return Response.json({ success: true });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return Response.json({ error: errorMessage }, { status: 400 });
                }
            }
        },

        // List new intelligence
        "/api/list": {
            POST: async (req) => {
                try {
                    const body = await req.json() as { sellerKey?: string; title?: string; description?: string; category?: string; price?: string | number };
                    const { sellerKey, title, description, category, price } = body;

                    if (!sellerKey || !title || !description || !category || !price) {
                        return Response.json({ error: 'Missing required fields' }, { status: 400 });
                    }

                    const id = await marketplace.listIntelligence(sellerKey, {
                        title,
                        description,
                        category: category as any,
                        price: typeof price === 'string' ? parseFloat(price) : price
                    });

                    return Response.json({ success: true, id });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return Response.json({ error: errorMessage }, { status: 400 });
                }
            }
        },

        // Get wallet info (for demo purposes)
        "/api/wallet": {
            GET: async () => {
                if (!wallet) {
                    return Response.json({ error: 'No wallet available' }, { status: 404 });
                }

                try {
                    const balance = await connection.getBalance(wallet.publicKey);
                    return Response.json({
                        publicKey: wallet.publicKey.toString(),
                        balance: balance / 1e9
                    });
                } catch (error) {
                    return Response.json({ error: 'Failed to get wallet info' }, { status: 500 });
                }
            }
        },

        // Simulate agent activity for demo
        "/api/simulate": {
            POST: async () => {
                try {
                    // Simulate an AI agent purchase
                    const intelligence = marketplace.searchIntelligence();
                    if (intelligence.length > 0) {
                        const randomIntel = intelligence[Math.floor(Math.random() * intelligence.length)];
                        if (randomIntel) {
                            const result = await marketplace.purchaseIntelligence('DEMO_AI_AGENT', randomIntel.id);

                            if (result.success) {
                                await marketplace.rateIntelligence('DEMO_AI_AGENT', randomIntel.id, 4 + Math.random(), 'Automated agent purchase');
                            }
                        }
                    }

                    return Response.json({ success: true, message: 'Agent activity simulated' });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return Response.json({ error: errorMessage }, { status: 400 });
                }
            }
        }
    },

    development: {
        hmr: true,
        console: true,
    },
});

console.log('🚀 NEXUS Agent Intelligence Marketplace Server');
console.log('🌐 Server running on http://localhost:3001');
console.log('💡 First AI-to-AI knowledge trading platform on Solana!');