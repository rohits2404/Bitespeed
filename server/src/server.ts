import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet"

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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;