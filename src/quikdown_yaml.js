/**
 * quikdown_yaml - Markdown to YAML converter
 * Converts markdown to YAML via AST
 * @param {string} markdown - The markdown source text
 * @param {Object} options - Optional configuration object
 * @returns {string} - YAML string representation of the AST
 */

import quikdown_ast from './quikdown_ast.js';

// Version will be injected at build time
const quikdownVersion = '__QUIKDOWN_VERSION__';

/**
 * Convert markdown to YAML
 * @param {string} markdown - The markdown source text
 * @param {Object} options - Optional configuration object
 * @returns {string} - YAML string
 */
function quikdown_yaml(markdown, options = {}) {
    const ast = quikdown_ast(markdown, options);
    return astToYaml(ast, 0);
}

/**
 * Convert an AST node to YAML string
 * Minimal YAML serializer - no external dependencies
 * @param {Object|Array|string|number|boolean|null} node - The value to serialize
 * @param {number} indent - Current indentation level
 * @returns {string} - YAML string
 */
function astToYaml(node, indent) {
    const spaces = '  '.repeat(indent);

    if (node === null || node === undefined) {
        return 'null';
    }

    if (typeof node === 'boolean') {
        return node ? 'true' : 'false';
    }

    if (typeof node === 'number') {
        return String(node);
    }

    if (typeof node === 'string') {
        return formatYamlString(node);
    }

    if (Array.isArray(node)) {
        if (node.length === 0) {
            return '[]';
        }

        const lines = [];
        for (const item of node) {
            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                // Object item - inline the first property on the same line as dash
                const props = Object.entries(item);
                if (props.length > 0) {
                    const [firstKey, firstValue] = props[0];
                    const firstValueStr = formatValue(firstValue, indent + 1);
                    lines.push(`${spaces}- ${firstKey}: ${firstValueStr}`);

                    // Remaining properties
                    for (let i = 1; i < props.length; i++) {
                        const [key, value] = props[i];
                        const valueStr = formatValue(value, indent + 1);
                        lines.push(`${spaces}  ${key}: ${valueStr}`);
                    }
                } else {
                    lines.push(`${spaces}- {}`);
                }
            } else {
                // Simple value
                const valueStr = astToYaml(item, indent + 1);
                lines.push(`${spaces}- ${valueStr}`);
            }
        }
        return '\n' + lines.join('\n');
    }

    if (typeof node === 'object') {
        const entries = Object.entries(node);
        if (entries.length === 0) {
            return '{}';
        }

        const lines = [];
        for (const [key, value] of entries) {
            const valueStr = formatValue(value, indent);
            lines.push(`${spaces}${key}: ${valueStr}`);
        }
        return lines.join('\n');
    }

    return String(node);
}

/**
 * Format a value for YAML (handles nested objects/arrays)
 */
function formatValue(value, indent) {
    if (value === null || value === undefined) {
        return 'null';
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
        return String(value);
    }

    if (typeof value === 'string') {
        return formatYamlString(value);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        return astToYaml(value, indent + 1);
    }

    if (typeof value === 'object') {
        // Nested object - format on new lines with increased indent
        const entries = Object.entries(value);
        if (entries.length === 0) {
            return '{}';
        }
        return '\n' + astToYaml(value, indent + 1);
    }

    return String(value);
}

/**
 * Format a string for YAML (handle quoting and escaping)
 */
function formatYamlString(str) {
    // Check if string needs quoting
    const needsQuoting = (
        str === '' ||
        str.includes('\n') ||
        str.includes(':') ||
        str.includes('#') ||
        str.includes("'") ||
        str.includes('"') ||
        str.startsWith(' ') ||
        str.endsWith(' ') ||
        str.startsWith('-') ||
        str.startsWith('[') ||
        str.startsWith('{') ||
        str === 'true' ||
        str === 'false' ||
        str === 'null' ||
        str === 'yes' ||
        str === 'no' ||
        str === 'on' ||
        str === 'off' ||
        /^\d+$/.test(str) ||
        /^\d+\.\d+$/.test(str)
    );

    if (!needsQuoting) {
        return str;
    }

    // Use double quotes and escape special characters
    if (str.includes('\n')) {
        // For multiline strings, use literal block style
        const escaped = str.replace(/\n/g, '\\n');
        return `"${escaped.replace(/"/g, '\\"')}"`;
    }

    // Simple string quoting
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Expose the AST parser for direct access
quikdown_yaml.parse = quikdown_ast;

// Expose the YAML serializer for direct AST-to-YAML conversion
quikdown_yaml.stringify = function(ast) {
    return astToYaml(ast, 0);
};

// Attach version
quikdown_yaml.version = quikdownVersion;

// Export for both CommonJS and ES6
/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = quikdown_yaml;
}

// For browser global
/* istanbul ignore next */
if (typeof window !== 'undefined') {
    window.quikdown_yaml = quikdown_yaml;
}

export default quikdown_yaml;
