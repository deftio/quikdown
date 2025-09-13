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
 * Copy to clipboard using HTML selection fallback (for Safari)
 * Uses div with selection to preserve HTML formatting
 * @param {string} html - HTML content to copy
 * @returns {boolean} Success status
 */
function copyToClipboard(html) {
    let tempDiv;
    let result;
    
    try {
        // Use a div instead of textarea to preserve HTML formatting
        tempDiv = document.createElement('div');
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.style.width = '1px';
        tempDiv.style.height = '1px';
        tempDiv.style.overflow = 'hidden';
        tempDiv.innerHTML = html;
        
        document.body.appendChild(tempDiv);
        
        // Select the HTML content
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Try to copy
        result = document.execCommand('copy');
        
        // Clear selection
        selection.removeAllRanges();
    } catch (err) {
        console.error('Fallback copy failed:', err);
        result = false;
    } finally {
        if (tempDiv && tempDiv.parentNode) {
            document.body.removeChild(tempDiv);
        }
    }
    
    return result;
}

/**
 * Convert SVG to PNG blob (based on squibview's implementation)
 * @param {SVGElement} svgElement - The SVG element to convert
 * @returns {Promise<Blob>} A promise that resolves with the PNG blob
 */
async function svgToPng(svgElement, needsWhiteBackground = false) {
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
                // Add white background for math equations (they often have transparent backgrounds)
                if (needsWhiteBackground) {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                
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
 * Rasterize a GeoJSON Leaflet map to PNG data URL (following Gem's guide)
 * @param {HTMLElement} liveContainer - The live map container element
 * @returns {Promise<string|null>} PNG data URL or null if failed
 */
async function rasterizeGeoJSONMap(liveContainer) {
    try {
        const map = liveContainer._map;
        if (!map) {
            console.warn('No map found on container');
            return null;
        }
        
        // Get container dimensions
        const mapRect = liveContainer.getBoundingClientRect();
        const width = Math.round(mapRect.width);
        const height = Math.round(mapRect.height);
        
        if (width === 0 || height === 0) {
            console.warn('Map container has zero dimensions');
            return null;
        }
        
        // Create canvas sized to the map container
        const canvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        
        // Set canvas size with DPR for sharpness
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        // 1. Draw tiles from THIS container only
        const tiles = liveContainer.querySelectorAll('.leaflet-tile');
        console.log(`Found ${tiles.length} tiles to capture`);
        
        const tilePromises = [];
        for (const tile of tiles) {
            tilePromises.push(new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    try {
                        // Calculate tile position relative to container
                        const tileRect = tile.getBoundingClientRect();
                        const offsetX = tileRect.left - mapRect.left;
                        const offsetY = tileRect.top - mapRect.top;
                        
                        // Draw tile at correct position
                        ctx.drawImage(img, offsetX, offsetY, tileRect.width, tileRect.height);
                        console.log(`Drew tile at ${offsetX}, ${offsetY}`);
                    } catch (err) {
                        console.warn('Failed to draw tile:', err);
                    }
                    resolve();
                };
                
                img.onerror = () => {
                    console.warn('Failed to load tile:', tile.src);
                    resolve();
                };
                
                img.src = tile.src;
            }));
        }
        
        // Wait for all tiles to load
        await Promise.all(tilePromises);
        
        // 2. Draw vector overlays (SVG paths for GeoJSON features)
        const svgOverlays = liveContainer.querySelectorAll('svg:not(.leaflet-attribution-flag)');
        console.log(`Found ${svgOverlays.length} SVG overlays`);
        
        for (const svg of svgOverlays) {
            // Skip attribution/control overlays
            if (svg.closest('.leaflet-control')) continue;
            
            try {
                const svgRect = svg.getBoundingClientRect();
                const offsetX = svgRect.left - mapRect.left;
                const offsetY = svgRect.top - mapRect.top;
                
                // Serialize SVG
                const serializer = new XMLSerializer();
                const svgStr = serializer.serializeToString(svg);
                const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                
                // Draw SVG overlay
                await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, offsetX, offsetY, svgRect.width, svgRect.height);
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(url);
                        reject(new Error('Failed to load SVG overlay'));
                    };
                    img.src = url;
                });
            } catch (err) {
                console.warn('Failed to draw SVG overlay:', err);
            }
        }
        
        // 3. Draw marker icons if any
        const markerIcons = liveContainer.querySelectorAll('.leaflet-marker-icon');
        console.log(`Found ${markerIcons.length} marker icons`);
        
        for (const marker of markerIcons) {
            try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                await new Promise((resolve) => {
                    img.onload = () => {
                        const markerRect = marker.getBoundingClientRect();
                        const offsetX = markerRect.left - mapRect.left;
                        const offsetY = markerRect.top - mapRect.top;
                        ctx.drawImage(img, offsetX, offsetY, markerRect.width, markerRect.height);
                        resolve();
                    };
                    img.onerror = resolve;
                    img.src = marker.src;
                });
            } catch (err) {
                console.warn('Failed to draw marker icon:', err);
            }
        }
        
        // Return PNG data URL
        return canvas.toDataURL('image/png', 1.0);
        
    } catch (error) {
        console.error('Failed to rasterize GeoJSON map:', error);
        return null;
    }
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
    
    // Check if MathJax needs to render (only if not already rendered)
    const mathBlocks = previewPanel.querySelectorAll('.math-display');
    if (mathBlocks.length > 0) {
        // Check if already rendered (has mjx-container inside)
        const needsRendering = Array.from(mathBlocks).some(block => !block.querySelector('mjx-container'));
        
        if (needsRendering && window.MathJax && window.MathJax.typesetPromise) {
            console.log('Waiting for MathJax to render...');
            try {
                await window.MathJax.typesetPromise(Array.from(mathBlocks));
            } catch (err) {
                console.warn('MathJax typesetting failed:', err);
            }
        } else {
            console.log('MathJax already rendered, skipping wait');
        }
    }
    
    // Clone the preview panel to avoid modifying the actual DOM
    const clone = previewPanel.cloneNode(true);
    
    // Process different fence types for rich copy
    try {
        // Phase 1: Process basic markdown elements with inline styles
        
        // 1.1 Text formatting - add inline styles
        clone.querySelectorAll('strong, b').forEach(el => {
            el.style.fontWeight = 'bold';
        });
        
        clone.querySelectorAll('em, i').forEach(el => {
            el.style.fontStyle = 'italic';
        });
        
        clone.querySelectorAll('del, s, strike').forEach(el => {
            el.style.textDecoration = 'line-through';
        });
        
        clone.querySelectorAll('u').forEach(el => {
            el.style.textDecoration = 'underline';
        });
        
        clone.querySelectorAll('code:not(pre code)').forEach(el => {
            el.style.backgroundColor = '#f4f4f4';
            el.style.padding = '2px 4px';
            el.style.borderRadius = '3px';
            el.style.fontFamily = 'monospace';
            el.style.fontSize = '0.9em';
        });
        
        // 1.2 Block elements - add inline styles
        clone.querySelectorAll('h1').forEach(el => {
            el.style.fontSize = '2em';
            el.style.fontWeight = 'bold';
            el.style.marginTop = '0.67em';
            el.style.marginBottom = '0.67em';
        });
        
        clone.querySelectorAll('h2').forEach(el => {
            el.style.fontSize = '1.5em';
            el.style.fontWeight = 'bold';
            el.style.marginTop = '0.83em';
            el.style.marginBottom = '0.83em';
        });
        
        clone.querySelectorAll('h3').forEach(el => {
            el.style.fontSize = '1.17em';
            el.style.fontWeight = 'bold';
            el.style.marginTop = '1em';
            el.style.marginBottom = '1em';
        });
        
        clone.querySelectorAll('h4').forEach(el => {
            el.style.fontSize = '1em';
            el.style.fontWeight = 'bold';
            el.style.marginTop = '1.33em';
            el.style.marginBottom = '1.33em';
        });
        
        clone.querySelectorAll('h5').forEach(el => {
            el.style.fontSize = '0.83em';
            el.style.fontWeight = 'bold';
            el.style.marginTop = '1.67em';
            el.style.marginBottom = '1.67em';
        });
        
        clone.querySelectorAll('h6').forEach(el => {
            el.style.fontSize = '0.67em';
            el.style.fontWeight = 'bold';
            el.style.marginTop = '2.33em';
            el.style.marginBottom = '2.33em';
        });
        
        clone.querySelectorAll('blockquote').forEach(el => {
            el.style.borderLeft = '4px solid #ddd';
            el.style.marginLeft = '0';
            el.style.paddingLeft = '1em';
            el.style.color = '#666';
        });
        
        clone.querySelectorAll('hr').forEach(el => {
            el.style.border = 'none';
            el.style.borderTop = '1px solid #ccc';
            el.style.margin = '1em 0';
        });
        
        // 1.3 Tables - add inline styles
        clone.querySelectorAll('table').forEach(table => {
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.marginBottom = '1em';
        });
        
        clone.querySelectorAll('th').forEach(th => {
            th.style.border = '1px solid #ccc';
            th.style.padding = '8px';
            th.style.textAlign = 'left';
            th.style.backgroundColor = '#f0f0f0';
            th.style.fontWeight = 'bold';
        });
        
        clone.querySelectorAll('td').forEach(td => {
            td.style.border = '1px solid #ccc';
            td.style.padding = '8px';
            td.style.textAlign = 'left';
        });
        
        // 1.4 Links - add inline styles
        clone.querySelectorAll('a').forEach(a => {
            a.style.color = '#0066cc';
            a.style.textDecoration = 'underline';
        });
        
        // Process code blocks - wrap in table and add syntax highlighting colors
        clone.querySelectorAll('pre code').forEach(block => {
            const pre = block.parentElement;
            
            // Add inline styles for syntax highlighting (GitHub theme colors)
            if (block.classList.contains('hljs')) {
                // Apply inline styles to all highlight.js elements
                block.querySelectorAll('.hljs-keyword').forEach(el => {
                    el.style.color = '#d73a49';
                    el.style.fontWeight = 'bold';
                });
                block.querySelectorAll('.hljs-string').forEach(el => {
                    el.style.color = '#032f62';
                });
                block.querySelectorAll('.hljs-number').forEach(el => {
                    el.style.color = '#005cc5';
                });
                block.querySelectorAll('.hljs-comment').forEach(el => {
                    el.style.color = '#6a737d';
                    el.style.fontStyle = 'italic';
                });
                block.querySelectorAll('.hljs-function').forEach(el => {
                    el.style.color = '#6f42c1';
                });
                block.querySelectorAll('.hljs-class').forEach(el => {
                    el.style.color = '#6f42c1';
                });
                block.querySelectorAll('.hljs-title').forEach(el => {
                    el.style.color = '#6f42c1';
                });
                block.querySelectorAll('.hljs-built_in').forEach(el => {
                    el.style.color = '#005cc5';
                });
                block.querySelectorAll('.hljs-literal').forEach(el => {
                    el.style.color = '#005cc5';
                });
                block.querySelectorAll('.hljs-meta').forEach(el => {
                    el.style.color = '#005cc5';
                });
                block.querySelectorAll('.hljs-attr').forEach(el => {
                    el.style.color = '#22863a';
                });
                block.querySelectorAll('.hljs-variable').forEach(el => {
                    el.style.color = '#e36209';
                });
                block.querySelectorAll('.hljs-regexp').forEach(el => {
                    el.style.color = '#032f62';
                });
                block.querySelectorAll('.hljs-selector-class').forEach(el => {
                    el.style.color = '#22863a';
                });
                block.querySelectorAll('.hljs-selector-id').forEach(el => {
                    el.style.color = '#6f42c1';
                });
                block.querySelectorAll('.hljs-selector-tag').forEach(el => {
                    el.style.color = '#22863a';
                });
                block.querySelectorAll('.hljs-tag').forEach(el => {
                    el.style.color = '#22863a';
                });
                block.querySelectorAll('.hljs-name').forEach(el => {
                    el.style.color = '#22863a';
                });
                block.querySelectorAll('.hljs-attribute').forEach(el => {
                    el.style.color = '#6f42c1';
                });
            }
            
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.border = 'none';
            table.style.marginBottom = '1em';
            
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.style.backgroundColor = '#f7f7f7';
            td.style.padding = '12px';
            td.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
            td.style.fontSize = '14px';
            td.style.lineHeight = '1.4';
            td.style.whiteSpace = 'pre';
            td.style.overflowX = 'auto';
            td.style.border = '1px solid #ddd';
            td.style.borderRadius = '4px';
            
            // Move the formatted code content with inline styles
            td.innerHTML = block.innerHTML;
            
            tr.appendChild(td);
            table.appendChild(tr);
            
            // Replace the pre element with the table
            pre.parentNode.replaceChild(table, pre);
        });
        
        // Process images - convert to data URLs and ensure proper dimensions
        const images = clone.querySelectorAll('img');
        for (const img of images) {
            // Ensure image has dimensions for Google Docs compatibility
            if (!img.width && img.naturalWidth) {
                img.width = img.naturalWidth;
            }
            if (!img.height && img.naturalHeight) {
                img.height = img.naturalHeight;
            }
            
            // Set max dimensions to prevent huge images
            const maxWidth = 800;
            const maxHeight = 600;
            if (img.width > maxWidth || img.height > maxHeight) {
                const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                img.width = Math.round(img.width * scale);
                img.height = Math.round(img.height * scale);
            }
            
            // Ensure width and height attributes are set
            if (img.width) {
                img.setAttribute('width', img.width.toString());
                img.style.width = img.width + 'px';
            }
            if (img.height) {
                img.setAttribute('height', img.height.toString());
                img.style.height = img.height + 'px';
            }
            
            // Add v:shapes for Word compatibility
            if (!img.getAttribute('v:shapes')) {
                img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
            }
            
            // Skip if already a data URL
            if (img.src && !img.src.startsWith('data:')) {
                try {
                    // Try to convert to data URL
                    const response = await fetch(img.src);
                    const blob = await response.blob();
                    
                    // Check if image is too large (Google Docs has limits)
                    const maxSize = 2 * 1024 * 1024; // 2MB limit for inline images
                    if (blob.size > maxSize) {
                        console.warn('Image too large for inline data URL:', img.src, 'Size:', blob.size);
                        // For large images, we might want to resize or keep the URL
                        continue;
                    }
                    
                    const dataUrl = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    img.src = dataUrl;
                } catch (err) {
                    console.warn('Failed to convert image to data URL:', img.src, err);
                    // Keep original src if conversion fails
                }
            }
        }
        
        // Phase 2: Process fence block types
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
        
        // 5. Process Math equations - convert to PNG images (exactly like squibview)
        const mathElements = Array.from(clone.querySelectorAll('.math-display'));
        
        // Process math elements - try keeping the SVG directly first
        if (mathElements.length > 0) {
            console.log(`Processing ${mathElements.length} math elements`);
            for (const mathEl of mathElements) {
                try {
                    // Check what's inside the math element
                    const mjxContainer = mathEl.querySelector('mjx-container');
                    console.log('Math element structure:', {
                        id: mathEl.id,
                        hasMjxContainer: !!mjxContainer,
                        hasSVG: !!mathEl.querySelector('svg')
                    });
                    
                    // Look for SVG to convert to PNG (use original DOM for accurate sizing)
                    let svg = null;
                    try {
                        const origMath = mathEl.id ? previewPanel.querySelector(`#${mathEl.id}`) : null;
                        svg = (origMath && origMath.querySelector('svg')) || mathEl.querySelector('svg');
                    } catch (_) {
                        svg = mathEl.querySelector('svg');
                    }
                    if (!svg) {
                        console.warn('No SVG found in math element, skipping');
                        continue;
                    }
                    
                    // Convert SVG to PNG data URL using squibview-like normalization
                    const serializer = new XMLSerializer();
                    let svgStr = serializer.serializeToString(svg);
                    // Normalize: ensure xmlns, replace currentColor, convert ex->px, ensure viewBox
                    try {
                        svgStr = svgStr.replace(/currentColor/g, 'black');
                        const tdiv = document.createElement('div');
                        tdiv.innerHTML = svgStr;
                        const ts = tdiv.querySelector('svg');
                        if (ts) {
                            if (!ts.hasAttribute('xmlns')) {
                                ts.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                            }
                            if (!ts.hasAttribute('xmlns:xlink')) {
                                ts.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
                            }
                            const exToPx = (val) => {
                                if (!val) return null;
                                if (/ex$/i.test(val)) {
                                    const num = parseFloat(val);
                                    if (!isNaN(num)) return String(Math.round(num * 8));
                                }
                                if (/px$/i.test(val)) {
                                    return String(parseFloat(val));
                                }
                                const num = parseFloat(val);
                                return isNaN(num) ? null : String(num);
                            };
                            const w = ts.getAttribute('width');
                            const h = ts.getAttribute('height');
                            const wPx = exToPx(w);
                            const hPx = exToPx(h);
                            if (wPx) ts.setAttribute('width', wPx);
                            if (hPx) ts.setAttribute('height', hPx);
                            if (!ts.hasAttribute('viewBox')) {
                                const vw = wPx ? parseFloat(wPx) : (ts.viewBox && ts.viewBox.baseVal ? ts.viewBox.baseVal.width : null);
                                const vh = hPx ? parseFloat(hPx) : (ts.viewBox && ts.viewBox.baseVal ? ts.viewBox.baseVal.height : null);
                                if (vw && vh) ts.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
                            }
                            svgStr = new XMLSerializer().serializeToString(ts);
                        }
                    } catch (_) {}
                    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
                    const url = URL.createObjectURL(svgBlob);
                    
                    const img = new Image();
                    const dataUrl = await new Promise((resolve, reject) => {
                        img.onload = function () {
                            const canvas = document.createElement('canvas');
                            
                            // Prefer the on-screen rendered size from the ORIGINAL element
                            let rect = { width: 0, height: 0 };
                            try {
                                rect = svg.getBoundingClientRect();
                            } catch (_) {}
                            let width = Math.round(rect.width);
                            let height = Math.round(rect.height);
                            let usedRect = width > 0 && height > 0;

                            if (!usedRect) {
                                // Fallback: try absolute units or viewBox
                                try {
                                    width = svg.width.baseVal.value;
                                    height = svg.height.baseVal.value;
                                } catch (e) {
                                    if (svg.viewBox && svg.viewBox.baseVal) {
                                        width = svg.viewBox.baseVal.width;
                                        height = svg.viewBox.baseVal.height;
                                    } else {
                                        width = img.naturalWidth || img.width || 200;
                                        height = img.naturalHeight || img.height || 50;
                                    }
                                }
                            }
                            
                            // Target constraints
                            const targetMaxWidth = 300;
                            const targetMaxHeight = 100;
                            
                            // If we used screen rect, don't apply base 0.10 shrink
                            let scaleFactor = usedRect ? 1.0 : 0.10;
                            
                            let scaledWidth = width * scaleFactor;
                            let scaledHeight = height * scaleFactor;
                            if (scaledWidth > targetMaxWidth || scaledHeight > targetMaxHeight) {
                                const scaleX = targetMaxWidth / scaledWidth;
                                const scaleY = targetMaxHeight / scaledHeight;
                                scaleFactor *= Math.min(scaleX, scaleY);
                                scaledWidth = width * scaleFactor;
                                scaledHeight = height * scaleFactor;
                            }
                            width = Math.max(1, Math.round(scaledWidth));
                            height = Math.max(1, Math.round(scaledHeight));
                            
                            // Use device pixel ratio for crisp rasterization
                            const dpr = Math.max(1, window.devicePixelRatio || 1);
                            canvas.width = Math.round(width * dpr);
                            canvas.height = Math.round(height * dpr);
                            const ctx = canvas.getContext('2d');
                            ctx.scale(dpr, dpr);
                            
                            // White background
                            ctx.fillStyle = "#FFFFFF";
                            ctx.fillRect(0, 0, width, height);
                            
                            // Draw the SVG image at logical size
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            // Debug: Check if anything was drawn
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const pixels = imageData.data;
                            let nonWhitePixels = 0;
                            for (let i = 0; i < pixels.length; i += 4) {
                                if (pixels[i] !== 255 || pixels[i+1] !== 255 || pixels[i+2] !== 255) {
                                    nonWhitePixels++;
                                }
                            }
                            console.log(`Canvas ${canvas.width}x${canvas.height}, non-white pixels: ${nonWhitePixels}/${pixels.length/4} (${(nonWhitePixels/(pixels.length/4)*100).toFixed(2)}%)`);
                            
                            // Clean up URL
                            URL.revokeObjectURL(url);
                            
                            // Return data URL
                            const dataUrl = canvas.toDataURL('image/png', 1.0);
                            console.log('Generated data URL length:', dataUrl.length);
                            resolve(dataUrl);
                        };
                        
                        img.onerror = () => {
                            URL.revokeObjectURL(url);
                            reject(new Error('Failed to load SVG image'));
                        };
                        
                        img.src = url;
                    });
                    
                    // Replace math element with img tag containing the PNG data URL
                    const imgElement = document.createElement('img');
                    imgElement.src = dataUrl;
                    imgElement.style.cssText = 'display:inline-block;margin:0.5em 0;vertical-align:middle;';
                    // Set explicit dimensions for better paste behavior
                    try {
                        const probe = new Image();
                        probe.src = dataUrl;
                        await new Promise((resolve) => { probe.onload = resolve; probe.onerror = resolve; });
                        if (probe.width && probe.height) {
                            imgElement.width = probe.width / (window.devicePixelRatio || 1);
                            imgElement.height = probe.height / (window.devicePixelRatio || 1);
                            imgElement.style.width = imgElement.width + 'px';
                            imgElement.style.height = imgElement.height + 'px';
                        }
                    } catch (_) {}
                    imgElement.alt = 'Math equation';
                    
                    console.log('Replacing math element with image, data URL starts with:', dataUrl.substring(0, 50));
                    mathEl.parentNode.replaceChild(imgElement, mathEl);
                    console.log('Replacement complete, img element created');
                } catch (error) {
                    console.error('Failed to convert math element:', error);
                    // Keep track of failure
                    console.log('Math element that failed:', mathEl.innerHTML);
                    // Mark the element so we can see it failed
                    mathEl.style.border = '2px solid red';
                }
            }
        }
        
        // 2. Process GeoJSON maps - convert to static images (following Gem's guide)
        const geojsonContainers = clone.querySelectorAll('.geojson-container');
        if (geojsonContainers.length > 0) {
            console.log(`Processing ${geojsonContainers.length} GeoJSON containers`);
            
            for (const clonedContainer of geojsonContainers) {
                try {
                    // Find the corresponding live container by matching data-original-source
                    const originalSource = clonedContainer.getAttribute('data-original-source');
                    if (!originalSource) {
                        console.warn('No original source found for GeoJSON container');
                        continue;
                    }
                    
                    // Find live container with same source
                    let liveContainer = null;
                    const allLiveContainers = previewPanel.querySelectorAll('.geojson-container');
                    for (const candidate of allLiveContainers) {
                        if (candidate.getAttribute('data-original-source') === originalSource) {
                            liveContainer = candidate;
                            break;
                        }
                    }
                    
                    if (!liveContainer) {
                        console.warn('Could not find live GeoJSON container');
                        const placeholder = document.createElement('div');
                        placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                        placeholder.textContent = '[GeoJSON Map - Interactive content not available in copy]';
                        clonedContainer.parentNode.replaceChild(placeholder, clonedContainer);
                        continue;
                    }
                    
                    // Check if map is ready
                    const map = liveContainer._map;
                    if (!map) {
                        console.warn('Map not initialized yet');
                        const placeholder = document.createElement('div');
                        placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                        placeholder.textContent = '[GeoJSON Map - Still loading]';
                        clonedContainer.parentNode.replaceChild(placeholder, clonedContainer);
                        continue;
                    }
                    
                    // Rasterize the map to PNG
                    const dataUrl = await rasterizeGeoJSONMap(liveContainer);
                    
                    if (dataUrl) {
                        // Replace with image
                        const img = document.createElement('img');
                        img.src = dataUrl;
                        img.style.cssText = 'width: 100%; height: 300px; border: 1px solid #ddd; border-radius: 4px; margin: 0.5em 0;';
                        img.alt = 'GeoJSON Map';
                        clonedContainer.parentNode.replaceChild(img, clonedContainer);
                    } else {
                        // Fallback placeholder
                        const placeholder = document.createElement('div');
                        placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                        placeholder.textContent = '[GeoJSON Map - Interactive content not available in copy]';
                        clonedContainer.parentNode.replaceChild(placeholder, clonedContainer);
                    }
                    
                } catch (error) {
                    console.error('Failed to process GeoJSON container:', error);
                    // Replace with placeholder
                    const placeholder = document.createElement('div');
                    placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                    placeholder.textContent = '[GeoJSON Map - Interactive content not available in copy]';
                    clonedContainer.parentNode.replaceChild(placeholder, clonedContainer);
                }
            }
        }
        
        
        /* OLD PROCESSING REMOVED - using squibview's simpler approach above
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = svgStr;
                    const tempSvg = tempDiv.querySelector('svg');
                    if (tempSvg) {
                        // Ensure SVG has the namespace
                        if (!tempSvg.hasAttribute('xmlns')) {
                            tempSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        }
                        tempSvg.setAttribute('width', width.toString());
                        tempSvg.setAttribute('height', height.toString());
                        // Also set viewBox if not present
                        if (!tempSvg.hasAttribute('viewBox')) {
                            tempSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
                        }
                        svgStr = new XMLSerializer().serializeToString(tempSvg);
                    }
                    
                    // Scale math images - MathJax viewBox dimensions are very large
                    const targetMaxWidth = 300;   // Target max width for math images  
                    const targetMaxHeight = 100;  // Target max height for math images
                    
                    // Apply base scale factor for MathJax SVGs which have oversized viewBox
                    let scaleFactor = 0.10; // Base scale as per squibview
                    
                    let finalWidth = width * scaleFactor;
                    let finalHeight = height * scaleFactor;
                    
                    // If still too large after base scaling, scale down further
                    if (finalWidth > targetMaxWidth || finalHeight > targetMaxHeight) {
                        const additionalScale = Math.min(targetMaxWidth / finalWidth, targetMaxHeight / finalHeight);
                        finalWidth *= additionalScale;
                        finalHeight *= additionalScale;
                    }
                    
                    console.log('Math scaling:', {
                        original: { width, height },
                        scaleFactor: scaleFactor,
                        final: { finalWidth, finalHeight }
                    });
                    
                    // Create canvas (no scaling - exactly like squibview)
                    const canvas = document.createElement('canvas');
                    canvas.width = finalWidth;
                    canvas.height = finalHeight;
                    const ctx = canvas.getContext('2d');
                    
                    // White background
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // Try blob URL approach like squibview  
                    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
                    const blobUrl = URL.createObjectURL(svgBlob);
                    
                    const img = new Image();
                    const dataUrl = await new Promise((resolve, reject) => {
                        img.onload = function() {
                            console.log('SVG Image loaded:', {
                                naturalWidth: img.naturalWidth,
                                naturalHeight: img.naturalHeight,
                                width: img.width,
                                height: img.height
                            });
                            try {
                                // Draw the image to fill the entire canvas
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                
                                // Check what was drawn - sample a few pixels
                                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                
                                // Count non-white pixels to see if anything was drawn
                                let nonWhiteCount = 0;
                                for (let i = 0; i < imageData.data.length; i += 4) {
                                    const r = imageData.data[i];
                                    const g = imageData.data[i + 1];
                                    const b = imageData.data[i + 2];
                                    if (r !== 255 || g !== 255 || b !== 255) {
                                        nonWhiteCount++;
                                    }
                                }
                                
                                console.log('Canvas pixel analysis:', {
                                    canvasSize: { width: canvas.width, height: canvas.height },
                                    nonWhitePixels: nonWhiteCount,
                                    totalPixels: imageData.data.length / 4,
                                    percentNonWhite: (nonWhiteCount / (imageData.data.length / 4) * 100).toFixed(2) + '%'
                                });
                                
                                // Clean up blob URL
                                URL.revokeObjectURL(blobUrl);
                                
                                // Convert canvas to data URL
                                const pngDataUrl = canvas.toDataURL('image/png', 1.0);
                                resolve(pngDataUrl);
                            } catch (e) {
                                console.error('Error drawing MathJax SVG:', e);
                                URL.revokeObjectURL(blobUrl);
                                reject(e);
                            }
                        };
                        
                        img.onerror = (e) => {
                            console.error('Failed to load MathJax SVG:', e);
                            console.error('SVG that failed (first 500 chars):', svgStr.substring(0, 500));
                            URL.revokeObjectURL(blobUrl);
                            reject(new Error('Failed to load SVG'));
                        };
                        
                        img.src = blobUrl;
                    });
                    
                    // Replace math element with img tag
                    const imgElement = document.createElement('img');
                    imgElement.src = dataUrl;
                    imgElement.width = finalWidth;
                    imgElement.height = finalHeight;
                    imgElement.style.width = finalWidth + 'px';
                    imgElement.style.height = finalHeight + 'px';
                    imgElement.style.verticalAlign = 'middle';
                    imgElement.style.margin = '0.5em';
                    imgElement.alt = 'Math equation';
                    imgElement.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                    
                    console.log('Math converted to image:', {
                        dataUrlLength: dataUrl.length,
                        width: finalWidth,
                        height: finalHeight
                    });
                    
                    mathEl.parentNode.replaceChild(imgElement, mathEl);
                } catch (err) {
                    console.warn('Failed to convert math element:', err);
                }
            }
        }
        
        // Skip the fallback processing since we already handled all math containers above
        /* Removed duplicate math processing
        for (const mathEl of mathElements) {
            try {
                
                // Look for SVG in the math container (in case MathJax already processed it)
                // MathJax might have placed an mjx-container inside our container
                let svg = mathEl.querySelector('svg');
                if (!svg) {
                    const mjxContainer = mathEl.querySelector('mjx-container');
                    if (mjxContainer) {
                        svg = mjxContainer.querySelector('svg');
                    }
                }
                
                if (svg) {
                    // Handle SVG-based math (MathJax) - use same approach as mjx-container
                    const serializer = new XMLSerializer();
                    let svgStr = serializer.serializeToString(svg);
                    
                    // Get dimensions from SVG
                    const widthAttr = svg.getAttribute('width');
                    const heightAttr = svg.getAttribute('height');
                    
                    let width, height;
                    
                    // Use viewBox dimensions first (actual coordinate system)
                    if (svg.viewBox && svg.viewBox.baseVal) {
                        width = svg.viewBox.baseVal.width;
                        height = svg.viewBox.baseVal.height;
                    } else if (widthAttr && widthAttr.includes('ex')) {
                        width = parseFloat(widthAttr) * 8; // 1ex ≈ 8px
                        height = heightAttr ? parseFloat(heightAttr) * 8 : 50;
                    } else if (widthAttr) {
                        width = parseFloat(widthAttr);
                        height = heightAttr ? parseFloat(heightAttr) : 50;
                    } else {
                        width = 200;
                        height = 50;
                    }
                    
                    // Ensure SVG has explicit pixel dimensions
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = svgStr;
                    const tempSvg = tempDiv.querySelector('svg');
                    if (tempSvg) {
                        tempSvg.setAttribute('width', width.toString());
                        tempSvg.setAttribute('height', height.toString());
                        if (!tempSvg.hasAttribute('viewBox')) {
                            tempSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
                        }
                        svgStr = new XMLSerializer().serializeToString(tempSvg);
                    }
                            
                    // Scale down math images (same as mjx-container approach)
                    const targetMaxWidth = 300;
                    const targetMaxHeight = 100;
                    
                    // Apply base scale factor for MathJax SVGs
                    let scaleFactor = 0.10;
                    
                    let finalWidth = width * scaleFactor;
                    let finalHeight = height * scaleFactor;
                    
                    // If still too large after base scaling, scale down further
                    if (finalWidth > targetMaxWidth || finalHeight > targetMaxHeight) {
                        const additionalScale = Math.min(targetMaxWidth / finalWidth, targetMaxHeight / finalHeight);
                        finalWidth *= additionalScale;
                        finalHeight *= additionalScale;
                    }
                    
                    const scale = 2;
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = finalWidth * scale;
                    canvas.height = finalHeight * scale;
                    const ctx = canvas.getContext('2d');
                    
                    // White background (fill entire canvas)
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    const img = new Image();
                    const dataUrl = await new Promise((resolve, reject) => {
                        img.onload = function() {
                            try {
                                // Draw to entire canvas
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                const pngDataUrl = canvas.toDataURL('image/png', 1.0);
                                resolve(pngDataUrl);
                            } catch (e) {
                                console.error('Error drawing fallback MathJax SVG:', e);
                                reject(e);
                            }
                        };
                        
                        img.onerror = (e) => {
                            console.error('Failed to load fallback MathJax SVG:', e);
                            reject(new Error('Failed to load SVG'));
                        };
                        
                        // Use data URL
                        const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
                        img.src = svgDataUrl;
                    });
                    
                    const replacementImg = document.createElement('img');
                    replacementImg.src = dataUrl;
                    replacementImg.style.verticalAlign = 'middle';
                    replacementImg.style.margin = '0.5em';
                    replacementImg.alt = 'Math equation';
                    replacementImg.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                    
                    mathEl.parentNode.replaceChild(replacementImg, mathEl);
                } else {
                    // Handle HTML-based math (KaTeX) - use html2canvas approach
                    // For now, add inline styles to make it copy better
                    const katexEl = mathEl.querySelector('.katex');
                    if (katexEl) {
                        // Add inline styles for better copying
                        katexEl.style.fontSize = '1.21em';
                        katexEl.style.textAlign = 'center';
                        katexEl.style.margin = '0.5em';
                        katexEl.style.display = 'inline-block';
                        
                        // Make sure all child elements have proper styles
                        katexEl.querySelectorAll('*').forEach(el => {
                            const computed = window.getComputedStyle(el);
                            if (computed.fontFamily) el.style.fontFamily = computed.fontFamily;
                            if (computed.fontSize) el.style.fontSize = computed.fontSize;
                            if (computed.fontStyle) el.style.fontStyle = computed.fontStyle;
                            if (computed.fontWeight) el.style.fontWeight = computed.fontWeight;
                        });
                    }
                }
                
            } catch (error) {
                console.error('Failed to convert math element:', error);
            }
        }
        */
        
        // 6. Process GeoJSON/Leaflet maps - capture as single image (compose tiles + overlays)
        const mapContainers = clone.querySelectorAll('[data-qd-lang="geojson"]');
        for (const container of mapContainers) {
            try {
                const containerId = container.id;
                const originalContainer = containerId ? previewPanel.querySelector(`#${containerId}`) : null;
                if (!originalContainer) continue;
                const leafletContainer = originalContainer.querySelector('.leaflet-container');
                if (!leafletContainer) continue;

                const dpr = Math.max(1, window.devicePixelRatio || 1);
                const width = leafletContainer.clientWidth || 600;
                const height = leafletContainer.clientHeight || 400;
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
                const ctx = canvas.getContext('2d');
                ctx.scale(dpr, dpr);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                const leafRect = leafletContainer.getBoundingClientRect();

                // Draw tiles (snap to integer pixels to avoid seams)
                const tiles = Array.from(leafletContainer.querySelectorAll('img.leaflet-tile'));
                for (const tile of tiles) {
                    try {
                        const r = tile.getBoundingClientRect();
                        const x = Math.round(r.left - leafRect.left);
                        const y = Math.round(r.top - leafRect.top);
                        const w = Math.round(r.width);
                        const h = Math.round(r.height);
                        const overlaps = !(r.right <= leafRect.left || r.left >= leafRect.right || r.bottom <= leafRect.top || r.top >= leafRect.bottom);
                        const style = window.getComputedStyle(tile);
                        if (w > 0 && h > 0 && overlaps && style.display !== 'none' && style.visibility !== 'hidden') {
                            ctx.drawImage(tile, x, y, w + 1, h + 1);
                        }
                    } catch (e) {
                        console.warn('Failed to draw tile:', e);
                    }
                }

                // Draw SVG overlays (paths, markers)
                const overlaySvgs = originalContainer.querySelectorAll('.leaflet-overlay-pane svg');
                for (const svg of overlaySvgs) {
                    try {
                        const svgStr = new XMLSerializer().serializeToString(svg);
                        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
                        const img = new Image();
                        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = dataUrl; });
                        const r = svg.getBoundingClientRect();
                        const x = Math.round(r.left - leafRect.left);
                        const y = Math.round(r.top - leafRect.top);
                        const w = Math.round(r.width);
                        const h = Math.round(r.height);
                        const overlaps = !(r.right <= leafRect.left || r.left >= leafRect.right || r.bottom <= leafRect.top || r.top >= leafRect.bottom);
                        if (w > 0 && h > 0 && overlaps) ctx.drawImage(img, x, y, w, h);
                    } catch (e) {
                        console.warn('Failed to draw overlay SVG:', e);
                    }
                }

                // Draw marker icons (PNG/SVG img elements)
                const markerIcons = originalContainer.querySelectorAll('.leaflet-marker-pane img.leaflet-marker-icon');
                for (const icon of markerIcons) {
                    try {
                        const r = icon.getBoundingClientRect();
                        const x = Math.round(r.left - leafRect.left);
                        const y = Math.round(r.top - leafRect.top);
                        const w = Math.round(r.width);
                        const h = Math.round(r.height);
                        const overlaps = !(r.right <= leafRect.left || r.left >= leafRect.right || r.bottom <= leafRect.top || r.top >= leafRect.bottom);
                        const style = window.getComputedStyle(icon);
                        if (w > 0 && h > 0 && overlaps && style.display !== 'none' && style.visibility !== 'hidden') {
                            ctx.drawImage(icon, x, y, w, h);
                        }
                    } catch (e) {
                        console.warn('Failed to draw marker icon:', e);
                    }
                }

                // Try to produce a data URL (may fail if canvas tainted by CORS tiles)
                let mapDataUrl = '';
                try {
                    mapDataUrl = canvas.toDataURL('image/png', 1.0);
                } catch (e) {
                    console.warn('Map canvas tainted; falling back to placeholder');
                }

                const img = document.createElement('img');
                if (mapDataUrl) {
                    img.src = mapDataUrl;
                    img.width = width;
                    img.height = height;
                    img.setAttribute('width', String(width));
                    img.setAttribute('height', String(height));
                    img.style.width = width + 'px';
                    img.style.height = height + 'px';
                    img.style.display = 'block';
                    img.style.border = '1px solid #ddd';
                    img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                    img.alt = 'Map';
                } else {
                    img.alt = 'Map';
                    img.style.width = width + 'px';
                    img.style.height = height + 'px';
                    img.style.border = '1px solid #ddd';
                    img.style.backgroundColor = '#f0f0f0';
                }

                container.parentNode.replaceChild(img, container);
            } catch (err) {
                console.warn('Failed to process map container:', err);
            }
        }
        
        // 7. Process HTML fence blocks - render the HTML content and process images
        const htmlContainers = clone.querySelectorAll('.qde-html-container');
        for (const container of htmlContainers) {
            try {
                // Get the original source HTML
                const source = container.getAttribute('data-qd-source');
                
                // Check if there's a pre element (fallback display) or actual HTML content
                const pre = container.querySelector('pre');
                
                if (source) {
                    // Parse the source HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = source;
                    
                    // Process all images in the HTML block
                    const htmlImages = tempDiv.querySelectorAll('img');
                    for (const img of htmlImages) {
                        // Preserve original dimensions from HTML attributes
                        const widthAttr = img.getAttribute('width');
                        const heightAttr = img.getAttribute('height');
                        
                        if (widthAttr) {
                            img.width = parseInt(widthAttr);
                            img.style.width = widthAttr.includes('%') ? widthAttr : `${img.width}px`;
                        }
                        if (heightAttr) {
                            img.height = parseInt(heightAttr);
                            img.style.height = heightAttr.includes('%') ? heightAttr : `${img.height}px`;
                        }
                        
                        // Convert to data URL using canvas (like squibview)
                        if (img.src && !img.src.startsWith('data:')) {
                            try {
                                // Use canvas to convert image to data URL (avoids CORS issues)
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                
                                // Create new image and wait for it to load
                                const tempImg = new Image();
                                tempImg.crossOrigin = 'anonymous';
                                
                                await new Promise((resolve, reject) => {
                                    tempImg.onload = function() {
                                        console.log('HTML fence image loaded:', {
                                            naturalWidth: tempImg.naturalWidth,
                                            naturalHeight: tempImg.naturalHeight,
                                            imgWidth: img.width,
                                            imgHeight: img.height,
                                            widthAttr: widthAttr,
                                            heightAttr: heightAttr
                                        });
                                        
                                        // Calculate dimensions preserving aspect ratio
                                        let displayWidth = 0;
                                        let displayHeight = 0;
                                        
                                        // Use the width specified in HTML (e.g. width="250")
                                        if (widthAttr && !widthAttr.includes('%')) {
                                            displayWidth = parseInt(widthAttr);
                                        }
                                        
                                        // Use the height if specified
                                        if (heightAttr && !heightAttr.includes('%')) {
                                            displayHeight = parseInt(heightAttr);
                                        }
                                        
                                        console.log('Parsed dimensions from HTML:', { displayWidth, displayHeight });
                                        
                                        // If only width is specified, calculate height based on aspect ratio
                                        if (displayWidth > 0 && displayHeight === 0) {
                                            if (tempImg.naturalWidth > 0) {
                                                const aspectRatio = tempImg.naturalHeight / tempImg.naturalWidth;
                                                displayHeight = Math.round(displayWidth * aspectRatio);
                                                console.log('Calculated height from aspect ratio:', displayHeight);
                                            }
                                        }
                                        // If only height is specified, calculate width based on aspect ratio
                                        else if (displayHeight > 0 && displayWidth === 0) {
                                            if (tempImg.naturalHeight > 0) {
                                                const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
                                                displayWidth = Math.round(displayHeight * aspectRatio);
                                                console.log('Calculated width from aspect ratio:', displayWidth);
                                            }
                                        }
                                        // If neither specified, use natural dimensions
                                        else if (displayWidth === 0 && displayHeight === 0) {
                                            displayWidth = tempImg.naturalWidth || 250;
                                            displayHeight = tempImg.naturalHeight || 200;
                                            console.log('Using natural dimensions');
                                        }
                                        
                                        console.log('Final dimensions for canvas:', { displayWidth, displayHeight });
                                        
                                        canvas.width = displayWidth;
                                        canvas.height = displayHeight;
                                        
                                        // Draw image to canvas
                                        ctx.drawImage(tempImg, 0, 0, displayWidth, displayHeight);
                                        
                                        // Convert to data URL
                                        const dataUrl = canvas.toDataURL('image/png', 1.0);
                                        
                                        // Update original image
                                        img.src = dataUrl;
                                        img.width = displayWidth;
                                        img.height = displayHeight;
                                        img.setAttribute('width', displayWidth.toString());
                                        img.setAttribute('height', displayHeight.toString());
                                        img.style.width = displayWidth + 'px';
                                        img.style.height = displayHeight + 'px';
                                        
                                        resolve();
                                    };
                                    
                                    tempImg.onerror = function() {
                                        console.warn('Failed to load HTML fence image:', img.src);
                                        reject(new Error('Image load failed'));
                                    };
                                    
                                    // Set source - resolve relative paths
                                    if (img.src.startsWith('http') || img.src.startsWith('//')) {
                                        tempImg.src = img.src;
                                    } else {
                                        // Relative path - let browser resolve it
                                        const absoluteImg = new Image();
                                        absoluteImg.src = img.src;
                                        tempImg.src = absoluteImg.src;
                                    }
                                });
                            } catch (err) {
                                console.warn('Failed to convert HTML fence image:', img.src, err);
                            }
                        }
                        
                        // Add v:shapes for Word compatibility
                        img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                    }
                    
                    // Replace container content with processed HTML (whether it had pre or not)
                    container.innerHTML = tempDiv.innerHTML;
                } else if (!pre) {
                    // Container has rendered HTML already, process its images directly
                    const htmlImages = container.querySelectorAll('img');
                    for (const img of htmlImages) {
                        // Same image processing as above
                        const widthAttr = img.getAttribute('width');
                        const heightAttr = img.getAttribute('height');
                        
                        if (widthAttr) {
                            img.width = parseInt(widthAttr);
                            img.style.width = widthAttr.includes('%') ? widthAttr : `${img.width}px`;
                        }
                        if (heightAttr) {
                            img.height = parseInt(heightAttr);
                            img.style.height = heightAttr.includes('%') ? heightAttr : `${img.height}px`;
                        }
                        
                        if (img.src && !img.src.startsWith('data:')) {
                            try {
                                // Use same canvas approach as above
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                const tempImg = new Image();
                                tempImg.crossOrigin = 'anonymous';
                                
                                await new Promise((resolve, reject) => {
                                    tempImg.onload = function() {
                                        // Calculate dimensions preserving aspect ratio
                                        let displayWidth = img.width || 0;
                                        let displayHeight = img.height || 0;
                                        
                                        // If only width is specified, calculate height based on aspect ratio
                                        if (displayWidth && !displayHeight) {
                                            const aspectRatio = tempImg.naturalHeight / tempImg.naturalWidth;
                                            displayHeight = Math.round(displayWidth * aspectRatio);
                                        }
                                        // If only height is specified, calculate width based on aspect ratio
                                        else if (displayHeight && !displayWidth) {
                                            const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
                                            displayWidth = Math.round(displayHeight * aspectRatio);
                                        }
                                        // If neither specified, use natural dimensions
                                        else if (!displayWidth && !displayHeight) {
                                            displayWidth = tempImg.naturalWidth || 250;
                                            displayHeight = tempImg.naturalHeight || Math.round(250 * (tempImg.naturalHeight / tempImg.naturalWidth));
                                        }
                                        
                                        canvas.width = displayWidth;
                                        canvas.height = displayHeight;
                                        ctx.drawImage(tempImg, 0, 0, displayWidth, displayHeight);
                                        
                                        const dataUrl = canvas.toDataURL('image/png', 1.0);
                                        img.src = dataUrl;
                                        img.width = displayWidth;
                                        img.height = displayHeight;
                                        img.setAttribute('width', displayWidth.toString());
                                        img.setAttribute('height', displayHeight.toString());
                                        img.style.width = displayWidth + 'px';
                                        img.style.height = displayHeight + 'px';
                                        
                                        resolve();
                                    };
                                    
                                    tempImg.onerror = function() {
                                        console.warn('Failed to load HTML fence image:', img.src);
                                        reject(new Error('Image load failed'));
                                    };
                                    
                                    if (img.src.startsWith('http') || img.src.startsWith('//')) {
                                        tempImg.src = img.src;
                                    } else {
                                        const absoluteImg = new Image();
                                        absoluteImg.src = img.src;
                                        tempImg.src = absoluteImg.src;
                                    }
                                });
                            } catch (err) {
                                console.warn('Failed to convert HTML fence image:', img.src, err);
                            }
                        }
                        
                        img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                    }
                }
            } catch (err) {
                console.warn('Failed to process HTML container:', err);
            }
        }
        
        // 8. Tables are already HTML tables from the built-in renderer
        // No processing needed
        
        // Wrap in proper HTML structure for rich text editors
        const fragment = clone.innerHTML;
        const htmlContent = `
            <!DOCTYPE html>
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
                  
                  /* Math equations centered like squibview */
                  .math-display { text-align: center; margin: 1em 0; }
                  .math-display img { display: inline-block; margin: 0 auto; }
                </style>
              </head>
              <body><!--StartFragment-->${fragment}<!--EndFragment--></body>
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
                // Safari fallback (selection-based HTML of fragment)
                if (copyToClipboard(fragment)) {
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
            // Use fragment for selection-based fallback copy
            tempDiv.innerHTML = fragment;
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

