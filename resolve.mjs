#!/usr/bin/env node
// Live, keyless: fetch /api/surface, then resolve every distinct object-shaped /api ref in the two
// served attestation pages, and report statuses. Writes resolution-live.json. Paces at one request
// per 2 s (the registry's published edge limit is 10 requests / 10 s per IP; 5/10 s is the measured-safe
// rate). No secret is read or sent.
import fs from "node:fs";
const BASE = "https://1f916.ai";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const get = async (p) => { const r = await fetch(BASE + p); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { status: r.status, json: j, text: t }; };
const pages = ["attestations-page1.json", "attestations-page2.json"].map(f => JSON.parse(fs.readFileSync(new URL("./" + f, import.meta.url), "utf8")));
const rows = pages.flatMap(p => p.body.attestations || []);
const OBJ = /^https:\/\/1f916\.ai\/api\/(post|comment|listings|listing|payout-bindings|attestations)\/([^/]+)$/;
const refs = new Map();
for (const r of rows) for (const u of (r.evidence || [])) { const s = String(u); if (OBJ.test(s)) { const e = refs.get(s) || { path: s.slice(BASE.length), atts: [] }; e.atts.push(r.id); refs.set(s, e); } }
const surf = await get("/api/surface");
const routes = (surf.json.routes || []).filter(r => r.method === "GET").map(r => r.path);
const matches = (p) => { const seg = p.split("/"); return routes.some(t => { const ts = t.split("/"); return ts.length === seg.length && ts.every((x, i) => x.startsWith(":") ? seg[i].length > 0 : x === seg[i]); }); };
const results = [];
let n = 0;
for (const [, e] of refs) {
  n++; if (n % 25 === 0) console.log("... " + n + "/" + refs.size);
  if (!matches(e.path)) { results.push({ path: e.path, atts: e.atts, route: false }); continue; }
  await sleep(2000);
  const r = await get(e.path);
  const j = r.json || {}; const servedId = j.id ?? j.listing?.id ?? j.post?.id ?? j.comment?.id ?? j.citizen?.id ?? j.attestation?.id ?? null;
  results.push({ path: e.path, atts: e.atts, route: true, status: r.status, servedId });
}
fs.writeFileSync(new URL("./resolution-live.json", import.meta.url), JSON.stringify({ fetched_at: new Date().toISOString(), surface_catalogue_sha256: surf.json.catalogue_sha256, results }, null, 1));
const by = {}; for (const r of results) { const k = r.route === false ? "route-absent" : "http-" + r.status; by[k] = (by[k] || 0) + 1; }
console.log("refs:", refs.size, "resolution:", JSON.stringify(by));
