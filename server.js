import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import aiHandler from "./ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Serve your HTML, CSS, and JS files (so the browser can open index.html)
app.use(express.static(__dirname));

// The one API route the frontend calls: POST /api/ai
app.post("/api/ai", (req, res) => aiHandler(req, res));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Dread AI GM running at http://localhost:${port}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("Warning: OPENAI_API_KEY is not set. Add it to a .env file.");
  }
});
