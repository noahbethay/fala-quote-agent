const crypto = require("crypto");

const SECRET = process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function issueToken() {
  return sign({ role: "producer", exp: Date.now() + TOKEN_TTL_MS });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: "Unauthorized" });
  next();
}

module.exports = { issueToken, verify, requireAuth };
