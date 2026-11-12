import "dotenv/config";
import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import userRoutes from "./routes/user.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import inquiryRoutes from "./routes/inquiry.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import blogRoutes from "./routes/blog.routes.js";
import earlyAdopterRoutes from "./routes/early-adopter.routes.js";
import projectRoutes from "./routes/project.routes.js";
import adminClientRoutes from "./routes/admin-client.routes.js";
import adminMasterFilterRoutes from "./routes/admin-master-filter.routes.js";
import masterFilterRoutes from "./routes/master-filter.routes.js";
import usageRoutes from "./routes/usage.routes.js";
import invitationRoutes from "./routes/invitation.routes.js";
import { isAllowedApiOrigin } from "./lib/api-cors.js";

const app = express();

// CORS configuration - must be before routes.
// credentials: true, so the matching origin is echoed. A "*" entry would not.
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedApiOrigin(origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-Slug"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
);

// Webhook routes use express.raw() internally and must be registered BEFORE
// express.json() so the raw body is preserved for Clerk signature verification.
app.use("/webhooks", webhookRoutes);

// Clerk middleware initialises req.auth on every request.
// Must be added before any route that calls requireAuth() / getAuth().
app.use(clerkMiddleware());

const json50kb = express.json({ limit: "50kb" });
const json3mb = express.json({ limit: "3mb" });
app.use((req, res, next) => {
  const largePatch =
    req.method === "PATCH" &&
    /^\/api\/admin\/master-filters\/[^/]+$/.test(req.path);
  return (largePatch ? json3mb : json50kb)(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Routes
app.use("/api/auth", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/inquiry", inquiryRoutes);
app.use("/api/chat-history", chatRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/early-adopters", earlyAdopterRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/admin/clients", adminClientRoutes);
app.use("/api/admin/master-filters", adminMasterFilterRoutes);
app.use("/api/master-filters", masterFilterRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/invitations", invitationRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

export default app;
