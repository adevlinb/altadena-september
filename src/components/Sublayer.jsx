const color = {
    'line':    'line-color',
    'circle':  'circle-color',
    'symbol':  'text-color',
    'fill':    'fill-color',
}

const opacity = {
    'line':    'line-opacity',
    'circle':  'circle-opacity',
    'symbol':  'text-opacity',
    'fill':    'fill-opacity',
}

export default function Sublayer({ layer, sublayer, updateMapLayers }) {
    
    function handleChange(evt) {
        const { name, value } = evt.target;
        const layerUpdate = { ...sublayer, layout: { ...sublayer.layout }, paint: { ...sublayer.paint }};


        if (name === "opacity")    layerUpdate.paint[opacity[layer.type]] = parseFloat(value);
        if (name === "color")      layerUpdate.paint[color[layer.type]] = value;
        if (name === "visibility") layerUpdate.layout.visibility = sublayer.layout.visibility === 'visible' ? 'none' : 'visible';
        
        updateMapLayers(layer, sublayer, name, layerUpdate);
    }

    return (
        <div className="map-sublayer-container">
            <div className="map-sublayer-container">
                <input type="checkbox" checked={sublayer.layout.visibility === 'visible'} name="visibility" onChange={handleChange} />
                <h1>{sublayer.name} <small className="detail-color">{sublayer?.name in layer.binCount ? `(${layer.binCount[`${sublayer.name}`]})` : ''}</small></h1>
            </div>
            <div className="map-sublayer-container">
                <input name="color" type="color" value={sublayer.paint[color[layer.type]]} onChange={handleChange} />
                <input value={sublayer.paint[opacity[layer.type]] ?? 1} name="opacity" type="number" min="0" max="1" step="0.01" onChange={handleChange}/>
            </div>
        </div>

    )
    
}

