// IMPORTS
import { useEffect, useState, useRef } from "react";
import { useDeepState }                from "./hooks";
import "./App.css";
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl'
import * as mapboxFuncs from "./mapbox-functions";

// COMPONENTS
import { SearchBox }    from '@mapbox/search-js-react';
import Layer            from "../components/Layer";
import PropertyDetail   from "../components/PropertyDetail";

const MAP_TOKEN=import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
import BASE_SOURCE from "../assets/map/base-source.json";
import MASTER_SOURCE from "../assets/map/master-source.json";

// DATA, CONSTANTS, APIs
const projectBounds   = "-118.69083089208162,34.0160835078113,-118.01095811981494,34.25408286864321";
const PROPERTY_SOURCE = { type: "FeatureCollection", name: "property-source", id: `property-source-${new Date().toISOString()}`, features: [], layers: mapboxFuncs.propertyLayers }

export default function App({ user = {} }) {
	const mapRef = useRef(null)
	const mapContainerRef = useRef(null)
	const [propertyDetail,  setPropertyDetail] = useState(null);
	const [mapLayers,       setMapLayers     ] = useDeepState([]);
	const [showMapLayers,   setShowMapLayers ] = useState(false);
	const [showPropDetail,  setShowPropDetail] = useState(false);

	useEffect(() => {
		// CREATE NEW MAP
		mapboxgl.accessToken = MAP_TOKEN;
		mapRef.current = new mapboxgl.Map({
			container: mapContainerRef.current,
			style: 'mapbox://styles/mapbox/light-v11',
			center: user?.address?.centerpoint || [-118.137, 34.19],
			zoom: 14,
			maxBounds: [
				[-119.35447269326701,33.42781319392145], // SW bounds
				[-117.49354593738312,34.61177793652189]  // NE bounds
			]
		});

		// SET MAP SETTINGS
		mapRef.current.on("load", () => {
			mapboxFuncs.addSourceAndLayers(mapRef, BASE_SOURCE,     true,  user);
			mapboxFuncs.addSourceAndLayers(mapRef, MASTER_SOURCE,   false, user);
			mapboxFuncs.addSourceAndLayers(mapRef, PROPERTY_SOURCE, false, user);
			mapboxFuncs.addClickEvt(mapRef, setPropertyDetail, setShowPropDetail)
		});

		// SET MAP LAYERS AND PROPERTY LAYERS
		setMapLayers([...mapLayers, ...BASE_SOURCE.layers, ...MASTER_SOURCE.layers, ...mapboxFuncs.propertyLayers]);

		return () => {
			mapRef.current.remove()
		}
	}, [])

	function updateMapLayers(layer, sublayer, action, formulaUpdate) {
		if (!mapRef.current.getLayer(sublayer.id)) {
			console.warn(`Layer "${sublayer.id}" does not exist.`);
			return;
		}

		const updatedMapLayers = mapLayers.map(l => {
			if (l.name === layer.name) {
				const updatedFormulas = l.formulas.map(
					subL => subL.id === sublayer.id ? formulaUpdate : subL 
				);
				return { ...l, formulas: updatedFormulas };
			}
			return l;
		});

		setMapLayers(updatedMapLayers);
		mapboxFuncs.updateLayers(mapRef, layer, formulaUpdate, action);
	}

	return (
		<main>
        <div id="map-page">
            <div id="map-container" ref={mapContainerRef} ></div>
			<div id="search-mapkey-property-container">
				<div className="search-container">
					<SearchBox id="autocomplete-list" accessToken={MAP_TOKEN} options={{ language: 'en', country: 'US', bbox: projectBounds }} map={mapRef.current} mapboxgl={mapboxgl} onRetrieve={(res) => mapboxFuncs.flyToAndSetProperty(res, mapRef, user, setPropertyDetail, setShowPropDetail)} />
				</div>
				<div className="mapkey-container">
					<div className="main-label">
						<h1>Map Key:</h1>
						<div onClick={() => setShowMapLayers(!showMapLayers)}>{ showMapLayers ? "❌" : "✅" }</div>
					</div>
					<div style={{ display: showMapLayers && mapLayers.length > 0 ? "block" : "none" }}>
						{ mapLayers.map(l => (<Layer key={l.key} layer={l} updateMapLayers={updateMapLayers} property={false} />)) }
					</div>
				</div>
				<div className="property-container">
					<div className="main-label">
						<h1>Property:</h1>
						{ propertyDetail 
							? <div onClick={() => setShowPropDetail(!showPropDetail)}>{ showPropDetail ? "❌" : "✅" }</div>
							: <div>🚫</div>
						}
					</div>
					<div style={{ display: propertyDetail && showPropDetail ? "block" : "none" }}>
						{ mapLayers.map(l => (<Layer key={l.key} layer={l} updateMapLayers={updateMapLayers} property={true} />)) }
						<PropertyDetail propertyDetail={propertyDetail} />
					</div>
				</div>
				
			</div>
		</div>
		</main>
	);

}




								// <button onClick={() => mapboxFuncs.updateLayers(mapRef, "distance-circles-layer", { id: "distance-circles-layer" }, "visibility")}>Clear Circles</button>
								// <button onClick={() => mapboxFuncs.updateLayers(mapRef, "center-point-layer",     { id: "center-point-layer" },     "visibility")}>Clear Center Point</button>