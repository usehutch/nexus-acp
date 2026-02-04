# GitHub Integration Setup

This guide explains how to set up automated GitHub synchronization for the Nexus ACP project when traditional git tools are not available.

## Prerequisites

1. **GitHub Personal Access Token**
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate a new token with these permissions:
     - `repo` (Full control of private repositories)
     - `workflow` (Update GitHub Action workflows)
   - Copy the token

2. **Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in your GitHub details:
     ```bash
     cp .env.example .env
     # Edit .env with your actual values
     ```

## Quick Setup

1. **Test Connection**
   ```bash
   bun run git:test
   ```

2. **Initialize Repository**
   ```bash
   bun run git:init
   ```

3. **Setup Continuous Deployment**
   ```bash
   bun run commit:setup
   ```

## Usage

### Manual Push
```bash
# Push with custom message
bun run git:push "Added marketplace functionality"

# Push with auto-generated message
bun run git:auto
```

### Automated Commits
```bash
# Commit and push with smart message
bun run commit:push "Implemented user authentication"

# Commit and push with auto-generated message
bun run commit:push
```

### Testing
```bash
# Test GitHub connection
bun run git:test

# Test full commit workflow
bun run commit:test
```

## Workflow Integration

### After Each Improvement
```bash
# Method 1: Quick auto-commit
bun run commit:push

# Method 2: Custom message
bun run commit:push "Fixed authentication bug in marketplace.ts:45"

# Method 3: Direct GitHub push
bun run git:push "Updated error handling system"
```

### Continuous Development Workflow

1. Make code changes
2. Test your changes
3. Run: `bun run commit:push "Description of changes"`
4. Continue development

## Scripts Overview

| Script | Purpose |
|--------|---------|
| `git:test` | Test GitHub API connection |
| `git:init` | Initialize/ensure repository exists |
| `git:push` | Push changes with custom message |
| `git:auto` | Push changes with auto-generated message |
| `commit:setup` | Setup continuous deployment workflow |
| `commit:push` | Smart commit and push with optional message |
| `commit:test` | Test the full commit workflow |

## Features

- ✅ No git binary required - uses GitHub API
- ✅ Automatic repository creation
- ✅ Smart commit message generation
- ✅ Full project file synchronization
- ✅ Error handling and connection testing
- ✅ Timestamp-based version tracking
- ✅ Integration with npm scripts

## Troubleshooting

### Connection Issues
```bash
# Test your setup
bun run git:test
```

### Repository Not Found
```bash
# Initialize repository
bun run git:init
```

### Permission Errors
- Verify your GITHUB_TOKEN has `repo` permissions
- Ensure GITHUB_OWNER is your actual username

### File Upload Issues
- Check file sizes (GitHub has limits)
- Verify no binary files are causing issues
- Review console output for specific errors

## Environment Variables

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx    # Required: Your personal access token
GITHUB_OWNER=yourusername                # Required: Your GitHub username
GITHUB_REPO=nexus-acp                    # Optional: Repository name (default: nexus-acp)
GITHUB_BRANCH=main                       # Optional: Branch name (default: main)
```

## Security Notes

- Never commit your `.env` file
- Use fine-grained personal access tokens when possible
- Regularly rotate your GitHub tokens
- Keep your token secure and never share it