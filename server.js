// IMPORTS
import * as dotenv from "dotenv";
dotenv.config();
import express from "express";
import * as path from "path";
import logger from "morgan";
import cors from "cors";
import { checkApiKey } from "./config/checkKey.js";
import { getMapFile, shutdownRedis } from "./redis/redis.js";
import updateMap from "./map/update.js";

// CONFIG
const app = express();
app.use(cors())
app.use(logger('dev'));
app.use(express.json());
const __dirname = path.resolve();

// ROUTES
app.get("/map", getMapFile);
app.put("/buildNote", checkApiKey, updateMap);

// CATCH ALL ROUTE => `index.html`
app.use(express.static(path.join(__dirname, 'dist')));
app.use(/.*/, function (req, res) {
	res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// SERVER LISTENING
const port = process.env.PORT || 3001;
const server = app.listen(port, function () {
	console.log(`Express app running on port ${port}`)
});

// CLEANUP
async function shutdown() {
    console.log("Shutting down...");
    await shutdownRedis();
    server.close(() => console.log("HTTP server closed"));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);