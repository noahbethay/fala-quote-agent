const COASTAL_PARISHES = [
  "Orleans", "Jefferson", "Plaquemines", "St. Bernard", "St. Tammany", "Terrebonne",
  "Lafourche", "Cameron", "Vermilion", "Iberia", "St. Mary", "Calcasieu", "Tangipahoa",
];

function scoreLead(d) {
  let score = 0;
  const tags = [];
  if (d.lineType === "bundle") { score += 3; tags.push("bundle"); }
  if (d.purchaseStatus === "new") { score += 2; tags.push("new-purchase"); }
  if (d.nonRenewReason && String(d.nonRenewReason).startsWith("yes")) { score += 2; tags.push("non-renewed"); }
  if (d.roofAge === "16-20" || d.roofAge === "20+") tags.push("hard-to-place");
  if ((d.oldSystems || []).some((s) => s !== "None of these")) tags.push("hard-to-place");
  if (COASTAL_PARISHES.includes(d.parish)) tags.push("coastal");
  if (d.floodInterest === "want") { score += 1; tags.push("flood-opportunity"); }
  const discountCount =
    (d.discounts || []).filter((x) => x !== "None of these").length +
    (d.coastalRisk || []).filter((x) => x !== "None yet").length;
  score += discountCount;
  if (score >= 5) tags.push("hot");
  return { score, tags: [...new Set(tags)] };
}

function carrierNote(d, tags) {
  const notes = [];
  if (tags.includes("hard-to-place")) notes.push("Older roof/systems — check SageSure/Auros, Lilypad, or SureChoice before standard market.");
  if (tags.includes("non-renewed")) notes.push("Non-renewed — GuardianPointe or surplus lines may be the fastest path.");
  if (tags.includes("coastal")) notes.push("Coastal parish — ask about wind mitigation credits; keep Citizens as backstop.");
  if (tags.includes("bundle")) notes.push("Bundle opportunity — quote home+auto together for best combined rate.");
  if (tags.includes("flood-opportunity")) notes.push("Wants a flood quote — pull NFIP/private flood alongside HO.");
  if (d.purchaseStatus === "new") notes.push("Time-sensitive — has a closing date, prioritize same-day callback.");
  return notes.join(" ");
}

function referralCode(name) {
  const base = (name || "").replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "FALA";
  return base + Math.floor(1000 + Math.random() * 9000);
}

// Basic server-side validation of the intake payload. Keeps this permissive
// (the quiz already validates client-side) but blocks obviously bad/empty
// submissions and caps field sizes to prevent abuse.
function sanitizeLeadInput(body) {
  if (!body || typeof body !== "object") throw new Error("Invalid payload");
  const clean = {};
  for (const [k, v] of Object.entries(body)) {
    if (v == null) continue;
    if (Array.isArray(v)) clean[k] = v.slice(0, 20).map((x) => String(x).slice(0, 200));
    else clean[k] = String(v).slice(0, 500);
  }
  if (!clean.name || !clean.phone || !clean.email) {
    throw new Error("name, phone, and email are required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) throw new Error("Invalid email");
  return clean;
}

module.exports = { COASTAL_PARISHES, scoreLead, carrierNote, referralCode, sanitizeLeadInput };
