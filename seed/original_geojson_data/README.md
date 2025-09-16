# Original GeoJSON Data

## Overview
This folder contains the original, unprocessed GeoJSON data files collected from local government data files related to the recent California wildfires in the Greater Los Angeles Area.

The files represent ~20,000+ parcels and their data / features in valid GeoJSON format that will be used to build a map for fire victims and contractors who would like to help them rebuild. 

This Original (4) GeoJSON Data Sets are stored in the current `./original_geojson_data` directory and will be used to generate three starting point files -> 

### Base Source
The `base_source` represents the primary data layer for the map, regardless of whether a user is logged in. It contains the parcel number, full address, and the coordinates for mapping each parcel to the map.

### Master Source
The `master_source` will be used to represent all other data and is meant to be used when a `User` is logged into the application. This master source is meant to hold all layers and allow a user full access to all data. 

### Master Index
The `master_index` is our 'gold standard' / 'source of truth' for the map. It will be used to store ALL sets of information related to the properties contained in the original datasets. We can then update that specific row in the index, generate a fresh FeatureCollection (geojson file), and use the Master Index to regenrate the Base Source, Master Source, and all layer / properties changes that have been implemented. 