// IMPORTS
import express from "express";
import * as path from "path";
import logger from "morgan";
import cors from "cors";
import 'dotenv/config'
import { checkApiKey } from "./config/checkKey.js";
import updateMap from "./map/update.js";

// CONFIG
const app = express();
app.use(cors())
app.use(logger('dev'));
app.use(express.json());
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

// UPDATE PATH 
// ✅ Serve the /public/map directory at /map
app.use("/map", express.static(path.join(__dirname, "public/map")));
app.put("/buildNote", checkApiKey, updateMap)

// CATCH ALL ROUTE => `index.html`
app.use(/.*/, function(req, res) {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// SERVER LISTENING
const port = process.env.PORT || 3001;
app.listen(port, function() {
  console.log(`Express app running on port ${port}`)
});