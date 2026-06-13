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

const app = express();

// CORS configuration - must be before routes
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://preview.nubred.com",
      "https://governance.nubred.com",
      "https://node.nubred.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Routes
app.use("/api/auth", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/inquiry", inquiryRoutes);
app.use("/api/chat-history", chatRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/early-adopters", earlyAdopterRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

export default app;
