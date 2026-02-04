import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import { AgentMarketplace } from './marketplace';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ErrorCode,
  NexusError,
  errorHandler,
  withRetry,
  validateRequired
} from './error-handler.js';

// Initialize marketplace and wallet with error handling
let connection: Connection;
let marketplace: AgentMarketplace;
let wallet: Keypair | null = null;

async function initializeServer() {
    try {
        // Initialize Solana connection
        connection = await withRetry(async () => {
            const conn = new Connection(clusterApiUrl('devnet'), 'confirmed');
            await conn.getVersion(); // Test connection
            return conn;
        }, 'server Solana connection', { maxRetries: 3 });

        // Initialize marketplace
        marketplace = new AgentMarketplace(connection);
        console.log('🏪 Marketplace initialized');

        // Load wallet
        wallet = await loadServerWallet();

    } catch (error) {
        const nexusError = errorHandler.normalizeError(error, 'server initialization');
        errorHandler.logError(nexusError, 'server initialization');
        console.error('❌ Server initialization failed:', nexusError.message);
        process.exit(1);
    }
}

async function loadServerWallet(): Promise<Keypair | null> {
    try {
        const walletPath = join(process.cwd(), 'wallet', 'devnet-wallet.json');

        if (!existsSync(walletPath)) {
            console.log('ℹ️ No wallet found for server');
            return null;
        }

        const walletData = await withRetry(async () => {
            const fileContent = readFileSync(walletPath, 'utf-8');
            const parsed = JSON.parse(fileContent);

            if (!parsed.secretKey || !Array.isArray(parsed.secretKey)) {
                throw new NexusError(
                    ErrorCode.INVALID_FORMAT,
                    'Server wallet file format is invalid',
                    { walletPath }
                );
            }

            return parsed;
        }, 'server wallet loading');

        const serverWallet = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
        console.log('💼 Server wallet loaded:', serverWallet.publicKey.toString());
        return serverWallet;

    } catch (error) {
        const nexusError = errorHandler.normalizeError(error, 'loadServerWallet');
        errorHandler.logError(nexusError, 'loadServerWallet');
        console.error('⚠️ Failed to load server wallet:', nexusError.message);
        return null;
    }
}

// Simple HTML responses
const indexHtml = () => new Response('<h1>NEXUS Agent Intelligence Marketplace</h1><p>API Server Running</p>', { headers: { 'Content-Type': 'text/html' } });
const architectureDiagram = () => new Response('<h1>NEXUS Architecture</h1><p>System Architecture Diagram</p>', { headers: { 'Content-Type': 'text/html' } });

// Helper function to handle API requests with error handling
async function handleApiRequest<T>(
    handler: () => Promise<T>,
    context: string
): Promise<Response> {
    try {
        const result = await handler();
        return Response.json({ success: true, data: result });
    } catch (error) {
        const nexusError = errorHandler.normalizeError(error, context);
        errorHandler.logError(nexusError, context);

        const { response, status } = errorHandler.createErrorResponse(nexusError);
        return Response.json(response, { status });
    }
}

// Enhanced request body parsing with validation
async function parseJsonBody<T extends Record<string, any>>(
    req: Request,
    requiredFields: (keyof T)[],
    context: string
): Promise<T> {
    try {
        const body = await req.json() as T;
        validateRequired(body, requiredFields, context);
        return body;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new NexusError(
                ErrorCode.INVALID_FORMAT,
                'Invalid JSON in request body',
                { error: error.message }
            );
        }
        throw error;
    }
}

// Initialize server before starting
await initializeServer();

// Bun server with enhanced API endpoints
const server = Bun.serve({
    port: 0, // Let system assign an available port
    async fetch(req) {
        try {
            const url = new URL(req.url);

            // Static routes
            if (url.pathname === '/') return indexHtml();
            if (url.pathname === '/architecture') return architectureDiagram();

            // API routes
            if (url.pathname === '/api/stats' && req.method === 'GET') {
                return handleApiRequest(async () => {
                    return marketplace.getMarketStats();
                }, '/api/stats');
            }

            if (url.pathname === '/api/intelligence' && req.method === 'GET') {
                return handleApiRequest(async () => {
                    const category = url.searchParams.get('category');
                    const maxPrice = url.searchParams.get('maxPrice');
                    const minQuality = url.searchParams.get('minQuality');

                    const filters: any = {};
                    if (category) {
                        const validCategories = ['market-analysis', 'defi-strategy', 'price-prediction', 'risk-assessment', 'trend-analysis'];
                        if (!validCategories.includes(category)) {
                            throw new NexusError(
                                ErrorCode.INVALID_INPUT,
                                `Invalid category filter. Must be one of: ${validCategories.join(', ')}`,
                                { category, validCategories }
                            );
                        }
                        filters.category = category;
                    }

                    if (maxPrice) {
                        const price = parseFloat(maxPrice);
                        if (isNaN(price) || price <= 0) {
                            throw new NexusError(
                                ErrorCode.INVALID_INPUT,
                                'Max price must be a positive number',
                                { maxPrice }
                            );
                        }
                        filters.maxPrice = price;
                    }

                    if (minQuality) {
                        const quality = parseInt(minQuality);
                        if (isNaN(quality) || quality < 0 || quality > 100) {
                            throw new NexusError(
                                ErrorCode.INVALID_INPUT,
                                'Min quality must be a number between 0 and 100',
                                { minQuality }
                            );
                        }
                        filters.minQuality = quality;
                    }

                    return marketplace.searchIntelligence(filters);
                }, '/api/intelligence');
            }

            if (url.pathname === '/api/agents' && req.method === 'GET') {
                return handleApiRequest(async () => {
                    const limitParam = url.searchParams.get('limit') || '10';
                    const limit = parseInt(limitParam);

                    if (isNaN(limit) || limit <= 0 || limit > 100) {
                        throw new NexusError(
                            ErrorCode.INVALID_INPUT,
                            'Limit must be a number between 1 and 100',
                            { limit: limitParam }
                        );
                    }

                    return marketplace.getTopAgents(limit);
                }, '/api/agents');
            }

            if (url.pathname === '/api/purchase' && req.method === 'POST') {
                return handleApiRequest(async () => {
                    const body = await parseJsonBody<{ intelligenceId?: string; buyerKey?: string }>(
                        req, ['intelligenceId', 'buyerKey'], '/api/purchase'
                    );

                    return await marketplace.purchaseIntelligence(body.buyerKey!, body.intelligenceId!);
                }, '/api/purchase');
            }

            if (url.pathname === '/api/rate' && req.method === 'POST') {
                return handleApiRequest(async () => {
                    const body = await parseJsonBody<{ intelligenceId?: string; buyerKey?: string; rating?: number; review?: string }>(
                        req, ['intelligenceId', 'buyerKey', 'rating'], '/api/rate'
                    );

                    await marketplace.rateIntelligence(body.buyerKey!, body.intelligenceId!, body.rating!, body.review);
                    return { message: 'Rating submitted successfully' };
                }, '/api/rate');
            }

            if (url.pathname === '/api/register' && req.method === 'POST') {
                return handleApiRequest(async () => {
                    const body = await parseJsonBody<{ publicKey?: string; name?: string; description?: string; specialization?: string[] }>(
                        req, ['publicKey', 'name', 'description', 'specialization'], '/api/register'
                    );

                    await marketplace.registerAgent(body.publicKey!, {
                        name: body.name!,
                        description: body.description!,
                        specialization: body.specialization!,
                        verified: false
                    });

                    return { message: 'Agent registered successfully' };
                }, '/api/register');
            }

            if (url.pathname === '/api/list' && req.method === 'POST') {
                return handleApiRequest(async () => {
                    const body = await parseJsonBody<{ sellerKey?: string; title?: string; description?: string; category?: string; price?: string | number }>(
                        req, ['sellerKey', 'title', 'description', 'category', 'price'], '/api/list'
                    );

                    const price = typeof body.price === 'string' ? parseFloat(body.price) : body.price!;

                    if (isNaN(price) || price <= 0) {
                        throw new NexusError(
                            ErrorCode.INVALID_INPUT,
                            'Price must be a positive number',
                            { price: body.price }
                        );
                    }

                    const id = await marketplace.listIntelligence(body.sellerKey!, {
                        title: body.title!,
                        description: body.description!,
                        category: body.category! as any,
                        price
                    });

                    return { message: 'Intelligence listed successfully', id };
                }, '/api/list');
            }

            if (url.pathname === '/api/wallet' && req.method === 'GET') {
                return handleApiRequest(async () => {
                    if (!wallet) {
                        throw new NexusError(
                            ErrorCode.WALLET_NOT_FOUND,
                            'No wallet available on server',
                            {}
                        );
                    }

                    const balance = await withRetry(async () => {
                        return await connection.getBalance(wallet!.publicKey);
                    }, 'wallet balance fetch', { maxRetries: 2 });

                    return {
                        publicKey: wallet.publicKey.toString(),
                        balance: balance / 1e9
                    };
                }, '/api/wallet');
            }

            if (url.pathname === '/api/simulate' && req.method === 'POST') {
                return handleApiRequest(async () => {
                    // Use the server wallet for simulation if available, otherwise use a default valid key
                    const simulationKey = wallet?.publicKey.toString() || '11111111111111111111111111111111';

                    // Simulate an AI agent purchase
                    const intelligence = marketplace.searchIntelligence();
                    if (intelligence.length > 0) {
                        const randomIntel = intelligence[Math.floor(Math.random() * intelligence.length)];
                        if (randomIntel) {
                            const result = await withRetry(async () => {
                                return await marketplace.purchaseIntelligence(simulationKey, randomIntel.id);
                            }, 'simulate purchase', { maxRetries: 2 });

                            if (result.success) {
                                const rating = Math.floor(4 + Math.random()) + 1; // 4-5 stars
                                await withRetry(async () => {
                                    await marketplace.rateIntelligence(simulationKey, randomIntel.id, rating, 'Automated agent purchase');
                                }, 'simulate rating');
                            }

                            return {
                                message: 'Agent activity simulated successfully',
                                purchaseResult: result,
                                simulatedBy: simulationKey
                            };
                        }
                    }

                    return { message: 'No intelligence available for simulation' };
                }, '/api/simulate');
            }

            // Handle unknown endpoints
            return new Response(JSON.stringify({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Endpoint ${url.pathname} not found`,
                    timestamp: Date.now()
                }
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            // Global error handler for unhandled errors
            const nexusError = errorHandler.normalizeError(error, 'global request handler');
            errorHandler.logError(nexusError, 'global request handler');

            const { response, status } = errorHandler.createErrorResponse(nexusError, 500);
            return Response.json(response, { status });
        }
    },

    // Server error handler
    error(error) {
        const nexusError = errorHandler.normalizeError(error, 'server error');
        errorHandler.logError(nexusError, 'server error');
        console.error('💥 Server error:', nexusError.message);

        return new Response(JSON.stringify({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Internal server error',
                timestamp: Date.now()
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

});

console.log('🚀 NEXUS Agent Intelligence Marketplace Server');
console.log(`🌐 Server running on http://localhost:${server.port}`);
console.log('💡 First AI-to-AI knowledge trading platform on Solana!');