#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

// Format bytes to human readable
function formatSize(bytes) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
}

// Get file size
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (e) {
        return null;
    }
}

// Calculate size reduction percentage
function calcReduction(original, minified) {
    if (!original || !minified) return 'N/A';
    const reduction = ((original - minified) / original * 100).toFixed(1);
    return `${reduction}%`;
}

// Print a formatted row
function printRow(name, original, minified, reduction) {
    const nameCol = name.padEnd(25);
    const origCol = (original || 'N/A').padStart(10);
    const minCol = (minified || 'N/A').padStart(10);
    const redCol = reduction.padStart(10);
    
    console.log(`│ ${nameCol} │ ${origCol} │ ${minCol} │ ${redCol} │`);
}

// Main function
function printBuildSizes() {
    const distDir = path.join(__dirname, '..', 'dist');
    
    console.log('\n' + colors.bright + colors.cyan + '═══════════════════════════════════════════════════════════════════════' + colors.reset);
    console.log(colors.bright + colors.cyan + '                      QuikDown Build Size Summary' + colors.reset);
    console.log(colors.bright + colors.cyan + '═══════════════════════════════════════════════════════════════════════' + colors.reset);
    
    // Table header
    console.log('┌───────────────────────────┬────────────┬────────────┬────────────┐');
    console.log('│ ' + colors.bright + 'File'.padEnd(25) + colors.reset + ' │ ' + colors.bright + 'Original'.padStart(10) + colors.reset + ' │ ' + colors.bright + 'Minified'.padStart(10) + colors.reset + ' │ ' + colors.bright + 'Reduction'.padStart(10) + colors.reset + ' │');
    console.log('├───────────────────────────┼────────────┼────────────┼────────────┤');
    
    // QuikDown Core
    console.log('│ ' + colors.yellow + colors.bright + 'QuikDown Core' + colors.reset + '             │            │            │            │');
    console.log('├───────────────────────────┼────────────┼────────────┼────────────┤');
    
    const files = [
        {
            name: '  quikdown.esm.js',
            original: 'quikdown.esm.js',
            minified: 'quikdown.esm.min.js'
        },
        {
            name: '  quikdown.umd.js',
            original: 'quikdown.umd.js',
            minified: 'quikdown.umd.min.js'
        },
        {
            name: '  quikdown.cjs',
            original: 'quikdown.cjs',
            minified: null
        }
    ];
    
    files.forEach(file => {
        const origSize = getFileSize(path.join(distDir, file.original));
        const minSize = file.minified ? getFileSize(path.join(distDir, file.minified)) : null;
        
        const origFormatted = origSize ? formatSize(origSize) : 'N/A';
        const minFormatted = minSize ? formatSize(minSize) : '—';
        const reduction = calcReduction(origSize, minSize);
        
        printRow(file.name, origFormatted, minFormatted, reduction);
    });
    
    // QuikDown BD
    console.log('├───────────────────────────┼────────────┼────────────┼────────────┤');
    console.log('│ ' + colors.magenta + colors.bright + 'QuikDown Bidirectional' + colors.reset + '    │            │            │            │');
    console.log('├───────────────────────────┼────────────┼────────────┼────────────┤');
    
    const bdFiles = [
        {
            name: '  quikdown_bd.esm.js',
            original: 'quikdown_bd.esm.js',
            minified: 'quikdown_bd.esm.min.js'
        },
        {
            name: '  quikdown_bd.umd.js',
            original: 'quikdown_bd.umd.js',
            minified: 'quikdown_bd.umd.min.js'
        },
        {
            name: '  quikdown_bd.cjs',
            original: 'quikdown_bd.cjs',
            minified: null
        }
    ];
    
    bdFiles.forEach(file => {
        const origSize = getFileSize(path.join(distDir, file.original));
        const minSize = file.minified ? getFileSize(path.join(distDir, file.minified)) : null;
        
        const origFormatted = origSize ? formatSize(origSize) : 'N/A';
        const minFormatted = minSize ? formatSize(minSize) : '—';
        const reduction = calcReduction(origSize, minSize);
        
        printRow(file.name, origFormatted, minFormatted, reduction);
    });
    
    // Quikdown Editor
    console.log('├───────────────────────────┼────────────┼────────────┼────────────┤');
    console.log('│ ' + colors.blue + colors.bright + 'Quikdown Editor' + colors.reset + '           │            │            │            │');
    console.log('├───────────────────────────┼────────────┼────────────┼────────────┤');
    
    const editFiles = [
        {
            name: '  quikdown_edit.esm.js',
            original: 'quikdown_edit.esm.js',
            minified: 'quikdown_edit.esm.min.js'
        },
        {
            name: '  quikdown_edit.umd.js',
            original: 'quikdown_edit.umd.js',
            minified: 'quikdown_edit.umd.min.js'
        },
        {
            name: '  quikdown_edit.cjs',
            original: 'quikdown_edit.cjs',
            minified: null
        }
    ];
    
    editFiles.forEach(file => {
        const origSize = getFileSize(path.join(distDir, file.original));
        const minSize = file.minified ? getFileSize(path.join(distDir, file.minified)) : null;
        
        const origFormatted = origSize ? formatSize(origSize) : 'N/A';
        const minFormatted = minSize ? formatSize(minSize) : '—';
        const reduction = calcReduction(origSize, minSize);
        
        printRow(file.name, origFormatted, minFormatted, reduction);
    });
    
    // CSS Files
    console.log('├───────────────────────────┼────────────┼────────────┼────────────┤');
    console.log('│ ' + colors.green + colors.bright + 'CSS Themes' + colors.reset + '                │            │            │            │');
    console.log('├───────────────────────────┼────────────┼────────────┼────────────┤');
    
    const cssFiles = [
        {
            name: '  quikdown.light.css',
            original: 'quikdown.light.css',
            minified: 'quikdown.light.min.css'
        },
        {
            name: '  quikdown.dark.css',
            original: 'quikdown.dark.css',
            minified: 'quikdown.dark.min.css'
        }
    ];
    
    cssFiles.forEach(file => {
        const origSize = getFileSize(path.join(distDir, file.original));
        const minSize = file.minified ? getFileSize(path.join(distDir, file.minified)) : null;
        
        const origFormatted = origSize ? formatSize(origSize) : 'N/A';
        const minFormatted = minSize ? formatSize(minSize) : '—';
        const reduction = calcReduction(origSize, minSize);
        
        printRow(file.name, origFormatted, minFormatted, reduction);
    });
    
    console.log('└───────────────────────────┴────────────┴────────────┴────────────┘');
    
    // Summary stats
    console.log('\n' + colors.bright + 'Key Bundle Sizes:' + colors.reset);
    
    const esmMinSize = getFileSize(path.join(distDir, 'quikdown.esm.min.js'));
    const bdEsmMinSize = getFileSize(path.join(distDir, 'quikdown_bd.esm.min.js'));
    const editEsmMinSize = getFileSize(path.join(distDir, 'quikdown_edit.esm.min.js'));
    
    if (esmMinSize) {
        console.log(`  ${colors.cyan}●${colors.reset} Quikdown Core (minified):    ${colors.bright}${formatSize(esmMinSize)}${colors.reset}`);
    }
    if (bdEsmMinSize) {
        console.log(`  ${colors.magenta}●${colors.reset} Quikdown BD (minified):      ${colors.bright}${formatSize(bdEsmMinSize)}${colors.reset}`);
    }
    if (editEsmMinSize) {
        console.log(`  ${colors.blue}●${colors.reset} Quikdown Editor (minified):  ${colors.bright}${formatSize(editEsmMinSize)}${colors.reset}`);
    }
    
    console.log('\n');
}

// Run if called directly
if (require.main === module) {
    printBuildSizes();
}

module.exports = printBuildSizes;