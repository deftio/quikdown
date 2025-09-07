/**
 * Rich copy functionality for QuikdownEditor
 * Handles copying rendered content with proper formatting for pasting into rich text editors
 */

/**
 * Convert SVG to PNG data URL
 * @param {SVGElement} svg - The SVG element to convert
 * @returns {Promise<string>} Data URL of the PNG image
 */
async function svgToPng(svg) {
    return new Promise((resolve, reject) => {
        try {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            // Get dimensions from SVG
            const svgWidth = parseFloat(svg.getAttribute('width')) || 
                            svg.viewBox?.baseVal?.width || 
                            svg.clientWidth || 400;
            const svgHeight = parseFloat(svg.getAttribute('height')) || 
                             svg.viewBox?.baseVal?.height || 
                             svg.clientHeight || 300;
            
            // Set canvas dimensions (2x for retina)
            const scale = 2;
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;
            ctx.scale(scale, scale);
            
            img.onload = () => {
                ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
                resolve(canvas.toDataURL('image/png'));
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load SVG as image'));
            };
            
            // Create blob URL for the SVG
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            img.src = url;
            
            // Clean up blob URL after loading
            img.onload = () => {
                ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png'));
            };
        } catch (err) {
            reject(err);
        }
    });
}

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
    try {
        // 1. Process STL 3D models - convert canvas to image or placeholder
        const stlContainers = clone.querySelectorAll('.qde-stl-container');
        for (const container of stlContainers) {
            try {
                // Find the corresponding original container to get the canvas
                const containerId = container.dataset.stlId;
                const originalContainer = previewPanel.querySelector(`.qde-stl-container[data-stl-id="${containerId}"]`);
                
                if (originalContainer) {
                    const canvas = originalContainer.querySelector('canvas');
                    if (canvas && canvas.width > 0 && canvas.height > 0) {
                        try {
                            // Try to capture the canvas as an image
                            const dataUrl = canvas.toDataURL('image/png', 1.0);
                            const img = document.createElement('img');
                            img.src = dataUrl;
                            img.style.cssText = 'width: 100%; max-width: 600px; height: auto; border: 1px solid #ddd; border-radius: 4px; margin: 0.5em 0;';
                            img.alt = 'STL 3D Model';
                            container.parentNode.replaceChild(img, container);
                            continue;
                        } catch (canvasErr) {
                            console.warn('Failed to convert STL canvas to image:', canvasErr);
                        }
                    }
                }
            } catch (err) {
                console.warn('Error processing STL container:', err);
            }
            
            // Fallback to placeholder
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
            placeholder.textContent = '[STL 3D Model - Interactive content not available in copy]';
            container.parentNode.replaceChild(placeholder, container);
        }
        
        // 2. Process Mermaid diagrams - convert SVG to PNG
        const mermaidContainers = clone.querySelectorAll('.mermaid');
        for (const container of mermaidContainers) {
            const svg = container.querySelector('svg');
            if (svg) {
                try {
                    const dataUrl = await svgToPng(svg);
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    img.style.cssText = 'max-width: 100%; height: auto; margin: 0.5em 0;';
                    img.alt = 'Mermaid Diagram';
                    container.parentNode.replaceChild(img, container);
                } catch (err) {
                    console.warn('Failed to convert Mermaid diagram:', err);
                    // Fallback: leave as SVG
                }
            }
        }
        
        // 3. Process Chart.js charts - convert canvas to image
        const chartContainers = clone.querySelectorAll('.qde-chart-container');
        for (const container of chartContainers) {
            try {
                const containerId = container.dataset.chartId;
                const originalContainer = previewPanel.querySelector(`.qde-chart-container[data-chart-id="${containerId}"]`);
                
                if (originalContainer) {
                    const canvas = originalContainer.querySelector('canvas');
                    if (canvas && canvas.width > 0 && canvas.height > 0) {
                        try {
                            const dataUrl = canvas.toDataURL('image/png', 1.0);
                            const img = document.createElement('img');
                            img.src = dataUrl;
                            img.style.cssText = 'max-width: 100%; height: auto; margin: 0.5em 0;';
                            img.alt = 'Chart';
                            container.parentNode.replaceChild(img, container);
                            continue;
                        } catch (canvasErr) {
                            console.warn('Failed to convert chart canvas to image:', canvasErr);
                        }
                    }
                }
            } catch (err) {
                console.warn('Error processing chart container:', err);
            }
            
            // Fallback to placeholder
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
            placeholder.textContent = '[Chart - Interactive content not available in copy]';
            container.parentNode.replaceChild(placeholder, container);
        }
        
        // 4. Process SVG fenced blocks - convert to PNG
        const svgContainers = clone.querySelectorAll('.qde-svg-container svg');
        for (const svg of svgContainers) {
            try {
                const dataUrl = await svgToPng(svg);
                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.cssText = 'max-width: 100%; height: auto; margin: 0.5em 0;';
                img.alt = 'SVG Image';
                svg.parentNode.replaceChild(img, svg);
            } catch (err) {
                console.warn('Failed to convert SVG to image:', err);
                // Leave as SVG if conversion fails
            }
        }
        
        // 5. Process Math equations - KaTeX renders to HTML, might have SVG
        // Leave as-is since KaTeX HTML generally copies well
        
        // 6. Tables are already HTML tables from the built-in renderer
        // No processing needed
        
        // Wrap in proper HTML structure for rich text editors
        const htmlContent = `
            <html xmlns:v="urn:schemas-microsoft-com:vml"
                  xmlns:o="urn:schemas-microsoft-com:office:office"
                  xmlns:w="urn:schemas-microsoft-com:office:word">
              <head>
                <meta charset="utf-8">
                <style>
                  /* Table styling */
                  table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
                  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                  th { background-color: #f0f0f0; font-weight: bold; }
                  
                  /* Code block styling */
                  pre { background-color: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto; }
                  code { font-family: monospace; background-color: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
                  
                  /* Image handling */
                  img { display: block; max-width: 100%; height: auto; margin: 0.5em 0; }
                  
                  /* Blockquote */
                  blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em; color: #666; }
                </style>
              </head>
              <body>
                ${clone.innerHTML}
              </body>
            </html>`;
        
        // Get plain text version
        const text = clone.textContent || clone.innerText || '';
        
        // Detect platform for clipboard strategy
        const isMacOS = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
        
        // Copy to clipboard with both HTML and plain text
        if (navigator.clipboard && navigator.clipboard.write) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([htmlContent], { type: 'text/html' }),
                        'text/plain': new Blob([text], { type: 'text/plain' })
                    })
                ]);
                return { success: true, html: htmlContent, text };
            } catch (err) {
                console.warn('Modern clipboard API failed, trying fallback:', err);
                
                // Fallback for Safari/older browsers
                if (isMacOS) {
                    // Try the textarea fallback method
                    const result = await copyWithFallback(htmlContent, text);
                    if (result) {
                        return { success: true, html: htmlContent, text };
                    }
                }
            }
        }
        
        // Final fallback to plain text
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return { success: true, text };
        }
        
        throw new Error('No clipboard API available');
        
    } catch (err) {
        console.error('Failed to copy rendered content:', err);
        throw err;
    }
}

/**
 * Fallback copy method using textarea
 * @param {string} html - HTML content to copy
 * @param {string} text - Plain text content to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyWithFallback(html, text) {
    return new Promise((resolve) => {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = html;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            resolve(success);
        } catch (err) {
            console.error('Fallback copy failed:', err);
            resolve(false);
        }
    });
}