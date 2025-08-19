#!/usr/bin/env node

/**
 * Generate theme CSS files from quikdown.emitStyles()
 * Both light and dark themes come directly from emitStyles()
 */

import quikdown from '../dist/quikdown.esm.js';
import fs from 'fs';
import path from 'path';
import { readFileSync } from 'fs';

// Get version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const version = packageJson.version;

/**
 * Parse minified CSS and format it nicely
 * @param {string} css - Minified CSS from emitStyles()
 * @returns {string} - Formatted CSS with proper spacing
 */
function formatCSS(css) {
  // Split into individual rules
  const rules = css.split('\n').filter(line => line.trim());
  
  // Separate structural rules from theme rules
  const structuralRules = [];
  const themeRules = [];
  let isThemeSection = false;
  
  rules.forEach(rule => {
    if (rule.includes('/* Theme:')) {
      isThemeSection = true;
      themeRules.push(rule);
    } else if (isThemeSection) {
      themeRules.push(rule);
    } else {
      structuralRules.push(rule);
    }
  });
  
  // Format structural rules
  const formattedStructural = structuralRules.map(rule => {
    const match = rule.match(/^([^{]+)\s*{\s*([^}]+)\s*}$/);
    if (!match) return rule;
    
    const selector = match[1].trim();
    const properties = match[2];
    
    // Get the element name for comments
    const element = selector.replace('.quikdown-', '').replace(/-/g, ' ');
    
    // Split and format properties
    const propList = properties.split(';').filter(p => p.trim());
    const formattedProps = propList.map(prop => {
      const [key, value] = prop.split(':');
      if (!key || !value) return prop;
      
      // Add spaces for readability
      let formattedValue = value.trim();
      
      // Expand shortened values for readability (only at start of value)
      if (key.trim() === 'margin' || key.trim() === 'padding') {
        // Only expand if it starts with a dot (e.g., .5em -> 0.5em)
        formattedValue = formattedValue.replace(/^\.(\d+)/g, '0.$1');
      }
      
      return `    ${key.trim()}: ${formattedValue};`;
    }).join('\n');
    
    // Add comment for each major element
    let comment = '';
    if (element.includes('h1')) comment = '/* Primary heading */\n';
    else if (element.includes('h2')) comment = '/* Secondary heading */\n';
    else if (element.includes('h3')) comment = '/* Tertiary heading */\n';
    else if (element.includes('h4')) comment = '/* Fourth level heading */\n';
    else if (element.includes('h5')) comment = '/* Fifth level heading */\n';
    else if (element.includes('h6')) comment = '/* Sixth level heading */\n';
    else if (element === 'pre') comment = '/* Code blocks */\n';
    else if (element === 'code') comment = '/* Inline code */\n';
    else if (element === 'blockquote') comment = '/* Blockquotes */\n';
    else if (element === 'table') comment = '/* Tables */\n';
    else if (element === 'th') comment = '/* Table headers */\n';
    else if (element === 'td') comment = '/* Table cells */\n';
    else if (element === 'hr') comment = '/* Horizontal rules */\n';
    else if (element === 'img') comment = '/* Images */\n';
    else if (element === 'a') comment = '/* Links */\n';
    else if (element === 'strong') comment = '/* Bold text */\n';
    else if (element === 'em') comment = '/* Italic text */\n';
    else if (element === 'del') comment = '/* Strikethrough */\n';
    else if (element === 'ul') comment = '/* Unordered lists */\n';
    else if (element === 'ol') comment = '/* Ordered lists */\n';
    else if (element === 'li') comment = '/* List items */\n';
    else if (element === 'task-item') comment = '/* Task list items */\n';
    else if (element === 'task-checkbox') comment = '/* Task checkboxes */\n';
    
    return `${comment}${selector} {\n${formattedProps}\n}`;
  }).join('\n\n');
  
  // Format theme rules - keep them compact
  const formattedTheme = themeRules.join('\n');
  
  return formattedStructural + (formattedTheme ? '\n\n' + formattedTheme : '');
}

// Generate Light Theme with proper parent-child selectors
const lightStylesRaw = quikdown.emitStyles('quikdown-', 'light');

// Add parent selector to each rule
function addParentSelector(css, parentClass) {
  const lines = css.split('\n').filter(line => line.trim());
  return lines.map(line => {
    const match = line.match(/^(\.quikdown-[^{]+)\s*{\s*([^}]+)\s*}$/);
    if (!match) return line;
    return `${parentClass} ${match[1]} { ${match[2]} }`;
  }).join('\n');
}

const lightStyles = addParentSelector(lightStylesRaw, '.quikdown-light');

// Create light theme CSS 
const lightTheme = `/**
 * QuikDown Light Theme CSS
 * Generated from quikdown.emitStyles('quikdown-', 'light')
 * 
 * Theme with container-based scoping.
 * Usage: <div class="quikdown-light">...content...</div>
 * 
 * @version ${version}
 * @source tools/generateThemeCSS.js
 */

/* ============================================
   QuikDown Light Theme Styles
   All selectors scoped to .quikdown-light container
   ============================================ */

${formatCSS(lightStyles)}

/* ============================================
   Container Styling
   ============================================ */

.quikdown-light {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #fff;
    padding: 1rem;
}`;

// Generate Dark Theme with proper parent-child selectors
const darkStylesRaw = quikdown.emitStyles('quikdown-', 'dark');
const darkStyles = addParentSelector(darkStylesRaw, '.quikdown-dark');

// Create dark theme CSS
const darkTheme = `/**
 * QuikDown Dark Theme CSS
 * Generated from quikdown.emitStyles('quikdown-', 'dark')
 * 
 * Theme with container-based scoping.
 * Usage: <div class="quikdown-dark">...content...</div>
 * 
 * @version ${version}
 * @source tools/generateThemeCSS.js
 */

/* ============================================
   QuikDown Dark Theme Styles
   All selectors scoped to .quikdown-dark container
   ============================================ */

${formatCSS(darkStyles)}

/* ============================================
   Container Styling
   ============================================ */

.quikdown-dark {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    color: #e0e0e0;
    background: #1a1a1a;
    padding: 1rem;
}

/* ============================================
   Auto Dark Mode Support
   ============================================ */

@media (prefers-color-scheme: dark) {
    .quikdown-auto {
        color: #e0e0e0;
        background: #1a1a1a;
    }
    
    /* Auto-apply dark theme styles */
    .quikdown-auto .quikdown-h1,
    .quikdown-auto .quikdown-h2,
    .quikdown-auto .quikdown-h3,
    .quikdown-auto .quikdown-h4,
    .quikdown-auto .quikdown-h5,
    .quikdown-auto .quikdown-h6 { color: #e0e0e0; }
    .quikdown-auto .quikdown-pre { background: #2a2a2a; }
    .quikdown-auto .quikdown-code { background: #2a2a2a; }
    .quikdown-auto .quikdown-blockquote { border-left-color: #3a3a3a; color: #e0e0e0; }
    .quikdown-auto .quikdown-th { background-color: #2a2a2a; border-color: #3a3a3a; }
    .quikdown-auto .quikdown-td { border-color: #3a3a3a; color: #e0e0e0; }
    .quikdown-auto .quikdown-hr { border-top-color: #3a3a3a; }
    .quikdown-auto .quikdown-a { color: #6db3f2; }
    .quikdown-auto .quikdown-li { color: #e0e0e0; }
}`;

// Write files
const distDir = path.join(process.cwd(), 'dist');

// Write light theme
fs.writeFileSync(
  path.join(distDir, 'quikdown.light.css'),
  lightTheme,
  'utf-8'
);
console.log('✓ Generated dist/quikdown.light.css from emitStyles("quikdown-", "light")');

// Write dark theme
fs.writeFileSync(
  path.join(distDir, 'quikdown.dark.css'),
  darkTheme,
  'utf-8'
);
console.log('✓ Generated dist/quikdown.dark.css from emitStyles("quikdown-", "dark")');

// Calculate sizes
const lightSize = Buffer.byteLength(lightTheme, 'utf-8');
const darkSize = Buffer.byteLength(darkTheme, 'utf-8');

console.log(`\nTheme CSS files generated directly from quikdown.emitStyles()`);
console.log(`Light theme: ${(lightSize / 1024).toFixed(2)}KB`);
console.log(`Dark theme: ${(darkSize / 1024).toFixed(2)}KB`);
console.log(`\nBoth themes generated from the same source with theme parameter`);
console.log(`To create minified versions, run: npm run minify:css`);