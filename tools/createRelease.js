#!/usr/bin/env node

/**
 * GitHub Release Script
 * Creates a GitHub release tag based on package.json version
 * 
 * Usage:
 *   npm run release        # Creates release with current version
 *   npm run release patch  # Bumps patch version and releases (2.0.0 -> 2.0.1)
 *   npm run release minor  # Bumps minor version and releases (2.0.0 -> 2.1.0)
 *   npm run release major  # Bumps major version and releases (2.0.0 -> 3.0.0)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = '') {
    console.log(`${color}${message}${colors.reset}`);
}

function exec(command, options = {}) {
    try {
        return execSync(command, { encoding: 'utf-8', stdio: 'pipe', ...options });
    } catch (error) {
        throw new Error(`Command failed: ${command}\n${error.message}`);
    }
}

function getPackageJson() {
    const packagePath = path.join(__dirname, '..', 'package.json');
    return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
}

function getCurrentBranch() {
    return exec('git branch --show-current').trim();
}

function hasUncommittedChanges() {
    const status = exec('git status --porcelain');
    return status.trim().length > 0;
}

function tagExists(tag) {
    try {
        exec(`git rev-parse ${tag}`);
        return true;
    } catch {
        return false;
    }
}

async function createRelease() {
    try {
        // Parse arguments
        const args = process.argv.slice(2);
        const bumpType = args[0]; // 'patch', 'minor', 'major', or undefined
        
        log('🚀 GitHub Release Script', colors.bright + colors.cyan);
        log('========================\n', colors.cyan);
        
        // Check for uncommitted changes
        if (hasUncommittedChanges()) {
            log('❌ Error: You have uncommitted changes.', colors.red);
            log('Please commit or stash them before creating a release.', colors.yellow);
            process.exit(1);
        }
        
        // Check current branch
        const branch = getCurrentBranch();
        if (branch !== 'main' && branch !== 'master') {
            log(`⚠️  Warning: You're on branch '${branch}', not 'main' or 'master'.`, colors.yellow);
            log('Consider switching to the main branch before releasing.\n', colors.yellow);
        }
        
        // Get current version
        let pkg = getPackageJson();
        let currentVersion = pkg.version;
        log(`Current version: ${currentVersion}`, colors.cyan);
        
        // Bump version if requested
        if (bumpType) {
            if (!['patch', 'minor', 'major'].includes(bumpType)) {
                log(`❌ Error: Invalid bump type '${bumpType}'`, colors.red);
                log('Use: patch, minor, or major', colors.yellow);
                process.exit(1);
            }
            
            log(`Bumping ${bumpType} version...`, colors.yellow);
            exec(`npm version ${bumpType} --no-git-tag-version`);
            
            // Reload package.json to get new version
            pkg = getPackageJson();
            const newVersion = pkg.version;
            log(`New version: ${newVersion}`, colors.green);
            
            // Update version in source
            exec('npm run updateVersion');
            
            // Commit version bump
            exec('git add -A');
            exec(`git commit -m "chore: bump version to ${newVersion}"`);
            log(`✓ Committed version bump to ${newVersion}`, colors.green);
            
            currentVersion = newVersion;
        }
        
        const tagName = `v${currentVersion}`;
        
        // Check if tag already exists
        if (tagExists(tagName)) {
            log(`❌ Error: Tag ${tagName} already exists.`, colors.red);
            log('Please bump the version or delete the existing tag.', colors.yellow);
            process.exit(1);
        }
        
        // Build the project and documentation
        log('\n📦 Building project and documentation...', colors.cyan);
        exec('npm run build:all');
        log('✓ Build complete (including docs)', colors.green);
        
        // Run tests
        log('\n🧪 Running tests...', colors.cyan);
        exec('npm test');
        log('✓ All tests passed', colors.green);
        
        // Get file sizes
        const distPath = path.join(__dirname, '..', 'dist');
        const files = fs.readdirSync(distPath);
        const minFiles = files.filter(f => f.endsWith('.min.js'));
        
        log('\n📊 Bundle sizes:', colors.cyan);
        minFiles.forEach(file => {
            const stats = fs.statSync(path.join(distPath, file));
            const size = (stats.size / 1024).toFixed(1);
            log(`  ${file}: ${size}KB`);
        });
        
        // Generate release notes
        log('\n📝 Generating release notes...', colors.cyan);
        const recentCommits = exec('git log --pretty=format:"- %s (%h)" -n 10');
        
        const releaseNotes = `# Release ${tagName}

## 📦 Installation

\`\`\`bash
npm install quikdown@${currentVersion}
\`\`\`

## 📊 Bundle Sizes
${minFiles.map(file => {
    const stats = fs.statSync(path.join(distPath, file));
    const size = (stats.size / 1024).toFixed(1);
    return `- ${file}: **${size}KB**`;
}).join('\n')}

## 🔄 Recent Changes
${recentCommits}

## 🚀 Features
- Bidirectional conversion (quikdown_bd module)
- Task lists support
- URL sanitization
- Autolinks
- ~~~ fence support
- Flexible table syntax

---
*Built with quikdown ${currentVersion}*`;
        
        // Write release notes to file
        const releaseNotesPath = path.join(__dirname, '..', 'RELEASE_NOTES.md');
        fs.writeFileSync(releaseNotesPath, releaseNotes);
        log('✓ Release notes generated', colors.green);
        
        // Create git tag
        log(`\n🏷️  Creating tag ${tagName}...`, colors.cyan);
        exec(`git tag -a ${tagName} -m "Release ${tagName}"`);
        log(`✓ Tag ${tagName} created`, colors.green);
        
        // Push changes and tag
        log('\n📤 Pushing to GitHub...', colors.cyan);
        exec('git push');
        exec(`git push origin ${tagName}`);
        log('✓ Pushed to GitHub', colors.green);
        
        // Create GitHub release using gh CLI
        log('\n🎉 Creating GitHub release...', colors.cyan);
        try {
            // Check if gh CLI is installed
            exec('gh --version', { stdio: 'ignore' });
            
            // Create release
            const releaseCmd = `gh release create ${tagName} \
                --title "Release ${tagName}" \
                --notes-file RELEASE_NOTES.md \
                dist/quikdown.umd.min.js \
                dist/quikdown.esm.min.js \
                dist/quikdown.cjs`;
            
            exec(releaseCmd);
            log(`✓ GitHub release ${tagName} created!`, colors.green);
            log(`\n🎊 View release: https://github.com/deftio/quikdown/releases/tag/${tagName}`, colors.bright + colors.green);
        } catch (error) {
            log('⚠️  GitHub CLI (gh) not found or not authenticated.', colors.yellow);
            log('To create the release manually:', colors.yellow);
            log(`1. Visit: https://github.com/deftio/quikdown/releases/new`, colors.cyan);
            log(`2. Select tag: ${tagName}`, colors.cyan);
            log(`3. Use the generated RELEASE_NOTES.md for the description`, colors.cyan);
            log(`4. Upload files from dist/ folder`, colors.cyan);
        }
        
        // Clean up release notes file
        fs.unlinkSync(releaseNotesPath);
        
        log('\n✅ Release process complete!', colors.bright + colors.green);
        
    } catch (error) {
        log(`\n❌ Error: ${error.message}`, colors.red);
        process.exit(1);
    }
}

// Run the script
createRelease();