import { useState } from "react";

export function useDeepState(initialState) {
    const initialCopy = deepCopy(initialState);
    const [state, setState] = useState(initialCopy);

    function updateDeepState(state) {
        const freshState = deepCopy(state);
        setState(freshState);
    }

    return [state, updateDeepState];
}

function deepCopy(value) {
    // Check for null or primitive values, return immediately
    if (value === null || typeof value !== 'object') return value; 

    // Handle arrays
    if (Array.isArray(value)) return value.map(item => deepCopy(item));

    // Handle objects
    const copy = {};
    for (const key in value) {
        if (value.hasOwnProperty(key)) {
            copy[key] = deepCopy(value[key]);
        }
    }

    return copy;
}