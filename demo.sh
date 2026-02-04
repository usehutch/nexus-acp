#!/bin/bash

# NEXUS Agent Intelligence Marketplace Demo Script
# Colosseum Agent Hackathon 2026

echo "🚀 NEXUS Agent Intelligence Marketplace Demo"
echo "============================================="
echo ""
echo "🏆 Colosseum Agent Hackathon 2026 Submission"
echo "💰 Prize Target: \$55,000 (\$50k First Place + \$5k Most Agentic)"
echo ""

# Check if everything is ready
echo "📋 Pre-flight check..."
if ! command -v bun &> /dev/null; then
    echo "❌ Bun not found. Please install Bun."
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ Not in NEXUS project directory"
    exit 1
fi

echo "✅ Bun found"
echo "✅ In correct directory"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
bun install

# Create wallet if needed
echo ""
echo "💼 Setting up Solana wallet..."
if [ ! -f "wallet/devnet-wallet.json" ]; then
    echo "Creating new wallet..."
    bun run create-wallet.ts
else
    echo "✅ Wallet already exists"
fi

echo ""
echo "🎯 DEMO OPTIONS:"
echo ""
echo "1. 💻 CLI Demo (Quick 2-minute overview)"
echo "2. 🌐 Web Interface Demo (Interactive experience)"
echo "3. 🎬 Full Presentation Mode (CLI + Web)"
echo ""
read -p "Choose demo type (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Starting CLI Demo..."
        echo ""
        bun run index.ts
        ;;
    2)
        echo ""
        echo "🌐 Starting Web Server..."
        echo ""
        echo "🔗 Opening http://localhost:3001"
        echo ""
        echo "📋 Demo Flow:"
        echo "1. Click 'Start Demo Mode' for guided presentation"
        echo "2. Browse intelligence marketplace"
        echo "3. View agent rankings"
        echo "4. Test purchase flow"
        echo ""
        bun run server.ts
        ;;
    3)
        echo ""
        echo "🎬 Full Presentation Mode"
        echo "========================"
        echo ""
        echo "Step 1: CLI Demo (30 seconds)"
        echo "Press Enter to start..."
        read

        bun run index.ts

        echo ""
        echo "Step 2: Web Interface"
        echo "Starting server in background..."
        bun run server.ts &
        SERVER_PID=$!

        sleep 3
        echo ""
        echo "🌐 Server ready at http://localhost:3001"
        echo ""
        echo "🎤 Presentation Points:"
        echo "• First AI-to-AI intelligence marketplace on Solana"
        echo "• Autonomous agent economy with real utility"
        echo "• Zero competition in blue ocean market"
        echo "• Built for Solana's speed and low costs"
        echo ""
        echo "Press Enter when demo is complete..."
        read

        echo "🛑 Stopping server..."
        kill $SERVER_PID 2>/dev/null
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Demo Complete!"
echo ""
echo "📖 For detailed demo guide, see: HACKATHON_DEMO_GUIDE.md"
echo "🏆 NEXUS: Where AI Agents Become Entrepreneurs"