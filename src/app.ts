import express from "express";
import cors from "cors";
import helmet from "helmet";
import { healthRoutes } from "./api/health-routes.js";
import { conversationRoutes } from "./api/conversation-routes.js";
import { triggerRoutes } from "./api/trigger-routes.js";
import { apiAuthMiddleware } from "./middleware/api-auth-middleware.js";
import { errorHandler } from "./middleware/error-handler.js";
import { kommoWebhookRouter } from "./webhooks/kommo-standard-handler.js";
import { chatApiWebhookRouter } from "./webhooks/chatapi-webhook-handler.js";
import { whatsAppWebhookRouter } from "./webhooks/whatsapp-webhook-handler.js";

const app = express();

// Security & parsing middleware with body size limits (M5)
app.use(helmet());
app.use(cors());
// Capture raw body for webhook signature verification (Phase A)
app.use(
  express.json({
    limit: "50kb",
    verify: (req, _res, buf) => {
      (req as unknown as Record<string, unknown>).rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// Public routes — no auth required (webhooks)
app.use("/webhooks", kommoWebhookRouter);      // Phase B: standard Kommo webhooks
app.use("/webhooks", chatApiWebhookRouter);     // Phase A: Kommo ChatAPI (outgoing)
app.use("/webhooks", whatsAppWebhookRouter);    // Phase A: WhatsApp Cloud API (incoming)
app.use("/health", healthRoutes); // H3: health check accessible without API key

// Protected API routes — require API key
app.use("/api", apiAuthMiddleware);
app.use("/api", conversationRoutes);
app.use("/api", triggerRoutes);

// Global error handler
app.use(errorHandler);

export { app };
