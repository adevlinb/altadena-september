import { useState, memo } from "react";

const PropertyDetail = ({ entry }) => {
    const [showRolodexInfo, setShowRolodexInfo] = useState(true)

    if (!entry) return null;

    return (
        <div className="map-layers-container">
            {/* <div className="sub-label detail-color" style={{ marginBottom: `${showRolodexInfo ? "10px" : "0px"}` }}>
                <h2>Businesses:</h2>
                <div onClick={() => setShowRolodexInfo(!showRolodexInfo)}>{ showRolodexInfo ? "❌" : "✅" }</div>
            </div> */}

            <div style={{ display: `${showRolodexInfo ? "block" : "none"}` }}>
                <table className="property-details-table">
                    <tbody>
                        {entry.name && (
                            <tr><th>Name:</th><td id="name">{entry.name}</td></tr>
                        )}

                        {entry.phone && (
                            <tr><th>Number:</th><td id="phone">{entry.phone}</td></tr>
                        )}

                        {entry.email && (
                            <tr><th>Email:</th><td id="email">{entry.email}</td></tr>
                        )}

                        {entry.website && (
                            <tr><th>Website:</th><td id="website">{entry.website}</td></tr>
                        )}

                        {entry?.roles.length > 0 && (
                            <tr><th>Roles:</th><td id="damage">{entry.roles.join(" ,")}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    )
}

export default memo(PropertyDetail);