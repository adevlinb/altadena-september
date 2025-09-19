// IMPORTS
import { useEffect, useState, useRef } from "react";
import { useDeepState }                from "./hooks";
import { ToggleSlider } from "react-toggle-slider";
import "./App.css";
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl'
import * as mapboxFuncs from "./mapbox-functions";

// COMPONENTS
import { SearchBox }    from '@mapbox/search-js-react';
import Layer            from "../components/Layer";
import PropertyDetail   from "../components/PropertyDetail";
import RolodexEntry     from "../components/RolodexEntry";

const MAP_TOKEN=import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// DATA, CONSTANTS, APIs
const projectBounds  = "-118.69083089208162,34.0160835078113,-118.01095811981494,34.25408286864321";
const propertySource = { type: "FeatureCollection", name: "property-source", id: `property-source-${new Date().toISOString()}`, features: [], layers: mapboxFuncs.propertyLayers }

export default function App({ user = {} }) {
	const mapRef = useRef(null)
	const mapContainerRef = useRef(null)
	const [propertyDetail,  setPropertyDetail ] = useState(null);
	const [mapLayers,       setMapLayers      ] = useDeepState([]);
	const [showMapLayers,   setShowMapLayers  ] = useState(false);
	const [showPropDetail,  setShowPropDetail ] = useState(false);
	const [showBuildLayers, setShowBuildLayers] = useState(false);
	const [showRolodex,     setShowRolodex    ] = useState(false);
	const [buildLayerNames, setBuildLayerNames] = useState([])
	const [baseSource,      setBaseSource     ] = useState(null);
	const [masterSource,    setMasterSource   ] = useState(null);
	const TOGGLE_PROPS = { handleSize: 12, barHeight: 16, barWidth: 32, barBackgroundColor: "#2980B9", barBackgroundColorActive: "#E74C3C" };

	console.log(showPropDetail, "testing showing prop app 36")

	useEffect(() => {
		async function fetchSources() {
			const [baseRes, masterRes] = await Promise.all([
				fetch("http://localhost:3001/map/base_source/base-source.json").then(r => r.json()),
				fetch("http://localhost:3001/map/master_source/master-source.json").then(r => r.json()),
			]);

			setBaseSource(baseRes);
			setMasterSource(masterRes);
			setBuildLayerNames(masterRes.buildLayers.map(layer => layer.name))
		}
		
		fetchSources();
	}, []);

	useEffect(() => {
		if (!baseSource || !masterSource) return; 

		mapboxgl.accessToken = MAP_TOKEN;
		mapRef.current = new mapboxgl.Map({
			container: mapContainerRef.current,
			style: "mapbox://styles/mapbox/light-v11",
			center: user?.address?.centerpoint || [-118.137, 34.19],
			zoom: 14,
			maxBounds: [
				[-119.35447269326701, 33.42781319392145], // SW bounds
				[-117.49354593738312, 34.61177793652189], // NE bounds
			],
		});

		mapRef.current.on("load", () => {
			mapboxFuncs.addSourceAndLayers(mapRef, baseSource, true, user);
			mapboxFuncs.addSourceAndLayers(mapRef, masterSource,false, user);
			mapboxFuncs.addSourceAndLayers(mapRef, propertySource, false, user);
			mapboxFuncs.addClickEvt(mapRef, setPropertyDetail, setShowPropDetail);
		});

		setMapLayers([
			...mapLayers,
			...baseSource.layers,
			...masterSource.layers,
			...masterSource.buildLayers,
			...mapboxFuncs.propertyLayers,
		]);

		return () => {
			mapRef.current.remove();
		};
	}, [baseSource, masterSource]); // only runs once both are loaded

	function updateMapLayers(layer, sublayer, action, formulaUpdate) {
		if (!mapRef.current.getLayer(sublayer.id)) {
			console.warn(`Layer "${sublayer.id}" does not exist.`);
			return;
		}

		const updatedMapLayers = mapLayers.map(l => {
			if (l.name === layer.name) {
				const updatedFormulas = l.formulas.map(subL => subL.id === sublayer.id ? formulaUpdate : subL );
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
			{ baseSource && masterSource && <>
			<div id="search-mapkey-property-container">
				<div className="search-container">
					<SearchBox id="autocomplete-list" accessToken={MAP_TOKEN} options={{ language: 'en', country: 'US', bbox: projectBounds }} map={mapRef.current} mapboxgl={mapboxgl} onRetrieve={(res) => mapboxFuncs.flyToAndSetProperty(res, mapRef, setPropertyDetail, setShowPropDetail)} />
				</div>
				<div className="mapkey-container">
					<div className="main-label">
						<h3>Map Layers:</h3>
						<ToggleSlider {...TOGGLE_PROPS} onToggle={showMapLayers => setShowMapLayers(showMapLayers)} />
					</div>
					<div style={{ display: showMapLayers && mapLayers.length > 0 ? "block" : "none" }}>
						{ mapLayers.map(l => (<Layer key={l.key} layer={l} updateMapLayers={updateMapLayers} property={false} buildNote={false} buildLayerNames={buildLayerNames}  />)) }
					</div>
				</div>
				<div className="mapkey-container">
					<div className="main-label">
						<h3>Build Notes:</h3>
						<ToggleSlider {...TOGGLE_PROPS} onToggle={showBuildLayers => setShowBuildLayers(showBuildLayers)} />
					</div>
					<div style={{ display: showBuildLayers && mapLayers.length > 0 ? "block" : "none" }}>
						{ mapLayers.map(l => (<Layer key={l.key} layer={l} updateMapLayers={updateMapLayers} property={false} buildNote={true} buildLayerNames={buildLayerNames} />)) }
					</div>
				</div>
				<div className="rolodex-container">
					<div className="main-label">
						<h3>Rolodex: ({masterSource?.rolodex.length})</h3>
						<ToggleSlider {...TOGGLE_PROPS} onToggle={showRolodex => setShowRolodex(showRolodex)} />
					</div>
					<div className="rolodex-items-container" style={{ display: showRolodex && masterSource?.rolodex.length > 0 ? "block" : "none" }}>
						{ masterSource?.rolodex.map((entry, idx) => (<RolodexEntry key={entry.name} entry={entry} idx={idx}/>)) }
					</div>
				</div>
				<div className="property-container">
					<div className="main-label">
						<h3>Property Detail:</h3>
						{ !propertyDetail && <div>🚫</div> }
						{  propertyDetail && <ToggleSlider {...TOGGLE_PROPS} active={showPropDetail} key={showPropDetail ? "on" : "off"} onToggle={() => setShowPropDetail(prev => !prev)} /> }
					</div>
					<div style={{ display: propertyDetail && showPropDetail ? "block" : "none" }}>
						{ mapLayers.map(l => (<Layer key={l.key} layer={l} updateMapLayers={updateMapLayers} property={true} buildNote={false} buildLayerNames={buildLayerNames}  />)) }
						<PropertyDetail propertyDetail={propertyDetail} showPropDetail={showPropDetail} />
					</div>
				</div>
			</div>
			</>}
		</div>
		</main>
	)
}