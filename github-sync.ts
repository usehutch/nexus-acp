#!/usr/bin/env bun

/**
 * GitHub Sync Script for Nexus ACP
 * Provides version control functionality using GitHub API when git is not available
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  branch: string;
}

interface FileContent {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

interface GitHubRef {
  object: {
    sha: string;
  };
}

interface GitHubCommit {
  tree: {
    sha: string;
  };
}

interface GitHubBlob {
  sha: string;
}

interface GitHubTree {
  sha: string;
}

interface GitHubCommitResponse {
  sha: string;
}

class GitHubSync {
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  private async makeRequest(endpoint: string, method = 'GET', body?: any) {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Nexus-ACP-Sync'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/user');
      console.log('✓ GitHub connection established');
      return true;
    } catch (error) {
      console.error('✗ GitHub connection failed:', error);
      return false;
    }
  }

  async ensureRepository(): Promise<void> {
    try {
      await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}`);
      console.log('✓ Repository exists');
    } catch (error) {
      console.log('Repository not found, creating...');
      await this.createRepository();
    }
  }

  private async createRepository(): Promise<void> {
    const repoData = {
      name: this.config.repo,
      description: 'NEXUS Agent Communication Protocol - Colosseum Hackathon Project',
      private: false,
      auto_init: true
    };

    await this.makeRequest('/user/repos', 'POST', repoData);
    console.log('✓ Repository created');
  }

  private async getAllFiles(dir: string, basePath = ''): Promise<FileContent[]> {
    const files: FileContent[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      // Skip common directories and files that shouldn't be synced
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'build') {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        try {
          const content = await readFile(fullPath, 'utf-8');
          files.push({
            path: relativePath,
            content,
            encoding: 'utf-8'
          });
        } catch (error) {
          console.warn(`Skipping file ${relativePath}: ${error}`);
        }
      }
    }

    return files;
  }

  async pushChanges(commitMessage: string, projectDir = '.'): Promise<void> {
    console.log('🔄 Starting GitHub sync...');

    // Get all files from project
    const files = await this.getAllFiles(projectDir);
    console.log(`📁 Found ${files.length} files to sync`);

    // Get latest commit SHA
    const branch = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/git/refs/heads/${this.config.branch}`) as GitHubRef;
    const latestCommitSha = branch.object.sha;

    // Get the tree for the latest commit
    const latestCommit = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/git/commits/${latestCommitSha}`) as GitHubCommit;
    const baseTreeSha = latestCommit.tree.sha;

    // Create blobs for all files
    const treeEntries = [];
    for (const file of files) {
      const blob = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/git/blobs`, 'POST', {
        content: file.content,
        encoding: file.encoding
      }) as GitHubBlob;

      treeEntries.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      });
    }

    // Create new tree
    const tree = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/git/trees`, 'POST', {
      base_tree: baseTreeSha,
      tree: treeEntries
    }) as GitHubTree;

    // Create new commit
    const commit = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/git/commits`, 'POST', {
      message: commitMessage,
      tree: tree.sha,
      parents: [latestCommitSha]
    }) as GitHubCommitResponse;

    // Update branch reference
    await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/git/refs/heads/${this.config.branch}`, 'PATCH', {
      sha: commit.sha
    });

    console.log(`✅ Changes pushed successfully: ${commit.sha.substring(0, 7)}`);
    console.log(`📝 Commit message: ${commitMessage}`);
    console.log(`🔗 View at: https://github.com/${this.config.owner}/${this.config.repo}/commit/${commit.sha}`);
  }
}

// Configuration
const config: GitHubConfig = {
  owner: process.env.GITHUB_OWNER || '',
  repo: process.env.GITHUB_REPO || 'nexus-acp',
  token: process.env.GITHUB_TOKEN || '',
  branch: process.env.GITHUB_BRANCH || 'main'
};

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!config.token) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!config.owner) {
    console.error('❌ GITHUB_OWNER environment variable is required');
    process.exit(1);
  }

  const github = new GitHubSync(config);

  switch (command) {
    case 'test':
      const connected = await github.checkConnection();
      if (connected) {
        console.log('🎉 GitHub sync is ready to use');
      }
      break;

    case 'init':
      await github.ensureRepository();
      break;

    case 'push':
      const message = args[1] || `Update project files - ${new Date().toISOString()}`;
      await github.ensureRepository();
      await github.pushChanges(message);
      break;

    case 'auto-push':
      const autoMessage = `Automated update - ${new Date().toLocaleString()}`;
      await github.ensureRepository();
      await github.pushChanges(autoMessage);
      break;

    default:
      console.log(`
GitHub Sync Tool for Nexus ACP

Usage:
  bun github-sync.ts test              Test GitHub connection
  bun github-sync.ts init              Initialize repository
  bun github-sync.ts push [message]    Push current changes
  bun github-sync.ts auto-push         Push with automated message

Environment Variables Required:
  GITHUB_TOKEN  - GitHub personal access token
  GITHUB_OWNER  - GitHub username/organization
  GITHUB_REPO   - Repository name (default: nexus-acp)
  GITHUB_BRANCH - Branch name (default: main)
      `);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

export { GitHubSync };