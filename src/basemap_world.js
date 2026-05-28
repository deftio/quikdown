/**
 * Vector basemap for offline GeoJSON rendering.
 * Converts Natural Earth 10m TopoJSON to GeoJSON country boundaries.
 *
 * The TopoJSON data is pre-built by tools/buildBasemap.cjs as a JSON.parse()
 * string literal to avoid Rollup/terser OOM on the large dataset.
 *
 * Used by the standalone bundle when allowExternalFetch is false,
 * avoiding the need for OSM tile requests.
 */
import { worldTopo10m } from './basemap_world_10m.gen.js';
import { feature } from 'topojson-client';

export const worldGeoJSON = feature(worldTopo10m, worldTopo10m.objects.countries);
