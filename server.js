require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { timingSafeEqual } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = Number(process.env.PORT) || 5001;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase environment configuration missing");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(bodyParser.json({ limit: "5mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "5mb",
    extended: true,
  })
);

function safeEqual(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));

  return (
    first.length === second.length &&
    timingSafeEqual(first, second)
  );
}

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN;

  if (!expected || expected.length < 32) {
    return res.status(503).json({
      error: "Admin API authentication not configured",
    });
  }

  const authorization = req.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Admin authentication required",
    });
  }

  const supplied = authorization.slice("Bearer ".length);

  if (!safeEqual(supplied, expected)) {
    return res.status(401).json({
      error: "Invalid admin credentials",
    });
  }

  next();
}

app.get("/", (req, res) => {
  res.json({
    name: "LeeHub Media API",
    status: "online",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "leehub-backend",
  });
});

// PUBLIC: fetch videos
app.get("/api/videos", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    const videos = (data || []).map((video) => ({
      id: video.id,
      title: video.title,
      channel: video.channel,
      length: video.length,
      price: video.price,
      desc: video.desc_source,
      thumb: video.thumb,
      uploadedAt: video.uploaded_at,
    }));

    return res.status(200).json(videos);
  } catch (error) {
    console.error("Video fetch failed:", error.message);

    return res.status(500).json({
      error: "Unable to load videos",
    });
  }
});

// ADMIN ONLY: publish videos
app.post("/api/videos", requireAdmin, async (req, res) => {
  const {
    id,
    title,
    channel,
    length,
    price,
    desc,
    thumb,
    uploadedAt,
  } = req.body || {};

  if (
    typeof title !== "string" ||
    typeof channel !== "string" ||
    !title.trim() ||
    !channel.trim()
  ) {
    return res.status(400).json({
      error: "Title and channel are required",
    });
  }

  const numericPrice = Number(price ?? 0);

  if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    return res.status(400).json({
      error: "Invalid video price",
    });
  }

  const video = {
    id: id || `vid_${crypto.randomUUID()}`,
    title: title.trim(),
    channel: channel.trim(),
    length: String(length || "0:00"),
    price: String(numericPrice),
    desc_source: String(desc || ""),
    thumb: String(thumb || ""),
    uploaded_at: uploadedAt || new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from("videos")
      .insert([video]);

    if (error) throw error;

    return res.status(201).json({
      success: true,
      id: video.id,
    });
  } catch (error) {
    console.error("Video publish failed:", error.message);

    return res.status(500).json({
      error: "Unable to publish video",
    });
  }
});

// ADMIN ONLY: delete videos
app.delete("/api/videos/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      error: "Video ID is required",
    });
  }

  try {
    const { error } = await supabase
      .from("videos")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("Video deletion failed:", error.message);

    return res.status(500).json({
      error: "Unable to delete video",
    });
  }
});

// Existing endpoint retained. No payment entitlement
// is granted until a verified payment integration exists.
app.get("/api/verify-video", (req, res) => {
  return res.status(200).json({
    purchased: false,
  });
});

// Payment integration not yet implemented.
app.post("/api/initialize-payment", (req, res) => {
  return res.status(501).json({
    success: false,
    error: "Payment gateway not configured",
  });
});

app.get("/api/check-payment-status", (req, res) => {
  return res.status(200).json({
    status: "unverified",
    paid: false,
  });
});

// The existing homepage uses these paths.
// Do not report fake successful transactions.
app.post("/api/payments/initiate", (req, res) => {
  return res.status(501).json({
    success: false,
    error: "Payment gateway not configured",
  });
});

app.get("/api/payments/status/:id", (req, res) => {
  return res.status(200).json({
    status: "unverified",
    paid: false,
  });
});

app.listen(PORT, () => {
  console.log(`LeeHub Media backend running on port ${PORT}`);
});