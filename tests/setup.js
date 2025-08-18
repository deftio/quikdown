// Setup file for Jest tests
// Fix for TextEncoder/TextDecoder not defined in Node.js environment
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;