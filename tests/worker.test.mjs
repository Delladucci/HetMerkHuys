import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import worker, { calc, shipping, verifySignature } from "../worker.js";
import { CATALOG } from "../catalog.js";

function mockKV(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { async get(k, t) { const v = m.get(k); if (v === undefined) return null; return t === "json" ? JSON.parse(v) : v; }, async put(k, v) { m.set(k, v); }, _m: m };
}
function sign(body, secret, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=` + crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
}
function env(extra = {}) {
  return { CHECKOUT_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", RESEND_API_KEY: "re_x", STOCK: mockKV(), ASSETS: { fetch: async () => new Response("asset") }, ...extra };
}
let calls;
function mockFetch() {
  calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes("stripe.com")) return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_1", id: "cs_test_1" }), { status: 200 });
    return new Response(JSON.stringify({ id: "mail1" }), { status: 200 });
  };
}
const post = (path, body, headers = {}) => new Request("https://hetmerkhuys.nl" + path, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });

test("prijzen kloppen met de staffels", () => {
  assert.equal(calc(CATALOG["bowie-groen"], 1), 1299);
  assert.equal(calc(CATALOG["bowie-groen"], 4), 4500);
  assert.equal(calc(CATALOG["bowie-groen"], 5), 5799);
  assert.equal(calc(CATALOG["wandrek-metaal"], 2), 9900);
  assert.equal(calc(CATALOG["wandrek-metaal"], 3), 15899);
});

test("verzendkosten: gratis vanaf 75, extra pakket 6,95, ophalen gratis", () => {
  assert.equal(shipping({ "bowie-groen": 1 }, 1299, "verzenden").cents, 695);
  assert.equal(shipping({ "klok-levy": 1 }, 7999, "verzenden").cents, 0);
  assert.equal(shipping({ "klok-levy": 2 }, 15998, "verzenden").cents, 695);
  assert.equal(shipping({ "klok-levy": 2 }, 15998, "ophalen").cents, 0);
  assert.equal(shipping({ "allibert-hortza-manden": 6 }, 5394, "verzenden").parcels, 1);
  assert.equal(shipping({ "allibert-hortza-manden": 7 }, 6293, "verzenden").parcels, 2);
});

test("checkout: uit zolang CHECKOUT_ENABLED niet true is", async () => {
  mockFetch();
  const r = await worker.fetch(post("/api/checkout", { cart: { "klok-levy": 1 } }), env({ CHECKOUT_ENABLED: "false" }));
  assert.equal(r.status, 503);
  assert.equal(calls.length, 0);
});

test("checkout: ongeldig mandje en te hoge aantallen worden geweigerd", async () => {
  mockFetch();
  assert.equal((await worker.fetch(post("/api/checkout", { cart: { nep: 1 } }), env())).status, 400);
  assert.equal((await worker.fetch(post("/api/checkout", { cart: { "klok-levy": 0 } }), env())).status, 400);
  assert.equal((await worker.fetch(post("/api/checkout", { cart: { "klok-levy": 2 } }), env())).status, 409);
  assert.equal(calls.length, 0);
});

test("checkout: server rekent zelf, prijs uit het verzoek wordt genegeerd", async () => {
  mockFetch();
  const r = await worker.fetch(post("/api/checkout", { cart: { "bowie-groen": 4 }, delivery: "verzenden", price: 1 }), env());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).url, "https://checkout.stripe.com/c/pay/cs_test_1");
  const body = decodeURIComponent(calls[0].opts.body);
  assert.match(body, /line_items\[0\]\[price_data\]\[unit_amount\]=4500/);
  assert.match(body, /shipping_options\[0\]\[shipping_rate_data\]\[fixed_amount\]\[amount\]=695/);
  assert.match(body, /shipping_address_collection\[allowed_countries\]\[0\]=NL/);
  assert.match(body, /metadata\[cart\]=bowie-groen:4/);
  assert.equal(calls[0].opts.headers.authorization, "Bearer sk_test_x");
});

test("checkout: ophalen heeft geen adres en 0 verzendkosten", async () => {
  mockFetch();
  await worker.fetch(post("/api/checkout", { cart: { "klok-levy": 1 }, delivery: "ophalen" }), env());
  const body = decodeURIComponent(calls[0].opts.body);
  assert.match(body, /fixed_amount\]\[amount\]=0/);
  assert.doesNotMatch(body, /shipping_address_collection/);
  assert.match(body, /billing_address_collection=required/);
});

test("webhook: ongeldige handtekening wordt geweigerd", async () => {
  mockFetch();
  const body = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });
  assert.equal((await worker.fetch(post("/api/webhook", body, { "stripe-signature": "t=1,v1=abc" }), env())).status, 400);
  assert.equal(await verifySignature(body, sign(body, "whsec_x", 1), "whsec_x"), false); // te oud
});

function paidEvent(id = "cs_1", cart = "klok-levy:1", delivery = "verzenden") {
  return JSON.stringify({ type: "checkout.session.completed", data: { object: {
    id, payment_status: "paid", amount_total: 8694, payment_intent: "pi_1", metadata: { cart, delivery },
    customer_details: { email: "klant@example.nl", name: "Piet", phone: "0612345678" },
    collected_information: { shipping_details: { name: "Piet", address: { line1: "Straat 1", postal_code: "1234 AB", city: "Heel", country: "NL" } } }
  } } });
}

test("webhook: betaling verlaagt voorraad, mailt klant en eigenaar, en wordt maar één keer verwerkt", async () => {
  mockFetch();
  const e = env();
  const body = paidEvent();
  const r1 = await worker.fetch(post("/api/webhook", body, { "stripe-signature": sign(body, "whsec_x") }), e);
  assert.equal(r1.status, 200);
  const stock = JSON.parse(e.STOCK._m.get("stock"));
  assert.equal(stock["klok-levy"], 0);
  const mails = calls.filter((c) => c.url.includes("resend.com"));
  assert.equal(mails.length, 2);
  assert.deepEqual(JSON.parse(mails[0].opts.body).to, ["klant@example.nl"]);
  assert.deepEqual(JSON.parse(mails[1].opts.body).to, ["info@hetmerkhuys.nl"]);
  assert.match(JSON.parse(mails[1].opts.body).html, /Straat 1/);
  // herhaling van hetzelfde bericht
  const r2 = await worker.fetch(post("/api/webhook", body, { "stripe-signature": sign(body, "whsec_x") }), e);
  assert.equal(r2.status, 200);
  assert.equal(calls.filter((c) => c.url.includes("resend.com")).length, 2);
});

test("webhook: te veel verkocht geeft waarschuwing aan de eigenaar", async () => {
  mockFetch();
  const e = env({ STOCK: mockKV({ stock: JSON.stringify({ "klok-levy": 0 }) }) });
  const body = paidEvent("cs_2");
  await worker.fetch(post("/api/webhook", body, { "stripe-signature": sign(body, "whsec_x") }), e);
  const owner = calls.filter((c) => c.url.includes("resend.com")).map((c) => JSON.parse(c.opts.body)).find((m) => m.to[0] === "info@hetmerkhuys.nl");
  assert.match(owner.subject, /TE VEEL VERKOCHT/);
});

test("webhook: onbetaalde sessie doet niets", async () => {
  mockFetch();
  const e = env();
  const ev = JSON.parse(paidEvent("cs_3")); ev.data.object.payment_status = "unpaid";
  const body = JSON.stringify(ev);
  assert.equal((await worker.fetch(post("/api/webhook", body, { "stripe-signature": sign(body, "whsec_x") }), e)).status, 200);
  assert.equal(e.STOCK._m.has("stock"), false);
});

test("stock-endpoint en doorverwijzing naar de site", async () => {
  const e = env();
  const s = await (await worker.fetch(new Request("https://hetmerkhuys.nl/api/stock"), e)).json();
  assert.equal(s.checkout, true);
  assert.equal(s.stock["allibert-hortza-manden"], 20);
  assert.equal(await (await worker.fetch(new Request("https://hetmerkhuys.nl/"), e)).text(), "asset");
});

test("catalogus staat gelijk aan script.js", async () => {
  const { execSync } = await import("node:child_process");
  const before = (await import("node:fs")).readFileSync(new URL("../catalog.js", import.meta.url), "utf8");
  execSync("node tools/sync-catalog.mjs", { cwd: new URL("..", import.meta.url).pathname });
  const after = (await import("node:fs")).readFileSync(new URL("../catalog.js", import.meta.url), "utf8");
  assert.equal(before, after);
});
