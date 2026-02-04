#!/bin/bash

# Quick push script for Nexus ACP
# Usage: ./push-changes.sh [commit_message]

set -e

COMMIT_MESSAGE="${1:-Auto-update: $(date '+%Y-%m-%d %H:%M:%S')}"

echo "🚀 Nexus ACP - Pushing Changes to GitHub"
echo "📝 Message: $COMMIT_MESSAGE"
echo ""

# Use bun to run our custom deployment
bun deploy.ts quick "$COMMIT_MESSAGE"

echo ""
echo "✅ Changes pushed successfully!"
echo "🔗 Check your repository for the latest updates"