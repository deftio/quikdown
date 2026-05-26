/**
 * Vector basemap for offline GeoJSON rendering.
 * Converts Natural Earth 110m TopoJSON to GeoJSON country boundaries.
 *
 * Used by the standalone bundle when allowExternalFetch is false,
 * avoiding the need for OSM tile requests.
 */
import worldTopo from 'sane-topojson/dist/world_110m.json';
import { feature } from 'topojson-client';

export const worldGeoJSON = feature(worldTopo, worldTopo.objects.countries);
