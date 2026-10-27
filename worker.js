// HetMerkhuys: betalen met Stripe, voorraad bijhouden en bestelmails.
// Draait op Cloudflare als Worker naast de statische site. Alle andere adressen gaan naar de site zelf.
//
// Instellingen (in Cloudflare, onder Settings > Variables and Secrets):
//   STRIPE_SECRET_KEY      (secret)  sk_test_... of sk_live_...
//   STRIPE_WEBHOOK_SECRET  (secret)  whsec_...
//   RESEND_API_KEY         (secret)  re_...
//   CHECKOUT_ENABLED       (tekst)   "true" zodra online betalen open mag voor klanten
//   OWNER_EMAIL            (tekst)   optioneel, standaard info@hetmerkhuys.nl
// KV-opslag "STOCK" (zie wrangler.toml) bewaart de actuele voorraad.

import { CATALOG, SHIP, GROUPS } from "./catalog.js";

const MAIL_FROM = "HetMerkhuys <info@hetmerkhuys.nl>";
const DEFAULT_OWNER = "info@hetmerkhuys.nl";
const STOCK_KEY = "stock";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/* ---------- prijzen (zelfde regels als in script.js) ---------- */

export function calc(product, qty) {
  const tiers = product.tiers.slice().sort((a, b) => b.q - a.q);
  let rem = qty;
  let cents = 0;
  for (const t of tiers) {
    const n = Math.floor(rem / t.q);
    cents += n * Math.round(t.p * 100);
    rem -= n * t.q;
  }
  return cents; // in centen
}

// Combi-korting: artikelen met dezelfde groep (bv. plaids) tellen samen mee. Geeft de korting per stuk in centen.
export function groupOffCents(cart, group) {
  const g = GROUPS[group];
  if (!g) return 0;
  let n = 0;
  for (const [id, qty] of Object.entries(cart)) if (CATALOG[id] && CATALOG[id].group === group) n += qty;
  let off = 0;
  for (const t of g.tiers) if (n >= t.q) off = Math.round(t.off * 100);
  return off;
}

// Prijs van één regel in het mandje (in centen), inclusief combi-korting.
export function lineCents(cart, id) {
  const p = CATALOG[id];
  let cents = calc(p, cart[id]);
  if (p.group) cents -= groupOffCents(cart, p.group) * cart[id];
  return cents;
}

export function shipping(cart, goodsCents, delivery) {
  if (delivery === "ophalen") return { cents: 0, parcels: 0, free: false };
  let units = 0;
  for (const [id, qty] of Object.entries(cart)) units += CATALOG[id].units * qty;
  const parcels = Math.max(1, Math.ceil(Math.round(units * 100) / 100));
  const free = goodsCents >= SHIP.freeFrom * 100;
  const paid = parcels - (free ? 1 : 0);
  return { cents: paid * Math.round(SHIP.price * 100), parcels, free };
}

/* ---------- voorraad ---------- */

async function readStock(env) {
  const base = {};
  for (const [id, p] of Object.entries(CATALOG)) base[id] = p.stock;
  if (!env.STOCK) return base;
  try {
    const saved = await env.STOCK.get(STOCK_KEY, "json");
    if (saved && typeof saved === "object") {
      for (const id of Object.keys(base)) {
        if (Number.isFinite(saved[id])) base[id] = Math.max(0, Math.floor(saved[id]));
      }
    }
  } catch (e) { /* val terug op de standaardvoorraad */ }
  return base;
}

/* ---------- Stripe ---------- */

// Zet een object om naar Stripe's formulierformaat (a[b][0]=c).
function formEncode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => {
      if (item !== null && typeof item === "object") formEncode(item, `${key}[${i}]`, out);
      else out.push(encodeURIComponent(`${key}[${i}]`) + "=" + encodeURIComponent(item));
    });
    else if (typeof v === "object") formEncode(v, key, out);
    else out.push(encodeURIComponent(key) + "=" + encodeURIComponent(v));
  }
  return out;
}

async function stripe(env, path, body) {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.STRIPE_SECRET_KEY,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: formEncode(body).join("&")
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Stripe: " + (data.error && data.error.message ? data.error.message : res.status));
  return data;
}

function cleanCart(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const cart = {};
  for (const [id, raw] of Object.entries(input)) {
    const qty = Number(raw);
    if (!CATALOG[id] || !Number.isInteger(qty) || qty < 1 || qty > 99) return null;
    cart[id] = qty;
  }
  return Object.keys(cart).length ? cart : null;
}

export async function handleCheckout(request, env) {
  if (env.CHECKOUT_ENABLED !== "true" || !env.STRIPE_SECRET_KEY) {
    return json({ error: "Online betalen is nog niet beschikbaar." }, 503);
  }
  let payload;
  try { payload = await request.json(); } catch (e) { return json({ error: "Ongeldige bestelling." }, 400); }

  const cart = cleanCart(payload.cart);
  if (!cart) return json({ error: "Je mandje is leeg of ongeldig." }, 400);
  const delivery = payload.delivery === "ophalen" ? "ophalen" : "verzenden";

  const stock = await readStock(env);
  for (const [id, qty] of Object.entries(cart)) {
    if (qty > stock[id]) {
      return json({ error: stock[id] > 0
        ? `Van ${CATALOG[id].name} zijn er nog maar ${stock[id]}. Pas je mandje aan.`
        : `${CATALOG[id].name} is helaas net uitverkocht.`, soldOut: id }, 409);
    }
  }

  const lines = [];
  let goods = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const cents = lineCents(cart, id);
    goods += cents;
    lines.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: cents,
        product_data: { name: qty > 1 ? `${CATALOG[id].name} (${qty} stuks)` : CATALOG[id].name }
      }
    });
  }
  const ship = shipping(cart, goods, delivery);
  const origin = new URL(request.url).origin;

  const params = {
    mode: "payment",
    locale: "nl",
    line_items: lines,
    success_url: origin + "/bedankt.html?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/",
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    phone_number_collection: { enabled: true },
    billing_address_collection: delivery === "ophalen" ? "required" : "auto",
    metadata: {
      cart: Object.entries(cart).map(([id, q]) => id + ":" + q).join(";"),
      delivery
    },
    shipping_options: [{
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: ship.cents, currency: "eur" },
        display_name: delivery === "ophalen"
          ? "Ophalen (adres volgt na je bestelling)"
          : (ship.cents === 0 ? "Gratis verzending met PostNL" : "Verzending met PostNL")
      }
    }]
  };
  if (delivery === "verzenden") params.shipping_address_collection = { allowed_countries: ["NL"] };

  try {
    const session = await stripe(env, "checkout/sessions", params);
    return json({ url: session.url });
  } catch (e) {
    console.error(e.message);
    return json({ error: "Betalen starten is niet gelukt. Probeer het zo nog eens of mail ons." }, 502);
  }
}

/* ---------- webhook: betaling gelukt ---------- */

function hex(buf) { return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); }

export async function verifySignature(rawBody, header, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const parts = {};
  for (const piece of header.split(",")) {
    const [k, v] = piece.split("=");
    (parts[k] = parts[k] || []).push(v);
  }
  const t = parts.t && parts.t[0];
  if (!t || !parts.v1) return false;
  if (Math.abs(nowSec - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + rawBody)));
  return parts.v1.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
}

function timingSafeEqual(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function escHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function euro(cents) { return "€ " + (cents / 100).toFixed(2).replace(".", ","); }

function parseCart(meta) {
  const cart = {};
  String((meta && meta.cart) || "").split(";").forEach((pair) => {
    const [id, q] = pair.split(":");
    if (CATALOG[id] && Number(q) > 0) cart[id] = Number(q);
  });
  return cart;
}

async function sendMail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) { console.error("RESEND_API_KEY ontbreekt, mail niet verstuurd:", subject); return false; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, reply_to: env.OWNER_EMAIL || DEFAULT_OWNER })
  });
  if (!res.ok) console.error("Resend fout", res.status, await res.text());
  return res.ok;
}

export async function processPaidSession(env, session) {
  const sessionId = session.id;
  // Elke betaling maar één keer verwerken (Stripe kan een bericht herhalen).
  if (env.STOCK && await env.STOCK.get("order:" + sessionId)) return { skipped: true };

  const cart = parseCart(session.metadata);
  const delivery = session.metadata && session.metadata.delivery === "ophalen" ? "ophalen" : "verzenden";

  // Voorraad verlagen
  const stock = await readStock(env);
  const oversold = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (stock[id] < qty) oversold.push(`${CATALOG[id].name} (besteld ${qty}, voorraad ${stock[id]})`);
    stock[id] = Math.max(0, stock[id] - qty);
  }
  if (env.STOCK) {
    await env.STOCK.put(STOCK_KEY, JSON.stringify(stock));
    await env.STOCK.put("order:" + sessionId, new Date().toISOString(), { expirationTtl: 60 * 60 * 24 * 90 });
  }

  const cust = session.customer_details || {};
  const ship = (session.collected_information && session.collected_information.shipping_details) || session.shipping_details || null;
  const name = (ship && ship.name) || cust.name || "";
  const addr = ship && ship.address ? ship.address : null;
  const addrText = addr
    ? [addr.line1, addr.line2, [addr.postal_code, addr.city].filter(Boolean).join(" "), addr.country].filter(Boolean).join(", ")
    : "";

  const itemRows = Object.entries(cart).map(([id, qty]) =>
    `<tr><td style="padding:4px 12px 4px 0">${escHtml(CATALOG[id].name)}</td><td style="padding:4px 12px">${qty} stuk${qty > 1 ? "s" : ""}</td><td style="padding:4px 0;text-align:right">${euro(lineCents(cart, id))}</td></tr>`
  ).join("");
  const table = `<table style="border-collapse:collapse;font-size:15px">${itemRows}</table>`;
  const total = euro(session.amount_total || 0);
  const deliveryLine = delivery === "ophalen"
    ? "Ophalen. Het ophaaladres en een tijdstip sturen we je in een aparte mail."
    : "Verzending met PostNL naar: " + escHtml(addrText);

  const customerHtml = `<div style="font-family:Arial,sans-serif;color:#2A1F18;line-height:1.5">
<p>Hallo ${escHtml(name || "")},</p>
<p>Bedankt voor je bestelling bij HetMerkhuys. Je betaling is gelukt.</p>
${table}
<p><strong>Totaal betaald: ${total}</strong></p>
<p>${deliveryLine}</p>
<p>Je mag je bestelling binnen 14 dagen herroepen. De voorwaarden en het retourbeleid staan op de site. Vragen? Antwoord gewoon op deze mail.</p>
<p>Groet,<br>HetMerkhuys<br>Bureau Leduc &middot; KvK 97183539</p></div>`;

  const ownerHtml = `<div style="font-family:Arial,sans-serif;color:#2A1F18;line-height:1.5">
<p><strong>Nieuwe betaalde bestelling</strong></p>
${oversold.length ? `<p style="color:#b00020"><strong>Let op: te veel verkocht.</strong> ${escHtml(oversold.join("; "))}. Neem contact op met de klant en betaal zo nodig terug in Stripe.</p>` : ""}
${table}
<p><strong>Totaal: ${total}</strong></p>
<p>Klant: ${escHtml(name)}<br>E-mail: ${escHtml(cust.email || "")}<br>Telefoon: ${escHtml(cust.phone || "")}<br>
Levering: ${delivery === "ophalen" ? "<strong>OPHALEN</strong> (stuur het ophaaladres en een tijdstip)" : "Verzenden naar " + escHtml(addrText)}</p>
<p>Stripe betaling: ${escHtml(session.payment_intent || sessionId)}</p>
<p>Pas de voorraad op Marktplaats aan als de artikelen daar ook staan.</p></div>`;

  if (cust.email) await sendMail(env, { to: cust.email, subject: "Je bestelling bij HetMerkhuys", html: customerHtml });
  await sendMail(env, { to: env.OWNER_EMAIL || DEFAULT_OWNER, subject: (oversold.length ? "TE VEEL VERKOCHT: " : "") + "Nieuwe bestelling " + total + (name ? " van " + name : ""), html: ownerHtml });

  return { ok: true, oversold };
}

export async function handleWebhook(request, env) {
  const raw = await request.text();
  const ok = await verifySignature(raw, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response("ongeldige handtekening", { status: 400 });

  let event;
  try { event = JSON.parse(raw); } catch (e) { return new Response("ongeldig bericht", { status: 400 }); }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      try { await processPaidSession(env, session); }
      catch (e) { console.error("verwerken mislukt", e && e.message); return new Response("fout", { status: 500 }); }
    }
  }
  return new Response("ok", { status: 200 });
}

/* ---------- ingang ---------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/stock" && request.method === "GET") {
      return json({ checkout: env.CHECKOUT_ENABLED === "true" && !!env.STRIPE_SECRET_KEY, stock: await readStock(env) });
    }
    if (url.pathname === "/api/checkout" && request.method === "POST") return handleCheckout(request, env);
    if (url.pathname === "/api/webhook" && request.method === "POST") return handleWebhook(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "Niet gevonden" }, 404);
    return env.ASSETS.fetch(request);
  }
};
