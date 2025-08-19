/**
 * Test suite for quikdown_edit (QuikdownEditor)
 * 
 * This test suite verifies the build output and structure of quikdown_edit
 * rather than full functional testing which would require a browser environment.
 */

const fs = require('fs');
const path = require('path');

describe('QuikdownEditor Build', () => {
    const distPath = path.join(__dirname, '../dist');
    
    describe('Build Files', () => {
        test('should have all quikdown_edit build outputs', () => {
            const expectedFiles = [
                'quikdown_edit.cjs',
                'quikdown_edit.esm.js',
                'quikdown_edit.esm.min.js',
                'quikdown_edit.umd.js',
                'quikdown_edit.umd.min.js'
            ];
            
            expectedFiles.forEach(file => {
                const filePath = path.join(distPath, file);
                expect(fs.existsSync(filePath)).toBe(true);
            });
        });
        
        test('should have minified files smaller than originals', () => {
            const pairs = [
                ['quikdown_edit.esm.js', 'quikdown_edit.esm.min.js'],
                ['quikdown_edit.umd.js', 'quikdown_edit.umd.min.js']
            ];
            
            pairs.forEach(([original, minified]) => {
                const originalSize = fs.statSync(path.join(distPath, original)).size;
                const minifiedSize = fs.statSync(path.join(distPath, minified)).size;
                expect(minifiedSize).toBeLessThan(originalSize);
                // Should achieve at least 40% reduction
                expect(minifiedSize / originalSize).toBeLessThan(0.6);
            });
        });
    });
    
    describe('Module Exports', () => {
        test('CJS module should export QuikdownEditor', () => {
            const quikdownEditPath = path.join(distPath, 'quikdown_edit.cjs');
            const source = fs.readFileSync(quikdownEditPath, 'utf8');
            
            // Check for expected exports
            expect(source).toContain('QuikdownEditor');
            expect(source).toContain('module.exports');
            
            // Check for key class methods
            expect(source).toContain('setMarkdown');
            expect(source).toContain('getMarkdown');
            expect(source).toContain('getHTML');
            expect(source).toContain('setMode');
            expect(source).toContain('destroy');
            expect(source).toContain('setLazyLinefeeds');
        });
        
        test('ESM module should export QuikdownEditor as default', () => {
            const esmPath = path.join(distPath, 'quikdown_edit.esm.js');
            const source = fs.readFileSync(esmPath, 'utf8');
            
            // Check for ESM export
            expect(source).toContain('export');
            expect(source).toContain('default');
            expect(source).toContain('QuikdownEditor');
        });
        
        test('UMD module should define global QuikdownEditor', () => {
            const umdPath = path.join(distPath, 'quikdown_edit.umd.js');
            const source = fs.readFileSync(umdPath, 'utf8');
            
            // Check for UMD pattern - adjusted for actual output format
            expect(source).toContain('typeof exports');
            expect(source).toContain('typeof module');
            expect(source).toContain('define.amd');
            expect(source).toContain('QuikdownEditor');
        });
    });
    
    describe('Dependencies', () => {
        test('should include quikdown_bd dependency', () => {
            const cjsPath = path.join(distPath, 'quikdown_edit.cjs');
            const source = fs.readFileSync(cjsPath, 'utf8');
            
            // QuikdownEditor depends on quikdown_bd for bidirectional conversion
            expect(source).toContain('quikdown_bd');
            expect(source).toContain('toMarkdown');
        });
    });
    
    describe('Features', () => {
        test('should include all view modes', () => {
            const source = fs.readFileSync(path.join(distPath, 'quikdown_edit.cjs'), 'utf8');
            
            // Check for view mode strings
            expect(source).toContain('source');
            expect(source).toContain('split');
            expect(source).toContain('preview');
        });
        
        test('should include toolbar functionality', () => {
            const source = fs.readFileSync(path.join(distPath, 'quikdown_edit.cjs'), 'utf8');
            
            // Check for toolbar-related code
            expect(source).toContain('qde-toolbar');
            expect(source).toContain('qde-btn');
            expect(source).toContain('copy-markdown');
            expect(source).toContain('copy-html');
        });
        
        test('should include theme support', () => {
            const source = fs.readFileSync(path.join(distPath, 'quikdown_edit.cjs'), 'utf8');
            
            // Check for theme-related code
            expect(source).toContain('qde-dark');
            expect(source).toContain('prefers-color-scheme');
            expect(source).toContain('applyTheme');
        });
        
        test('should include plugin support', () => {
            const source = fs.readFileSync(path.join(distPath, 'quikdown_edit.cjs'), 'utf8');
            
            // Check for plugin-related code
            expect(source).toContain('customFences');
            expect(source).toContain('fence_plugin');
            expect(source).toContain('plugins');
        });
        
        test('should include keyboard shortcuts', () => {
            const source = fs.readFileSync(path.join(distPath, 'quikdown_edit.cjs'), 'utf8');
            
            // Check for keyboard shortcut handling
            expect(source).toContain('keydown');
            expect(source).toContain('ctrlKey');
            expect(source).toContain('metaKey');
        });
    });
    
    describe('CSS Styles', () => {
        test('should include embedded styles', () => {
            const source = fs.readFileSync(path.join(distPath, 'quikdown_edit.cjs'), 'utf8');
            
            // Check for essential CSS classes
            expect(source).toContain('.qde-container');
            expect(source).toContain('.qde-toolbar');
            expect(source).toContain('.qde-editor');
            expect(source).toContain('.qde-preview');
            expect(source).toContain('.qde-textarea');
            
            // Check for responsive styles
            expect(source).toContain('@media');
            expect(source).toContain('max-width');
        });
    });
    
    describe('Size Constraints', () => {
        test('minified ESM should be under 30KB', () => {
            const filePath = path.join(distPath, 'quikdown_edit.esm.min.js');
            const stats = fs.statSync(filePath);
            const sizeKB = stats.size / 1024;
            
            expect(sizeKB).toBeLessThan(30);
        });
        
        test('minified UMD should be under 30KB', () => {
            const filePath = path.join(distPath, 'quikdown_edit.umd.min.js');
            const stats = fs.statSync(filePath);
            const sizeKB = stats.size / 1024;
            
            expect(sizeKB).toBeLessThan(30);
        });
    });
});