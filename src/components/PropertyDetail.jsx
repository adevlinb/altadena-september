import { useState, memo } from "react";

const PropertyDetail = ({ propertyDetail }) => {
    const [showDetailInfo, setShowDetailInfo] = useState(true)

    if (!propertyDetail) return null;

    return (
        <div className="map-layers-container">
            <div className="sub-label detail-color" style={{ marginBottom: `${showDetailInfo ? "10px" : "0px"}` }}>
                <h2>Details:</h2>
                <div onClick={() => setShowDetailInfo(!showDetailInfo)}>{ showDetailInfo ? "❌" : "✅" }</div>
            </div>

            <div style={{ display: `${showDetailInfo ? "block" : "none"}` }}>
                <table className="property-details-table">
                    <tbody>
                        {propertyDetail.address && (
                            <>
                                <tr><th>Address:</th><td id="address">{propertyDetail.address}</td></tr>
                                {propertyDetail.cityState && (
                                    <tr><th>City/State/Zip:</th><td>{propertyDetail.cityState}, {propertyDetail.zipCode}</td></tr>
                                )}
                            </>
                        )}

                        {propertyDetail.community && (
                            <tr><th>Neighborhood:</th><td id="community">{propertyDetail.community}</td></tr>
                        )}

                        {propertyDetail.fireName && (
                            <tr><th>Fire:</th><td id="fireName">{propertyDetail.fireName}</td></tr>
                        )}

                        {propertyDetail.damage && (
                            <tr><th>Amt Damage:</th><td id="damage">{propertyDetail.damage}</td></tr>
                        )}

                        {propertyDetail.propertyType && (
                            <tr><th>Property Type:</th><td id="propertyType">{propertyDetail.propertyType}</td></tr>
                        )}

                        {propertyDetail.lotSizeAcres && (
                            <tr><th>Lot Size (Acres):</th><td id="lotSizeAcres">{propertyDetail.lotSizeAcres}</td></tr>
                        )}

                        {propertyDetail.lotSizeMeters && (
                            <tr><th>Lot Size (Sq Meters):</th><td id="lotSizeMeters">{propertyDetail.lotSizeMeters}</td></tr>
                        )}

                        {propertyDetail.parcelNum && (
                            <tr><th>Parcel Number:</th><td id="parcel">{propertyDetail.parcelNum}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    )
}

export default memo(PropertyDetail);