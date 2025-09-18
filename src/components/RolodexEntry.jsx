import { useState, memo } from "react";

const PropertyDetail = ({ entry }) => {

    if (!entry) return null;

    return (
        <div className="rolodex-items-container">
            {entry.name && (
                <div className="rolodex-detail-container">
                    <div>Name:</div>
                    <div>{entry.name}</div>
                </div>
            )}

            {entry.phone && (
                <div className="rolodex-detail-container">
                    <div>Number:</div>
                    <div>{entry.phone}</div>
                </div>
            )}

            {entry.email && (
                <div className="rolodex-detail-container">
                    <div>Email:</div>
                    <div>{entry.email}</div>
                </div>
            )}

            {entry.website && (
                <div className="rolodex-detail-container">
                    <div>Website:</div>
                    <a id="rolo-link" href={entry.website} target="_blank">{entry.website}</a>
                </div>
            )}

            {entry?.roles.length > 0 && (
                <div className="rolodex-detail-container">
                    <div>Roles:</div>
                    <div>{entry.roles.join(" ,")}</div>
                </div>
            )}
        </div>
    )
}

export default memo(PropertyDetail);