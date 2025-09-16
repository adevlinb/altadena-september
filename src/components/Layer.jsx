import { useState, memo } from "react";
import Sublayer from "./Sublayer"

const Layer = ({ layer, updateMapLayers, property }) => {
    const [showLayerInfo, setShowLayerInfo] = useState(false)

    if (layer.formulas.length === 0 || layer.name.includes("(nc)")) return null;
    if (layer.src !== "property-source" && property) return null;
    if (layer.src === "property-source" && !property) return null;

    const sublayers = layer.formulas.map(sublayer => <Sublayer key={sublayer.id} layer={layer} sublayer={sublayer} updateMapLayers={updateMapLayers} />)

    return (
        <div className="map-layers-container">
            <div className="map-layer-label" style={{ marginBottom: `${showLayerInfo ? "10px" : "0px"}` }}>
                <h2>{layer.name}</h2>
                <div onClick={() => setShowLayerInfo(!showLayerInfo)}>{ showLayerInfo ? "❌" : "✅" }</div>
            </div>
            <div style={{ display: `${showLayerInfo ? "block" : "none"}` }}>
                {sublayers}
            </div>
        </div>
    )
}

export default memo(Layer);