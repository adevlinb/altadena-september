import { useState, memo } from "react";
import Sublayer from "./Sublayer";
import { ToggleSlider } from "react-toggle-slider";

const Layer = ({ layer, updateMapLayers, property, buildNote, buildLayerNames }) => {
    const [showLayerInfo, setShowLayerInfo] = useState(false)
    const TOGGLE_PROPS = { handleSize: 12, barHeight: 16, barWidth: 32, barBackgroundColor: "#1ABC9C", barBackgroundColorActive: "#E74C3C" };

    if (buildLayerNames.includes(layer.name) && !buildNote) return null
    if (!buildLayerNames.includes(layer.name) && buildNote) return null
    if (layer.formulas.length === 0) return null;
    if (layer.src !== "property-source" && property) return null;
    if (layer.src === "property-source" && !property) return null;

    const sublayers = layer.formulas.map(sublayer => <Sublayer key={sublayer.id} layer={layer} sublayer={sublayer} updateMapLayers={updateMapLayers} />)

    return (
        <div className="map-layers-container">
            <div className="map-layer-label" style={{ marginBottom: `${showLayerInfo ? "10px" : "0px"}` }}>
                <h4>{layer.name}</h4>
                <ToggleSlider {...TOGGLE_PROPS} onToggle={showLayerInfo => setShowLayerInfo(showLayerInfo)} />
            </div>
            <div style={{ display: `${showLayerInfo ? "block" : "none"}` }}>
                {sublayers}
            </div>
        </div>
    )
}

export default memo(Layer);