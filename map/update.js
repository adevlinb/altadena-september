// MAP.JS

// PURPOSE OF THIS FILE:

// THIS FILE SERVES AS THE ONLY ENTRY POINT INTO UPDATING DATA RELATED TO THE MAP
// THE MASTER-INDEX IS A CLASS WITH A FEATURES PROPERTY WITH KEYS BASED ON THE PROPERTY PARCEL NUMBER ->
// THE MASTER INDEX IS USED AS A SINGLE SOURCE OF TRUTH / BACKUP 
// THIS ALLOWS QUICK UPDATES AND METHODS BUILT INTO THE CLASS TAKE CARE OF THE ENTIRE
// PROCESS OF BACKING UP, UPDATING, AND REWRITING THE GEOJSON FILES NEEDED TO DISPLAY MAP DATA

// NOTE => THE SYSTEM CANNOT ACCEPT FILES THAT ARE NOT PART OF THE ORIGINAL DATASET 
// UNLESS A USER PROVIDES THE COORDINATES NEEDED TO DISPLAY THE INFORMATION ON THE MAP (which is highly unlikely)

import { awsCopy, awsGet, awsPut } from '../amazon/amazon.js';
import { diffLayers, diffFeatureProperties, normalizeName, finalizeLayers, processParcelLayers, mergeParcelProperties, localGet, BASE_FILE_NAMES, BACKUP_FILE_NAMES } from './utility.js';
import { FeatureCollection, BaseCollectionFeature, MasterCollectionFeature, MasterIndex, MasterIndexFeature, History, HistoryEntry } from "./map.js";

export default async function updateMap(req, res) {

    const updates = req.body;         // rows to udpate (overwrites each time!!)
    const type    = req.query.type;   // googleSheet for now (may be used later to run code based on type)
    res.status(200).end();            // return response to settle incoming request
    if (updates.length === 0) return; // return if nothing to update

    // 0.0 SET CONSTANTS / GLOBAL VARS
    // 0.1  LOAD CURRENT FILES
    const { successfulLoad, data, source } = await loadCurrFiles();

    if (!successfulLoad || !data) {
        console.error("Failed to load files, aborting update.");
        return;
    }

    const [CURR_BASE_SOURCE, CURR_MASTER_SOURCE, CURR_MASTER_INDEX, CURRENT_HISTORY] = data;

    // 0.2 WRITE BACKUPS
    await backupCurrFiles(data);

    // 0.3 CREATE NEW FILES
    const NEW_BASE_SOURCE   = new FeatureCollection('base-source');
    const NEW_MASTER_SOURCE = new FeatureCollection('master-source');
    const NEW_MASTER_INDEX  = new MasterIndex('master-index');
    const NEW_HISTORY_ENTRY = new History(CURR_MASTER_INDEX.id, CURR_BASE_SOURCE.id, CURR_MASTER_SOURCE.id)

    // 0.4 CREATE NEW LAYERS + ROLODEX
    const NEW_BASE_LAYERS   = FeatureCollection.getBaseLayers();
    const NEW_MASTER_LAYERS = FeatureCollection.getMasterLayers();
    const NEW_BUILD_LAYERS  = FeatureCollection.getBuildNoteLayers();
    const ROLODEX = {}

    try {
        // 1.0 => PARSE, VERIFY DATA TO UPDATE (PROPERTY OR LAYER CHANGES!)
        // 1.1 VERIFY / REJECT UDPATES
        updates.forEach((parcel) => {
            if (History.validator(parcel) && CURR_MASTER_INDEX.features[parcel.parcelNum]) {
                const logEntry = new HistoryEntry({ name: `Parcel: ${parcel.parcelNum}`, type: 'Property', action: 'verified', item: parcel });
                historyEntry.verifiedProps.push(logEntry);
            }
            else {
                const err = History.validator.errors;
                const logEntry = new HistoryEntry({ name: `Parcel: ${parcel?.parcelNum || "unknown"}`, type: 'Property', action: 'rejected', item: parcel, details: { errors: err ?? "Likely: Parcel Num not in Master Idx" } });
                historyEntry.rejectedProps.push(logEntry);
                History.validator.errors = null;
            }
        });

        // 1.2 TRACK DIFFERENCES IN LAYERS (Base, Master, BuildNote)
        const [removedBaseLayers,      addedBaseLayers]      = diffLayers(CURR_BASE_SOURCE.layers,        NEW_BASE_LAYERS)
        const [removedMasterLayers,    addedMasterLayers]    = diffLayers(CURR_MASTER_SOURCE.layers,      NEW_MASTER_LAYERS);
        const [removedBuildNoteLayers, addedBuildNoteLayers] = diffLayers(CURR_MASTER_SOURCE.buildLayers, NEW_BUILD_LAYERS);
        

        historyEntry.layerChanges.push(...[
            removedBaseLayers     .length ? new HistoryEntry({ name: "All Base Layers",       type: 'Base Layers',       action: 'removed', item: removedBaseLayers      .map(layer => layer.name) }) : null,
            addedBaseLayers       .length ? new HistoryEntry({ name: "All Base Layers",       type: 'Base Layers',       action: 'added',   item: addedBaseLayers        .map(layer => layer.name) }) : null,
            removedMasterLayers   .length ? new HistoryEntry({ name: "All Master Layers",     type: 'Master Layers',     action: 'removed', item: removedMasterLayers    .map(layer => layer.name) }) : null,
            addedMasterLayers     .length ? new HistoryEntry({ name: "All Master Layers",     type: 'Master Layers',     action: 'added',   item: addedMasterLayers      .map(layer => layer.name) }) : null,
            removedBuildNoteLayers.length ? new HistoryEntry({ name: "All Build Note Layers", type: 'Build Note Layers', action: 'removed', item: removedBuildNoteLayers .map(layer => layer.name) }) : null,
            addedBuildNoteLayers  .length ? new HistoryEntry({ name: "All Build Note Layers", type: 'Build Note Layers', action: 'added',   item: addedBuildNoteLayers   .map(layer => layer.name) }) : null,
        ].filter(Boolean));

        // 1.3 TRACK DIFFERENCES IN LAYER PROPERTIES FOR BASE / MASTER SOURCE (master src includes build note properties!)
        const [rmvdBaseFeatureProps, addedBaseFeatureProps]     = diffFeatureProperties(CURR_BASE_SOURCE.features[0],   new BaseCollectionFeature());
        const [rmvdMasterFeatureProps, addedMasterFeatureProps] = diffFeatureProperties(CURR_MASTER_SOURCE.features[0], new MasterCollectionFeature());

        historyEntry.featurePropChanges.push(...[
            rmvdBaseFeatureProps.length    ? new HistoryEntry({ name: 'Base Layer Properties',   type: 'Base Layer Properties',   action: 'removed', item: rmvdBaseFeatureProps    }) : null,
            addedBaseFeatureProps.length   ? new HistoryEntry({ name: 'Base Layer Properties',   type: 'Base Layer Properties',   action: 'added',   item: addedBaseFeatureProps   }) : null,
            rmvdMasterFeatureProps.length  ? new HistoryEntry({ name: 'Master Layer Properties', type: 'Master Layer Properties', action: 'removed', item: rmvdMasterFeatureProps  }) : null,
            addedMasterFeatureProps.length ? new HistoryEntry({ name: 'Master Layer Properties', type: 'Master Layer Properties', action: 'added',   item: addedMasterFeatureProps }) : null,
        ].filter(Boolean));

        
        // ** IF NO CHANGES -> DO NOTHING **
        if (historyEntry.rejectedProps.length      === 0 &&
            historyEntry.verifiedProps.length      === 0 &&
            historyEntry.layerChanges.length       === 0 &&
            historyEntry.featurePropChanges.length === 0)
            return;

        // 2.0 => IMPLEMENT FEATURE UPDATES TO CURRENT MASTER INDEX
        for (const update of updates) {
            
            const key = update.parcelNum;
            const feature = CURR_MASTER_INDEX.features[key];

            if (!feature) continue;

            const mergedProps = mergeParcelProperties(feature, update);

            CURR_MASTER_INDEX.features[key] = mergedProps;
        }

        // 3.0 GENERATE NEW SOURCE FEATURES, LAYER VALUES, ROLODEX OF PARTNERS
        for (const [key, parcel] of Object.entries(CURR_MASTER_INDEX.features)) {

            // 3.1 BASE-FEATURES
            const newBaseFeature = new BaseCollectionFeature(parcel);
            NEW_BASE_SOURCE.features.push(newBaseFeature);
            // 3.1 MASTER-FEATURES
            const newMasterFeature = new MasterCollectionFeature(parcel);
            NEW_MASTER_SOURCE.features.push(newMasterFeature)
            // 3.4 MASTER-INDEX-FEATURES
            const newIndexFeature = new MasterIndexFeature(parcel)
            NEW_MASTER_INDEX.features[parcel.parcelNum] = newIndexFeature;
            NEW_MASTER_INDEX.length += 1;

            // 3.2 SET BIN VALUES
            processParcelLayers(parcel, NEW_BASE_LAYERS, ["parcels", "outline"]);
            processParcelLayers(parcel, NEW_MASTER_LAYERS);
            processParcelLayers(parcel, NEW_BUILD_LAYERS);

            // 3.3 GENERATE ROLODEX
            // List of roles and their respective columns in the parcel
            const categories = ["architect", "engineer", "builder"];

            categories.forEach(role => {
                const rawName = parcel[role];
                if (!rawName) return;
                const name = normalizeName(rawName);
                if (!name) return;

                // Initialize the contributor in the rolodex if not seen before
                if (!ROLODEX[name]) {
                    ROLODEX[name] = {
                    name,
                    phone:   parcel[`${role}PhoneNumber`] || null,
                    email:   parcel[`${role}Email`]       || null,
                    website: parcel[`${role}Website`]     || null,
                    roles: [role], // list of roles they serve
                    };
                } else {
                    const partner = ROLODEX[name];

                    // Update missing contact info, add role if not present
                    if (!partner.phone   && parcel[`${role}PhoneNumber`]) partner.phone   = parcel[`${role}PhoneNumber`];
                    if (!partner.email   && parcel[`${role}Email`])       partner.email   = parcel[`${role}Email`];
                    if (!partner.website && parcel[`${role}Website`])   partner.website = parcel[`${role}Website`];
                    if (!partner.roles.includes(role)) partner.roles.push(role);
                }
            });
        }

        // 4.0 GENERATE LAYER FORMULAS 
        finalizeLayers(BASE_SOURCE_LAYERS);
        finalizeLayers(MASTER_SOURCE_LAYERS);
        finalizeLayers(BUILD_NOTE_LAYERS);

        // 4.4 ASSIGN LAYERS, ROLODEX
        NEW_BASE_SOURCE.layers        = NEW_BASE_LAYERS;
        NEW_MASTER_SOURCE.layers      = NEW_MASTER_LAYERS;
        NEW_MASTER_SOURCE.buildLayers = NEW_BUILD_LAYERS;
        NEW_MASTER_SOURCE.rolodex     = Object.values(ROLODEX);

        // 4.5 SET MASTER-INDEX LAYERS, ROLODEX
        NEW_MASTER_INDEX.rolodex      = Object.values(ROLODEX);
        NEW_MASTER_INDEX.baseLayers   = NEW_BASE_LAYERS;
        NEW_MASTER_INDEX.masterLayers = NEW_MASTER_LAYERS;
        NEW_MASTER_INDEX.buildLayers  = NEW_BUILD_LAYERS;

        // 5.0 => WRITE NEW FILES
        const NEW_FILES_DATA = [
            NEW_BASE_SOURCE,
            NEW_MASTER_SOURCE,
            NEW_MASTER_INDEX,
            NEW_HISTORY_ENTRY,
        ];

        // AWS S3 UPDATE CURRENT FILES
        await Promise.all(CURR_FILES.map((fileName, index) => awsPut(fileName, NEW_FILES_DATA[index])));

        // UPDATE REDIS / LOCAL CACHE
        return { baseSrc: NEW_BASE_SOURCE, masterSrc: NEW_MASTER_SOURCE }

    } catch (err) {
        console.warn(err)
    }
}

async function loadCurrFiles() {
    const sources = [
        { name: "primary", files: CURR_FILES,   loader: awsGet },
        { name: "backup",  files: BACKUP_FILES, loader: awsGet },
        { name: "redis",   loader: redisGetFiles },     // FIX REDIS!!
        { name: "local",   files: CURR_FILES,   loader: localGet },  // write local get function!
    ];

    for (const source of sources) {
        try {
            let data;
            if (source.files) {
                data = await Promise.all(source.files.map(file => source.loader(file)));
            } else {
                data = await source.loader(); // e.g., Redis might return all at once
            }
            console.log(`Loaded files from ${source.name}`);
            return { success: true, data, source: source.name };
        } catch (err) {
            console.warn(`Failed to load from ${source.name}:`, err);
        }
    }

    console.error("All file loading attempts failed.");
    return { successfulLoad: false, data: null, source: null };
}

export async function backupCurrFiles(currentData) {
    try {
        await Promise.all(CURR_FILES.map((file, i) => awsCopy(file, BACKUP_FILES[i])));
        console.log("Backups copied successfully in S3");
        return true;
    } catch (err) {
        console.warn("S3 copy failed, falling back to awsPut:", err);
        try {
            await Promise.all(CURR_FILES.map((file, i) => awsPut(BACKUP_FILES[i], currentData[i])));
            console.log("Backups uploaded successfully via awsPut");
            return true;
        } catch (err2) {
            console.error("Backup failed completely:", err2);
            return false;
        }
    }
}