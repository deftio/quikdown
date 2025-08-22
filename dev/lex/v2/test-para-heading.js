import quikdown_v2 from './quikdown_lex_v2.js';
import quikdown_main from '../../../dist/quikdown.esm.js';

const input = 'para\n# heading';
console.log('Input:', JSON.stringify(input));
console.log('\nMain output:');
console.log(quikdown_main(input));
console.log('\nV2 output:');
console.log(quikdown_v2(input));
