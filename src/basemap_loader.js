/**
 * Lazy loader for the offline Natural Earth vector basemap.
 * Used by the standalone editor — keeps ~3.5 MB TopoJSON out of the
 * minified JS bundle so Rollup/Terser do not OOM.
 */
import { feature } from 'topojson-client';

let loadPromise = null;

/**
 * Fetch TopoJSON and convert to GeoJSON for Leaflet.
 * @param {string} url  Path to basemap_world_10m.topojson (same dir as standalone bundle)
 * @returns {Promise<object>} GeoJSON FeatureCollection
 */
export function loadWorldBasemap(url) {
    if (typeof window !== 'undefined' && window._qde_worldGeoJSON) {
        return Promise.resolve(window._qde_worldGeoJSON);
    }
    if (loadPromise) return loadPromise;

    loadPromise = fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`Basemap fetch failed (${res.status})`);
            return res.json();
        })
        .then(topo => {
            const geo = feature(topo, topo.objects.countries);
            if (typeof window !== 'undefined') {
                window._qde_worldGeoJSON = geo;
            }
            return geo;
        })
        .catch(err => {
            loadPromise = null;
            throw err;
        });

    return loadPromise;
}
