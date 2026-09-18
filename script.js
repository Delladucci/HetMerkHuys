/* ============================================
   HetMerkhuys — winkelmandje
   Geen backend: cart wordt bewaard in localStorage
   zodat een bezoeker 'm niet kwijtraakt bij een refresh.
   ============================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "hetmerkhuys-cart";
  var ORDER_EMAIL = "hallo@hetmerkhuys.nl"; // pas dit aan naar het echte bestel-adres

  var cart = loadCart();

  var cartToggle = document.getElementById("cart-toggle");
  var cartClose = document.getElementById("cart-close");
  var cartDrawer = document.getElementById("cart-drawer");
  var cartOverlay = document.getElementById("cart-overlay");
  var cartItemsEl = document.getElementById("cart-items");
  var cartEmptyEl = document.getElementById("cart-empty");
  var cartCountEl = document.getElementById("cart-count");
  var cartTotalEl = document.getElementById("cart-total");
  var cartCheckoutEl = document.getElementById("cart-checkout");

  // --- helpers -------------------------------------------------

  function loadCart() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      /* localStorage niet beschikbaar (bv. privénavigatie) — mandje werkt nog wel binnen deze paginaweergave */
    }
  }

  function formatPrice(amount) {
    return "€ " + amount.toFixed(2).replace(".", ",");
  }

  function findItem(id) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) return cart[i];
    }
    return null;
  }

  // --- cart mutations --------------------------------------------

  function addToCart(id, name, price) {
    var item = findItem(id);
    if (item) {
      item.qty += 1;
    } else {
      cart.push({ id: id, name: name, price: price, qty: 1 });
    }
    saveCart();
    render();
    showToast(name + " is toegevoegd aan je mandje");
  }

  function changeQty(id, delta) {
    var item = findItem(id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(function (i) { return i.id !== id; });
    }
    saveCart();
    render();
  }

  function removeFromCart(id) {
    cart = cart.filter(function (i) { return i.id !== id; });
    saveCart();
    render();
  }

  // --- rendering ---------------------------------------------------

  function totalCount() {
    return cart.reduce(function (sum, i) { return sum + i.qty; }, 0);
  }

  function totalPrice() {
    return cart.reduce(function (sum, i) { return sum + i.qty * i.price; }, 0);
  }

  function render() {
    cartCountEl.textContent = totalCount();
    cartTotalEl.textContent = formatPrice(totalPrice());

    cartItemsEl.innerHTML = "";

    if (cart.length === 0) {
      cartEmptyEl.style.display = "block";
      cartItemsEl.style.display = "none";
    } else {
      cartEmptyEl.style.display = "none";
      cartItemsEl.style.display = "block";

      cart.forEach(function (item) {
        var li = document.createElement("li");
        li.className = "cart-item";
        li.innerHTML =
          '<div class="cart-item__info">' +
            '<p class="cart-item__name">' + escapeHtml(item.name) + '</p>' +
            '<p class="cart-item__price">' + formatPrice(item.price) + ' per stuk</p>' +
          '</div>' +
          '<div class="cart-item__qty">' +
            '<button type="button" data-action="decrease" aria-label="Minder">&minus;</button>' +
            '<span>' + item.qty + '</span>' +
            '<button type="button" data-action="increase" aria-label="Meer">+</button>' +
          '</div>' +
          '<button type="button" class="cart-item__remove" data-action="remove">Verwijder</button>';

        li.querySelector('[data-action="decrease"]').addEventListener("click", function () {
          changeQty(item.id, -1);
        });
        li.querySelector('[data-action="increase"]').addEventListener("click", function () {
          changeQty(item.id, 1);
        });
        li.querySelector('[data-action="remove"]').addEventListener("click", function () {
          removeFromCart(item.id);
        });

        cartItemsEl.appendChild(li);
      });
    }

    updateCheckoutLink();
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function updateCheckoutLink() {
    if (!cartCheckoutEl) return;
    if (cart.length === 0) {
      cartCheckoutEl.setAttribute("aria-disabled", "true");
      cartCheckoutEl.href = "#";
      return;
    }
    cartCheckoutEl.removeAttribute("aria-disabled");

    var lines = cart.map(function (i) {
      return "- " + i.name + " x" + i.qty + " (" + formatPrice(i.price * i.qty) + ")";
    });
    var body =
      "Hallo HetMerkhuys,%0D%0A%0D%0AIk wil graag het volgende bestellen:%0D%0A%0D%0A" +
      encodeURIComponent(lines.join("\n")) +
      "%0D%0A%0D%0ATotaal: " + encodeURIComponent(formatPrice(totalPrice())) +
      "%0D%0A%0D%0AMijn naam en adres:%0D%0A%0D%0AGroet,";

    cartCheckoutEl.href = "mailto:" + ORDER_EMAIL + "?subject=" + encodeURIComponent("Bestelling via HetMerkhuys") + "&body=" + body;
  }

  // --- drawer open/close --------------------------------------------

  function openCart() {
    cartDrawer.classList.add("is-open");
    cartOverlay.classList.add("is-visible");
    cartOverlay.hidden = false;
    cartDrawer.setAttribute("aria-hidden", "false");
    cartToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("cart-open");
  }

  function closeCart() {
    cartDrawer.classList.remove("is-open");
    cartOverlay.classList.remove("is-visible");
    cartDrawer.setAttribute("aria-hidden", "true");
    cartToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("cart-open");
    window.setTimeout(function () { cartOverlay.hidden = true; }, 250);
  }

  // --- toast --------------------------------------------------------

  var toastTimer = null;
  function showToast(message) {
    var toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  // --- event wiring ---------------------------------------------------

  document.querySelectorAll(".add-to-cart").forEach(function (btn) {
    btn.addEventListener("click", function () {
      addToCart(btn.dataset.id, btn.dataset.name, parseFloat(btn.dataset.price));
    });
  });

  if (cartToggle) cartToggle.addEventListener("click", openCart);
  if (cartClose) cartClose.addEventListener("click", closeCart);
  if (cartOverlay) cartOverlay.addEventListener("click", closeCart);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeCart();
  });

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  render();

  // --- zoeken -----------------------------------------------------

  var searchToggle = document.getElementById("search-toggle");
  var searchBar = document.getElementById("search-bar");
  var searchInput = document.getElementById("search-input");
  var searchClose = document.getElementById("search-close");
  var searchStatus = document.getElementById("search-status");
  var productCards = Array.prototype.slice.call(document.querySelectorAll(".product-card"));
  var categoryTitles = Array.prototype.slice.call(document.querySelectorAll(".category-title"));

  function openSearch() {
    searchBar.hidden = false;
    searchToggle.setAttribute("aria-expanded", "true");
    window.setTimeout(function () { searchInput.focus(); }, 50);
  }

  function closeSearch() {
    searchBar.hidden = true;
    searchToggle.setAttribute("aria-expanded", "false");
    searchInput.value = "";
    filterProducts("");
  }

  function filterProducts(query) {
    var q = query.trim().toLowerCase();
    var visibleCount = 0;

    productCards.forEach(function (card) {
      var haystack = (card.dataset.search || "") + " " + card.textContent.toLowerCase();
      var match = q === "" || haystack.toLowerCase().indexOf(q) !== -1;
      card.hidden = !match;
      if (match) visibleCount++;
    });

    categoryTitles.forEach(function (title) {
      var grid = title.nextElementSibling;
      if (!grid) return;
      var cardsInGrid = grid.querySelectorAll(".product-card");
      if (cardsInGrid.length === 0) {
        // Nog geen producten in deze categorie (placeholder-tekst) — altijd tonen, zoeken is hier niet op van toepassing.
        title.hidden = false;
        grid.hidden = false;
        return;
      }
      var anyVisible = Array.prototype.some.call(cardsInGrid, function (c) {
        return !c.hidden;
      });
      title.hidden = !anyVisible;
      grid.hidden = !anyVisible;
    });

    if (q !== "" && visibleCount === 0) {
      searchStatus.hidden = false;
      searchStatus.textContent = "Geen producten gevonden voor ‘" + query.trim() + "’.";
    } else {
      searchStatus.hidden = true;
    }
  }

  if (searchToggle && searchBar) {
    searchToggle.addEventListener("click", function () {
      var isOpen = !searchBar.hidden;
      if (isOpen) {
        closeSearch();
      } else {
        openSearch();
      }
    });
  }
  if (searchClose) searchClose.addEventListener("click", closeSearch);
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      filterProducts(searchInput.value);
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && searchBar && !searchBar.hidden) closeSearch();
  });
})();
