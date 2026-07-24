const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "fala.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New',
    score INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    note TEXT DEFAULT '',
    agentNote TEXT DEFAULT '',
    refCode TEXT,
    addOns TEXT NOT NULL DEFAULT '[]',
    data TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    json TEXT NOT NULL
  );
`);

const DEFAULT_CONFIG = {
  agentName: "Noah Bethay",
  agentPhone: "(504) 555-0100",
  agentEmail: "noah@fala-insurance.com",
  pin: "1955",
  avgSavings: 847,
  rating: 4.9,
  reviewCount: 312,
  carrierCount: 20,
  yearsInBusiness: 69,
  reviewLink: "#",
  referralBonus: 25,
};

function getConfig() {
  const row = db.prepare("SELECT json FROM config WHERE id = 1").get();
  if (!row) {
    db.prepare("INSERT INTO config (id, json) VALUES (1, ?)").run(JSON.stringify(DEFAULT_CONFIG));
    return { ...DEFAULT_CONFIG };
  }
  return { ...DEFAULT_CONFIG, ...JSON.parse(row.json) };
}

function setConfig(cfg) {
  const merged = { ...getConfig(), ...cfg };
  db.prepare(
    "INSERT INTO config (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json"
  ).run(JSON.stringify(merged));
  return merged;
}

function rowToLead(row) {
  if (!row) return null;
  return {
    ...JSON.parse(row.data),
    id: row.id,
    createdAt: row.createdAt,
    status: row.status,
    score: row.score,
    tags: JSON.parse(row.tags),
    note: row.note,
    agentNote: row.agentNote,
    refCode: row.refCode,
    addOns: JSON.parse(row.addOns),
  };
}

function listLeads() {
  const rows = db.prepare("SELECT * FROM leads ORDER BY createdAt DESC").all();
  return rows.map(rowToLead);
}

function getLead(id) {
  return rowToLead(db.prepare("SELECT * FROM leads WHERE id = ?").get(id));
}

function insertLead(lead) {
  const { id, createdAt, status, score, tags, note, agentNote, refCode, addOns, ...rest } = lead;
  db.prepare(
    `INSERT INTO leads (id, createdAt, status, score, tags, note, agentNote, refCode, addOns, data)
     VALUES (@id, @createdAt, @status, @score, @tags, @note, @agentNote, @refCode, @addOns, @data)`
  ).run({
    id,
    createdAt,
    status: status || "New",
    score: score || 0,
    tags: JSON.stringify(tags || []),
    note: note || "",
    agentNote: agentNote || "",
    refCode: refCode || "",
    addOns: JSON.stringify(addOns || []),
    data: JSON.stringify(rest),
  });
  return getLead(id);
}

function updateLead(id, patch) {
  const existing = getLead(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch, id };
  const { status, score, tags, note, agentNote, refCode, addOns, createdAt, ...rest } = merged;
  db.prepare(
    `UPDATE leads SET status=@status, score=@score, tags=@tags, note=@note, agentNote=@agentNote,
       refCode=@refCode, addOns=@addOns, data=@data WHERE id=@id`
  ).run({
    id,
    status,
    score,
    tags: JSON.stringify(tags || []),
    note: note || "",
    agentNote: agentNote || "",
    refCode: refCode || "",
    addOns: JSON.stringify(addOns || []),
    data: JSON.stringify(rest),
  });
  return getLead(id);
}

function deleteLead(id) {
  db.prepare("DELETE FROM leads WHERE id = ?").run(id);
}

module.exports = { db, getConfig, setConfig, listLeads, getLead, insertLead, updateLead, deleteLead, DEFAULT_CONFIG };
