#!/usr/bin/env bun

/**
 * Auto-commit script for continuous deployment workflow
 * Automatically commits and pushes changes after each improvement
 */

import { GitHubSync } from './github-sync.ts';

interface CommitConfig {
  includeTimestamp: boolean;
  includeFileList: boolean;
  messagePrefix: string;
}

class AutoCommit {
  private githubSync: GitHubSync;
  private config: CommitConfig;

  constructor() {
    const githubConfig = {
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || 'nexus-acp',
      token: process.env.GITHUB_TOKEN || '',
      branch: process.env.GITHUB_BRANCH || 'main'
    };

    this.githubSync = new GitHubSync(githubConfig);
    this.config = {
      includeTimestamp: true,
      includeFileList: false,
      messagePrefix: '🚀 Auto-update:'
    };
  }

  private generateCommitMessage(customMessage?: string): string {
    const parts = [this.config.messagePrefix];

    if (customMessage) {
      parts.push(customMessage);
    } else {
      parts.push('Incremental improvements and updates');
    }

    if (this.config.includeTimestamp) {
      const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
      parts.push(`(${timestamp})`);
    }

    return parts.join(' ');
  }

  async commitAndPush(message?: string): Promise<boolean> {
    try {
      console.log('🔄 Starting automated commit and push...');

      // Test connection first
      const connected = await this.githubSync.checkConnection();
      if (!connected) {
        throw new Error('GitHub connection failed');
      }

      // Ensure repository exists
      await this.githubSync.ensureRepository();

      // Generate commit message
      const commitMessage = this.generateCommitMessage(message);

      // Push changes
      await this.githubSync.pushChanges(commitMessage);

      console.log('✅ Auto-commit completed successfully');
      return true;

    } catch (error) {
      console.error('❌ Auto-commit failed:', error);
      return false;
    }
  }

  async setupContinuousDeployment(): Promise<void> {
    console.log('🛠️ Setting up continuous deployment...');

    // Check if we can connect to GitHub
    const connected = await this.githubSync.checkConnection();
    if (!connected) {
      console.error('Cannot setup CD without GitHub connection');
      return;
    }

    // Create initial commit
    await this.commitAndPush('Initial project setup and structure');

    console.log('✅ Continuous deployment setup complete');
    console.log('💡 Use "bun auto-commit.ts push [message]" to commit changes');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const autoCommit = new AutoCommit();

  switch (command) {
    case 'setup':
      await autoCommit.setupContinuousDeployment();
      break;

    case 'push':
      const message = args.slice(1).join(' ') || undefined;
      const success = await autoCommit.commitAndPush(message);
      process.exit(success ? 0 : 1);

    case 'test':
      console.log('🧪 Testing auto-commit functionality...');
      const testSuccess = await autoCommit.commitAndPush('Test commit from auto-commit script');
      process.exit(testSuccess ? 0 : 1);

    default:
      console.log(`
Auto-Commit Tool for Nexus ACP

Usage:
  bun auto-commit.ts setup           Setup continuous deployment
  bun auto-commit.ts push [msg]      Commit and push changes
  bun auto-commit.ts test            Test the auto-commit functionality

Examples:
  bun auto-commit.ts push "Added new marketplace features"
  bun auto-commit.ts push            Uses default commit message
      `);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

export { AutoCommit };