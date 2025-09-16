import * as turf from '@turf/turf';

const layerOrder = ["outline", "distance-circles-layer", "center-point-layer", "distance-circle-labels", "master-click-layer"]

export const propertyLayers = [
    { key: "distance-circles",   name: "Distance",      src: "property-source", type: 'line',   binCount: {}, formulas: [{ id: "distance-circles-layer", name: "Distance",      type: 'line',   layout: { visibility: "visible" }, filter: ['==', '$type', 'Polygon'], source: "property-source", paint: { 'line-color': '#ff0000', 'line-width': 3, 'line-dasharray': [3, 3] }}]},
    { key: "center-point",       name: "Center Point",  src: "property-source", type: 'circle', binCount: {}, formulas: [{ id: "center-point-layer",     name: "Center Point",  type: 'circle', layout: { visibility: "visible" }, filter: ['all', ['==', '$type', 'Point'], ['==', 'type', 'center-point']],    source: "property-source", paint: { 'circle-radius': 6, 'circle-color': '#ff0000', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' }}]},
    { key: "dist-circle-labels", name: "Circle Labels", src: "property-source", type: 'symbol', binCount: {}, formulas: [{ id: "distance-circle-labels", name: "Circle Labels", type: 'symbol', filter: ['==', ['get', 'type'], 'distance-label'], source: "property-source",   layout: { 'visibility': "visible", 'text-field': ['get', 'label'], 'text-size': 16, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-anchor': 'center' }, paint: { 'text-color': '#000000', 'text-halo-color': '#fff', 'text-halo-width': 1 }}]}
]

export const MASTER_CLICK_LAYER = {
    id: 'master-click-layer',
    type: 'fill',
    source: 'master-source',
    paint: { 'fill-color': '#000000', 'fill-opacity': 0.01 }
}

export function addSourceAndLayers(mapRef, source, isBaseSource, user) {
    if (!mapRef.current) return;                         // mapRef not loaded
    if (!isBaseSource && !user) return                   // source = MASTER, but no user
    if (mapRef?.current?.getSource(source.name)) return; // source already loaded;
    
    mapRef.current.addSource(source.name, { type: 'geojson', data: source });
    if (source.name === "master-source" && !mapRef.current.getLayer(MASTER_CLICK_LAYER.id)) {
        mapRef.current.addLayer(MASTER_CLICK_LAYER); 
    }
    
    source.layers.forEach(layer => {
        layer.formulas.forEach(formula => {
            if (Array.isArray(formula.filter) && formula.filter.length < 1) delete formula.filter
            if (formula?.id) mapRef.current.addLayer(formula)
        });
    });
}

export async function flyToAndSetProperty(res, mapRef, user, setPropertyDetail, setShowPropDetail) {
    if (res?.features?.length) {
        const [lng, lat] = res.features[0].geometry.coordinates;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });

        const point = mapRef.current.project([lng, lat]); // Converts lng/lat to screen point

        const features = mapRef.current.queryRenderedFeatures(point, { layers: ["master-click-layer"] });
        let feature;

        if (features.length > 0) feature = features[0].properties;
        if (!feature) return;

        setPropertySrcAndLayers(mapRef, feature);
        setPropertyDetail(features[0].properties)
        setShowPropDetail(true);
    }
}

export function addClickEvt(mapRef, setPropertyDetail, setShowPropDetail) {
    mapRef.current.on('click', MASTER_CLICK_LAYER.id, async function (evt) {
        const feature = evt.features[0].properties
        setPropertySrcAndLayers(mapRef, feature);
        setPropertyDetail(feature)
        setShowPropDetail(true)
    });
    
}

function setPropertySrcAndLayers(mapRef, parcelData) {
    const centroid = Array.isArray(parcelData.centroid)
        ? parcelData.centroid
        : JSON.parse(parcelData.centroid);
    if (!centroid) return;
    
    const distances = [1, 2, 3];
    const features = generateDistanceCircles(centroid, distances);

    // Add center point separately
    features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: centroid },
        properties: { type: 'center-point' }
    });

    const geoJSON = { type: 'FeatureCollection', features };

    // UPDATE SOURCES
    if (mapRef.current.getSource("property-source")) mapRef.current.getSource("property-source").setData(geoJSON);
    else mapRef.current.addSource("property-source", { type: 'geojson', data: geoJSON });

    // ENSURE LAYER ORDER
    layerOrder.forEach(layer => {
        if (layer && mapRef.current.getLayer(layer)) mapRef.current.moveLayer(layer);
    })
}

export function generateDistanceCircles(centerCoord, distancesInMiles) {
    const features = distancesInMiles.flatMap((distance) => {
        const circle = turf.circle(centerCoord, distance, {
            steps: 64,
            units: 'miles',
            properties: { distance }
        });

        const labelPoint = turf.destination(centerCoord, distance, 0, { units: 'miles' });
        labelPoint.properties = {
            type: 'distance-label',
            distance,
            label: `${distance} mile${distance === 1 ? '' : 's'}`
        };

        return [circle, labelPoint];
    });

    return features;
}

export function updateLayers(mapRef, layer, sublayer, action) {
    const type = layer.type;
    const id = sublayer.id;

    if (!mapRef.current.getLayer(id)) return;

    switch (action) {
        case "opacity": {
            const opacity = {
                'line':    'line-opacity',
                'circle':  'circle-opacity',
                'symbol':  'text-opacity',
                'fill':    'fill-opacity',
            }

            const prop = opacity[type];
            mapRef.current.setPaintProperty(id, prop, sublayer.paint?.[prop] ?? 1);
            break;
        }

        case "color": {
            const color = {
                'line':    'line-color',
                'circle':  'circle-color',
                'symbol':  'text-color',
                'fill':    'fill-color',
            }

            const prop = color[type];
            mapRef.current.setPaintProperty(id, prop, sublayer.paint?.[prop] ?? '#000');
            break;
        }

        case "visibility": {
            const current = mapRef.current.getLayoutProperty(id, 'visibility');
            const newSetting = current === 'visible' ? 'none' : 'visible';
            mapRef.current.setLayoutProperty(id, 'visibility', newSetting);
            break;
        }

        default:
            console.warn(`Unknown action: "${action}"`);
            break;
    }

    // Maintain layer order
    [sublayer?.id, ...layerOrder].forEach(l => {
        if (l && mapRef.current.getLayer(l)) mapRef.current.moveLayer(l);
    });
}

// export function updateMapLayers(mapRef, layer, sublayer, action) {

//     switch (action) {
//         case "opacity": {
//             const property = `${layer.type}-opacity`;
//             mapRef.current.setPaintProperty(sublayer.id, property, sublayer.paint[`${layer.type}-opacity`]);
//             break;
//         }

//         case "color": {
//             const property = `${layer.type}-color`;
//             mapRef.current.setPaintProperty(sublayer.id, property, sublayer.paint[`${layer.type}-color`]);
//             break;
//         }

//         case "visibility": {
//             const visibility = mapRef.current.getLayoutProperty(sublayer.id, "visibility");
//             const newSetting = visibility === "visible" ? "none" : "visible";
//             mapRef.current.setLayoutProperty(sublayer.id, 'visibility', newSetting);
//             break;
//         }

//         default:
//             console.warn(`Unknown action: "${action}"`);
//             break;

//     }

//     [sublayer?.id ,...layerOrder].forEach(layer => {
//         if (layer && mapRef.current.getLayer(layer)) mapRef.current.moveLayer(layer);
//     })
// }


export function updatePropertyLayers(mapRef, layer, sublayer, action) {

    switch (action) {
        case "opacity": {
            const property = `${layer.type}-opacity`;
            mapRef.current.setPaintProperty(sublayer.id, property, sublayer.paint[`${layer.type}-opacity`]);
            break;
        }

        case "color": {
            const property = `${layer.type}-color`;
            mapRef.current.setPaintProperty(sublayer.id, property, sublayer.paint[`${layer.type}-color`]);
            break;
        }

        case "visibility": {
            const visibility = mapRef.current.getLayoutProperty(sublayer.id, "visibility");
            const newSetting = visibility === "visible" ? "none" : "visible";
            mapRef.current.setLayoutProperty(sublayer.id, 'visibility', newSetting);
            break;
        }

        case "distance-circles": {

            break;
        }
        
        case "center-point": {

            break; 
        }

        default:
            console.warn(`Unknown action: "${action}"`);
            break;

    }

    [sublayer?.id ,...layerOrder].forEach(layer => {
        if (layer && mapRef.current.getLayer(layer)) mapRef.current.moveLayer(layer);
    })
}