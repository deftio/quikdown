/**
 * QuikDown Grammar Compiler
 * Compiles grammar rules into optimized data structures for the parser
 */

import { GRAMMAR, STYLES } from './quikdown_lex_grammar.js';

export class GrammarCompiler {
  compile() {
    return {
      // Pre-compiled regex patterns for faster matching
      blocks: this.compileBlockRules(GRAMMAR.blocks),
      inline: this.compileInlineRules(GRAMMAR.inline),
      inlineBlocks: this.compileInlineBlockRules(GRAMMAR.inlineBlocks),
      
      // Optimized lookup structures
      lists: this.compileListRules(GRAMMAR.lists),
      tables: GRAMMAR.tables,
      processing: GRAMMAR.processing,
      helpers: GRAMMAR.helpers,
      
      // Style data
      styles: STYLES
    };
  }

  compileBlockRules(rules) {
    return rules.map(rule => ({
      name: rule.name,
      pattern: rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern),
      parse: rule.parse,
      // Pre-compile pattern source for faster checks
      patternSource: rule.pattern instanceof RegExp ? rule.pattern.source : rule.pattern
    }));
  }

  compileInlineRules(rules) {
    // Create optimized lookup table by first character for faster matching
    const charMap = {};
    const regexRules = [];
    
    for (const rule of rules) {
      if (typeof rule.pattern === 'string') {
        const firstChar = rule.pattern[0];
        if (!charMap[firstChar]) charMap[firstChar] = [];
        charMap[firstChar].push({
          name: rule.name,
          pattern: rule.pattern,
          parse: rule.parse
        });
      } else {
        regexRules.push({
          name: rule.name,
          pattern: rule.pattern,
          parse: rule.parse
        });
      }
    }
    
    return { charMap, regexRules };
  }

  compileInlineBlockRules(rules) {
    return rules.map(rule => ({
      name: rule.name,
      condition: rule.condition,
      pattern: rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern),
      parse: rule.parse
    }));
  }

  compileListRules(lists) {
    return {
      ordered: {
        ...lists.ordered,
        marker: lists.ordered.marker instanceof RegExp ? 
          lists.ordered.marker : new RegExp(lists.ordered.marker)
      },
      unordered: {
        ...lists.unordered,
        marker: lists.unordered.marker instanceof RegExp ? 
          lists.unordered.marker : new RegExp(lists.unordered.marker)
      },
      task: {
        ...lists.task,
        pattern: lists.task.pattern instanceof RegExp ? 
          lists.task.pattern : new RegExp(lists.task.pattern),
        checked: lists.task.checked instanceof RegExp ? 
          lists.task.checked : new RegExp(lists.task.checked)
      },
      nesting: {
        ...lists.nesting,
        indent: lists.nesting.indent instanceof RegExp ? 
          lists.nesting.indent : new RegExp(lists.nesting.indent),
        nestedMarker: lists.nesting.nestedMarker instanceof RegExp ? 
          lists.nesting.nestedMarker : new RegExp(lists.nesting.nestedMarker)
      },
      continuation: lists.continuation
    };
  }
}

// Export compiled grammar as a module
export function compileGrammar() {
  const compiler = new GrammarCompiler();
  return compiler.compile();
}

// If run directly, output the compiled grammar
if (import.meta.url === `file://${process.argv[1]}`) {
  const compiled = compileGrammar();
  console.log('export const COMPILED_GRAMMAR = ' + JSON.stringify(compiled, (key, val) => {
    // Convert RegExp to string representation for serialization
    if (val instanceof RegExp) {
      return { __regex: true, source: val.source, flags: val.flags };
    }
    // Convert functions to string names for method references
    if (typeof val === 'function') {
      return { __function: true, name: val.name || 'anonymous' };
    }
    return val;
  }, 2) + ';');
}