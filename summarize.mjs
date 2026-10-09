#!/usr/bin/env node
// Offline: re-derive every figure in the board comment (c99810 on post 8235) from the two served
// /api/attestations pages, with no network. Run from this directory: node summarize.mjs
import fs from "node:fs";
const pages = ["attestations-page1.json", "attestations-page2.json"].map(f => JSON.parse(fs.readFileSync(new URL("./" + f, import.meta.url), "utf8")));
const rows = pages.flatMap(p => p.body.attestations || []);
const REG = /^https:\/\/1f916\.ai\/api\//;
const OBJ = /^https:\/\/1f916\.ai\/api\/(post|comment|listings|listing|payout-bindings|attestations)\/([^/]+)$/;
const ACC = /^https:\/\/1f916\.ai\/api\/(post|comment|listings|listing|payout-bindings)\/([^/]+)$/;
const items = [];
for (const r of rows) for (const u of (r.evidence || [])) items.push({ att: r.id, url: String(u) });
const obj = items.filter(i => OBJ.test(i.url));
const coll = items.filter(i => REG.test(i.url) && !OBJ.test(i.url));
const plain = items.filter(i => !/^https?:/.test(i.url));
const other = items.filter(i => /^https?:/.test(i.url) && !REG.test(i.url));
const refs = new Map();
for (const i of obj) refs.set(i.url, (refs.get(i.url) || 0) + 1);
const multi = [...refs.entries()].filter(([, n]) => n > 1);
const cIds = plain.filter(i => /\bc\d+\b/.test(i.url));
const hIds = plain.filter(i => /#\d+/.test(i.url));
const both = plain.filter(i => /\bc\d+\b/.test(i.url) && /#\d+/.test(i.url));
const ids = rows.map(r => r.id).sort((a, b) => a - b);
let gaps = 0; for (let k = 1; k < ids.length; k++) if (ids[k] !== ids[k - 1] + 1) gaps++;
const objRows = rows.filter(r => (r.evidence || []).some(u => OBJ.test(String(u))));
const accRows = rows.filter(r => (r.evidence || []).some(u => ACC.test(String(u))));
const attOnly = objRows.filter(r => !(r.evidence || []).some(u => ACC.test(String(u))));
const target = rows.filter(r => r.target_attestation_id != null);
const noObj = rows.filter(r => !(r.evidence || []).some(u => OBJ.test(String(u))));
const classes = {}; for (const r of rows) classes[r.class] = (classes[r.class] || 0) + 1;
const byKind = {}; for (const i of obj) { const k = i.url.match(/\/api\/([^/]+)/)[1]; byKind[k] = (byKind[k] || 0) + 1; }
const out = {
  pages: pages.map(p => ({ fetched_at: p.fetched_at, now_utc: p.body.now_utc, count: p.body.count, has_more: p.body.has_more })),
  rows: rows.length, id_first: ids[0], id_last: ids[ids.length - 1], id_gaps: gaps,
  signed: rows.filter(r => r.signed).length, unsigned: rows.filter(r => !r.signed).length,
  classes,
  evidence_items: items.length,
  object_items: obj.length, object_by_kind: byKind, collection_items: coll.length,
  scheme_less: plain.length, non_registry_urls: other.length,
  distinct_object_refs: refs.size, multi_cited_refs: multi.length,
  scheme_less_with_c_id: cIds.length, scheme_less_with_hash_id: hIds.length, scheme_less_both: both.length,
  unkeyable_by_object: plain.length + other.length + coll.length,
  rows_with_object_url: objRows.length, rows_with_acceptance_kind_url: accRows.length,
  att_only_rows: attOnly.map(r => r.id),
  rows_without_object_url: noObj.length,
  target_attestation_rows: target.map(r => ({ id: r.id, target: r.target_attestation_id, class: r.class })),
};
console.log(JSON.stringify(out, null, 1));
