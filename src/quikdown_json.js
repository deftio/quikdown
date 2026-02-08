/**
 * quikdown_json - Markdown to JSON converter
 * Converts markdown to JSON via AST
 * @param {string} markdown - The markdown source text
 * @param {Object} options - Optional configuration object
 * @param {number} options.indent - JSON indentation (default: 2)
 * @returns {string} - JSON string representation of the AST
 */

import quikdown_ast from './quikdown_ast.js';

// Version will be injected at build time
const quikdownVersion = '__QUIKDOWN_VERSION__';

/**
 * Convert markdown to JSON
 * @param {string} markdown - The markdown source text
 * @param {Object} options - Optional configuration object
 * @returns {string} - JSON string
 */
function quikdown_json(markdown, options = {}) {
    const ast = quikdown_ast(markdown, options);
    const indent = options.indent !== undefined ? options.indent : 2;
    return JSON.stringify(ast, null, indent);
}

// Expose the AST parser for direct access
quikdown_json.parse = quikdown_ast;

// Attach version
quikdown_json.version = quikdownVersion;

// Export for both CommonJS and ES6
/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = quikdown_json;
}

// For browser global
/* istanbul ignore next */
if (typeof window !== 'undefined') {
    window.quikdown_json = quikdown_json;
}

export default quikdown_json;
