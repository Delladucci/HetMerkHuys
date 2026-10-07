/* ============================================
   HetMerkhuys — aanbod, mandje en productdetail
   Geen backend: het mandje staat in localStorage.
   Voorraad en prijzen pas je aan in de lijst PRODUCTS hieronder.
   ============================================ */

(function () {
  "use strict";

  var ORDER_EMAIL = "hallo@hetmerkhuys.nl";
  var STORAGE_KEY = "hetmerkhuys-cart-v2";

  /* --------------------------------------------------------------
     AANBOD
     stock  = aantal op voorraad (zet op 0 voor "uitverkocht")
     tiers  = staffelprijzen: q = vanaf q stuks, p = prijs voor die q stuks samen
              (bv. { q: 2, p: 29.99 } betekent: 2 stuks voor € 29,99)
     worth  = (optioneel) winkelwaarde, wordt doorgestreept getoond
     -------------------------------------------------------------- */
  var CATEGORIES = [
    { id: "alles", label: "Alles" },
    { id: "kussens", label: "Kussens" },
    { id: "wonen", label: "Wonen" },
    { id: "wanddecoratie", label: "Wanddecoratie" }
  ];

  var PRODUCTS = [
    {
      id: "bowie-groen", cat: "kussens", brand: "Riverdale",
      name: "Bowie sierkussen groen", spec: "45 x 45 cm · inclusief binnenkussen",
      tiers: [{ q: 1, p: 17.99 }, { q: 2, p: 29.99 }, { q: 4, p: 49.99 }],
      stock: 12, unit: "stuk", note: "Scherp geprijsd",
      images: ["images/riverdale-bowie-groen-2.jpg", "images/riverdale-bowie-groen-1.jpg", "images/riverdale-bowie-groen-3.jpg"],
      desc: "Zacht groen sierkussen met crème bies, inclusief binnenkussen. Mooi op de bank, in de leesstoel of op bed. Ook verkrijgbaar in beige en taupe.",
      specs: [["Afmeting", "45 x 45 cm"], ["Staat", "Nieuw, met label"], ["Artikelnummer", "429011-21"]]
    },
    {
      id: "bowie-beige", cat: "kussens", brand: "Riverdale",
      name: "Bowie sierkussen beige", spec: "45 x 45 cm · inclusief binnenkussen",
      tiers: [{ q: 1, p: 17.99 }, { q: 2, p: 29.99 }],
      stock: 2, unit: "stuk", note: "",
      images: ["images/riverdale-bowie-beige-2.jpg", "images/riverdale-bowie-beige.jpg"],
      desc: "Zacht beige sierkussen met donkergroene bies, inclusief binnenkussen. Mooi op de bank, in de leesstoel of op bed. Ook verkrijgbaar in groen en taupe.",
      specs: [["Afmeting", "45 x 45 cm"], ["Staat", "Nieuw, met label"], ["Artikelnummer", "003097-23"]]
    },
    {
      id: "bowie-taupe", cat: "kussens", brand: "Riverdale",
      name: "Bowie sierkussen taupe", spec: "45 x 45 cm · inclusief binnenkussen",
      tiers: [{ q: 1, p: 19.99 }],
      stock: 1, unit: "stuk", note: "",
      images: ["images/riverdale-bowie-taupe-1.jpg"],
      desc: "Zacht taupe sierkussen met crème bies, inclusief binnenkussen. Mooi op de bank, in de leesstoel of op bed. Ook verkrijgbaar in beige en groen.",
      specs: [["Afmeting", "45 x 45 cm"], ["Staat", "Nieuw, met label"]]
    },
    {
      id: "cush-roze", cat: "kussens", brand: "Riverdale",
      name: "Cush bouclé sierkussen roze", spec: "50 x 50 cm · bouclé met gouden rits",
      tiers: [{ q: 1, p: 29.99 }, { q: 3, p: 79.99 }, { q: 6, p: 149.99 }],
      stock: 6, unit: "stuk", note: "", worth: 59.95, worthPrefix: "Winkelwaarde",
      images: ["images/riverdale-cush-boucle-pink.jpg", "images/riverdale-cush-boucle-pink-2.jpg", "images/riverdale-cush-boucle-pink-3.jpg", "images/riverdale-cush-boucle-pink-4.jpg"],
      desc: "Luxe sierkussen in zachte roze bouclé-stof met een gouden rits. Fijn los, of als setje van drie op de bank.",
      specs: [["Afmeting", "50 x 50 cm"], ["Staat", "Nieuw, met label"], ["Artikelnummer", "003072-21"]]
    },
    {
      id: "klok-levy", cat: "wanddecoratie", brand: "Riverdale",
      name: "Wandklok Levy", spec: "Ø 50 cm · goud met slangenprint",
      tiers: [{ q: 1, p: 79.99 }],
      stock: 1, unit: "stuk", note: "", worth: 155, worthPrefix: "Winkelwaarde",
      images: ["images/riverdale-wandklok-levy.jpg", "images/riverdale-wandklok-levy-2.jpg"],
      desc: "Warmgouden wandklok met een subtiele slangenprint en zwarte wijzers: een klein statement boven de bank of in de hal. Werkt op één AA-batterij.",
      specs: [["Afmeting", "Ø 50 cm"], ["Staat", "Nieuw, originele verpakking"], ["Artikelnummer", "308670-20"]]
    },
    {
      id: "klok-derby", cat: "wanddecoratie", brand: "Riverdale",
      name: "Wandklok Derby", spec: "Ø 50 cm · zwart met Romeinse cijfers",
      tiers: [{ q: 1, p: 79.99 }],
      stock: 1, unit: "stuk", note: "",
      images: ["images/riverdale-wandklok-derby.jpg"],
      desc: "Chique zwarte klok met een wijzerplaat in marmerlook, Romeinse cijfers en een glazen voorkant die het uurwerk stofvrij houdt.",
      specs: [["Afmeting", "Ø 50 cm"], ["Staat", "Nieuw, originele verpakking"]]
    },
    {
      id: "tafelset-rupert", cat: "wonen", brand: "PTMD",
      name: "Salontafelset Rupert naturel", spec: "Set van 2 · gerecycled teakhout",
      tiers: [{ q: 1, p: 99 }],
      stock: 1, unit: "set", note: "Set van 2", worth: 215, worthPrefix: "Winkelwaarde ca.",
      images: ["images/ptmd-rupert-naturel.jpg", "images/ptmd-rupert-naturel-2.jpg"],
      desc: "Twee bijzettafels van gerecycled teakhout met zwarte pootjes en een warme houtlook. Schuif ze in elkaar of zet ze apart in de zithoek.",
      specs: [["Afmeting", "Ø 53 x 50 x 51 cm"], ["Staat", "Nieuw, originele verpakking"]]
    },
    {
      id: "wandrek-metaal", cat: "wonen", brand: "HetMerkhuys",
      name: "Zwart wandrek met houten plank", spec: "60 x 17 x 17 cm · metaal met hout",
      tiers: [{ q: 1, p: 59.99 }, { q: 3, p: 99 }],
      stock: 3, unit: "stuk", note: "Alle 3 voor € 99",
      images: ["images/matra-kripa-wandrek-2.jpg", "images/matra-kripa-wandrek-3.jpg"],
      desc: "Zwart metalen wandrek met een houten plank, mooi voor planten, kaarsen en boeken. Per stuk te koop, of neem ze alle drie voor een lagere prijs.",
      specs: [["Afmeting", "60 x 17 x 17 cm"], ["Staat", "Nieuw"]]
    }
  ];

  var byId = {};
  PRODUCTS.forEach(function (p) { byId[p.id] = p; });

  /* ---------- helpers ---------- */

  function fmt(n) {
    var r = Math.round(n * 100) / 100;
    if (Math.round(r) === r) return "€ " + r + ",-";
    return "€ " + r.toFixed(2).replace(".", ",");
  }

  function fmtUnit(n) {
    return "€ " + (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  function $(id) { return document.getElementById(id); }

  // Prijs voor `qty` stuks: pak steeds de grootste staffel die past.
  function calc(p, qty) {
    var tiers = p.tiers.slice().sort(function (a, b) { return b.q - a.q; });
    var rem = qty, total = 0;
    tiers.forEach(function (t) {
      var n = Math.floor(rem / t.q);
      total += n * t.p;
      rem -= n * t.q;
    });
    return Math.round(total * 100) / 100;
  }

  function unitPrice(p) { return p.tiers[0].p; }
  function fullPrice(p, qty) { return Math.round(unitPrice(p) * qty * 100) / 100; }

  function activeTier(p, qty) {
    var best = null;
    p.tiers.slice().sort(function (a, b) { return a.q - b.q; }).forEach(function (t) {
      if (t.q <= qty) best = t;
    });
    return best;
  }

  function tierLabel(p, t) {
    if (t.q === 1) return "1 " + p.unit;
    if (t.q === p.stock && p.stock > 1) return "Alle " + t.q;
    return t.q + " stuks";
  }

  /* ---------- state ---------- */

  var state = { cat: "alles", q: "", cart: loadCart() };
  var modal = { id: null, thumb: 0, qty: 1, opener: null };

  function loadCart() {
    var out = {};
    try {
      var raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      Object.keys(raw).forEach(function (id) {
        var p = byId[id];
        var n = Math.floor(Number(raw[id]));
        if (p && n > 0 && p.stock > 0) out[id] = Math.min(n, p.stock);
      });
    } catch (e) { /* geen localStorage: mandje werkt dan alleen in dit scherm */ }
    return out;
  }

  function saveCart() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart)); } catch (e) { /* negeren */ }
  }

  function inCart(id) { return state.cart[id] || 0; }
  function cartCount() { return Object.keys(state.cart).reduce(function (s, id) { return s + state.cart[id]; }, 0); }
  function cartTotal() {
    return Object.keys(state.cart).reduce(function (s, id) { return s + calc(byId[id], state.cart[id]); }, 0);
  }

  function addToCart(id, n) {
    var p = byId[id];
    var room = p.stock - inCart(id);
    var add = Math.min(n, room);
    if (add <= 0) return false;
    state.cart[id] = inCart(id) + add;
    saveCart();
    return true;
  }

  function setQty(id, n) {
    var p = byId[id];
    n = Math.max(0, Math.min(n, p.stock));
    if (n === 0) delete state.cart[id]; else state.cart[id] = n;
    saveCart();
  }

  /* ---------- aanbod tonen ---------- */

  function matches(p) {
    if (state.cat !== "alles" && p.cat !== state.cat) return false;
    var q = state.q.trim().toLowerCase();
    if (!q) return true;
    var catLabel = "";
    CATEGORIES.forEach(function (c) { if (c.id === p.cat) catLabel = c.label; });
    return (p.brand + " " + p.name + " " + p.spec + " " + catLabel).toLowerCase().indexOf(q) !== -1;
  }

  function stockLabel(p, left) {
    if (left <= 0) return "Alles in je mandje";
    if (p.stock === 1) return "Laatste " + p.unit;
    return "Nog " + left + " op voorraad";
  }

  function tileHtml(p) {
    var soldOut = p.stock <= 0;
    var has = p.images.length > 0;
    var multi = p.images.length > 1;
    var maxed = inCart(p.id) >= p.stock;

    var media = "";
    if (has) {
      media += '<img src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + '" loading="lazy">';
      if (multi) media += '<img class="tile__img2" src="' + esc(p.images[1]) + '" alt="" loading="lazy">';
    } else {
      media += '<span class="tile__nophoto">Foto volgt</span>';
    }

    var badges = "";
    if (soldOut) badges += '<span class="badge badge--stock">Uitverkocht</span>';
    else if (p.stock === 1) badges += '<span class="badge badge--last">Laatste ' + esc(p.unit) + '</span>';
    else badges += '<span class="badge badge--stock">Nog ' + p.stock + ' op voorraad</span>';
    if (p.note && !soldOut) badges += '<span class="badge badge--note">' + esc(p.note) + '</span>';

    var photoCount = multi
      ? '<span class="photocount"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="11" r="2"></circle><path d="M21 16l-5-5-8 8"></path></svg>' + p.images.length + '</span>'
      : "";

    var staffel = "";
    var t2 = p.tiers[1];
    if (t2) staffel = '<div class="tile__staffel">' + (t2.q === p.stock && p.stock > 1 ? "Alle " + t2.q : t2.q + " stuks") + " voor " + fmt(t2.p) + "</div>";

    var action;
    if (soldOut) action = '<span class="tag-full">Uitverkocht</span>';
    else if (maxed) action = '<span class="tag-full">Alles in mandje</span>';
    else action = '<button type="button" class="btn" data-add="' + p.id + '">In mandje</button>';

    return '<article class="tile">' +
      '<div class="tile__media">' +
        '<button type="button" class="tile__open" data-open="' + p.id + '" aria-label="Bekijk ' + esc(p.name) + (multi ? " (" + p.images.length + " foto's)" : "") + '">' + media + '</button>' +
        '<div class="badges">' + badges + '</div>' + photoCount +
      '</div>' +
      '<div class="tile__body">' +
        '<div class="tile__brand">' + esc(p.brand) + '</div>' +
        '<h3 class="tile__name"><button type="button" data-open="' + p.id + '">' + esc(p.name) + '</button></h3>' +
        '<div class="tile__spec">' + esc(p.spec) + '</div>' +
        '<div class="tile__buy">' + staffel +
          '<div class="tile__buyrow"><div class="tile__price">' + fmt(unitPrice(p)) + '</div>' + action + '</div>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderPills() {
    $("cat-pills").innerHTML = CATEGORIES.map(function (c) {
      var n = PRODUCTS.filter(function (p) { return c.id === "alles" || p.cat === c.id; }).length;
      return '<button type="button" class="pill" data-cat="' + c.id + '" aria-pressed="' + (state.cat === c.id) + '">' +
        '<span>' + esc(c.label) + '</span><span class="pill__count">' + n + '</span></button>';
    }).join("");
  }

  function renderGrid() {
    var list = PRODUCTS.filter(matches);
    $("grid").innerHTML = list.map(tileHtml).join("");
    $("no-results").hidden = list.length > 0;
    var pieces = list.reduce(function (s, p) { return s + p.stock; }, 0);
    $("shown-label").textContent = list.length === 0 ? "" :
      list.length + (list.length === 1 ? " artikel" : " artikelen") + " · " + pieces + " stuks op voorraad";
  }

  function renderStats() {
    var pieces = PRODUCTS.reduce(function (s, p) { return s + p.stock; }, 0);
    var from = Math.min.apply(null, PRODUCTS.map(unitPrice));
    $("stat-items").textContent = PRODUCTS.length;
    $("stat-pieces").textContent = pieces;
    $("stat-from").textContent = fmt(from);
  }

  /* ---------- mandje ---------- */

  function renderCart() {
    var count = cartCount();
    var total = cartTotal();
    $("cart-count").textContent = count;
    $("cart-total").textContent = fmt(total);
    $("cart-sum").textContent = fmt(total);

    var bar = $("cartbar");
    bar.hidden = count === 0;
    $("cartbar-text").textContent = count + (count === 1 ? " stuk" : " stuks") + " in je mandje · " + fmt(total);

    var ids = Object.keys(state.cart);
    $("cart-empty").hidden = ids.length > 0;
    $("cart-items").hidden = ids.length === 0;

    $("cart-items").innerHTML = ids.map(function (id) {
      var p = byId[id], n = state.cart[id];
      var lineTotal = calc(p, n);
      var saved = Math.round((fullPrice(p, n) - lineTotal) * 100) / 100;
      return '<li class="line">' +
        '<div class="line__img">' + (p.images[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : "") + '</div>' +
        '<div>' +
          '<p class="line__name">' + esc(p.name) + '</p>' +
          '<p class="line__meta">' + n + " × " + fmt(unitPrice(p)) + (saved > 0 ? "" : "") + '</p>' +
          (saved > 0 ? '<p class="line__save">Staffelkorting: je bespaart ' + fmt(saved) + '</p>' : "") +
          '<div class="line__ctrl">' +
            '<div class="stepper">' +
              '<button type="button" data-dec="' + id + '" aria-label="Minder ' + esc(p.name) + '">&minus;</button>' +
              '<span>' + n + '</span>' +
              '<button type="button" data-inc="' + id + '" aria-label="Meer ' + esc(p.name) + '"' + (n >= p.stock ? " disabled" : "") + '>+</button>' +
            '</div>' +
            '<button type="button" class="line__remove" data-remove="' + id + '">Verwijder</button>' +
          '</div>' +
        '</div>' +
        '<div class="line__side">' + fmt(lineTotal) + '</div>' +
      '</li>';
    }).join("");

    updateCheckout(ids, total);
  }

  function updateCheckout(ids, total) {
    var a = $("cart-checkout");
    if (ids.length === 0) {
      a.setAttribute("aria-disabled", "true");
      a.setAttribute("href", "#");
      return;
    }
    a.removeAttribute("aria-disabled");
    var lines = ids.map(function (id) {
      var p = byId[id], n = state.cart[id];
      return "- " + p.name + " x" + n + " (" + fmt(calc(p, n)) + ")";
    });
    var body = "Hallo HetMerkhuys,\n\nIk wil graag het volgende bestellen:\n\n" +
      lines.join("\n") + "\n\nTotaal: " + fmt(total) +
      "\n\nMijn naam en adres:\n\n\nGroet,";
    a.setAttribute("href", "mailto:" + ORDER_EMAIL +
      "?subject=" + encodeURIComponent("Bestelling via HetMerkhuys") +
      "&body=" + encodeURIComponent(body.replace(/\n/g, "\r\n")));
  }

  function refresh() {
    renderGrid();
    renderCart();
    if (!$("modal").hidden) renderModal();
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { t.classList.remove("is-visible"); }, 2200);
  }

  /* --- zijpaneel --- */
  var drawerOpener = null;

  function openCart() {
    drawerOpener = document.activeElement;
    $("cart-overlay").hidden = false;
    $("cart-drawer").classList.add("is-open");
    $("cart-drawer").setAttribute("aria-hidden", "false");
    $("cart-toggle").setAttribute("aria-expanded", "true");
    document.body.classList.add("is-locked");
    window.requestAnimationFrame(function () { $("cart-overlay").classList.add("is-visible"); });
    $("cart-close").focus();
  }

  function closeCart() {
    var d = $("cart-drawer");
    if (!d.classList.contains("is-open")) return;
    d.classList.remove("is-open");
    d.setAttribute("aria-hidden", "true");
    $("cart-overlay").classList.remove("is-visible");
    $("cart-toggle").setAttribute("aria-expanded", "false");
    if ($("modal").hidden) document.body.classList.remove("is-locked");
    window.setTimeout(function () { $("cart-overlay").hidden = true; }, 260);
    if (drawerOpener && drawerOpener.focus) drawerOpener.focus();
  }

  /* ---------- productdetail ---------- */

  function renderModal(focusSel) {
    var p = byId[modal.id];
    if (!p) return;
    var left = p.stock - inCart(p.id);
    var maxQty = Math.max(1, left);
    if (modal.qty > maxQty) modal.qty = maxQty;
    if (modal.qty < 1) modal.qty = 1;
    var qty = modal.qty;

    var img = p.images[modal.thumb];
    var gallery = '<div><div class="gallery__main">' +
      (img ? '<img src="' + esc(img) + '" alt="' + esc(p.name) + ', foto ' + (modal.thumb + 1) + ' van ' + p.images.length + '">' : "Foto volgt") +
      "</div>";
    if (p.images.length > 1) {
      gallery += '<div class="gallery__thumbs">' + p.images.map(function (src, i) {
        return '<button type="button" class="thumb" data-thumb="' + i + '" aria-pressed="' + (i === modal.thumb) + '" aria-label="Foto ' + (i + 1) + ' van ' + p.images.length + '"><img src="' + esc(src) + '" alt=""></button>';
      }).join("") + "</div>";
    }
    gallery += "</div>";

    var priceHtml = '<div class="info__price"><strong>' + fmt(unitPrice(p)) + "</strong>" +
      (p.worth ? '<span class="info__worth">' + esc(p.worthPrefix) + " " + fmt(p.worth) + "</span>" : "") + "</div>";

    var stockHtml = "";
    if (p.stock > 0) {
      var dots = "";
      for (var i = 0; i < Math.max(0, left) && i < 20; i++) dots += "<i></i>";
      stockHtml = '<div class="info__stock"><span class="stockpill">' + esc(stockLabel(p, left)) + '</span><span class="dots" aria-hidden="true">' + dots + "</span></div>";
    } else {
      stockHtml = '<div class="info__stock"><span class="stockpill">Uitverkocht</span></div>';
    }

    var specs = '<dl class="specs">' + p.specs.map(function (s) {
      return "<dt>" + esc(s[0]) + "</dt><dd>" + esc(s[1]) + "</dd>";
    }).join("") + "</dl>";

    var tiersHtml = "";
    if (p.tiers.length > 1) {
      var cur = activeTier(p, qty);
      tiersHtml = '<div class="tiers"><div class="tiers__head">Meer stuks, lagere prijs</div>' +
        p.tiers.slice().sort(function (a, b) { return a.q - b.q; }).map(function (t) {
          var per = t.q > 1 ? "(" + fmtUnit(t.p / t.q) + " per stuk)" : "";
          return '<div class="tiers__row' + (cur && cur.q === t.q ? " is-active" : "") + '"><span>' + esc(tierLabel(p, t)) + "</span><span>" + fmt(t.p) + " <small>" + per + "</small></span></div>";
        }).join("") + "</div>";
    }

    var buy = "";
    if (p.stock <= 0) {
      buy = '<p class="info__cannot">Dit artikel is helaas uitverkocht.</p>';
    } else if (left <= 0) {
      buy = '<p class="info__cannot">Alles wat we hebben zit al in je mandje.</p>';
    } else {
      var total = calc(p, qty);
      var saved = Math.round((fullPrice(p, qty) - total) * 100) / 100;
      buy = '<div class="buy">' +
        (maxQty > 1 ? '<div class="stepper" style="height:52px">' +
          '<button type="button" data-qty="-1" aria-label="Minder"' + (qty <= 1 ? " disabled" : "") + '>&minus;</button>' +
          '<span aria-live="polite">' + qty + '</span>' +
          '<button type="button" data-qty="1" aria-label="Meer"' + (qty >= maxQty ? " disabled" : "") + '>+</button></div>' : "") +
        '<button type="button" class="btn" data-add-detail="1">In mandje · ' + fmt(total) + "</button></div>" +
        (saved > 0 ? '<p class="info__save">Je bespaart ' + fmt(saved) + " met deze aantallen.</p>" : "");
    }

    $("modal-box").innerHTML =
      '<button type="button" class="iconbtn modal__close" data-close="1" aria-label="Sluiten"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>' +
      gallery +
      '<div class="info"><div class="info__brand">' + esc(p.brand) + '</div>' +
      '<h2 class="info__title" id="detail-title">' + esc(p.name) + "</h2>" +
      '<div class="info__spec">' + esc(p.spec) + "</div>" +
      priceHtml + stockHtml +
      '<p class="info__desc">' + esc(p.desc) + "</p>" + specs + tiersHtml + buy + "</div>";

    if (focusSel) {
      var el = $("modal-box").querySelector(focusSel);
      if (el && !el.disabled) el.focus();
    }
  }

  function openModal(id, opener) {
    modal.id = id;
    modal.thumb = 0;
    modal.qty = 1;
    modal.opener = opener || null;
    $("modal").hidden = false;
    document.body.classList.add("is-locked");
    renderModal();
    $("modal-box").scrollTop = 0;
    $("modal").scrollTop = 0;
    var close = $("modal-box").querySelector("[data-close]");
    if (close) close.focus();
  }

  function closeModal() {
    if ($("modal").hidden) return;
    $("modal").hidden = true;
    $("modal-box").innerHTML = "";
    if (!$("cart-drawer").classList.contains("is-open")) document.body.classList.remove("is-locked");
    if (modal.opener && document.body.contains(modal.opener) && modal.opener.focus) modal.opener.focus();
    modal.id = null;
  }

  /* ---------- events ---------- */

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;

    var cat = t.closest("[data-cat]");
    if (cat) { state.cat = cat.getAttribute("data-cat"); renderPills(); renderGrid(); return; }

    var add = t.closest("[data-add]");
    if (add) {
      var id = add.getAttribute("data-add");
      if (addToCart(id, 1)) { toast(byId[id].name + " zit in je mandje"); }
      refresh();
      return;
    }

    var open = t.closest("[data-open]");
    if (open) { openModal(open.getAttribute("data-open"), open); return; }

    var thumb = t.closest("[data-thumb]");
    if (thumb) { modal.thumb = Number(thumb.getAttribute("data-thumb")); renderModal('[data-thumb="' + modal.thumb + '"]'); return; }

    var q = t.closest("[data-qty]");
    if (q) { modal.qty += Number(q.getAttribute("data-qty")); renderModal('[data-qty="' + q.getAttribute("data-qty") + '"]'); return; }

    if (t.closest("[data-add-detail]")) {
      var p = byId[modal.id];
      if (addToCart(p.id, modal.qty)) toast(p.name + " zit in je mandje");
      modal.qty = 1;
      refresh();
      var again = $("modal-box").querySelector("[data-close]");
      if (again) again.focus();
      return;
    }

    if (t.closest("[data-close]")) { closeModal(); return; }
    if (t === $("modal")) { closeModal(); return; }

    var inc = t.closest("[data-inc]");
    if (inc) { var iid = inc.getAttribute("data-inc"); setQty(iid, inCart(iid) + 1); refresh(); return; }
    var dec = t.closest("[data-dec]");
    if (dec) { var did = dec.getAttribute("data-dec"); setQty(did, inCart(did) - 1); refresh(); return; }
    var rem = t.closest("[data-remove]");
    if (rem) { setQty(rem.getAttribute("data-remove"), 0); refresh(); return; }
  });

  $("cart-toggle").addEventListener("click", openCart);
  $("cartbar-open").addEventListener("click", openCart);
  $("cart-close").addEventListener("click", closeCart);
  $("cart-overlay").addEventListener("click", closeCart);

  $("search-input").addEventListener("input", function (e) {
    state.q = e.target.value;
    renderGrid();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if ($("cart-drawer").classList.contains("is-open")) closeCart();
      else if (!$("modal").hidden) closeModal();
      return;
    }
    if (!$("modal").hidden && !$("cart-drawer").classList.contains("is-open")) {
      var p = byId[modal.id];
      if (p && p.images.length > 1 && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        var step = e.key === "ArrowLeft" ? -1 : 1;
        modal.thumb = (modal.thumb + step + p.images.length) % p.images.length;
        renderModal();
      }
      // Tab blijft binnen het venster
      if (e.key === "Tab") {
        var f = $("modal-box").querySelectorAll("button:not([disabled])");
        if (f.length) {
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          else if (!$("modal-box").contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        }
      }
    }
  });

  $("year").textContent = new Date().getFullYear();

  renderStats();
  renderPills();
  refresh();
})();
