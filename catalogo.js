(async function () {
  const CATEGORY_ORDER = ["Natal", "Presente afetivo", "Personalizados", "Organizadores", "Scrapbook e bancada", "Acessórios", "Leitura"];
  const $ = (id) => document.getElementById(id);
  const money = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const isConsult = (l) => String(l || "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ") === "sob consulta";
  const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const imgSrc = (p) => String(p.image || "").replace(/^\/+/, "");
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  let products = [];
  let phone = "";
  let activeCategory = "";

  function whatsappUrl(p) {
    const shown = (p.priceLabel ? p.priceLabel + " " : "") + money(Number(p.price) || 0);
    const msg = isConsult(p.priceLabel)
      ? `Olá! Tenho interesse no produto ${p.name}. Gostaria de consultar o preço.`
      : `Olá! Tenho interesse no produto ${p.name}, no valor de ${shown}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  function fillPrice(box, p) {
    box.replaceChildren();
    if (isConsult(p.priceLabel)) {
      box.append(el("strong", "", "Sob consulta"));
    } else {
      if (p.priceLabel) box.append(el("span", "", p.priceLabel));
      box.append(el("strong", "", money(Number(p.price) || 0)));
    }
  }

  function card(p, index) {
    const article = el("article", "card");
    const link = el("a", "card-link");
    link.href = "#" + p.id;

    const photo = el("div", "card-photo");
    if (p.image) {
      const img = el("img");
      img.src = imgSrc(p);
      img.alt = p.name;
      img.loading = index < 4 ? "eager" : "lazy";
      img.decoding = "async";
      photo.append(img);
    }

    const text = el("div", "card-text");
    text.append(el("h3", "", p.name));
    if (p.description) text.append(el("p", "card-desc", p.description));
    const price = el("div", "price");
    fillPrice(price, p);
    text.append(price);
    link.append(photo, text);

    let button;
    if (phone) {
      button = el("a", "wa", "Pedir pelo WhatsApp");
      button.href = whatsappUrl(p);
      button.target = "_blank";
      button.rel = "noreferrer";
    } else {
      button = el("span", "wa wa-off", "Contato em configuração");
    }
    article.append(link, button);
    return article;
  }

  function renderGrid() {
    const list = activeCategory ? products.filter((p) => p.category === activeCategory) : products;
    $("catalog").replaceChildren(...list.map(card));
    $("count").textContent = `${list.length} ${list.length === 1 ? "produto" : "produtos"}`;
    $("catalog-title").textContent = activeCategory || "Todos os produtos";
    $("empty").hidden = !!list.length;
    $("note").hidden = !list.length;
    document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.category === activeCategory)));
  }

  function renderFilters() {
    const counts = {};
    products.forEach((p) => { if (p.category) counts[p.category] = (counts[p.category] || 0) + 1; });
    const known = CATEGORY_ORDER.filter((c) => counts[c]);
    const others = Object.keys(counts).filter((c) => !CATEGORY_ORDER.includes(c));
    const chip = (label, value, n) => {
      const b = el("button", "chip", label);
      b.type = "button";
      b.dataset.category = value;
      b.append(el("small", "", String(n)));
      b.addEventListener("click", () => {
        activeCategory = value;
        renderGrid();
        const top = $("produtos").getBoundingClientRect().top + window.scrollY;
        if (window.scrollY > top) window.scrollTo({ top });
      });
      return b;
    };
    $("filters").replaceChildren(chip("Todos", "", products.length), ...[...known, ...others].map((c) => chip(c, c, counts[c])));
  }

  /* Detalhe do produto: fica no endereço (#nome-do-produto), então dá para compartilhar o link. */
  const dialog = $("detail");
  let openedHere = false;

  function showDetail(p) {
    $("detail-img").src = imgSrc(p);
    $("detail-img").alt = p.name;
    $("detail-img").hidden = !p.image;
    $("detail-cat").textContent = p.category || "";
    $("detail-title").textContent = p.name;
    fillPrice($("detail-price"), p);
    $("detail-desc").textContent = p.description || "";
    const wa = $("detail-wa");
    wa.hidden = !phone;
    if (phone) wa.href = whatsappUrl(p);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add("has-dialog");
    document.title = `${p.name} | Nina Craft Studio`;
  }

  function hideDetail() {
    if (dialog.open) dialog.close();
    document.body.classList.remove("has-dialog");
    document.title = "Nina Craft Studio | Catálogo";
  }

  function syncFromHash() {
    let id = "";
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { /* endereço inválido */ }
    const p = products.find((x) => x.id === id);
    if (p) showDetail(p); else hideDetail();
  }

  function requestClose() {
    if (openedHere) { openedHere = false; history.back(); }
    else { history.replaceState(null, "", location.pathname + location.search + "#produtos"); hideDetail(); }
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.card-link");
    if (a) openedHere = true;
  });
  window.addEventListener("hashchange", syncFromHash);
  $("detail-close").addEventListener("click", requestClose);
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); requestClose(); });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) requestClose(); });

  try {
    const get = (f) => fetch(f, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(f);
      return r.json();
    });
    const [data, config] = await Promise.all([get("data/produtos.json"), get("data/config.json")]);
    phone = String(config.whatsapp || "").replace(/\D/g, "");
    const seen = new Set();
    products = (data.products || []).filter((p) => p.active !== false).map((p) => {
      let id = slug(p.name) || "produto";
      while (seen.has(id)) id += "-2";
      seen.add(id);
      return { ...p, id };
    });
    renderFilters();
    renderGrid();
    syncFromHash();
  } catch (e) {
    const box = $("empty");
    box.querySelector("h3").textContent = "Não foi possível carregar o catálogo";
    box.querySelector("p").textContent = "Atualize a página em instantes.";
    box.hidden = false;
  }
})();
