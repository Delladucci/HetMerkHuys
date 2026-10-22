// Maakt catalog.js (de prijslijst voor de server) uit script.js, zodat prijzen maar op één plek staan.
// Gebruik: node tools/sync-catalog.mjs
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");

function grab(startMarker, endMarker) {
  const i = src.indexOf(startMarker);
  if (i < 0) throw new Error("niet gevonden: " + startMarker);
  const j = src.indexOf(endMarker, i);
  return src.slice(i + startMarker.length, j);
}

const ctx = vm.createContext({});
const products = vm.runInContext("(" + "[" + grab("var PRODUCTS = [", "\n  ];\n") + "\n  ]" + ")", ctx);
const ship = vm.runInContext("(" + grab("var SHIP = ", ";\n") + ")", ctx);
const units = vm.runInContext("(" + grab("var SHIP_UNITS = ", ";\n") + ")", ctx);

const products_out = {};
for (const p of products) {
  products_out[p.id] = { name: p.name, tiers: p.tiers, units: units[p.id] != null ? units[p.id] : 1, stock: p.stock };
}

const out = `// GEGENEREERD door tools/sync-catalog.mjs uit script.js. Niet met de hand aanpassen.
export const SHIP = ${JSON.stringify(ship)};
export const CATALOG = ${JSON.stringify(products_out, null, 2)};
`;
fs.writeFileSync(new URL("../catalog.js", import.meta.url), out);
console.log("catalog.js geschreven:", Object.keys(products_out).length, "artikelen");
