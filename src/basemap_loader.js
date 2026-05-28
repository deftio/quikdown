/**
 * Lazy loader for offline Natural Earth basemap layers.
 * Keeps TopoJSON out of the minified JS bundle (Terser OOM avoidance).
 *
 * Loads two sibling assets from the standalone bundle directory:
 *   basemap_countries_110m.topojson  — country fills + borders
 *   basemap_admin1_lines.topojson   — state/province internal boundaries
 */
import { feature } from 'topojson-client';

let loadPromise = null;

function resolveBasemapUrls(base) {
    // base may be a file URL (import.meta.url of bundle) or explicit directory URL
    const root = base.endsWith('/') ? base : base.replace(/[^/]+$/, '');
    return {
        countries: new URL('basemap_countries_110m.topojson', root).href,
        admin1: new URL('basemap_admin1_lines.topojson', root).href
    };
}

/**
 * Fetch both basemap layers and expose as GeoJSON on window.
 * @param {string} baseUrl  Directory or bundle URL (import.meta.url works)
 * @returns {Promise<{ countries: object, admin1: object }>}
 */
export function loadOfflineBasemap(baseUrl) {
    if (typeof window !== 'undefined' && window._qde_worldGeoJSON && window._qde_admin1GeoJSON) {
        return Promise.resolve({
            countries: window._qde_worldGeoJSON,
            admin1: window._qde_admin1GeoJSON
        });
    }
    if (loadPromise) return loadPromise;

    const urls = resolveBasemapUrls(baseUrl);

    loadPromise = Promise.all([
        fetch(urls.countries).then(r => {
            if (!r.ok) throw new Error(`Countries basemap fetch failed (${r.status})`);
            return r.json();
        }),
        fetch(urls.admin1).then(r => {
            if (!r.ok) throw new Error(`Admin-1 basemap fetch failed (${r.status})`);
            return r.json();
        })
    ])
        .then(([countriesTopo, admin1Topo]) => {
            const countries = feature(countriesTopo, countriesTopo.objects.countries);
            const admin1Key = admin1Topo.objects.admin1_lines
                ? 'admin1_lines'
                : Object.keys(admin1Topo.objects)[0];
            const admin1 = feature(admin1Topo, admin1Topo.objects[admin1Key]);
            if (typeof window !== 'undefined') {
                window._qde_worldGeoJSON = countries;
                window._qde_admin1GeoJSON = admin1;
            }
            return { countries, admin1 };
        })
        .catch(err => {
            loadPromise = null;
            throw err;
        });

    return loadPromise;
}

/** @deprecated Use loadOfflineBasemap — kept for tests referencing old name */
export function loadWorldBasemap(baseUrl) {
    return loadOfflineBasemap(baseUrl);
}
