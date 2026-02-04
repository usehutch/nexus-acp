#!/usr/bin/env bun

/**
 * Deployment script for Nexus ACP
 * Automates the process of testing, building, and pushing changes to GitHub
 */

import { AutoCommit } from './auto-commit.ts';

interface DeployOptions {
  skipTests?: boolean;
  skipBuild?: boolean;
  message?: string;
  force?: boolean;
}

class Deployer {
  private autoCommit: AutoCommit;

  constructor() {
    this.autoCommit = new AutoCommit();
  }

  private async runCommand(command: string, description: string): Promise<boolean> {
    console.log(`🔄 ${description}...`);

    try {
      const proc = Bun.spawn(command.split(' '), {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const result = await proc.exited;

      if (result === 0) {
        console.log(`✅ ${description} completed successfully`);
        return true;
      } else {
        console.error(`❌ ${description} failed`);
        return false;
      }
    } catch (error) {
      console.error(`❌ ${description} error:`, error);
      return false;
    }
  }

  async runTests(): Promise<boolean> {
    return await this.runCommand('bun test', 'Running tests');
  }

  async runBuild(): Promise<boolean> {
    // Check if there's a build script
    try {
      const packageJson = await Bun.file('package.json').json();
      if (packageJson.scripts?.build) {
        return await this.runCommand('bun run build', 'Building project');
      } else {
        console.log('ℹ️ No build script found, skipping build step');
        return true;
      }
    } catch {
      console.log('ℹ️ Cannot read package.json, skipping build step');
      return true;
    }
  }

  async deploy(options: DeployOptions = {}): Promise<boolean> {
    console.log('🚀 Starting deployment process...\n');

    // Step 1: Run tests (unless skipped)
    if (!options.skipTests) {
      const testsPass = await this.runTests();
      if (!testsPass && !options.force) {
        console.error('❌ Deployment aborted: Tests failed');
        console.log('💡 Use --force to deploy anyway or --skip-tests to skip testing');
        return false;
      }
    }

    // Step 2: Build project (unless skipped)
    if (!options.skipBuild) {
      const buildSuccess = await this.runBuild();
      if (!buildSuccess && !options.force) {
        console.error('❌ Deployment aborted: Build failed');
        console.log('💡 Use --force to deploy anyway or --skip-build to skip building');
        return false;
      }
    }

    // Step 3: Commit and push changes
    console.log('\n📦 Committing and pushing changes...');
    const commitSuccess = await this.autoCommit.commitAndPush(options.message);

    if (commitSuccess) {
      console.log('\n🎉 Deployment completed successfully!');
      return true;
    } else {
      console.error('\n❌ Deployment failed during commit/push phase');
      return false;
    }
  }

  async quickDeploy(message?: string): Promise<boolean> {
    return await this.deploy({
      skipTests: true,
      skipBuild: true,
      message: message || 'Quick update'
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const deployer = new Deployer();

  // Parse arguments
  const options: DeployOptions = {};
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--skip-tests':
        options.skipTests = true;
        break;
      case '--skip-build':
        options.skipBuild = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '-m':
      case '--message':
        options.message = args[++i];
        break;
      default:
        if (!arg.startsWith('-')) {
          positionalArgs.push(arg);
        }
    }
  }

  const command = positionalArgs[0];

  switch (command) {
    case 'quick':
    case 'q':
      const quickMessage = positionalArgs.slice(1).join(' ') || options.message;
      const quickSuccess = await deployer.quickDeploy(quickMessage);
      process.exit(quickSuccess ? 0 : 1);

    case 'full':
    case 'f':
    default:
      const message = positionalArgs.slice(1).join(' ') || options.message;
      if (message) options.message = message;

      const success = await deployer.deploy(options);
      process.exit(success ? 0 : 1);
  }
}

// Help text
function showHelp() {
  console.log(`
Nexus ACP Deployment Tool

Usage:
  bun deploy.ts [command] [options] [message]

Commands:
  full, f    Full deployment (test → build → commit → push) [default]
  quick, q   Quick deployment (skip tests and build)

Options:
  --skip-tests     Skip running tests
  --skip-build     Skip build step
  --force          Continue deployment even if tests/build fail
  -m, --message    Commit message

Examples:
  bun deploy.ts                                    # Full deployment
  bun deploy.ts "Fixed authentication bug"         # Full deployment with message
  bun deploy.ts quick                              # Quick deployment
  bun deploy.ts quick "Hotfix for API endpoints"   # Quick deployment with message
  bun deploy.ts --skip-tests "Updated docs"        # Deploy without testing
  bun deploy.ts --force "Emergency fix"           # Force deploy despite failures

Workflow Integration:
  After making changes, simply run:
  bun deploy.ts "Description of your changes"
  `);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
  } else {
    main().catch(console.error);
  }
}