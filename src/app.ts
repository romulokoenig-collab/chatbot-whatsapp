import express from "express";
import cors from "cors";
import helmet from "helmet";
import { healthRoutes } from "./api/health-routes.js";
import { conversationRoutes } from "./api/conversation-routes.js";
import { triggerRoutes } from "./api/trigger-routes.js";
import { apiAuthMiddleware } from "./middleware/api-auth-middleware.js";
import { errorHandler } from "./middleware/error-handler.js";
import { kommoWebhookRouter } from "./webhooks/kommo-standard-handler.js";

const app = express();

// Security & parsing middleware with body size limits (M5)
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// Public routes — no auth required
app.use("/webhooks", kommoWebhookRouter);
app.use("/health", healthRoutes); // H3: health check accessible without API key

// Protected API routes — require API key
app.use("/api", apiAuthMiddleware);
app.use("/api", conversationRoutes);
app.use("/api", triggerRoutes);

// Global error handler
app.use(errorHandler);

export { app };
