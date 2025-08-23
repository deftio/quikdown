#!/usr/bin/env node

/**
 * Proof of Concept: Backwards-Compatible Bidirectional Fence Plugin API
 * 
 * This demonstrates how the new API would work while maintaining
 * 100% backwards compatibility with existing fence plugins.
 */

import { JSDOM } from 'jsdom';
import quikdown from './src/quikdown.js';

// Create DOM environment for testing
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

// ============================================================================
// Helper Functions (would go in quikdown.js and quikdown_bd.js)
// ============================================================================

function isExtendedFencePlugin(plugin) {
  return plugin && typeof plugin === 'object' && typeof plugin.render === 'function';
}

function getFenceRenderer(plugin) {
  if (!plugin) return null;
  if (typeof plugin === 'function') return plugin;
  if (isExtendedFencePlugin(plugin)) return plugin.render;
  return null;
}

function getFenceReverser(plugin) {
  if (!plugin) return null;
  if (typeof plugin === 'function' && plugin.reverse) return plugin.reverse;
  if (isExtendedFencePlugin(plugin) && plugin.reverse) return plugin.reverse;
  return null;
}

// ============================================================================
// Example 1: Simple Backwards-Compatible Plugin (existing style)
// ============================================================================

const simpleFencePlugin = (content, lang) => {
  console.log(`Simple plugin processing ${lang} fence`);
  return `<pre class="custom-${lang}"><code>${content}</code></pre>`;
};

// ============================================================================
// Example 2: Function with Reverse Property
// ============================================================================

const functionWithReverse = (content, lang) => {
  console.log(`Function+reverse processing ${lang} fence`);
  return `<div class="widget-${lang}" data-source="${content.replace(/"/g, '&quot;')}">${content}</div>`;
};

functionWithReverse.reverse = (element) => {
  console.log('Function reverse handler called');
  const source = element.getAttribute('data-source');
  const lang = element.className.replace('widget-', '');
  return {
    fence: '```',
    lang: lang,
    content: source ? source.replace(/&quot;/g, '"') : element.textContent
  };
};

// ============================================================================
// Example 3: Full Object-Based Plugin
// ============================================================================

const objectPlugin = {
  render: (content, lang) => {
    console.log(`Object plugin processing ${lang} fence`);
    
    // Simulate SVG validation/sanitization
    if (lang === 'svg' && !content.includes('<svg')) {
      content = `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
    }
    
    return `<div class="svg-container" data-lang="${lang}">${content}</div>`;
  },
  
  reverse: (element) => {
    console.log('Object reverse handler called');
    const svg = element.querySelector('svg');
    const lang = element.getAttribute('data-lang') || 'svg';
    
    return {
      fence: '```',
      lang: lang,
      content: svg ? svg.outerHTML : element.innerHTML
    };
  }
};

// ============================================================================
// Modified quikdown wrapper for testing
// ============================================================================

function quikdownWithExtendedFence(markdown, options = {}) {
  const { fence_plugin, ...otherOptions } = options;
  
  // Get the renderer function
  const renderer = getFenceRenderer(fence_plugin);
  
  // Use the renderer if available
  const modifiedOptions = {
    ...otherOptions,
    fence_plugin: renderer
  };
  
  // Call original quikdown
  let html = quikdown(markdown, modifiedOptions);
  
  // If bidirectional and has reverser, enhance the HTML with data attributes
  if (options.bidirectional && getFenceReverser(fence_plugin)) {
    // This would be done inside quikdown.js in real implementation
    console.log('Would add data-qd-has-reverser attribute for bidirectional support');
  }
  
  return html;
}

// ============================================================================
// Simulated toMarkdown with plugin support
// ============================================================================

function toMarkdownWithPlugins(html, fence_plugin) {
  const container = document.createElement('div');
  container.innerHTML = html;
  
  // Find fence blocks
  const fenceBlocks = container.querySelectorAll('pre, div.svg-container, div[class^="widget-"]');
  
  let markdown = '';
  
  fenceBlocks.forEach(block => {
    const reverser = getFenceReverser(fence_plugin);
    
    if (reverser) {
      try {
        const result = reverser(block);
        if (result && result.content) {
          const fence = result.fence || '```';
          const lang = result.lang || '';
          markdown += `${fence}${lang}\n${result.content}\n${fence}\n\n`;
          console.log('✅ Used plugin reverse handler');
          return;
        }
      } catch (err) {
        console.warn('Reverse handler error:', err);
      }
    }
    
    // Fallback to default extraction
    const code = block.querySelector('code');
    const content = code ? code.textContent : block.textContent;
    markdown += `\`\`\`\n${content}\n\`\`\`\n\n`;
    console.log('📌 Used fallback extraction');
  });
  
  return markdown.trim();
}

// ============================================================================
// Test Cases
// ============================================================================

console.log('🧪 Testing Backwards-Compatible Bidirectional Fence Plugin API\n');
console.log('=' .repeat(70));

// Test 1: Simple function (backwards compatible)
console.log('\n📝 Test 1: Simple Function Plugin (existing style)');
console.log('-'.repeat(40));

const markdown1 = '```javascript\nconst x = 42;\n```';
const html1 = quikdownWithExtendedFence(markdown1, {
  fence_plugin: simpleFencePlugin
});
console.log('HTML:', html1);

const back1 = toMarkdownWithPlugins(html1, simpleFencePlugin);
console.log('Back to MD:', back1);
console.log('Has reverser?', getFenceReverser(simpleFencePlugin) ? 'Yes' : 'No (uses fallback)');

// Test 2: Function with reverse property
console.log('\n📝 Test 2: Function with Reverse Property');
console.log('-'.repeat(40));

const markdown2 = '```widget\n{"type": "chart", "data": [1,2,3]}\n```';
const html2 = quikdownWithExtendedFence(markdown2, {
  fence_plugin: functionWithReverse
});
console.log('HTML:', html2);

const back2 = toMarkdownWithPlugins(html2, functionWithReverse);
console.log('Back to MD:', back2);
console.log('Has reverser?', getFenceReverser(functionWithReverse) ? 'Yes' : 'No');

// Test 3: Object-based plugin
console.log('\n📝 Test 3: Object-Based Plugin');
console.log('-'.repeat(40));

const markdown3 = '```svg\n<circle cx="50" cy="50" r="40" fill="red"/>\n```';
const html3 = quikdownWithExtendedFence(markdown3, {
  fence_plugin: objectPlugin
});
console.log('HTML:', html3);

const back3 = toMarkdownWithPlugins(html3, objectPlugin);
console.log('Back to MD:', back3);
console.log('Has reverser?', getFenceReverser(objectPlugin) ? 'Yes' : 'No');

// ============================================================================
// Compatibility Tests
// ============================================================================

console.log('\n✅ Compatibility Test Results:');
console.log('-'.repeat(40));

// Test that all formats work with getFenceRenderer
console.log('getFenceRenderer:');
console.log('  - Simple function:', typeof getFenceRenderer(simpleFencePlugin) === 'function' ? '✅' : '❌');
console.log('  - Function+reverse:', typeof getFenceRenderer(functionWithReverse) === 'function' ? '✅' : '❌');
console.log('  - Object plugin:', typeof getFenceRenderer(objectPlugin) === 'function' ? '✅' : '❌');
console.log('  - null:', getFenceRenderer(null) === null ? '✅' : '❌');

// Test that reverse detection works correctly
console.log('\ngetFenceReverser:');
console.log('  - Simple function:', getFenceReverser(simpleFencePlugin) === null ? '✅ null (correct)' : '❌');
console.log('  - Function+reverse:', typeof getFenceReverser(functionWithReverse) === 'function' ? '✅' : '❌');
console.log('  - Object plugin:', typeof getFenceReverser(objectPlugin) === 'function' ? '✅' : '❌');

console.log('\n' + '='.repeat(70));
console.log('🎉 Proof of Concept Complete!');
console.log('\nKey Points:');
console.log('  1. All existing fence plugins work unchanged');
console.log('  2. New plugins can opt-in to bidirectional support');
console.log('  3. Clean API with multiple format options');
console.log('  4. Graceful fallback when reverse handler not provided');