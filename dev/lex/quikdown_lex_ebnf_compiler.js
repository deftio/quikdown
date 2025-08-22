/**
 * EBNF Grammar Compiler for QuikDown
 * ===================================
 * 
 * Compiles EBNF grammar into optimized state machine code.
 * 
 * Features:
 * - Parses EBNF notation into AST
 * - Generates hierarchical state machines
 * - Optimizes using JavaScript string methods where beneficial
 * - Outputs compact, hand-tuned-style code
 * 
 * The compiler generates:
 * 1. Token definitions and patterns
 * 2. State transition tables
 * 3. Action functions for HTML emission
 * 4. Helper method calls for complex patterns
 */

import fs from 'fs';
import path from 'path';

/**
 * EBNF Parser - Converts grammar text to AST
 */
class EBNFParser {
  constructor(grammar) {
    this.grammar = grammar;
    this.pos = 0;
    this.rules = {};
    this.tokens = {};
    this.templates = {};
    this.options = {};
  }

  parse() {
    // Extract metadata blocks first
    this.extractMetadata();
    
    // Parse production rules
    while (this.pos < this.grammar.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.grammar.length) break;
      
      const rule = this.parseRule();
      if (rule) {
        this.rules[rule.name] = rule;
      }
    }
    
    return {
      rules: this.rules,
      tokens: this.tokens,
      templates: this.templates,
      options: this.options
    };
  }

  extractMetadata() {
    // Extract @compiler-options from comment block
    const optionsMatch = this.grammar.match(/@compiler-options\s*{\s*\n([\s\S]*?)\n\s*\*\s*}/);
    if (optionsMatch) {
      try {
        // Clean up: remove comment stars and parse as JSON5-like
        let cleanText = optionsMatch[1]
          .split('\n')
          .map(line => line.replace(/^\s*\*\s*/, ''))
          .join('\n')
          .replace(/\/\/[^\n]*/g, '') // Remove // comments
          .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
        
        // Wrap in braces if needed
        cleanText = '{' + cleanText + '}';
        this.options = JSON.parse(cleanText);
      } catch (e) {
        console.warn('Failed to parse compiler options:', e);
        // Use defaults
        this.options = {
          use_string_methods: true,
          inline_small_patterns: true,
          merge_adjacent_literals: true,
          use_charmap: true
        };
      }
    }

    // Extract @tokens from comment block
    const tokensMatch = this.grammar.match(/@tokens\s*{\s*\n([\s\S]*?)\n\s*\*\s*}/);
    if (tokensMatch) {
      try {
        let cleanText = tokensMatch[1]
          .split('\n')
          .map(line => line.replace(/^\s*\*\s*/, ''))
          .join('\n')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/,(\s*[}\]])/g, '$1');
        
        // Handle regex patterns
        cleanText = cleanText.replace(/:\s*\/([^\/]+)\//g, ': "__REGEX__$1__REGEX__"');
        cleanText = '{' + cleanText + '}';
        
        const parsed = JSON.parse(cleanText);
        // Convert regex strings back
        for (const [key, val] of Object.entries(parsed)) {
          if (typeof val === 'string' && val.startsWith('__REGEX__')) {
            parsed[key] = new RegExp(val.slice(9, -9));
          }
        }
        this.tokens = parsed;
      } catch (e) {
        console.warn('Failed to parse tokens:', e);
        this.tokens = {};
      }
    }

    // Extract @templates from comment block
    const templatesMatch = this.grammar.match(/@templates\s*{\s*\n([\s\S]*?)\n\s*\*\s*}/);
    if (templatesMatch) {
      try {
        let cleanText = templatesMatch[1]
          .split('\n')
          .map(line => line.replace(/^\s*\*\s*/, ''))
          .join('\n')
          .replace(/,(\s*})/g, '}');
        
        cleanText = '{' + cleanText + '}';
        this.templates = JSON.parse(cleanText);
      } catch (e) {
        console.warn('Failed to parse templates:', e);
        this.templates = {};
      }
    }
  }

  skipWhitespaceAndComments() {
    while (this.pos < this.grammar.length) {
      // Skip whitespace
      if (/\s/.test(this.grammar[this.pos])) {
        this.pos++;
        continue;
      }
      
      // Skip line comments
      if (this.grammar.slice(this.pos, this.pos + 2) === '//') {
        while (this.pos < this.grammar.length && this.grammar[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }
      
      // Skip block comments
      if (this.grammar.slice(this.pos, this.pos + 2) === '/*') {
        this.pos += 2;
        while (this.pos < this.grammar.length - 1) {
          if (this.grammar.slice(this.pos, this.pos + 2) === '*/') {
            this.pos += 2;
            break;
          }
          this.pos++;
        }
        continue;
      }
      
      break;
    }
  }

  parseRule() {
    // Parse rule name
    const nameMatch = this.grammar.slice(this.pos).match(/^([a-z_][a-z0-9_]*)\s*::=/i);
    if (!nameMatch) return null;
    
    const name = nameMatch[1];
    this.pos += nameMatch[0].length;
    
    // Parse alternatives
    const alternatives = this.parseAlternatives();
    
    return { name, alternatives };
  }

  parseAlternatives() {
    const alternatives = [];
    alternatives.push(this.parseSequence());
    
    while (this.peek() === '|') {
      this.pos++; // consume |
      this.skipWhitespaceAndComments();
      alternatives.push(this.parseSequence());
    }
    
    return alternatives;
  }

  parseSequence() {
    const items = [];
    
    while (this.pos < this.grammar.length) {
      this.skipWhitespaceAndComments();
      
      const char = this.peek();
      if (!char || char === '|' || char === '\n') break;
      
      const item = this.parseItem();
      if (item) items.push(item);
      else break;
    }
    
    return items;
  }

  parseItem() {
    this.skipWhitespaceAndComments();
    const char = this.peek();
    
    // Terminal (literal string)
    if (char === "'") {
      return this.parseTerminal();
    }
    
    // Optional []
    if (char === '[') {
      return this.parseOptional();
    }
    
    // Repetition {}
    if (char === '{') {
      return this.parseRepetition();
    }
    
    // Grouping ()
    if (char === '(') {
      return this.parseGroup();
    }
    
    // Semantic hint <>
    if (char === '<') {
      return this.parseHint();
    }
    
    // Special directive @
    if (char === '@') {
      return this.parseDirective();
    }
    
    // Non-terminal reference
    if (/[a-z_]/i.test(char)) {
      return this.parseNonTerminal();
    }
    
    return null;
  }

  parseTerminal() {
    this.pos++; // skip opening '
    let value = '';
    while (this.pos < this.grammar.length && this.grammar[this.pos] !== "'") {
      if (this.grammar[this.pos] === '\\') {
        this.pos++;
      }
      value += this.grammar[this.pos++];
    }
    this.pos++; // skip closing '
    return { type: 'terminal', value };
  }

  parseOptional() {
    this.pos++; // skip [
    const items = this.parseSequence();
    this.skipWhitespaceAndComments();
    if (this.peek() === ']') this.pos++;
    return { type: 'optional', items };
  }

  parseRepetition() {
    this.pos++; // skip {
    const items = this.parseSequence();
    this.skipWhitespaceAndComments();
    if (this.peek() === '}') this.pos++;
    return { type: 'repetition', items };
  }

  parseGroup() {
    this.pos++; // skip (
    const alternatives = this.parseAlternatives();
    this.skipWhitespaceAndComments();
    if (this.peek() === ')') this.pos++;
    return { type: 'group', alternatives };
  }

  parseHint() {
    this.pos++; // skip <
    let hint = '';
    while (this.pos < this.grammar.length && this.grammar[this.pos] !== '>') {
      hint += this.grammar[this.pos++];
    }
    this.pos++; // skip >
    return { type: 'hint', value: hint };
  }

  parseDirective() {
    const match = this.grammar.slice(this.pos).match(/^@(regex|builtin|helper|position)\s+([^\s\]|}|)]+)/);
    if (match) {
      this.pos += match[0].length;
      return { type: 'directive', directive: match[1], value: match[2] };
    }
    return null;
  }

  parseNonTerminal() {
    const match = this.grammar.slice(this.pos).match(/^[a-z_][a-z0-9_]*/i);
    if (match) {
      this.pos += match[0].length;
      return { type: 'nonterminal', name: match[0] };
    }
    return null;
  }

  peek() {
    return this.grammar[this.pos];
  }
}

/**
 * State Machine Generator
 * Converts AST to optimized state machine code
 */
class StateMachineGenerator {
  constructor(ast) {
    this.ast = ast;
    this.states = new Map();
    this.stateCounter = 0;
    this.charMap = {};  // For fast first-char lookup
  }

  generate() {
    // Build state machine from rules
    this.buildStateMachine();
    
    // Optimize the state machine
    if (this.ast.options.use_charmap) {
      this.buildCharMap();
    }
    
    // Generate JavaScript code
    return this.generateCode();
  }

  buildStateMachine() {
    // Create states for each rule
    for (const [name, rule] of Object.entries(this.ast.rules)) {
      const state = this.createState(name, rule);
      this.states.set(name, state);
    }
  }

  createState(name, rule) {
    const state = {
      name,
      id: this.stateCounter++,
      transitions: [],
      actions: []
    };

    // Process each alternative
    for (const sequence of rule.alternatives) {
      const transition = this.processSequence(sequence);
      state.transitions.push(transition);
    }

    return state;
  }

  processSequence(sequence) {
    const transition = {
      conditions: [],
      actions: [],
      nextState: null
    };

    for (const item of sequence) {
      switch (item.type) {
        case 'terminal':
          transition.conditions.push({
            type: 'literal',
            value: item.value
          });
          break;
          
        case 'directive':
          if (item.directive === 'regex') {
            transition.conditions.push({
              type: 'regex',
              pattern: item.value
            });
          } else if (item.directive === 'helper') {
            transition.actions.push({
              type: 'helper',
              method: item.value
            });
          } else if (item.directive === 'builtin') {
            transition.actions.push({
              type: 'builtin',
              method: item.value
            });
          }
          break;
          
        case 'nonterminal':
          transition.nextState = item.name;
          break;
          
        case 'hint':
          // Process semantic hints for HTML emission
          if (item.value.startsWith('emit:')) {
            transition.actions.push({
              type: 'emit',
              tag: item.value.slice(5)
            });
          }
          break;
          
        case 'optional':
          // Mark as optional in conditions
          transition.conditions.push({
            type: 'optional',
            items: this.processSequence(item.items)
          });
          break;
          
        case 'repetition':
          // Mark as repeating
          transition.conditions.push({
            type: 'repetition',
            items: this.processSequence(item.items)
          });
          break;
      }
    }

    return transition;
  }

  buildCharMap() {
    // Build character lookup table for first character of terminals
    for (const [name, state] of this.states.entries()) {
      for (const transition of state.transitions) {
        for (const condition of transition.conditions) {
          if (condition.type === 'literal' && condition.value.length > 0) {
            const firstChar = condition.value[0];
            if (!this.charMap[firstChar]) {
              this.charMap[firstChar] = [];
            }
            this.charMap[firstChar].push({
              state: name,
              condition,
              transition
            });
          }
        }
      }
    }
  }

  generateCode() {
    const code = [];
    
    // File header
    code.push('/**');
    code.push(' * QuikDown Lexer - EBNF Grammar Compiled State Machine');
    code.push(' * Auto-generated from quikdown_lex.ebnf');
    code.push(' */');
    code.push('');
    
    // Generate scanner class with embedded state machine
    code.push(this.generateScannerClass());
    
    // Generate parser class that uses the state machine
    code.push(this.generateParserClass());
    
    // Generate main export
    code.push(this.generateExports());
    
    return code.join('\n');
  }

  generateScannerClass() {
    return `
// Scanner with embedded state machine
class Scanner {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.state = 'document';  // Start state
    this.stateStack = [];     // For nested states
  }

  // Core scanning methods leveraging JS string methods
  peek() {
    return this.input.slice(this.pos);
  }

  advance(count = 1) {
    const result = this.input.slice(this.pos, this.pos + count);
    this.pos += count;
    return result;
  }

  match(pattern) {
    if (typeof pattern === 'string') {
      // Use startsWith for literal strings (fast)
      if (this.input.startsWith(pattern, this.pos)) {
        return this.advance(pattern.length);
      }
    } else if (pattern instanceof RegExp) {
      // Use regex match
      const match = this.input.slice(this.pos).match(pattern);
      if (match && match.index === 0) {
        return this.advance(match[0].length);
      }
    }
    return null;
  }

  scanUntil(pattern) {
    const start = this.pos;
    if (typeof pattern === 'string') {
      // Use indexOf for strings (fast)
      const idx = this.input.indexOf(pattern, this.pos);
      this.pos = idx === -1 ? this.input.length : idx;
    } else {
      // Use regex search
      const match = this.input.slice(this.pos).match(pattern);
      this.pos = match ? this.pos + match.index : this.input.length;
    }
    return this.input.slice(start, this.pos);
  }

  scanUntilFence() {
    // Specialized helper for fence scanning
    const fence = this.input.slice(this.pos - 3, this.pos);
    // Create pattern for matching fence at line start
    const searchStr = '\\n' + fence;
    const idx = this.input.indexOf(searchStr, this.pos);
    if (idx !== -1) {
      const result = this.input.slice(this.pos, idx);
      this.pos = idx + 1; // Position after newline
      return result;
    }
    // No closing fence found
    const result = this.input.slice(this.pos);
    this.pos = this.input.length;
    return result;
  }

  atEnd() {
    return this.pos >= this.input.length;
  }

  // State machine execution
  transition(nextState) {
    this.state = nextState;
  }

  pushState(newState) {
    this.stateStack.push(this.state);
    this.state = newState;
  }

  popState() {
    if (this.stateStack.length > 0) {
      this.state = this.stateStack.pop();
    }
  }
}`;
  }

  generateParserClass() {
    // Generate the state transition table
    const stateTable = this.generateStateTable();
    
    // Generate character map for optimization
    const charMapCode = this.ast.options.use_charmap ? this.generateCharMap() : '';
    
    return `
// Parser using compiled state machine
class EBNFParser {
  constructor(options = {}) {
    this.opts = {
      inline_styles: options.inline_styles || false,
      class_prefix: options.class_prefix || 'quikdown-',
      fence_plugin: options.fence_plugin || null,
      lazy_linefeeds: options.lazy_linefeeds || false,
      allow_unsafe_urls: options.allow_unsafe_urls || false
    };
    
    // Compiled state machine
    this.states = ${stateTable};
    
    ${charMapCode}
    
    // HTML templates
    this.templates = ${JSON.stringify(this.ast.templates, null, 2)};
  }

  parse(input) {
    if (!input || typeof input !== 'string') return '';
    
    const scanner = new Scanner(input);
    const blocks = [];
    
    // Execute state machine
    while (!scanner.atEnd()) {
      const block = this.executeState(scanner, 'block');
      if (block) blocks.push(block);
      else scanner.advance(); // Skip unrecognized
    }
    
    return blocks.join('');
  }

  executeState(scanner, stateName) {
    const state = this.states[stateName];
    if (!state) return null;
    
    // Try character map first for optimization
    ${this.ast.options.use_charmap ? `
    const firstChar = scanner.peek()[0];
    if (this.charMap[firstChar]) {
      for (const entry of this.charMap[firstChar]) {
        if (entry.state === stateName) {
          const result = this.tryTransition(scanner, entry.transition);
          if (result !== null) return result;
        }
      }
    }` : ''}
    
    // Try each transition in order
    for (const transition of state.transitions) {
      const result = this.tryTransition(scanner, transition);
      if (result !== null) return result;
    }
    
    return null;
  }

  tryTransition(scanner, transition) {
    const savedPos = scanner.pos;
    const results = [];
    
    // Check conditions
    for (const condition of transition.conditions) {
      if (!this.checkCondition(scanner, condition, results)) {
        scanner.pos = savedPos;
        return null;
      }
    }
    
    // Execute actions
    let output = '';
    for (const action of transition.actions) {
      output += this.executeAction(action, results, scanner);
    }
    
    // Handle next state
    if (transition.nextState) {
      output += this.executeState(scanner, transition.nextState);
    }
    
    return output;
  }

  checkCondition(scanner, condition, results) {
    switch (condition.type) {
      case 'literal':
        const match = scanner.match(condition.value);
        if (match) {
          results.push(match);
          return true;
        }
        return false;
        
      case 'regex':
        const regexMatch = scanner.match(new RegExp(condition.pattern));
        if (regexMatch) {
          results.push(regexMatch);
          return true;
        }
        return false;
        
      case 'optional':
        // Optional always succeeds
        this.tryTransition(scanner, condition.items);
        return true;
        
      case 'repetition':
        // Match zero or more times
        while (this.tryTransition(scanner, condition.items) !== null) {
          // Keep matching
        }
        return true;
        
      default:
        return false;
    }
  }

  executeAction(action, results, scanner) {
    switch (action.type) {
      case 'emit':
        const template = this.templates[action.tag];
        return this.fillTemplate(template, results);
        
      case 'helper':
        if (scanner[action.method]) {
          return scanner[action.method]();
        }
        return '';
        
      case 'builtin':
        const text = results[results.length - 1] || '';
        if (text[action.method]) {
          return text[action.method]();
        }
        return text;
        
      default:
        return '';
    }
  }

  fillTemplate(template, results) {
    let filled = template;
    filled = filled.replace('{content}', results.join(''));
    filled = filled.replace('{attr}', this.getAttr(template.match(/<(\\w+)/)[1]));
    return filled;
  }

  // Helper methods
  getAttr(tag) {
    if (tag === 'p') return '';
    if (this.opts.inline_styles) {
      // Import styles statically in actual build
      const style = ''; // Will be replaced at build time
      return style ? \` style="\${style}"\` : '';
    }
    return \` class="\${this.opts.class_prefix}\${tag}"\`;
  }

  escapeHtml(str) {
    const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
    return str.replace(/[&<>"']/g, m => map[m]);
  }

  sanitizeUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (this.opts.allow_unsafe_urls) return trimmed;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
      return lower.startsWith('data:image/') ? trimmed : '#';
    }
    return trimmed;
  }
}`;
  }

  generateStateTable() {
    const table = {};
    
    for (const [name, state] of this.states.entries()) {
      table[name] = {
        transitions: state.transitions.map(t => ({
          conditions: t.conditions,
          actions: t.actions,
          nextState: t.nextState
        }))
      };
    }
    
    return JSON.stringify(table, null, 2);
  }

  generateCharMap() {
    if (!this.ast.options.use_charmap) return '';
    
    return `
    // Character map for fast first-character lookup
    this.charMap = ${JSON.stringify(this.charMap, (key, val) => {
      if (val && val.transition) {
        // Don't include full transition in JSON
        return { state: val.state, condition: val.condition };
      }
      return val;
    }, 2)};`;
  }

  generateExports() {
    return `
// Main export
export default function quikdown_lex(markdown, options = {}) {
  const parser = new EBNFParser(options);
  return parser.parse(markdown);
}

// API compatibility
quikdown_lex.version = '__QUIKDOWN_VERSION__';

quikdown_lex.emitStyles = function(prefix = 'quikdown-') {
  // Styles will be inlined at build time
  const styles = {};
  let css = '';
  for (const [tag, style] of Object.entries(styles)) {
    if (style) {
      css += \`.\${prefix}\${tag} { \${style} }\\n\`;
    }
  }
  return css;
};

quikdown_lex.configure = function(options) {
  return function(markdown) {
    return quikdown_lex(markdown, options);
  };
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown_lex;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return quikdown_lex; });
} else if (typeof globalThis !== 'undefined') {
  globalThis.quikdown_lex = quikdown_lex;
}`;
  }
}

/**
 * Main compiler function
 */
export function compileEBNFGrammar(grammarPath) {
  // Read grammar file
  const grammar = fs.readFileSync(grammarPath, 'utf8');
  
  // Parse EBNF to AST
  const parser = new EBNFParser(grammar);
  const ast = parser.parse();
  
  console.log('📝 Parsed EBNF grammar:');
  console.log(`  - ${Object.keys(ast.rules).length} production rules`);
  console.log(`  - ${Object.keys(ast.tokens).length} token definitions`);
  console.log(`  - ${Object.keys(ast.templates).length} HTML templates`);
  
  // Generate state machine code
  const generator = new StateMachineGenerator(ast);
  const code = generator.generate();
  
  console.log('🔧 Generated state machine:');
  console.log(`  - ${generator.states.size} states`);
  console.log(`  - ${Object.keys(generator.charMap).length} character map entries`);
  
  return code;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const grammarPath = process.argv[2] || './quikdown_lex.ebnf';
  const outputPath = process.argv[3] || './quikdown_lex_ebnf.js';
  
  console.log('🚀 Compiling EBNF grammar...');
  console.log(`  Input: ${grammarPath}`);
  console.log(`  Output: ${outputPath}`);
  
  try {
    const code = compileEBNFGrammar(grammarPath);
    
    // Add version placeholder
    const packagePath = path.join(path.dirname(grammarPath), '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const finalCode = code.replace(/__QUIKDOWN_VERSION__/g, packageJson.version);
    
    fs.writeFileSync(outputPath, finalCode);
    console.log('✅ Compilation successful!');
    
    // Report size
    const size = (finalCode.length / 1024).toFixed(1);
    console.log(`📊 Output size: ${size}KB`);
  } catch (error) {
    console.error('❌ Compilation failed:', error);
    process.exit(1);
  }
}