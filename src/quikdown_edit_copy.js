/**
 * Rich copy functionality for QuikdownEditor
 * Handles copying rendered content with proper formatting for pasting into rich text editors
 */

/**
 * Get rendered content as rich HTML suitable for clipboard
 * @param {HTMLElement} previewPanel - The preview panel element to copy from
 * @returns {Promise<{success: boolean, html?: string, text?: string}>}
 */
export async function getRenderedContent(previewPanel) {
    if (!previewPanel) {
        throw new Error('No preview panel available');
    }
    
    // Clone the preview panel to avoid modifying the actual DOM
    const clone = previewPanel.cloneNode(true);
    
    // Process different fence types for rich copy
    // The built-in renderers already create proper HTML tables for CSV/TSV/PSV
    // Mermaid creates SVG diagrams that need to be converted to images
    // Math equations also render as SVG that need conversion
    
    try {
        // 1. Process Mermaid diagrams - convert SVG to images
        const mermaidContainers = clone.querySelectorAll('.mermaid');
        for (const container of mermaidContainers) {
            const svg = container.querySelector('svg');
            if (svg) {
                try {
                    // Convert SVG to data URL for better compatibility
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);
                    
                    const img = document.createElement('img');
                    img.src = url;
                    img.style.maxWidth = '100%';
                    img.alt = 'Mermaid Diagram';
                    
                    container.parentNode.replaceChild(img, container);
                    
                    // Clean up
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                } catch (err) {
                    console.warn('Failed to convert Mermaid diagram:', err);
                }
            }
        }
        
        // 2. Process Math equations - KaTeX renders to HTML with SVG
        const mathContainers = clone.querySelectorAll('.qde-math-container');
        for (const container of mathContainers) {
            // KaTeX already renders to HTML, but we might want to ensure it's copyable
            // For now, leave as-is since KaTeX HTML copies well
        }
        
        // 3. Tables are already HTML tables from the built-in renderer
        // No processing needed
        
        // Get the final HTML
        const html = clone.innerHTML;
        
        // Also get plain text version
        const text = clone.textContent || clone.innerText || '';
        
        // Copy to clipboard with both HTML and plain text
        if (navigator.clipboard && navigator.clipboard.write) {
            const htmlBlob = new Blob([html], { type: 'text/html' });
            const textBlob = new Blob([text], { type: 'text/plain' });
            
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': textBlob
                })
            ]);
            
            return { success: true, html, text };
        } else {
            // Fallback to writeText
            await navigator.clipboard.writeText(text);
            return { success: true, text };
        }
    } catch (err) {
        console.error('Failed to copy rendered content:', err);
        throw err;
    }
}