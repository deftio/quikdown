#!/usr/bin/env node
/**
 * Grammar Compiler
 * Compiles the grammar definition into an optimized trie structure
 */

import { GRAMMAR } from './grammar.js';
import fs from 'fs';
import path from 'path';

class GrammarCompiler {
  constructor(grammar) {
    this.grammar = grammar;
    this.trie = { children: {}, tokens: [] };
    this.tokenMap = {};
    this.blockRules = {};
    this.inlineRules = {};
  }

  compile() {
    console.log('🔨 Compiling grammar...');
    
    // Build token trie for efficient matching
    this.buildTokenTrie();
    
    // Compile block and inline rules
    this.compileBlockRules();
    this.compileInlineRules();
    
    // Generate the compiled grammar module
    const output = this.generateOutput();
    
    // Write to file
    const outputPath = path.join(process.cwd(), 'compiled-grammar.js');
    fs.writeFileSync(outputPath, output);
    
    console.log('✅ Grammar compiled to compiled-grammar.js');
    console.log(`📊 Trie nodes: ${this.countTrieNodes()}`);
    console.log(`📊 Token types: ${Object.keys(this.tokenMap).length}`);
  }

  buildTokenTrie() {
    // Process string-based tokens into trie
    Object.entries(this.grammar.tokens).forEach(([name, def]) => {
      if (typeof def.pattern === 'string') {
        this.addToTrie(def.pattern, name, def);
      } else {
        // Store regex patterns separately
        this.tokenMap[name] = { ...def, regex: def.pattern };
      }
    });
  }

  addToTrie(pattern, tokenName, def) {
    let node = this.trie;
    
    for (const char of pattern) {
      if (!node.children[char]) {
        node.children[char] = { children: {}, tokens: [] };
      }
      node = node.children[char];
    }
    
    node.tokens.push({ name: tokenName, ...def });
    this.tokenMap[tokenName] = { pattern, ...def };
  }

  compileBlockRules() {
    Object.entries(this.grammar.blocks).forEach(([name, rule]) => {
      this.blockRules[name] = this.compileRule(rule);
    });
  }

  compileInlineRules() {
    Object.entries(this.grammar.inline).forEach(([name, rule]) => {
      this.inlineRules[name] = this.compileRule(rule);
    });
  }

  compileRule(rule) {
    // Convert rule to optimized format
    const compiled = { ...rule };
    
    // Convert start tokens to array
    if (compiled.start && !Array.isArray(compiled.start)) {
      compiled.start = [compiled.start];
    }
    
    // Pre-compile render function to string for smaller output
    if (compiled.render) {
      compiled.renderStr = compiled.render.toString();
    }
    
    return compiled;
  }

  countTrieNodes() {
    let count = 0;
    const visit = (node) => {
      count++;
      Object.values(node.children).forEach(visit);
    };
    visit(this.trie);
    return count;
  }

  generateOutput() {
    return `/**
 * Compiled Grammar (Auto-generated)
 * DO NOT EDIT - Generated from grammar.js
 */

// Token Trie for efficient matching
export const TOKEN_TRIE = ${JSON.stringify(this.trie, null, 2)};

// Token definitions
export const TOKENS = ${JSON.stringify(this.tokenMap, null, 2)};

// Regex patterns for complex tokens
export const REGEX_TOKENS = [
  ${Object.entries(this.tokenMap)
    .filter(([_, def]) => def.regex)
    .map(([name, def]) => `{ name: '${name}', pattern: ${def.regex}, ...${JSON.stringify({...def, regex: undefined})} }`)
    .join(',\n  ')}
];

// Block-level rules
export const BLOCK_RULES = ${JSON.stringify(this.blockRules, null, 2)};

// Inline rules  
export const INLINE_RULES = ${JSON.stringify(this.inlineRules, null, 2)};

// Helper functions
export const escape = (text) => {
  const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += map[text[i]] || text[i];
  }
  return result;
};

export const sanitizeUrl = (url, opts = {}) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (opts.allow_unsafe_urls) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
    return lower.startsWith('data:image/') ? trimmed : '#';
  }
  return trimmed;
};
`;
  }
}

// Run the compiler
const compiler = new GrammarCompiler(GRAMMAR);
compiler.compile();