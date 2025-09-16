/***************************************************/
// This seed file is only meant to be run ONCE to initiate the starting point for map related items. 
// It only needs to be run IF something happens to all of the other files!!!
/***************************************************/

// IMPORTS
import fs from 'fs/promises';
import path from 'path';
import * as turf from '@turf/turf';
import { FeatureCollection, BaseCollectionFeature, MasterCollectionFeature, MasterIndex, MasterIndexFeature, Layer, History, HistoryEntry } from '../map/map.js';


import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FOLDER / FILE PATHS
const originalDataDir  = path.resolve(__dirname, './original_geojson_data');
const baseSrcDir       = path.resolve(__dirname, '../map/base_source');
const masterSrcDir     = path.resolve(__dirname, '../map/master_source');
const masterIdxDir     = path.resolve(__dirname, '../map/master_index');
const rejectedItemsDir = path.resolve(__dirname, '../map/rejectedParcels');
const historyDir       = path.resolve(__dirname, '../map/history');
const dataFiles = [
	'altadena_1.json', 
	'altadena_2.json', 
	'altadena_3.json', 
	'altadena_4.json' 
];


const normalizeParcelData = (p) => ({
	type:             p.geometry.type,
	coordinates:      p.geometry.coordinates,
	assessorNum:      p.properties.AIN_1,
	parcelNum:        p.properties.APN_1,
	centroid:         turf.centroid(p.geometry).geometry.coordinates,
	houseNum:         p.properties.SitusHouseNo,
	street:           p.properties.SitusStreet,
	address:          p.properties.SitusAddress,
	cityState:        p.properties.SitusCity,
	zipCode:          (() => { const z = p.properties.SitusZIP; return (typeof z === "string" && /^\d{5}$/.test(z.slice(0,5))) ? z.slice(0, 5) : "" })(),
	fullAddress:      p.properties.SitusFullAddress,
	community:        (p.properties.COMMUNITY || "").trim(),
	propertyType:     p.properties.UseType,
	structureCat:     p.properties.STRUCTURECATEGORY,
	yearBuilt:        p.properties.YearBuilt1,
	taxRateArea:      p.properties.TaxRateArea,
	taxRateCity:      p.properties.TaxRateCity,
	lotSizeMeters:    +turf.area(p.geometry).toFixed(2),
	lotSizeAcres:     +(turf.area(p.geometry) * 0.000247105).toFixed(3),
	lastSaleDate:     p.properties.LastSaleDate,
	lastSaleAmt:      p.properties.LastSaleAmount,
	legalDescription: p.properties.LegalDescription,
	totalUnits:       +p.properties.Total_Units || "",
	units:            setUnitInfo(p),
	fireName:         p.properties.Fire_Name,
	damage:           p.properties.DAMAGE_1,
	globalID:         p.properties.GlobalID,
})


function setUnitInfo(p) {
    const units = [];

    for (let i = 1; i <= p.properties.Total_Units || 0; i++) {
        const newUnit = {}
        if (`Units${i}` in p.properties && p.properties[`Units${i}`]) {
            newUnit.unitNum   = p.properties[`Units${i}`]
            newUnit.bedrooms  = p.properties[`Bedrooms${i}`]
            newUnit.bathrooms = p.properties[`Bathrooms${i}`]
            newUnit.sqft      = p.properties[`SQFTmain${i}`]
            units.push(newUnit)
        }
    }

    return units.length > 0 ? units : null;
}


export async function initializeMapData(assetsDir) {
	try {
		// PARSE, FLATTEN JSON DATA 
		const originalGeojsonDataArrays = await Promise.all(
			dataFiles.map(async (file) => {
				const filePath = path.join(originalDataDir, file);
				const fileData = await fs.readFile(filePath, 'utf-8');
				const parsedData = JSON.parse(fileData);
				return parsedData.features
			})
		);

		const allGeoDataParcels        = originalGeojsonDataArrays.flat()
		const rejectedParcels          = [];
		const BASE_SOURCE_COLLECTION   = new FeatureCollection('base-source');
		const BASE_SOURCE_LAYERS	   = FeatureCollection.getBaseLayers();
		const MASTER_SOURCE_COLLECTION = new FeatureCollection('master-source');
		const MASTER_SOURCE_LAYERS     = FeatureCollection.getMasterLayers();
		const BUILD_NOTE_LAYERS		   = FeatureCollection.getBuildNoteLayers();
		const MASTER_INDEX             = new MasterIndex('master-index'); // HOLDS ALL DATA (GENERATED ONCE AND UPDATED => USED FOR ALL FUTURE FEATURE COLLECTIONS)
    	const historyEntry             = new History(MASTER_INDEX.id, BASE_SOURCE_COLLECTION.id, MASTER_SOURCE_COLLECTION.id)
		
		// FORMAT, CALCULATE, STRUCTURE DATA AND LAYERS FOR BASE / MASTER SOURCES AND MASTER INDEX
		allGeoDataParcels.forEach((p) => {
			const parcel = normalizeParcelData(p);

			// ONLY REJECTS ITEMS WITH MISSING PARCEL NUMBER
			if (!parcel.parcelNum) {
				rejectedParcels.push(parcel);
			} else {
	
				// GENERATE BASE COLLECTION / FEATURES / LAYERS
				const newBaseFeature = new BaseCollectionFeature(parcel);
				BASE_SOURCE_COLLECTION.features.push(newBaseFeature);
	
				for (const layer of BASE_SOURCE_LAYERS) {
					const value = parcel[layer.key];

					// skip two core layers => parcels and outline
					if (["parcels", "outline"].includes(layer.key)) {
						layer.binCount[layer.key] = (layer.binCount[layer.key] || 0) + 1;
						continue;
					}

					if (isValidValue(value)) {
						if (layer.dataType === "category") {
							layer.binValues.add(value);
							layer.binCount[value] = (layer.binCount[value] || 0) + 1;
						}

						if (layer.dataType === "range") {
							const current = layer.binValues.get(value) || 0;
							layer.binValues.set(value, current + 1);
						}
					}
				}
				
				// // GENERATE MASTER COLLECTION / FEATURES / LAYERS
				const newMasterFeature = new MasterCollectionFeature(parcel);
				MASTER_SOURCE_COLLECTION.features.push(newMasterFeature)
	
				for (const layer of MASTER_SOURCE_LAYERS) {
					const value = parcel[layer.key];
					
					if (isValidValue(value)) {
						if (layer.dataType === "category") {
							layer.binValues.add(value);
							layer.binCount[value] = (layer.binCount[value] || 0) + 1;
						}

						if (layer.dataType === "range") {
							const current = layer.binValues.get(value) || 0;
							layer.binValues.set(value, current + 1);
						}
					}
				}
				
				// // GENERATE MASTER INDEX && FEATURES
				const newIndexFeature = new MasterIndexFeature(parcel)
				MASTER_INDEX.features[parcel.parcelNum] = newIndexFeature;
				MASTER_INDEX.length += 1;
			}
		});

		// SET LAYER FORMULAS FOR BASE COLLECTION
		for (const layer of BASE_SOURCE_LAYERS) {
			if (layer.dataType === "category") layer.binValues = Array.from(layer.binValues);
			 
			if (layer.dataType === "range") {

				const expanded = [];
				for (const [value, count] of layer.binValues.entries()) {
					for (let i = 0; i < count; i++) {
						expanded.push(value);
					}
				}
				
				expanded.sort((a, b) => a - b);
				const { bins, counts } = Layer.generateBins(expanded);
				layer.binValues = bins;   // the bin ranges: [[min, max], ...]
				layer.binCount  = counts; // number of items in each bin
			}

			layer.formulas = Layer.buildLayerFormulas(layer);
		}

		// ASSIGN GENERATED BASE SOURCE LAYERS
		BASE_SOURCE_COLLECTION.layers = BASE_SOURCE_LAYERS;

		// SET LAYER FORMULAS FOR MASTER COLLECTION
		for (const layer of MASTER_SOURCE_LAYERS) {
			if (layer.dataType === "category") layer.binValues = Array.from(layer.binValues);
			
			if (layer.dataType === "range") {

				const expanded = [];
				for (const [value, count] of layer.binValues.entries()) {
					for (let i = 0; i < count; i++) {
						expanded.push(value);
					}
				}
				
				expanded.sort((a, b) => a - b);
				const { bins, counts } = Layer.generateBins(expanded);
				layer.binValues = bins;   // the bin ranges: [[min, max], ...]
				layer.binCount  = counts; // number of items in each bin
			}

			layer.formulas = Layer.buildLayerFormulas(layer);
		}

		// ASSIGN GENERATED MASTER SOURCE LAYERS
		MASTER_SOURCE_COLLECTION.layers = MASTER_SOURCE_LAYERS;

        // SET LAYER FORMULAS FOR BUILD NOTE LAYERS
        for (const layer of BUILD_NOTE_LAYERS) {
            if (layer.dataType === "category") {
                layer.binValues = Array.from(layer.binValues);
            }
            
            if (layer.dataType === "range") {

                const expanded = [];
                for (const [value, count] of layer.binValues.entries()) {
                    for (let i = 0; i < count; i++) {
                        expanded.push(value);
                    }
                }

                expanded.sort((a, b) => a - b);
                const { bins, counts } = Layer.generateBins(expanded);
                layer.binValues = bins;   // the bin ranges: [[min, max], ...]
                layer.binCount = counts; // number of items in each bin
            }

            layer.formulas = Layer.buildLayerFormulas(layer);
        }

		// ASSIGN GENERATED MASTER SOURCE BUILD NOTE LAYERS
        MASTER_SOURCE_COLLECTION.buildLayers = BUILD_NOTE_LAYERS;
		

		// SET MASTER INDEX LAYERS (x3)
        NEW_MASTER_INDEX.baseLayers   = BASE_SOURCE_LAYERS;
        NEW_MASTER_INDEX.masterLayers = MASTER_SOURCE_LAYERS;
        NEW_MASTER_INDEX.buildLayers  = BUILD_NOTE_LAYERS;

		// WRITE FILES AND BACKUP FILES
		await writeAssetAndBackup(BASE_SOURCE_COLLECTION,   assetsDir,        'base-source.json');
		await writeAssetAndBackup(MASTER_SOURCE_COLLECTION, assetsDir,        'master-source.json');
		await writeAssetAndBackup(BASE_SOURCE_COLLECTION,   baseSrcDir,       'base-source.json');
		await writeAssetAndBackup(MASTER_SOURCE_COLLECTION, masterSrcDir,     'master-source.json');
		await writeAssetAndBackup(MASTER_INDEX,             masterIdxDir,     'master-index.json');
		await writeAssetAndBackup(rejectedParcels,          rejectedItemsDir, 'rejected-parcels.json');


		// WRITE HISTORY FILE / INITIAL ENTRY:

		// 1.2 TRACK DIFFERENCES IN LAYERS
		const [removedBaseLayers,   addedBaseLayers  ] = diffLayers([], BASE_SOURCE_LAYERS)
		const [removedMasterLayers, addedMasterLayers] = diffLayers([], MASTER_SOURCE_LAYERS);

        historyEntry.layerChanges.push(...[
            removedBaseLayers  .length ? new HistoryEntry({ name: "All Base Layers",   type: 'Base Layers',   action: 'removed', item: removedBaseLayers   .map(layer => layer.name) }) : null,
            addedBaseLayers    .length ? new HistoryEntry({ name: "All Base Layers",   type: 'Base Layers',   action: 'added',   item: addedBaseLayers     .map(layer => layer.name) }) : null,
            removedMasterLayers.length ? new HistoryEntry({ name: "All Master Layers", type: 'Master Layers', action: 'removed', item: removedMasterLayers .map(layer => layer.name) }) : null,
            addedMasterLayers  .length ? new HistoryEntry({ name: "All Master Layers", type: 'Master Layers', action: 'added',   item: addedMasterLayers   .map(layer => layer.name) }) : null,
        ].filter(Boolean));
		
		// 1.3 TRACK DIFFERENCES IN LAYER PROPERTIES FOR BASE / MASTER SOURCE
		const [rmvdBaseFeatureProps,   addedBaseFeatureProps   ] = diffFeatureProperties([], new BaseCollectionFeature());
		const [rmvdMasterFeatureProps, addedMasterFeatureProps ] = diffFeatureProperties([], new MasterCollectionFeature());

		historyEntry.featurePropChanges.push(...[
			rmvdBaseFeatureProps   .length ? new HistoryEntry({ name: 'Base Layer Properties',   type: 'Base Layer Properties',   action: 'removed', item: rmvdBaseFeatureProps })    : null,
			addedBaseFeatureProps  .length ? new HistoryEntry({ name: 'Base Layer Properties',   type: 'Base Layer Properties',   action: 'added',   item: addedBaseFeatureProps })   : null,
			rmvdMasterFeatureProps .length ? new HistoryEntry({ name: 'Master Layer Properties', type: 'Master Layer Properties', action: 'removed', item: rmvdMasterFeatureProps })  : null,
			addedMasterFeatureProps.length ? new HistoryEntry({ name: 'Master Layer Properties', type: 'Master Layer Properties', action: 'added',   item: addedMasterFeatureProps }) : null,
		].filter(Boolean));

		
		try {
			await appendJsonLine(historyEntry, historyDir, 'history.jsonl');
		} catch (logErr) {
			console.warn("Failed to write history log:", logErr.message);
		}

	} catch (err) {
		console.error('❌ Error during seeding:', err);
	}
};

async function writeAssetAndBackup(collection, assetDir, assetFilename) {
    const assetPath  = path.join(assetDir, assetFilename);
    const json       = JSON.stringify(collection, null, 1);

    await fs.writeFile(assetPath,  json, 'utf8');
}

async function appendJsonLine(data, dir, filename) {
	const fullPath = path.join(dir, filename);
	const line = JSON.stringify(data) + "\n";
	await fs.mkdir(dir, { recursive: true });
	await fs.appendFile(fullPath, line);
}

function diffLayers(oldLayers, newLayers) {
    const oldKeySet = new Set(oldLayers.map(layer => layer.key));
    const newKeySet = new Set(newLayers.map(layer => layer.key));

    const added = newLayers.filter(layer => !oldKeySet.has(layer.key));
    const removed = oldLayers.filter(layer => !newKeySet.has(layer.key));

    return [removed, added];
}

function diffFeatureProperties(oldFeature, newFeature) {

    if (!oldFeature || !newFeature) return [[], []];


    const oldProps = oldFeature.properties || {};
    const newProps = newFeature.properties || {};

    const oldKeys = new Set(Object.keys(oldProps));
    const newKeys = new Set(Object.keys(newProps));

    const removed = [...oldKeys].filter(key => !newKeys.has(key));
    const added   = [...newKeys].filter(key => !oldKeys.has(key));

    return [removed, added];
}

function isValidValue(val) {
  return val !== undefined && val !== null && val !== '' && val !== false;
}