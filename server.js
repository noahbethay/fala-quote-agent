require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");

const db = require("./db");
const auth = require("./auth");
const { notifyNewLead, pushToSheetsWebhook } = require("./email");
const { scoreLead, carrierNote, referralCode, sanitizeLeadInput } = require("./leadLogic");

// Declarations-page uploads live next to the SQLite DB, so if DB_PATH points
// at a mounted volume (see README), uploads persist across deploys too.
const UPLOAD_DIR = path.join(path.dirname(db.DB_PATH || path.join(__dirname, "fala.db")), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_UPLOAD_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, "");
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => cb(null, ALLOWED_UPLOAD_TYPES.has(file.mimetype)),
});

const app = express();
// Railway (and most PaaS hosts) sit behind a reverse proxy. Without this,
// req.ip resolves to the proxy's IP for every request, which breaks the
// per-IP rate limiter below (everyone shares one bucket).
app.set("trust proxy", 1);
app.use(express.json({ limit: "200kb" }));

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: false,
  })
);

// --- Very small in-memory rate limiter for public endpoints (per IP) ---
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + ":" + req.path;
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) return res.status(429).json({ error: "Too many requests, try again shortly." });
    next();
  };
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---------- Public: non-secret config used by the quote/marketing pages ----------
app.get("/api/config/public", (req, res) => {
  const cfg = db.getConfig();
  const { pin, agentEmail, ...pub } = cfg;
  res.json(pub);
});

// ---------- Public: submit a new lead from the quote quiz ----------
app.post("/api/leads", rateLimit(10, 10 * 60 * 1000), async (req, res) => {
  try {
    const clean = sanitizeLeadInput(req.body);
    const { score, tags } = scoreLead(clean);
    const lead = {
      id: Date.now() + "-" + crypto.randomBytes(3).toString("hex"),
      createdAt: new Date().toISOString(),
      status: "New",
      score,
      tags,
      note: carrierNote(clean, tags),
      agentNote: "",
      refCode: referralCode(clean.name),
      addOns: [],
      ...clean,
    };
    const saved = db.insertLead(lead);
    const cfg = db.getConfig();
    notifyNewLead(saved, cfg).catch(() => {});
    pushToSheetsWebhook(saved).catch(() => {});
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Public: add an add-on request to an existing lead (post-submit cross-sell) ----------
app.patch("/api/leads/:id/addons", rateLimit(20, 10 * 60 * 1000), (req, res) => {
  const lead = db.getLead(req.params.id);
  if (!lead) return res.status(404).json({ error: "Not found" });
  const addOns = Array.isArray(req.body.addOns) ? req.body.addOns.slice(0, 20).map(String) : lead.addOns;
  const updated = db.updateLead(req.params.id, { addOns });
  res.json(updated);
});

// ---------- Public: optional declarations-page upload for an existing lead ----------
app.post(
  "/api/leads/:id/declarations",
  rateLimit(10, 10 * 60 * 1000),
  (req, res) => {
    upload.single("declarations")(req, res, (err) => {
      if (err) return res.status(400).json({ error: "Upload failed — PDF/JPG/PNG under 10MB only." });
      const lead = db.getLead(req.params.id);
      if (!lead) return res.status(404).json({ error: "Not found" });
      if (!req.file) return res.status(400).json({ error: "No file received — PDF/JPG/PNG under 10MB only." });
      const updated = db.updateLead(req.params.id, { declarationsFile: req.file.filename });
      res.json({ ok: true, lead: updated });
    });
  }
);

// ---------- Producer auth ----------
function safePinMatch(a, b) {
  // Hash both sides to fixed-length digests first so timingSafeEqual never
  // throws on a length mismatch (which would itself leak length info),
  // and so the comparison time doesn't vary with how many characters match.
  const ah = crypto.createHash("sha256").update(String(a)).digest();
  const bh = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}

app.post("/api/auth/pin", rateLimit(10, 10 * 60 * 1000), (req, res) => {
  const cfg = db.getConfig();
  if (safePinMatch(req.body.pin || "", cfg.pin)) {
    return res.json({ token: auth.issueToken() });
  }
  res.status(401).json({ error: "Incorrect passcode" });
});

// ---------- Producer dashboard (auth required beyond this point) ----------
const admin = express.Router();
admin.use(auth.requireAuth);

admin.get("/leads", (req, res) => res.json(db.listLeads()));

admin.patch("/leads/:id", (req, res) => {
  const allowed = ["status", "agentNote", "addOns"];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  const updated = db.updateLead(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

admin.delete("/leads/:id", (req, res) => {
  db.deleteLead(req.params.id);
  res.json({ ok: true });
});

admin.get("/leads/export.csv", (req, res) => {
  const leads = db.listLeads();
  const cols = ["createdAt", "status", "name", "phone", "email", "lineType", "parish", "score", "tags", "note", "agentNote"];
  const rows = [cols.join(",")].concat(
    leads.map((l) =>
      cols
        .map((c) => {
          let v = l[c];
          if (Array.isArray(v)) v = v.join("; ");
          v = v === undefined || v === null ? "" : String(v).replace(/"/g, '""');
          return `"${v}"`;
        })
        .join(",")
    )
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=fala-leads.csv");
  res.send(rows.join("\n"));
});

admin.get("/leads/:id/declarations", (req, res) => {
  const lead = db.getLead(req.params.id);
  if (!lead || !lead.declarationsFile) return res.status(404).json({ error: "No file on this lead" });
  const filePath = path.join(UPLOAD_DIR, lead.declarationsFile);
  if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  res.sendFile(filePath);
});

admin.get("/config", (req, res) => res.json(db.getConfig()));
admin.put("/config", (req, res) => {
  // Never let the passcode be blanked out accidentally
  const body = { ...req.body };
  if (!body.pin) delete body.pin;
  res.json(db.setConfig(body));
});

app.use("/api/admin", admin);

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`FALA app listening on :${PORT}`));
