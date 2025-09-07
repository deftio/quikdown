/**
 * Rich copy functionality for QuikdownEditor
 * Handles copying rendered content with proper formatting for pasting into rich text editors
 */

/**
 * Get platform information
 * @returns {string} The detected platform: 'macos', 'windows', 'linux', or 'unknown'
 */
function getPlatform() {
    const platform = navigator.platform?.toLowerCase() || '';
    const userAgent = navigator.userAgent?.toLowerCase() || '';
    
    if (platform.includes('mac') || userAgent.includes('mac')) {
        return 'macos';
    } else if (userAgent.includes('windows')) {
        return 'windows';
    } else if (userAgent.includes('linux')) {
        return 'linux';
    }
    return 'unknown';
}

/**
 * Copy to clipboard using textarea fallback (for Safari)
 * @param {string} html - HTML content to copy
 * @returns {boolean} Success status
 */
function copyToClipboard(html) {
    let textarea;
    let result;
    
    try {
        textarea = document.createElement('textarea');
        textarea.setAttribute('readonly', true);
        textarea.setAttribute('contenteditable', true);
        textarea.style.position = 'fixed';
        textarea.style.left = '0';
        textarea.style.top = '0';
        textarea.style.width = '1px';
        textarea.style.height = '1px';
        textarea.style.padding = '0';
        textarea.style.border = 'none';
        textarea.style.outline = 'none';
        textarea.style.boxShadow = 'none';
        textarea.style.background = 'transparent';
        textarea.value = html;
        
        document.body.appendChild(textarea);
        
        // Select the text
        textarea.focus();
        textarea.select();
        
        // For iOS Safari
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textarea.setSelectionRange(0, textarea.value.length);
        
        // Try to copy
        result = document.execCommand('copy');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        result = false;
    } finally {
        if (textarea && textarea.parentNode) {
            document.body.removeChild(textarea);
        }
    }
    
    return result;
}

/**
 * Convert SVG to PNG blob (based on squibview's implementation)
 * @param {SVGElement} svgElement - The SVG element to convert
 * @returns {Promise<Blob>} A promise that resolves with the PNG blob
 */
async function svgToPng(svgElement) {
    return new Promise((resolve, reject) => {
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        const scale = 2;
        
        // Check if this is a Mermaid-generated SVG (they don't have explicit width/height attributes)
        const isMermaidSvg = svgElement.closest('.mermaid') || svgElement.classList.contains('mermaid');
        const hasExplicitDimensions = svgElement.getAttribute('width') && svgElement.getAttribute('height');
        
        let svgWidth, svgHeight;
        
        if (isMermaidSvg || !hasExplicitDimensions) {
            // For Mermaid or other generated SVGs, prioritize computed dimensions
            svgWidth = svgElement.clientWidth || 
                       (svgElement.viewBox && svgElement.viewBox.baseVal.width) || 
                       parseFloat(svgElement.getAttribute('width')) || 400;
            svgHeight = svgElement.clientHeight || 
                        (svgElement.viewBox && svgElement.viewBox.baseVal.height) || 
                        parseFloat(svgElement.getAttribute('height')) || 300;
        } else {
            // For explicit SVGs (like fenced SVG blocks), prioritize explicit attributes
            svgWidth = parseFloat(svgElement.getAttribute('width')) || 
                       (svgElement.viewBox && svgElement.viewBox.baseVal.width) || 
                       svgElement.clientWidth || 400;
            svgHeight = parseFloat(svgElement.getAttribute('height')) || 
                        (svgElement.viewBox && svgElement.viewBox.baseVal.height) || 
                        svgElement.clientHeight || 300;
        }
        
        // Ensure the SVG string has explicit dimensions by modifying it if necessary
        let modifiedSvgString = svgString;
        if (svgWidth && svgHeight) {
            // Create a temporary SVG element to modify the serialized string
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svgString;
            const tempSvg = tempDiv.querySelector('svg');
            if (tempSvg) {
                tempSvg.setAttribute('width', svgWidth.toString());
                tempSvg.setAttribute('height', svgHeight.toString());
                modifiedSvgString = new XMLSerializer().serializeToString(tempSvg);
            }
        }
        
        canvas.width = svgWidth * scale;
        canvas.height = svgHeight * scale;
        ctx.scale(scale, scale);
        
        img.onload = () => {
            try {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
                canvas.toBlob(blob => {
                    resolve(blob);
                }, 'image/png', 1.0);
            } catch (err) {
                reject(err);
            }
        };
        
        img.onerror = reject;
        // Use data URI instead of blob URL to avoid tainting the canvas
        const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(modifiedSvgString)}`;
        img.src = svgDataUrl;
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
                    // Look for canvas element in the original container (Three.js WebGL canvas)
                    const canvas = originalContainer.querySelector('canvas');
                    if (canvas && canvas.width > 0 && canvas.height > 0) {
                        try {
                            // Get Three.js references stored on the container (like squibview)
                            const renderer = originalContainer._threeRenderer;
                            const scene = originalContainer._threeScene;
                            const camera = originalContainer._threeCamera;
                            
                            // If we have access to the Three.js objects, force render the scene
                            if (renderer && scene && camera) {
                                renderer.render(scene, camera);
                            }
                            
                            // Try to capture the canvas as an image
                            const dataUrl = canvas.toDataURL('image/png', 1.0);
                            const img = document.createElement('img');
                            img.src = dataUrl;
                            
                            // Use canvas dimensions for the image
                            const imgWidth = canvas.width / 2; // Divide by scale factor (2x for retina)
                            const imgHeight = canvas.height / 2;
                            
                            // Set both HTML attributes and CSS properties for maximum compatibility
                            img.width = imgWidth;
                            img.height = imgHeight;
                            img.setAttribute('width', imgWidth.toString());
                            img.setAttribute('height', imgHeight.toString());
                            img.style.width = imgWidth + 'px';
                            img.style.height = imgHeight + 'px';
                            img.style.maxWidth = 'none';
                            img.style.maxHeight = 'none';
                            img.style.border = '1px solid #ddd';
                            img.style.borderRadius = '4px';
                            img.style.margin = '0.5em 0';
                            img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                            img.alt = 'STL 3D Model';
                            
                            container.parentNode.replaceChild(img, container);
                            continue;
                        } catch (canvasErr) {
                            console.warn('Failed to convert STL canvas to image (likely WebGL context issue):', canvasErr);
                        }
                    } else {
                        console.warn('No valid canvas found in STL container');
                    }
                } else {
                    console.warn('Could not find original STL container');
                }
            } catch (err) {
                console.error('Error processing STL container for copy:', err);
            }
            
            // Fallback to placeholder if canvas conversion fails
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
                    const pngBlob = await svgToPng(svg);
                    const dataUrl = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(pngBlob);
                    });
                    
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    
                    // Use the exact same dimension calculation logic as svgToPng (like squibview)
                    const isMermaidSvg = svg.closest('.mermaid') || svg.classList.contains('mermaid');
                    const hasExplicitDimensions = svg.getAttribute('width') && svg.getAttribute('height');
                    
                    let imgWidth, imgHeight;
                    
                    if (isMermaidSvg || !hasExplicitDimensions) {
                        // For Mermaid or other generated SVGs, prioritize computed dimensions
                        imgWidth = svg.clientWidth || 
                                   (svg.viewBox && svg.viewBox.baseVal.width) || 
                                   parseFloat(svg.getAttribute('width')) || 400;
                        imgHeight = svg.clientHeight || 
                                    (svg.viewBox && svg.viewBox.baseVal.height) || 
                                    parseFloat(svg.getAttribute('height')) || 300;
                    } else {
                        // For explicit SVGs (like fenced SVG blocks), prioritize explicit attributes
                        imgWidth = parseFloat(svg.getAttribute('width')) || 
                                   (svg.viewBox && svg.viewBox.baseVal.width) || 
                                   svg.clientWidth || 400;
                        imgHeight = parseFloat(svg.getAttribute('height')) || 
                                    (svg.viewBox && svg.viewBox.baseVal.height) || 
                                    svg.clientHeight || 300;
                    }
                    
                    // Set both HTML attributes and CSS properties for maximum compatibility (like squibview)
                    img.width = imgWidth;
                    img.height = imgHeight;
                    img.setAttribute('width', imgWidth.toString());
                    img.setAttribute('height', imgHeight.toString());
                    img.style.width = imgWidth + 'px';
                    img.style.height = imgHeight + 'px';
                    img.style.maxWidth = 'none';  // Prevent CSS from constraining the image
                    img.style.maxHeight = 'none';
                    img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
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
                            
                            // Use canvas dimensions for the image
                            const imgWidth = canvas.width;
                            const imgHeight = canvas.height;
                            
                            // Set both HTML attributes and CSS properties for maximum compatibility
                            img.width = imgWidth;
                            img.height = imgHeight;
                            img.setAttribute('width', imgWidth.toString());
                            img.setAttribute('height', imgHeight.toString());
                            img.style.width = imgWidth + 'px';
                            img.style.height = imgHeight + 'px';
                            img.style.maxWidth = 'none';
                            img.style.maxHeight = 'none';
                            img.style.margin = '0.5em 0';
                            img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
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
                const pngBlob = await svgToPng(svg);
                const dataUrl = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(pngBlob);
                });
                
                const img = document.createElement('img');
                img.src = dataUrl;
                
                // Calculate dimensions for the SVG
                const hasExplicitDimensions = svg.getAttribute('width') && svg.getAttribute('height');
                
                let imgWidth, imgHeight;
                
                if (hasExplicitDimensions) {
                    // For explicit SVGs (like fenced SVG blocks), prioritize explicit attributes
                    imgWidth = parseFloat(svg.getAttribute('width')) || 
                               (svg.viewBox && svg.viewBox.baseVal.width) || 
                               svg.clientWidth || 400;
                    imgHeight = parseFloat(svg.getAttribute('height')) || 
                                (svg.viewBox && svg.viewBox.baseVal.height) || 
                                svg.clientHeight || 300;
                } else {
                    // For generated SVGs, prioritize computed dimensions
                    imgWidth = svg.clientWidth || 
                               (svg.viewBox && svg.viewBox.baseVal.width) || 
                               parseFloat(svg.getAttribute('width')) || 400;
                    imgHeight = svg.clientHeight || 
                                (svg.viewBox && svg.viewBox.baseVal.height) || 
                                parseFloat(svg.getAttribute('height')) || 300;
                }
                
                // Set both HTML attributes and CSS properties for maximum compatibility
                img.width = imgWidth;
                img.height = imgHeight;
                img.setAttribute('width', imgWidth.toString());
                img.setAttribute('height', imgHeight.toString());
                img.style.width = imgWidth + 'px';
                img.style.height = imgHeight + 'px';
                img.style.maxWidth = 'none';  // Prevent CSS from constraining the image
                img.style.maxHeight = 'none';
                img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
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
        
        // Get platform for clipboard strategy (like squibview)
        const platform = getPlatform();
        
        if (platform === 'macos') {
            // macOS approach (like squibview)
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([htmlContent], { type: 'text/html' }),
                        'text/plain': new Blob([text], { type: 'text/plain' })
                    })
                ]);
                return { success: true, html: htmlContent, text };
            } catch (modernErr) {
                console.warn('Modern clipboard API failed, trying Safari fallback:', modernErr);
                // Safari fallback
                if (copyToClipboard(htmlContent)) {
                    return { success: true, html: htmlContent, text };
                }
                throw new Error('Fallback copy failed');
            }
        } else {
            // Windows/Linux approach (like squibview)
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'fixed';
            tempDiv.style.left = '-9999px';
            tempDiv.style.top = '0';
            tempDiv.innerHTML = htmlContent;
            document.body.appendChild(tempDiv);
            
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([htmlContent], { type: 'text/html' }),
                        'text/plain': new Blob([text], { type: 'text/plain' })
                    })
                ]);
                return { success: true, html: htmlContent, text };
            } catch (modernErr) {
                console.warn('Modern clipboard API failed, trying execCommand fallback:', modernErr);
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(tempDiv);
                selection.removeAllRanges();
                selection.addRange(range);
                
                const successful = document.execCommand('copy');
                if (!successful) {
                    throw new Error('Fallback copy failed');
                }
                return { success: true, html: htmlContent, text };
            } finally {
                if (tempDiv && tempDiv.parentNode) {
                    document.body.removeChild(tempDiv);
                }
            }
        }
        
    } catch (err) {
        console.error('Failed to copy rendered content:', err);
        throw err;
    }
}

