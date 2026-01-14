import express from "express";
import cors from "cors";
import userRoutes from "./routes/user.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import inquiryRoutes from "./routes/inquiry.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const app = express();

// CORS configuration - must be before routes
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// routes
app.use("/api/auth", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/inquiry", inquiryRoutes);
app.use("/api/chat-history", chatRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

export default app;
