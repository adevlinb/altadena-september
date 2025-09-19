import { useState, memo } from "react";
import { ToggleSlider } from "react-toggle-slider";

const PropertyDetail = ({ propertyDetail }) => {
    const [showDetailInfo, setShowDetailInfo] = useState(true)
    	const TOGGLE_PROPS = { handleSize: 12, barHeight: 16, barWidth: 32, barBackgroundColor: "#1ABC9C", barBackgroundColorActive: "#E74C3C" };

    if (!propertyDetail) return null;

    return (
        <div className="map-layers-container">
            <div className="map-layer-label" style={{ marginBottom: `${showDetailInfo ? "10px" : "0px"}` }}>
                <h4 style={{ color: "rgb(255, 208, 0)"}}>Details:</h4>
                <ToggleSlider {...TOGGLE_PROPS} onToggle={showDetailInfo => setShowDetailInfo(showDetailInfo)} />
            </div>

            <div style={{ display: `${showDetailInfo ? "block" : "none"}` }}>
                <div className="property-details-card">
                    {propertyDetail.address && (
                        <div className="property-detail-row">
                        <div className="label">Address:</div>
                        <div className="value">{propertyDetail.address}</div>
                        </div>
                    )}

                    {propertyDetail.cityState && (
                        <div className="property-detail-row">
                        <div className="label"></div>
                        <div className="value">
                            {propertyDetail.cityState}, {propertyDetail.zipCode}
                        </div>
                        </div>
                    )}

                    {propertyDetail.community && (
                        <div className="property-detail-row">
                        <div className="label" >Community:</div>
                        <div className="value">{propertyDetail.community}</div>
                        </div>
                    )}

                    {propertyDetail.fireName && (
                        <div className="property-detail-row">
                        <div className="label">Fire:</div>
                        <div className="value">{propertyDetail.fireName}</div>
                        </div>
                    )}

                    {propertyDetail.damage && (
                        <div className="property-detail-row">
                        <div className="label">Amt Damage:</div>
                        <div className="value">{propertyDetail.damage}</div>
                        </div>
                    )}

                    {propertyDetail.propertyType && (
                        <div className="property-detail-row">
                        <div className="label">Property Type:</div>
                        <div className="value">{propertyDetail.propertyType}</div>
                        </div>
                    )}

                    {propertyDetail.lotSizeAcres && (
                        <div className="property-detail-row">
                        <div className="label">Lot Size:</div>
                        <div className="value">{propertyDetail.lotSizeAcres} acres</div>
                        </div>
                    )}

                    {propertyDetail.lotSizeMeters && (
                        <div className="property-detail-row">
                        <div className="label">Lot Size:</div>
                        <div className="value">{propertyDetail.lotSizeMeters} sq. meters</div>
                        </div>
                    )}

                    {propertyDetail.parcelNum && (
                        <div className="property-detail-row">
                        <div className="label">Parcel Number:</div>
                        <div className="value">{propertyDetail.parcelNum}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default memo(PropertyDetail);