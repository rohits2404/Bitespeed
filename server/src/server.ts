import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet"

import { IdentifyController } from "./controllers/identify.controller";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());

app.use(express.json());

// Health check
app.get("/health", (_, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
    });
});

// Routes
const identifyController = new IdentifyController();
app.post("/identify", identifyController.identify);

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;