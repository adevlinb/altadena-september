# SEED.JS

Purpose: Brief explanation of the seed file, how it works, why do this process.

## Description

The data being used for this fire recovery map is from a local government (local to Los Angeles) dataset that is publicly available. While the dataset is in geojson format (needed to display in a mapbox map), the data still has to be processed in order for it to show up on a mapbox map. Layers have to be built. With the end user in mind, ideally we would want a system where non-account holders (open to public) would potentially have access to view basic map data, while confirmed account holders would have access to extended map data that might be considered more private. Along the way, the main project's engineer might also want to change / make adjustments to which layers belong in which feature set and adjust layers, etc.

This seed file is used to generate the initial datasets that are to be used in the mapbox map, as well as a master-index, which is used for every future update as a `source-of-truth` for making updates to parcels, rebuilding layer formulas, and then rebuilding the data sources accordingly. **You should not be making adjustments to this file... any changes you may wish to make are most likely in `/map`... go read the README file in `/map`!**