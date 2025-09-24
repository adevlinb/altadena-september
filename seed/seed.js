/***************************************************/
// This seed file is only meant to be run ONCE to initiate the starting point for map related items. 
// It only needs to be run IF something happens to all of the other files!!!
/***************************************************/
// import dotenv from 'dotenv'; // => development only
// dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

// IMPORTS
import fs from 'fs/promises';
import path from 'path';
import * as turf from '@turf/turf';
import { FeatureCollection, BaseCollectionFeature, MasterCollectionFeature, MasterIndex, MasterIndexFeature, History, HistoryEntry } from '../map/map.js';
import { diffLayers, diffFeatureProperties, finalizeLayers, processParcelLayers, localWrite, BASE_FILE_NAMES, BACKUP_FILE_NAMES } from '../map/utility.js';
import { awsPut } from '../amazon/amazon.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FOLDER / FILE PATHS
const originalDataDir  = path.resolve(__dirname, './original_geojson_data');

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

initializeMapData()
export async function initializeMapData() {
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
		const REJECTED                 = [];
		const BASE_SOURCE              = new FeatureCollection('base-source');
		const BASE_LAYERS	           = FeatureCollection.getBaseLayers();
		const MASTER_SOURCE            = new FeatureCollection('master-source');
		const MASTER_LAYERS            = FeatureCollection.getMasterLayers();
		const BUILD_NOTE_LAYERS		   = FeatureCollection.getBuildNoteLayers();
		const MASTER_INDEX             = new MasterIndex('master-index'); // HOLDS ALL DATA (GENERATED ONCE AND UPDATED => USED FOR ALL FUTURE FEATURE COLLECTIONS)
    	const HISTORY_ENTRY            = new History(MASTER_INDEX.id, BASE_SOURCE.id, MASTER_SOURCE.id, "original files - local")
		
		// FORMAT, CALCULATE, STRUCTURE DATA AND LAYERS FOR BASE / MASTER SOURCES AND MASTER INDEX
		allGeoDataParcels.forEach((p) => {
			const parcel = normalizeParcelData(p);

			// ONLY REJECTS ITEMS WITH MISSING PARCEL NUMBER
			if (!parcel.parcelNum) {
				REJECTED.push(parcel);
			} else {
	
				// GENERATE BASE COLLECTION / FEATURES / LAYERS
				const newBaseFeature = new BaseCollectionFeature(parcel);
				BASE_SOURCE.features.push(newBaseFeature);
	
				processParcelLayers(parcel, BASE_LAYERS, ["parcels", "outline"]);
				
				// // GENERATE MASTER COLLECTION / FEATURES / LAYERS
				const newMasterFeature = new MasterCollectionFeature(parcel);
				MASTER_SOURCE.features.push(newMasterFeature)
	
				processParcelLayers(parcel, MASTER_LAYERS);
				
				// // GENERATE MASTER INDEX && FEATURES
				const newIndexFeature = new MasterIndexFeature(parcel)
				MASTER_INDEX.features[parcel.parcelNum] = newIndexFeature;
				MASTER_INDEX.length += 1;
			}
		});

		// GENERATE LAYER FORMULAS
		// BASE
		finalizeLayers(BASE_LAYERS);
		BASE_SOURCE.layers        = BASE_LAYERS;
        MASTER_INDEX.baseLayers   = BASE_LAYERS;

		// MASTER
		finalizeLayers(MASTER_LAYERS);
		MASTER_SOURCE.layers      = MASTER_LAYERS;
        MASTER_INDEX.masterLayers = MASTER_LAYERS;

		// BUILD NOTE
		finalizeLayers(BUILD_NOTE_LAYERS);
		MASTER_SOURCE.buildLayers = BUILD_NOTE_LAYERS;
        MASTER_INDEX.buildLayers  = BUILD_NOTE_LAYERS;

		// WRITE HISTORY FILE / INITIAL ENTRY:
		// 1.2 TRACK DIFFERENCES IN LAYERS
		const [removedBaseLayers,   addedBaseLayers  ] = diffLayers([], BASE_LAYERS)
		const [removedMasterLayers, addedMasterLayers] = diffLayers([], MASTER_LAYERS);

        HISTORY_ENTRY.layerChanges.push(...[
            removedBaseLayers  .length ? new HistoryEntry({ name: "All Base Layers",   type: 'Base Layers',   action: 'removed', item: removedBaseLayers   .map(layer => layer.name) }) : null,
            addedBaseLayers    .length ? new HistoryEntry({ name: "All Base Layers",   type: 'Base Layers',   action: 'added',   item: addedBaseLayers     .map(layer => layer.name) }) : null,
            removedMasterLayers.length ? new HistoryEntry({ name: "All Master Layers", type: 'Master Layers', action: 'removed', item: removedMasterLayers .map(layer => layer.name) }) : null,
            addedMasterLayers  .length ? new HistoryEntry({ name: "All Master Layers", type: 'Master Layers', action: 'added',   item: addedMasterLayers   .map(layer => layer.name) }) : null,
        ].filter(Boolean));
		
		// 1.3 TRACK DIFFERENCES IN LAYER PROPERTIES FOR BASE / MASTER SOURCE
		const [rmvdBaseFeatureProps,   addedBaseFeatureProps   ] = diffFeatureProperties([], new BaseCollectionFeature());
		const [rmvdMasterFeatureProps, addedMasterFeatureProps ] = diffFeatureProperties([], new MasterCollectionFeature());

		HISTORY_ENTRY.featurePropChanges.push(...[
			rmvdBaseFeatureProps   .length ? new HistoryEntry({ name: 'Base Layer Properties',   type: 'Base Layer Properties',   action: 'removed', item: rmvdBaseFeatureProps })    : null,
			addedBaseFeatureProps  .length ? new HistoryEntry({ name: 'Base Layer Properties',   type: 'Base Layer Properties',   action: 'added',   item: addedBaseFeatureProps })   : null,
			rmvdMasterFeatureProps .length ? new HistoryEntry({ name: 'Master Layer Properties', type: 'Master Layer Properties', action: 'removed', item: rmvdMasterFeatureProps })  : null,
			addedMasterFeatureProps.length ? new HistoryEntry({ name: 'Master Layer Properties', type: 'Master Layer Properties', action: 'added',   item: addedMasterFeatureProps }) : null,
		].filter(Boolean));

		const NEW_FILES_DATA = [
			BASE_SOURCE,
			MASTER_SOURCE,
			MASTER_INDEX,
			[HISTORY_ENTRY],
			REJECTED,
		]

		// WRITE BASE FILES LOCALLY
		await Promise.all(BASE_FILE_NAMES.map((fileName, index) => localWrite(NEW_FILES_DATA[index], fileName)));
		console.log("✅ Local seed files written successfully.");

		// UPLOAD BASE FILES TO S3
		// await Promise.all(BASE_FILE_NAMES.map((fileName, index) => awsPut(NEW_FILES_DATA[index], fileName)));
		await Promise.all(BASE_FILE_NAMES.map((fileName, index) => awsPut(fileName, NEW_FILES_DATA[index])));
		console.log("✅ AWS_S3 BASE files written successfully.");

		// UPLOAD BACKUP FILES TO S3
		// await Promise.all(BACKUP_FILE_NAMES.map((fileName, index) => awsPut(NEW_FILES_DATA[index], fileName)));
		await Promise.all(BACKUP_FILE_NAMES.map((fileName, index) => awsPut(fileName, NEW_FILES_DATA[index])));
		console.log("✅ AWS_S3 BACKUP files written successfully.");

		const zippedBase   = await gzip(JSON.stringify(BASE_SOURCE)) 
		const zippedMaster = await gzip(JSON.stringify(MASTER_SOURCE));
		updateRedisCache(zippedBase);
		updateRedisCache(zippedMaster);

	} catch (err) {
		console.error('❌ Error during seeding:', err);
	}
};

