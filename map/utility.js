import * as fs from 'fs/promises';
import { Layer } from "./map.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const FILE_LOOKUP = {
    "base-source.json":   path.resolve(__dirname, "../map/base_source"),
    "master-source.json": path.resolve(__dirname, "../map/master_source"),
    "master-index.json":  path.resolve(__dirname, "../map/master_index"),
    "history.json":       path.resolve(__dirname, "../map/history"),
    "rejected.json":      path.resolve(__dirname, "../map/rejectedParcels"),
};

export const BASE_FILE_NAMES   = ["base-source.json", "master-source.json", "master-index.json", "history.json"]  //  "rejected.json" (seed process only)
export const BACKUP_FILE_NAMES = ["base-source.backup.json", "master-source.backup.json", "master-index.backup.json", "history.backup.json"]

export async function localGet(fileName) {
    try {
        const dir = FILE_LOOKUP[fileName];
        if (!dir) throw new Error(`Unknown local file requested: ${fileName}`);
        const filePath = path.join(dir, fileName);
        const fileData = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileData);
    } catch (err) {
        if (err.code === "ENOENT") return null;
        console.error(`Failed to load local file ${fileName} from ${dir}:`, err);
        throw err;
    }
}

export async function localWrite(data, fileName) {
    try {
        const dir = FILE_LOOKUP[fileName];
        if (!dir) throw new Error(`Unknown local file requested: ${fileName}`);
        const filePath = path.join(dir, fileName);
		// const json = JSON.stringify(data, null, 1); // development => line spacing set to 1
		const json = JSON.stringify(data); // production => no spacing
		await fs.writeFile(filePath,  json, 'utf8');
	} catch (err) {
		console.error(err, `${fileName} not successfully written to ${dir}`)
	}
}

export function diffLayers(oldLayers, newLayers) {
    const oldKeySet = new Set(oldLayers.map(layer => layer.key));
    const newKeySet = new Set(newLayers.map(layer => layer.key));

    const added = newLayers.filter(layer => !oldKeySet.has(layer.key));
    const removed = oldLayers.filter(layer => !newKeySet.has(layer.key));

    return [removed, added];
}

export function diffFeatureProperties(oldFeature, newFeature) {

    if (!oldFeature || !newFeature) return [[], []];


    const oldProps = oldFeature.properties || {};
    const newProps = newFeature.properties || {};

    const oldKeys = new Set(Object.keys(oldProps));
    const newKeys = new Set(Object.keys(newProps));

    const removed = [...oldKeys].filter(key => !newKeys.has(key));
    const added   = [...newKeys].filter(key => !oldKeys.has(key));

    return [removed, added];
}

export function isValidValue(val) {
    return val !== undefined && val !== null && val !== '' && val !== false && val !== 0;
}

export function normalizeName(name) {
    if (!name) return null;
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ") // collapse multiple spaces
        .replace(/\b\w/g, char => char.toUpperCase()); // capitalize first letter of each word
}

export function sortBinValues(values) {
    // Deduplicate first
    const uniqueValues = Array.from(new Set(values));

    // Sort with numeric-first, string fallback
    uniqueValues.sort((a, b) => {
        const numA = parseFloat(a);
        const numB = parseFloat(b);

        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB; // numeric comparison
        }

        // fallback to string comparison
        return String(a).localeCompare(String(b));
    });

    return uniqueValues;
}

export function finalizeLayers(layers) {
	for (const layer of layers) {
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

			const uniqueValues = sortBinValues(Array.from(new Set(expanded)));
            const { bins, counts } = Layer.generateBins(uniqueValues);
			layer.binValues = bins;   // the bin ranges: [[min, max], ...]
			layer.binCount  = counts; // number of items in each bin
		}

		layer.formulas = Layer.buildLayerFormulas(layer);
	}
}

export function processParcelLayers(parcel, layers, skipKeys = []) {
    for (const layer of layers) {
        const value = parcel[layer.key];

        // handle skipKeys if provided
        if (skipKeys.includes(layer.key)) {
            layer.binCount[layer.key] = (layer.binCount[layer.key] || 0) + 1;
            continue;
        }

        if (!isValidValue(value)) continue;

        if (layer.dataType === "category") {
            layer.binValues.add(value);
            layer.binCount[value] = (layer.binCount[value] || 0) + 1;
        } else if (layer.dataType === "range") {
            const current = layer.binValues.get(value) || 0;
            layer.binValues.set(value, current + 1);
        }
    }
}

export function mergeParcelProperties(oldProps = {}, newProps = {}) {
    const merged = { ...oldProps }; // start with everything from oldProps

    for (const [key, newVal] of Object.entries(newProps)) {
        if (newVal) {                 // only update if truthy
            merged[key] = newVal;
        } else if (!(key in merged)) {
            // if it’s a brand new key but falsy, decide if you want to keep it
            merged[key] = newVal; // or skip this line if you *don’t* want to add falsy keys
        }
    }

    return merged;
}


