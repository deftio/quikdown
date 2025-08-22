import quikdown_v2 from './quikdown_lex_v2.js';

const parser = new (await import('./quikdown_lex_v2.js')).GrammarParser();
const result = parser.parseInline('para\n# heading');
console.log('parseInline result:', JSON.stringify(result));
