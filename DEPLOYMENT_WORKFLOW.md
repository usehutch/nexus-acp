# Deployment Workflow for Nexus ACP

## Overview
This document outlines the complete workflow for pushing improvements to GitHub after each change in the Nexus ACP project.

## Quick Start

### 1. One-Time Setup
```bash
# Copy environment template and configure GitHub credentials
cp .env.example .env
# Edit .env with your GITHUB_TOKEN and GITHUB_OWNER

# Test GitHub connection
bun run git:test

# Initialize repository
bun run git:init
```

### 2. Development Workflow

After making ANY improvement to the codebase:

```bash
# Option A: Quick deployment (recommended for iterative development)
bun run deploy:quick "Improved marketplace search functionality"

# Option B: Full deployment (includes tests and build)
bun run deploy "Major refactor of authentication system"

# Option C: Simple commit and push
bun run commit:push "Fixed bug in wallet creation"
```

## Available Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `bun run deploy` | Full deployment with tests and build | Major changes, releases |
| `bun run deploy:quick` | Skip tests/build, commit and push | Quick fixes, documentation updates |
| `bun run commit:push` | Smart commit with optional message | General development |
| `bun run git:push` | Direct GitHub API push | Manual control needed |
| `bun run git:test` | Test GitHub connection | Troubleshooting |
| `bun run git:init` | Initialize/ensure repository | First-time setup |

## Detailed Workflow Steps

### After Code Changes

1. **Make your improvements** (fix bugs, add features, update docs)

2. **Choose deployment method**:
   - **Quick iterations**: `bun run deploy:quick "description"`
   - **Significant changes**: `bun run deploy "description"`
   - **Testing fixes**: `bun run deploy --skip-tests "emergency fix"`

3. **Monitor output** for any errors or issues

4. **Verify deployment** by checking your GitHub repository

### Error Handling

If deployment fails:

```bash
# Test GitHub connection
bun run git:test

# Try force deployment (skip tests/build failures)
bun run deploy:force "Emergency deployment"

# Manual push if needed
bun run git:push "Manual commit message"
```

## Integration with Development

### Standard Development Loop

```bash
# 1. Make changes to codebase
# 2. Test locally (optional)
bun test

# 3. Deploy changes
bun run deploy:quick "Added user profile management"

# 4. Continue development
```

### For Major Features

```bash
# 1. Develop feature
# 2. Run full test suite
bun test

# 3. Full deployment with validation
bun run deploy "Implemented AI agent marketplace v2.0"

# 4. Monitor repository for successful deployment
```

## GitHub Repository Structure

The automated deployment will maintain this structure:

```
your-repo/
├── src/                    # Source code
├── docs/                   # Documentation
├── scripts/               # Deployment and utility scripts
├── .env.example           # Environment template
└── README.md             # Main documentation
```

## Environment Variables

Required in `.env`:

```bash
# GitHub Integration
GITHUB_TOKEN=ghp_your_token_here    # Required: GitHub personal access token
GITHUB_OWNER=yourusername           # Required: Your GitHub username
GITHUB_REPO=nexus-acp              # Optional: Repository name
GITHUB_BRANCH=main                 # Optional: Branch name

# Colosseum (existing)
COLOSSEUM_API_KEY=your_key_here    # Your Colosseum API key
```

## Security Considerations

1. **Never commit `.env`** - Contains sensitive tokens
2. **Rotate tokens regularly** - GitHub personal access tokens should be refreshed
3. **Use minimal permissions** - Token only needs `repo` access
4. **Monitor repository** - Check for unexpected changes

## Troubleshooting

### Common Issues

**"GitHub connection failed"**
- Check GITHUB_TOKEN in .env
- Verify token has repo permissions
- Test internet connectivity

**"Repository not found"**
- Run `bun run git:init` to create repository
- Check GITHUB_OWNER is correct username
- Verify token has access to create repositories

**"Build/tests failed"**
- Use `--force` flag to skip failures
- Or `--skip-tests` / `--skip-build` to skip specific steps
- Fix issues and retry deployment

**"Permission denied"**
- Check GitHub token permissions
- Verify repository ownership
- Check if repository is private and token has access

### Getting Help

1. **Test connection**: `bun run git:test`
2. **Check configuration**: Review `.env` file
3. **Manual verification**: Visit GitHub repository in browser
4. **Logs**: Check console output for specific error messages

## Best Practices

1. **Commit frequently** - Small, focused commits are better
2. **Descriptive messages** - Make commit messages meaningful
3. **Test before deploy** - Use `bun test` for critical changes
4. **Monitor deployments** - Check GitHub for successful pushes
5. **Keep tokens secure** - Never share or commit authentication tokens

## Integration with Existing Tools

This workflow integrates with:
- **Bun.js** - All scripts use bun runtime
- **Colosseum API** - Existing forum integration preserved
- **Solana tools** - Wallet and blockchain functionality unaffected
- **TypeScript** - Full type safety maintained

## Summary

The GitHub integration provides:
- ✅ **Automated version control** without traditional git
- ✅ **One-command deployment** for rapid iteration
- ✅ **Flexible workflow options** for different scenarios
- ✅ **Error handling and recovery** for robust deployment
- ✅ **Security best practices** for token management

After setup, simply run `bun run deploy:quick "your changes"` after each improvement to automatically push to GitHub!