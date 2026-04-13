const MODULE_ID = "homebrew-hub-5e";
const MODULE_TITLE = "Relics & Realms Bazaar";

Hooks.once("init", () => {
  console.log(`${MODULE_TITLE} | Initializing`);

  game.settings.register(MODULE_ID, "apiUrl", {
    name: "API URL",
    hint: "The URL of your Relics & Realms Bazaar server",
    scope: "world", config: true, type: String,
    default: "https://relicsandrealms.com",
  });
  game.settings.register(MODULE_ID, "authToken", {
    name: "Auth Token",
    scope: "client", config: false, type: String, default: "",
  });
  game.settings.register(MODULE_ID, "compendiumName", {
    name: "Compendium Name",
    hint: "Name of the compendium to import content into",
    scope: "world", config: true, type: String,
    default: "homebrew-hub-imports",
  });
  game.settings.register(MODULE_ID, "importToItems", {
    name: "Also add to World Items",
    hint: "When importing, also add the item directly to the world Items tab",
    scope: "world", config: true, type: Boolean, default: true,
  });
});



class HHApi {
  static getBaseUrl() { return game.settings.get(MODULE_ID, "apiUrl"); }
  static getToken() { return game.settings.get(MODULE_ID, "authToken"); }

  /** Resolve an image URL — makes relative proxy paths absolute using the API base URL */
  static resolveImageUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${this.getBaseUrl()}${url}`;
    return url;
  }

  /**
   * Pick the unwatermarked full image for importing. The API surfaces
   * data.full_image_url only to authorized buyers/owners; non-buyers get
   * data stripped, so this falls back to image_url (the watermarked
   * preview) in that case.
   */
  static fullImageFor(item) {
    const full = item && item.data && item.data.full_image_url;
    return this.resolveImageUrl(full || (item && item.image_url) || "");
  }

  /** Same idea, for monster token images. */
  static fullTokenFor(item) {
    const d = (item && item.data) || {};
    return this.resolveImageUrl(
      d.token_full_image_url || d.token_image_url || (item && item.image_url) || ""
    );
  }

  static async request(path, options = {}) {
    const url = `${this.getBaseUrl()}${path}`;
    const token = this.getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    if (response.status === 401) {
      await game.settings.set(MODULE_ID, "authToken", "");
      ui.notifications.warn("Session expired. Please log in again.");
      const openBrowser = Object.values(ui.windows).find(w => w.id === "homebrew-hub-browser");
      if (openBrowser) openBrowser.close();
      new HHLoginApp().render(true);
      throw new Error("Session expired");
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  static async login(email, password) {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }
  static async getMe() { return this.request("/api/me"); }
  static async getContent(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/content${query ? "?" + query : ""}`);
  }
  static async getContentItem(id) { return this.request(`/api/content/${id}`); }
  static async getLibrary(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/library${query ? "?" + query : ""}`);
  }
  static async getPacks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/packs${query ? "?" + query : ""}`);
  }
  static async getPack(id) {
    return this.request(`/api/packs/${id}`);
  }
}

class HHSidebarTab extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "rrb-sidebar",
      title: "Relics & Realms",
      template: "modules/homebrew-hub-5e/templates/sidebar.html",
      width: 300,
      height: 600,
      resizable: true,
    });
  }

  async getData() {
    const token = game.settings.get(MODULE_ID, "authToken");
    let loggedInUser = null;
    if (token) {
      try { loggedInUser = await HHApi.getMe(); }
      catch { await game.settings.set(MODULE_ID, "authToken", ""); }
    }
    return { loggedInUser };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("#rrb-sidebar-login-btn").click(() => {
      new HHLoginApp().render(true);
    });
    html.find("#rrb-sidebar-browse-btn").click(() => {
      const token = game.settings.get(MODULE_ID, "authToken");
      if (!token) {
        ui.notifications.warn("Please log in first.");
        new HHLoginApp().render(true);
        return;
      }
      new HHBrowserApp().render(true);
    });
    html.find("#rrb-sidebar-logout-btn").click(async () => {
      await game.settings.set(MODULE_ID, "authToken", "");
      const openBrowser = Object.values(ui.windows).find(w => w.id === "homebrew-hub-browser");
      if (openBrowser) openBrowser.close();
      this.render();
    });
  }
}

Hooks.on("ready", () => {
  setTimeout(() => {
    const menu = document.querySelector("#sidebar-tabs menu");
    if (!menu) return;

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ui-control plain";
    btn.setAttribute("data-action", "tab");
    btn.setAttribute("data-tab", "rrb-bazaar");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("data-group", "primary");
    btn.setAttribute("aria-label", "Relics & Realms");
    btn.setAttribute("data-tooltip", "Relics & Realms");
    btn.style.cssText = "width:32px;height:32px;display:flex;align-items:center;justify-content:center;padding:0;";
    const img = document.createElement("img");
    img.src = "modules/homebrew-hub-5e/tower-foundry-cap-icon.png";
    img.alt = "Relics & Realms";
    img.style.cssText = "width:24px;height:24px;filter:invert(0.7) sepia(0.5) saturate(2) hue-rotate(10deg) brightness(0.85);pointer-events:none;";
    btn.appendChild(img);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const token = game.settings.get(MODULE_ID, "authToken");
      if (!token) {
        new HHLoginApp().render(true);
      } else {
        new HHBrowserApp().render(true);
      }
    });

    li.appendChild(btn);
    menu.appendChild(li);
    console.log("HH | Button injected into sidebar");
  }, 1000);
});
class HHLoginApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "homebrew-hub-login",
      title: "Relics & Realms",
      template: "modules/homebrew-hub-5e/templates/login.html",
      width: 360, height: "auto", resizable: false,
    });
  }

  async getData() {
    const token = game.settings.get(MODULE_ID, "authToken");
    let loggedInUser = null;
    if (token) {
      try {
        const url = `${HHApi.getBaseUrl()}/api/me`;
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
          loggedInUser = await res.json();
        } else {
          await game.settings.set(MODULE_ID, "authToken", "");
        }
      } catch {
        await game.settings.set(MODULE_ID, "authToken", "");
      }
    }
    return { loggedInUser };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("#hh-login-form").submit(async (e) => {
      e.preventDefault();
      const email = html.find("#hh-email").val();
      const password = html.find("#hh-password").val();
      const statusEl = html.find("#hh-login-status");
      const submitBtn = html.find("#hh-login-submit");
      submitBtn.prop("disabled", true).text("Entering...");
      statusEl.removeClass("success error").text("").hide();
      try {
        const data = await HHApi.login(email, password);
        await game.settings.set(MODULE_ID, "authToken", data.access_token);
        statusEl.addClass("success").text("Welcome to the Bazaar!").show();
        setTimeout(() => {
          this.close();
          new HHBrowserApp().render(true);
        }, 800);
      } catch (err) {
        statusEl.addClass("error").text(err.message || "Login failed").show();
        submitBtn.prop("disabled", false).text("Enter");
      }
    });
    html.find("#hh-logout").click(async () => {
      await game.settings.set(MODULE_ID, "authToken", "");
      const openBrowser = Object.values(ui.windows).find(w => w.id === "homebrew-hub-browser");
      if (openBrowser) openBrowser.close();
      this.render();
    });
    html.find("#hh-open-browser").click(() => {
      this.close();
      setTimeout(() => new HHBrowserApp().render(true), 100);
    });
  }
}

class HHBrowserApp extends Application {
  constructor(...args) {
    super(...args);
    this._screen = "categories";
    this._items = [];
    this._currentType = "";
    this._currentTypeLabel = "";
    this._currentItem = null;
    this._page = 1;
    this._totalPages = 1;
    this._search = "";
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "homebrew-hub-browser",
      title: "Relics & Realms",
      template: "modules/homebrew-hub-5e/templates/browser.html",
      width: 560, height: 720, resizable: true,
    });
  }

  async getData() { return {}; }

  activateListeners(html) {
    super.activateListeners(html);
    this._html = html;
    this._mode = "mine";
    this._updateAuthBar();

    const token = game.settings.get(MODULE_ID, "authToken");
    if (!token) {
      const grid = html.find("#rrb-category-grid");
      grid.html(
        "<div class=\"rrb-status\">"
        + "<div class=\"rrb-status-icon\">&#9670;</div>"
        + "<p style=\"margin-bottom:1rem;\">Sign in to browse your content</p>"
        + "<button id=\"rrb-inline-login\" class=\"rrb-submit-btn\" style=\"width:auto;padding:0.5rem 1.5rem;\">Sign In</button>"
        + "</div>"
      );
      html.find("#rrb-inline-login").click(() => {
        new HHLoginApp().render(true);
        this.close();
      });
      return;
    }

    // Mode tab switching
    html.find(".rrb-mode-tab").click((e) => {
      const mode = $(e.currentTarget).data("mode");
      this._mode = mode;
      this._search = "";
      this._page = 1;
      html.find(".rrb-mode-tab").removeClass("rrb-mode-active");
      $(e.currentTarget).addClass("rrb-mode-active");
      const title = mode === "mine" ? "My Creations" : "My Collection";
      html.find("#rrb-categories-title").text(title);
      html.find("#rrb-global-search").val("");
      this._showScreen("categories");
      this._loadCategories();
    });

    this._loadCategories();

    let globalSearchTimeout;
    html.find("#rrb-global-search").on("input", (e) => {
      clearTimeout(globalSearchTimeout);
      globalSearchTimeout = setTimeout(async () => {
        const val = e.target.value;
        if (val.length > 1) {
          this._currentType = "";
          this._currentTypeLabel = "Search results";
          this._page = 1;
          this._search = val;
          html.find("#rrb-list-title").text("Search results");
          html.find("#rrb-item-search").val(val);
          await this._loadItems();
          this._renderItemList();
          this._showScreen("items");
        } else if (!val) {
          this._showScreen("categories");
        }
      }, 400);
    });

    html.find("#rrb-back-to-categories").click(() => {
      this._search = "";
      this._currentType = "";
      this._showScreen("categories");
    });

    html.find("#rrb-back-to-list").click(() => {
      this._showScreen("items");
    });

    let itemSearchTimeout;
    html.find("#rrb-item-search").on("input", (e) => {
      clearTimeout(itemSearchTimeout);
      itemSearchTimeout = setTimeout(async () => {
        this._search = e.target.value;
        this._page = 1;
        await this._loadItems();
        this._renderItemList();
      }, 400);
    });

    html.find("#rrb-prev-page").click(async () => {
      if (this._page > 1) {
        this._page--;
        await this._loadItems();
        this._renderItemList();
      }
    });

    html.find("#rrb-next-page").click(async () => {
      if (this._page < this._totalPages) {
        this._page++;
        await this._loadItems();
        this._renderItemList();
      }
    });
  }

  _showScreen(name) {
    this._screen = name;
    this._html.find(".rrb-screen").hide();
    this._html.find(`#rrb-screen-${name}`).show();
  }

  async _updateAuthBar() {
    const token = game.settings.get(MODULE_ID, "authToken");
    const statusEl = this._html.find("#rrb-auth-status");
    const actionsEl = this._html.find("#rrb-auth-actions");

    if (!token) {
      this.close();
      new HHLoginApp().render(true);
      return;
    }

    try {
      const me = await HHApi.getMe();
      statusEl.html(
        "<span style=\"color:var(--rrb-accent-violet-light);font-size:0.75rem;\">&#9670;</span>"
        + "<span style=\"color:var(--rrb-text-primary);font-size:0.78rem;font-weight:600;\">" + me.username + "</span>"
      );
      actionsEl.html(
        "<button class=\"rrb-auth-btn\" id=\"rrb-bar-logout\">Sign Out</button>"
      );
      this._html.find("#rrb-bar-logout").click(async () => {
        await game.settings.set(MODULE_ID, "authToken", "");
        this.close();
        new HHLoginApp().render(true);
      });
    } catch (err) {
      await game.settings.set(MODULE_ID, "authToken", "");
      this.close();
      new HHLoginApp().render(true);
    }
  }

  async _loadCategories() {
    console.log("HH | Loading categories");
    const html = this._html;
    const grid = html.find("#rrb-category-grid");

    const categories = [
      { type: "pack",       label: "Bundles",      icon: "modules/homebrew-hub-5e/icons/bundle.svg" },
      { type: "weapon",     label: "Weapons",     icon: "modules/homebrew-hub-5e/icons/weapons.svg" },
      { type: "spell",      label: "Spells",      icon: "modules/homebrew-hub-5e/icons/magic.svg" },
      { type: "monster",    label: "Monsters",    icon: "modules/homebrew-hub-5e/icons/creature.svg" },
      { type: "armor",      label: "Armor",       icon: "modules/homebrew-hub-5e/icons/armor.svg" },
      { type: "equipment",  label: "Equipment",   icon: "modules/homebrew-hub-5e/icons/equipment.svg" },
      { type: "feat",       label: "Feats",       icon: "modules/homebrew-hub-5e/icons/feat.svg" },
      { type: "background", label: "Backgrounds", icon: "modules/homebrew-hub-5e/icons/background.svg" },
      { type: "class",       label: "Classes",      icon: "modules/homebrew-hub-5e/icons/class.svg" },
      { type: "subclass",    label: "Subclasses",   icon: "modules/homebrew-hub-5e/icons/subclass.svg" },
      { type: "journal",     label: "Journals",     icon: "modules/homebrew-hub-5e/icons/journal.svg" },
      { type: "map",         label: "Maps",         icon: "modules/homebrew-hub-5e/icons/treasure-map.svg" },
      { type: "audio",       label: "Audio",        icon: "modules/homebrew-hub-5e/icons/audio.svg" },
    ];

    let counts = {};
    try {
      const mode = this._mode || "mine";
      const agnosticTypes = ["map", "audio"];
      const packParams = mode === "library"
        ? { system: "dnd5e", limit: 1, purchased: "true" }
        : { system: "dnd5e", limit: 1, author: "me" };
      const countPromises = categories.map(c =>
        c.type === "pack"
          ? HHApi.getPacks(packParams)
              .then(d => ({ type: c.type, count: d.pagination?.total || 0 }))
              .catch(() => ({ type: c.type, count: 0 }))
          : mode === "library"
            ? HHApi.getLibrary(Object.assign({ type: c.type, limit: 1 }, agnosticTypes.includes(c.type) ? {} : { system: "dnd5e" }))
                .then(d => ({ type: c.type, count: d.pagination?.total || 0 }))
                .catch(() => ({ type: c.type, count: 0 }))
            : HHApi.getContent(Object.assign(
                { type: c.type, limit: 1, author: "me" },
                agnosticTypes.includes(c.type) ? {} : { system: "dnd5e" }
              ))
                .then(d => ({ type: c.type, count: d.pagination?.total || 0 }))
                .catch(() => ({ type: c.type, count: 0 }))
      );
      const results = await Promise.all(countPromises);
      results.forEach(r => counts[r.type] = r.count);
      console.log("HH | Counts:", counts);
    } catch (err) {
      console.warn("HH | Failed to load counts:", err);
    }

    let html2 = "";
    for (const cat of categories) {
      const count = counts[cat.type] || 0;
      html2 += `
        <div class="rrb-cat-card" data-type="${cat.type}" data-label="${cat.label}">
          <div class="rrb-cat-icon"><img src="${cat.icon}" style="width:1.75rem;height:1.75rem;"></div>
          <div class="rrb-cat-name">${cat.label}</div>
          <div class="rrb-cat-count">${count} item${count !== 1 ? "s" : ""}</div>
        </div>
      `;
    }
    grid.html(html2);

    grid.find(".rrb-cat-card").click(async (e) => {
      const card = $(e.currentTarget);
      this._currentType = card.data("type");
      this._currentTypeLabel = card.data("label");
      this._search = "";
      this._page = 1;
      this._html.find("#rrb-list-title").text(this._currentTypeLabel);
      this._html.find("#rrb-item-search").val("");
      if (this._currentType === "pack") {
        await this._loadPacks();
        this._renderPackList();
      } else {
        await this._loadItems();
        this._renderItemList();
      }
      this._showScreen("items");
    });
  }

  async _loadItems() {
    const params = { page: this._page, limit: 20 };
    if (this._currentType) params.type = this._currentType;
    if (this._search) params.search = this._search;
    try {
      const mode = this._mode || "mine";
      let data;
      if (mode === "library") {
        const agnosticTypes = ["map", "audio"];
        if (!agnosticTypes.includes(this._currentType)) {
          params.system = "dnd5e";
        }
        data = await HHApi.getLibrary(params);
      } else {
        const agnosticTypes = ["map", "audio"];
        if (!agnosticTypes.includes(this._currentType)) {
          params.system = "dnd5e";
        }
        params.author = "me";
        data = await HHApi.getContent(params);
      }
      this._items = data.items || [];
      this._totalPages = data.pagination?.pages || 1;
    } catch (err) {
      ui.notifications.error("R&R Bazaar: " + err.message);
      this._items = [];
    }
  }

  _renderItemList() {
    const list = this._html.find("#rrb-item-list");
    const showPagination = this._totalPages > 1;
    this._html.find(".rrb-pagination").toggle(showPagination);
    if (showPagination) {
      this._html.find("#rrb-page-info").text(`${this._page} / ${this._totalPages}`);
      this._html.find("#rrb-prev-page").prop("disabled", this._page <= 1);
      this._html.find("#rrb-next-page").prop("disabled", this._page >= this._totalPages);
    }

    if (!this._items.length) {
      list.html(`<div class="rrb-status"><div class="rrb-status-icon">&#9674;</div><p>No items found</p></div>`);
      return;
    }

    let html2 = "";
    for (const item of this._items) {
      const imgHtml = item.image_url
        ? `<img src="${HHApi.resolveImageUrl(item.image_url)}" class="rrb-item-img" alt="${item.name}" />`
        : `<div class="rrb-item-img-placeholder">&#9670;</div>`;
      html2 += `
        <div class="rrb-item" data-id="${item.id}">
          <div class="rrb-item-art">${imgHtml}</div>
          <div class="rrb-item-info">
            <div class="rrb-item-name">${item.name}</div>
            <div class="rrb-item-meta">
              <span class="rrb-badge rrb-badge-${item.content_type}">${item.content_type}</span>
              <span class="rrb-badge rrb-badge-version">v${item.version}</span>
              ${item.profiles?.username ? `<span class="rrb-author">${item.profiles.username}</span>` : ""}
            </div>
            ${item.description ? `<div class="rrb-item-desc">${item.description}</div>` : ""}
          </div>
          <div class="rrb-item-actions">
            <button class="rrb-preview-btn" data-id="${item.id}">View</button>
            <button class="rrb-import-btn rrb-import-quick" data-id="${item.id}" data-name="${item.name}">Import</button>
          </div>
        </div>
      `;
    }
    list.html(html2);

    list.find(".rrb-item").click((e) => {
      if (!$(e.target).hasClass("rrb-preview-btn")) {
        const id = $(e.currentTarget).data("id");
        const item = this._items.find(i => i.id === id);
        if (item) this._showPreview(item);
      }
    });

    list.find(".rrb-preview-btn").click((e) => {
      e.stopPropagation();
      const id = $(e.currentTarget).data("id");
      const item = this._items.find(i => i.id === id);
      if (item) this._showPreview(item);
    });

    list.find(".rrb-import-quick").click(async (e) => {
      e.stopPropagation();
      const id = $(e.currentTarget).data("id");
      const name = $(e.currentTarget).data("name");
      const btn = $(e.currentTarget);
      btn.prop("disabled", true).text("...");
      try {
        await HHImporter.importItem(id);
        btn.text("Done!");
        ui.notifications.info(`Imported "${name}" successfully.`);
      } catch (err) {
        btn.prop("disabled", false).text("Import");
        ui.notifications.error(`Import failed: ${err.message}`);
      }
    });
  }

  async _showPreview(item) {
    this._html.find("#rrb-preview-title").text(item.name);
    let fullItem = item;
    try { fullItem = await HHApi.getContentItem(item.id); }
    catch (err) { console.warn("HH | Could not fetch full item:", err); }

    const d = fullItem.data || {};
    const imgHtml = fullItem.image_url
      ? `<img src="${HHApi.resolveImageUrl(fullItem.image_url)}" class="rrb-preview-img" alt="${fullItem.name}" />`
      : `<div class="rrb-preview-img-placeholder">&#9670;</div>`;

    let statsHtml = "";
    if (fullItem.content_type === "weapon") {
      statsHtml = `
        <div class="rrb-stat-row"><span class="rrb-stat-label">Damage</span><span class="rrb-stat-value">${d.damage_formula || "-"} ${d.damage_type || ""}</span></div>
        ${d.bonus_damage_formula ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Bonus</span><span class="rrb-stat-value">${d.bonus_damage_formula} ${d.bonus_damage_type || ""}</span></div>` : ""}
        ${d.range_normal ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Range</span><span class="rrb-stat-value">${d.range_normal}/${d.range_long || "-"} ft</span></div>` : ""}
        ${d.properties?.length ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Properties</span><span class="rrb-stat-value">${d.properties.join(", ")}</span></div>` : ""}
        ${d.rarity ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Rarity</span><span class="rrb-stat-value">${d.rarity}</span></div>` : ""}
        ${d.weight ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Weight</span><span class="rrb-stat-value">${d.weight} lb</span></div>` : ""}
        ${d.price ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Price</span><span class="rrb-stat-value">${d.price} gp</span></div>` : ""}
      `;
    } else if (fullItem.content_type === "spell") {
      statsHtml = `
        <div class="rrb-stat-row"><span class="rrb-stat-label">Level</span><span class="rrb-stat-value">${d.level === 0 ? "Cantrip" : `Level ${d.level}`}</span></div>
        ${d.school ? `<div class="rrb-stat-row"><span class="rrb-stat-label">School</span><span class="rrb-stat-value">${d.school}</span></div>` : ""}
        ${d.casting_time ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Casting time</span><span class="rrb-stat-value">${d.casting_time}</span></div>` : ""}
        ${d.range ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Range</span><span class="rrb-stat-value">${d.range}</span></div>` : ""}
        ${d.duration ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Duration</span><span class="rrb-stat-value">${d.duration}</span></div>` : ""}
        ${d.damage_formula ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Damage</span><span class="rrb-stat-value">${d.damage_formula} ${d.damage_type || ""}</span></div>` : ""}
        ${d.save_ability ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Save</span><span class="rrb-stat-value">${d.save_ability}</span></div>` : ""}
      `;
    } else if (fullItem.content_type === "monster") {
      const abilityScores = ["str","dex","con","int","wis","cha"].map(a => {
        const val = d[a] || 10;
        const mod = Math.floor((val - 10) / 2);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        return `<div class="rrb-ability"><div class="rrb-ability-label">${a.toUpperCase()}</div><div class="rrb-ability-value">${val}</div><div class="rrb-ability-mod">${modStr}</div></div>`;
      }).join("");
      statsHtml = `
        ${d.cr !== undefined ? `<div class="rrb-stat-row"><span class="rrb-stat-label">CR</span><span class="rrb-stat-value">${d.cr}</span></div>` : ""}
        ${d.size ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Size</span><span class="rrb-stat-value">${d.size}</span></div>` : ""}
        ${d.monster_type ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Type</span><span class="rrb-stat-value">${d.monster_type}</span></div>` : ""}
        ${d.ac ? `<div class="rrb-stat-row"><span class="rrb-stat-label">AC</span><span class="rrb-stat-value">${d.ac}</span></div>` : ""}
        ${d.hp ? `<div class="rrb-stat-row"><span class="rrb-stat-label">HP</span><span class="rrb-stat-value">${d.hp}${d.hp_formula ? ` (${d.hp_formula})` : ""}</span></div>` : ""}
        ${d.speed ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Speed</span><span class="rrb-stat-value">${d.speed}</span></div>` : ""}
        <div class="rrb-ability-scores">${abilityScores}</div>
      `;
    } else if (fullItem.content_type === "armor") {
      statsHtml = `
        ${d.ac_base ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Base AC</span><span class="rrb-stat-value">${d.ac_base}</span></div>` : ""}
        ${d.rarity ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Rarity</span><span class="rrb-stat-value">${d.rarity}</span></div>` : ""}
        ${d.weight ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Weight</span><span class="rrb-stat-value">${d.weight} lb</span></div>` : ""}
        ${d.price ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Price</span><span class="rrb-stat-value">${d.price} gp</span></div>` : ""}
      `;
    } else if (["feat","background"].includes(fullItem.content_type)) {
      statsHtml = `
        ${d.prerequisites ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Prerequisites</span><span class="rrb-stat-value">${d.prerequisites}</span></div>` : ""}
        ${d.usage ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Usage</span><span class="rrb-stat-value">${d.usage}</span></div>` : ""}
      `;
    } else if (fullItem.content_type === "map") {
      const gridTypes = { 0: "Gridless", 1: "Square", 2: "Hex (Odd Col)", 3: "Hex (Even Col)", 4: "Hex (Odd Row)", 5: "Hex (Even Row)" };
      statsHtml = `
        ${d.map_width && d.map_height ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Dimensions</span><span class="rrb-stat-value">${d.map_width} × ${d.map_height} px</span></div>` : ""}
        ${d.grid_columns && d.grid_rows ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Grid</span><span class="rrb-stat-value">${d.grid_columns} × ${d.grid_rows} squares</span></div>` : ""}
        ${d.grid_type !== undefined ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Grid Type</span><span class="rrb-stat-value">${gridTypes[d.grid_type] || "Square"}</span></div>` : ""}
        ${d.grid_size ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Grid Size</span><span class="rrb-stat-value">${d.grid_size}px</span></div>` : ""}
        ${d.darkness_level ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Darkness</span><span class="rrb-stat-value">${(d.darkness_level * 100).toFixed(0)}%</span></div>` : ""}
        ${(d.map_preview_url || d.map_image_url) ? `<div style="margin-top:0.5rem;"><img src="${HHApi.resolveImageUrl(d.map_preview_url || d.map_image_url)}" style="width:100%;border-radius:6px;border:1px solid var(--rrb-border-subtle);" /></div>` : ""}
      `;
    } else if (fullItem.content_type === "audio") {
      const dur = d.audio_duration ? `${Math.floor(d.audio_duration / 60)}:${(d.audio_duration % 60).toString().padStart(2, "0")}` : "";
      statsHtml = `
        ${d.category ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Category</span><span class="rrb-stat-value">${d.category}</span></div>` : ""}
        ${dur ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Duration</span><span class="rrb-stat-value">${dur}</span></div>` : ""}
        ${d.audio_format ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Format</span><span class="rrb-stat-value">${d.audio_format.toUpperCase()}</span></div>` : ""}
        ${d.loop !== undefined ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Loop</span><span class="rrb-stat-value">${d.loop ? "Yes" : "No"}</span></div>` : ""}
        ${d.mood ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Mood</span><span class="rrb-stat-value">${d.mood}</span></div>` : ""}
        ${d.environment ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Environment</span><span class="rrb-stat-value">${d.environment}</span></div>` : ""}
        ${d.audio_url ? `<div style="margin-top:0.5rem;"><audio controls src="${HHApi.resolveImageUrl(d.audio_url)}" style="width:100%;" preload="metadata"></audio></div>` : ""}
      `;
    }

    const tagsHtml = fullItem.tags?.length
      ? `<div class="rrb-preview-tags">${fullItem.tags.map(t => `<span class="rrb-tag">${t}</span>`).join("")}</div>`
      : "";

    this._html.find("#rrb-preview-content").html(`
      <div class="rrb-preview-top">
        ${imgHtml}
        <div class="rrb-preview-header">
          <h2 class="rrb-preview-name">${fullItem.name}</h2>
          <div class="rrb-preview-meta">
            <span class="rrb-badge rrb-badge-${fullItem.content_type}">${fullItem.content_type}</span>
            <span class="rrb-badge rrb-badge-version">v${fullItem.version}</span>
            ${fullItem.profiles?.username ? `<span class="rrb-author">by ${fullItem.profiles.username}</span>` : ""}
          </div>
          ${tagsHtml}
        </div>
      </div>
      ${fullItem.description ? `<div class="rrb-preview-description">${fullItem.description}</div>` : ""}
      ${statsHtml ? `<div class="rrb-preview-stats">${statsHtml}</div>` : ""}
      <button class="rrb-import-btn rrb-import-full" data-id="${fullItem.id}" data-name="${fullItem.name}">
        Import to Foundry
      </button>
    `);

    this._showScreen("preview");

    this._html.find(".rrb-import-full").click(async (e) => {
      const id = $(e.currentTarget).data("id");
      const name = $(e.currentTarget).data("name");
      const btn = $(e.currentTarget);
      btn.prop("disabled", true).text("Importing...");
      try {
        await HHImporter.importItem(id);
        btn.text("Imported!");
        ui.notifications.info(`Imported "${name}" successfully.`);
      } catch (err) {
        btn.prop("disabled", false).text("Import to Foundry");
        ui.notifications.error(`Import failed: ${err.message}`);
      }
    });
  }
}

// These methods are part of HHBrowserApp but defined separately
HHBrowserApp.prototype._loadPacks = async function() {
  const mode = this._mode || "mine";
  const params = mode === "library"
    ? { system: "dnd5e", page: this._page, limit: 20, purchased: "true" }
    : { system: "dnd5e", page: this._page, limit: 20, author: "me" };
  if (this._search) params.search = this._search;
  try {
    const data = await HHApi.getPacks(params);
    this._packs = data.packs || [];
    this._totalPages = data.pagination?.pages || 1;
  } catch (err) {
    ui.notifications.error("R&R Bazaar: " + err.message);
    this._packs = [];
  }
};

HHBrowserApp.prototype._renderPackList = function() {
  const list = this._html.find("#rrb-item-list");
  const showPagination = this._totalPages > 1;
  this._html.find(".rrb-pagination").toggle(showPagination);
  if (showPagination) {
    this._html.find("#rrb-page-info").text(this._page + " / " + this._totalPages);
    this._html.find("#rrb-prev-page").prop("disabled", this._page <= 1);
    this._html.find("#rrb-next-page").prop("disabled", this._page >= this._totalPages);
  }

  if (!this._packs || !this._packs.length) {
    list.html('<div class="rrb-status"><div class="rrb-status-icon">&#9672;</div><p>No bundles found</p></div>');
    return;
  }

  let html2 = "";
  for (const pack of this._packs) {
    const imgHtml = pack.image_url
      ? '<img src="' + HHApi.resolveImageUrl(pack.image_url) + '" class="rrb-item-img" alt="' + pack.name + '" />'
      : '<div class="rrb-item-img-placeholder">&#9672;</div>';
    const authorHtml = pack.profiles && pack.profiles.username
      ? '<span class="rrb-author">by ' + pack.profiles.username + '</span>' : "";
    const descHtml = pack.description
      ? '<div class="rrb-item-desc">' + pack.description + '</div>' : "";
    html2 += '<div class="rrb-item" data-id="' + pack.id + '">'
      + '<div class="rrb-item-art">' + imgHtml + '</div>'
      + '<div class="rrb-item-info">'
      + '<div class="rrb-item-name">' + pack.name + '</div>'
      + '<div class="rrb-item-meta">'
      + '<span class="rrb-badge" style="background:rgba(124,58,237,0.2);color:#c4b5fd;border:1px solid rgba(124,58,237,0.3);">bundle</span>'
      + '<span class="rrb-badge rrb-badge-version">v' + pack.version + '</span>'
      + authorHtml + '</div>' + descHtml + '</div>'
      + '<div class="rrb-item-actions">'
      + '<button class="rrb-pack-view-btn rrb-preview-btn" data-id="' + pack.id + '">View</button>'
      + '<button class="rrb-pack-import-btn rrb-import-btn" data-id="' + pack.id + '" data-name="' + pack.name + '">Import</button>'
      + '</div></div>';
  }
  list.html(html2);

  const self = this;
  list.find(".rrb-pack-view-btn").click(function(e) {
    e.stopPropagation();
    const id = $(e.currentTarget).data("id");
    self._showPackPreview(id);
  });

  list.find(".rrb-pack-import-btn").click(async function(e) {
    e.stopPropagation();
    const id = $(e.currentTarget).data("id");
    const name = $(e.currentTarget).data("name");
    const btn = $(e.currentTarget);
    btn.prop("disabled", true).text("...");
    try {
      await HHImporter.importPack(id);
      btn.text("Done!");
      ui.notifications.info("Bundle imported successfully.");
    } catch (err) {
      btn.prop("disabled", false).text("Import");
      ui.notifications.error("Bundle import failed:" + err.message);
    }
  });
};

HHBrowserApp.prototype._showPackPreview = async function(packId) {
  let pack;
  try {
    pack = await HHApi.getPack(packId);
  } catch (err) {
    ui.notifications.error("Could not load bundle details.");
    return;
  }

  this._html.find("#rrb-preview-title").text(pack.name);

  const imgHtml = pack.image_url
    ? '<img src="' + HHApi.resolveImageUrl(pack.image_url) + '" class="rrb-preview-img" alt="' + pack.name + '" />'
    : '<div class="rrb-preview-img-placeholder">&#9672;</div>';

  const items = pack.pack_items || [];
  let itemsHtml = "";
  if (items.length) {
    let rows = "";
    const sorted = items.slice().sort(function(a, b) { return a.sort_order - b.sort_order; });
    for (const pi of sorted) {
      const item = pi.content_items;
      if (!item) continue;
      const thumbHtml = item.image_url
        ? '<img src="' + HHApi.resolveImageUrl(item.image_url) + '" style="width:20px;height:20px;object-fit:cover;border-radius:3px;" />'
        : "";
      rows += '<div class="rrb-stat-row">'
        + '<span class="rrb-stat-label" style="display:flex;align-items:center;gap:0.4rem;">'
        + thumbHtml + item.name + '</span>'
        + '<span class="rrb-badge rrb-badge-' + item.content_type + '" style="font-size:0.62rem;">'
        + item.content_type + '</span></div>';
    }
    itemsHtml = '<div class="rrb-preview-stats">'
      + '<div style="font-family:Cinzel,serif;font-size:0.68rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--rrb-accent-violet-light);margin-bottom:0.5rem;">'
      + 'Bundle Contents (' + items.length + ' items)</div>'
      + rows + '</div>';
  } else {
    itemsHtml = '<p style="color:var(--rrb-text-muted);font-size:0.8rem;">No items in this bundle yet.</p>';
  }

  const tagsHtml = pack.tags && pack.tags.length
    ? '<div class="rrb-preview-tags">' + pack.tags.map(function(t) { return '<span class="rrb-tag">' + t + '</span>'; }).join("") + '</div>'
    : "";
  const authorHtml = pack.profiles && pack.profiles.username
    ? '<span class="rrb-author">by ' + pack.profiles.username + '</span>' : "";
  const descHtml = pack.description
    ? '<div class="rrb-preview-description">' + pack.description + '</div>' : "";

  this._html.find("#rrb-preview-content").html(
    '<div class="rrb-preview-top">' + imgHtml
    + '<div class="rrb-preview-header">'
    + '<h2 class="rrb-preview-name">' + pack.name + '</h2>'
    + '<div class="rrb-preview-meta">'
    + '<span class="rrb-badge" style="background:rgba(124,58,237,0.2);color:#c4b5fd;border:1px solid rgba(124,58,237,0.3);">bundle</span>'
    + '<span class="rrb-badge rrb-badge-version">v' + pack.version + '</span>'
    + authorHtml + '</div>' + tagsHtml + '</div></div>'
    + descHtml + itemsHtml
    + '<button class="rrb-import-btn rrb-import-full" data-id="' + pack.id + '" data-name="' + pack.name + '">'
    + 'Import Entire Bundle</button>'
  );

  this._showScreen("preview");

  const self = this;
  this._html.find(".rrb-import-full").click(async function(e) {
    const id = $(e.currentTarget).data("id");
    const name = $(e.currentTarget).data("name");
    const btn = $(e.currentTarget);
    btn.prop("disabled", true).text("Importing bundle...");
    try {
      await HHImporter.importPack(id);
      btn.text("Bundle Imported!");
      ui.notifications.info("Bundle imported successfully.");
    } catch (err) {
      btn.prop("disabled", false).text("Import Entire Bundle");
      ui.notifications.error("Bundle import failed:" + err.message);
    }
  });
};
class HHImporter {
  static async importPack(packId) {
    const pack = await HHApi.getPack(packId);
    const items = pack.pack_items || [];

    if (!items.length) {
      throw new Error("This bundle has no items to import.");
    }

    ui.notifications.info("Importing: " + pack.name + " (" + items.length + " items)...");

    const results = { success: [], failed: [] };
    const sorted = items.sort((a, b) => a.sort_order - b.sort_order);

    for (const packItem of sorted) {
      const item = packItem.content_items;
      if (!item) continue;
      try {
        await this.importItem(item.id);
        results.success.push(item.name);
      } catch (err) {
        console.warn(`HH | Failed to import "${item.name}":`, err);
        results.failed.push(item.name);
      }
    }

    if (results.failed.length) {
      ui.notifications.warn(`Bundle imported with ${results.failed.length} error(s): ${results.failed.join(", ")}`);
    } else {
      ui.notifications.info("Bundle imported: " + results.success.length + " items added.");
    }

    return results;
  }

  static async importItem(id) {
    const item = await HHApi.getContentItem(id);

    if (item.content_type === "monster") {
      return this.importMonster(item);
    }
    if (item.content_type === "journal") {
      return this.importJournal(item);
    }
    if (item.content_type === "map") {
      return this.importMap(item);
    }
    if (item.content_type === "audio") {
      return this.importAudio(item);
    }

    const itemData = this.mapToDnd5e(item);
    const results = {};

    try {
      const compendiumName = game.settings.get(MODULE_ID, "compendiumName");
      let pack = game.packs.get(`world.${compendiumName}`);
      if (!pack) {
        pack = await CompendiumCollection.createCompendium({
          name: compendiumName,
          label: "Relics & Realms Imports",
          type: "Item", system: "dnd5e",
        });
      }
      await pack.getIndex();
      const existing = pack.index.find(e => e.name === item.name);
      if (existing) {
        const doc = await pack.getDocument(existing._id);
        await doc.update(itemData);
        results.compendium = doc;
      } else {
        results.compendium = await Item.create(itemData, { pack: pack.collection });
      }
    } catch (err) { console.warn("HH | Failed to import to compendium:", err); }

    if (game.settings.get(MODULE_ID, "importToItems")) {
      try {
        const existing = game.items.find(i => i.getFlag(MODULE_ID, "sourceId") === item.id);
        let worldItem;
        if (existing) {
          await existing.update(itemData);
          worldItem = existing;
        } else {
          worldItem = await Item.create(itemData);
        }
        if (item.content_type === "weapon" && item.data?.bonus_damage_formula) {
          await this.setBonusDamage(worldItem, item.data);
        }
        results.worldItem = worldItem;
      } catch (err) { console.warn("HH | Failed to import to world items:", err); }
    }

    if (results.compendium && item.content_type === "weapon" && item.data?.bonus_damage_formula) {
      try { await this.setBonusDamage(results.compendium, item.data); }
      catch (err) { console.warn("HH | Failed to set bonus damage:", err); }
    }

    return results;
  }

  /** Resolve all relative image/link URLs in HTML content to absolute API URLs */
  static resolveContentUrls(html) {
    if (!html) return html;
    const baseUrl = HHApi.getBaseUrl();
    // Replace src="/api/... and href="/api/... with absolute URLs
    return html.replace(/(src|href)="(\/api\/[^"]+)"/g, `$1="${baseUrl}$2"`);
  }

  static async importJournal(item) {
    const d = item.data || {};
    const pages = d.pages || [{ title: item.name, content: item.description || "", sort_order: 0 }];

    const journalData = {
      name: item.name,
      img: HHApi.fullImageFor(item) || null,
      flags: { [MODULE_ID]: { sourceId: item.id, version: item.version } },
      pages: pages.map((page, idx) => ({
        name: page.title || "Page " + (idx + 1),
        type: "text",
        sort_order: (page.sort_order || idx) * 100000,
        text: {
          content: this.resolveContentUrls(page.content || ""),
          format: 1,
        },
      })),
    };

    const results = {};

    if (game.settings.get(MODULE_ID, "importToItems")) {
      try {
        const existing = game.journal.find(j => j.getFlag(MODULE_ID, "sourceId") === item.id);
        if (existing) {
          await existing.update(journalData);
          results.journal = existing;
        } else {
          results.journal = await JournalEntry.create(journalData);
        }
      } catch (err) {
        console.warn("HH | Failed to import journal:", err);
      }
    }

    return results;
  }

  /**
   * Download a remote file to Foundry's local storage.
   * @param {string} url - Remote file URL
   * @param {string} targetDir - Target directory in Foundry data
   * @param {string} fileName - Desired file name
   * @returns {Promise<string|null>} Local file path or null on failure
   */
  static async downloadToLocal(url, targetDir, fileName, contentItemId = null) {
    try {
      let downloadUrl = HHApi.resolveImageUrl(url);

      // If this is a private bucket URL, get a signed URL first
      if (contentItemId && url.includes("/storage/v1/object/public/")) {
        const bucketMatch = url.match(/\/storage\/v1\/object\/public\/(map-images|map-sounds)\/(.+)/);
        if (bucketMatch) {
          const [, bucket, path] = bucketMatch;
          try {
            const data = await HHApi.request("/api/storage/signed-url", {
              method: "POST",
              body: JSON.stringify({ bucket, path: decodeURIComponent(path), content_item_id: contentItemId }),
            });
            if (data.url) {
              downloadUrl = data.url;
              console.log(`HH | Got signed URL for ${fileName}`);
            }
          } catch (err) {
            console.warn(`HH | Failed to get signed URL for ${fileName}, trying direct:`, err);
          }
        }
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      // Ensure directory exists
      try {
        await FilePicker.browse("data", targetDir);
      } catch {
        await FilePicker.createDirectory("data", targetDir);
      }

      const file = new File([blob], fileName, { type: blob.type });
      const result = await FilePicker.upload("data", targetDir, file);
      const path = result?.path || `${targetDir}/${fileName}`;
      console.log(`HH | Downloaded ${fileName} to ${path}`);
      return path;
    } catch (err) {
      console.warn(`HH | Failed to download ${url}:`, err);
      return null;
    }
  }

  static async importAudio(item) {
    const d = item.data || {};
    const audioUrl = d.audio_url;
    if (!audioUrl) throw new Error("No audio file URL found.");

    const safeName = item.name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
    const soundDir = "relics-realms-audio";

    // Download the audio file
    ui.notifications.info(`Downloading audio: ${item.name}...`);
    const ext = d.audio_format || audioUrl.match(/\.(ogg|wav|webm|mp3)(\?|$)/i)?.[1] || "ogg";
    const localPath = await this.downloadToLocal(
      audioUrl, soundDir, `${safeName}_${item.id.substring(0, 8)}.${ext}`, item.id
    );
    if (!localPath) throw new Error("Failed to download audio file.");

    // Find or create a "Relics & Realms" playlist
    const playlistName = "Relics & Realms Imports";
    let playlist = game.playlists.find(p => p.name === playlistName);
    if (!playlist) {
      playlist = await Playlist.create({
        name: playlistName,
        mode: 0, // sequential
        flags: { [MODULE_ID]: { managed: true } },
      });
    }

    // Check if sound already exists in the playlist
    const existingSound = playlist.sounds.find(s => s.getFlag(MODULE_ID, "sourceId") === item.id);

    const soundData = {
      name: item.name,
      path: localPath,
      volume: d.default_volume ?? 0.8,
      repeat: d.loop ?? true,
      flags: { [MODULE_ID]: { sourceId: item.id, version: item.version, category: d.category, mood: d.mood, environment: d.environment } },
    };

    if (existingSound) {
      await existingSound.update(soundData);
      ui.notifications.info(`Updated audio "${item.name}" in playlist.`);
    } else {
      await playlist.createEmbeddedDocuments("PlaylistSound", [soundData]);
      ui.notifications.info(`Added "${item.name}" to ${playlistName} playlist.`);
    }

    return { playlist, path: localPath };
  }

  static async importMap(item) {
    const d = item.data || {};
    console.log("HH | Map data keys:", Object.keys(d));
    console.log("HH | Walls:", d.walls?.length || 0, "Lights:", d.lights?.length || 0, "Sounds:", d.sounds?.length || 0);
    const imageUrl = HHApi.resolveImageUrl(d.map_image_url || item.image_url) || null;
    const safeName = item.name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
    const mapDir = "relics-realms-maps";
    const soundDir = "relics-realms-maps/sounds";

    // Download the map image
    let localImagePath = null;
    if (imageUrl) {
      ui.notifications.info("Downloading map image...");
      const ext = imageUrl.match(/\.(png|jpe?g|webp|avif|svg|gif|bmp|webm|mp4)(\?|$)/i)?.[1] || "png";
      localImagePath = await this.downloadToLocal(
        imageUrl, mapDir, `${safeName}_${item.id.substring(0, 8)}.${ext}`, item.id
      );
      if (!localImagePath) localImagePath = imageUrl; // fallback to URL
    }

    // Download sound files and update paths
    const sounds = d.sounds || [];
    const localSounds = [];
    if (sounds.length > 0) {
      ui.notifications.info(`Downloading ${sounds.length} sound file(s)...`);
      for (let i = 0; i < sounds.length; i++) {
        const sound = { ...sounds[i] };
        // Check both path and audio_url for remote/proxy URLs
        const soundUrl = (sound.audio_url && (sound.audio_url.startsWith("http") || sound.audio_url.startsWith("/"))) ? sound.audio_url
          : (sound.path && (sound.path.startsWith("http") || sound.path.startsWith("/"))) ? sound.path
          : "";

        if (soundUrl) {
          // Use original_filename if available, otherwise generate a name
          const soundExt = soundUrl.match(/\.(ogg|wav|webm|mp3)(\?|$)/i)?.[1] || "ogg";
          const soundFileName = sound.original_filename
            ? sound.original_filename.replace(/[^a-zA-Z0-9._-]/g, "_")
            : `${safeName}_sound_${i}.${soundExt}`;
          ui.notifications.info(`Downloading sound ${i + 1}/${sounds.length}: ${soundFileName}`);
          const localPath = await this.downloadToLocal(soundUrl, soundDir, soundFileName, item.id);
          if (localPath) {
            sound.path = localPath;
            console.log(`HH | Sound ${i}: ${soundUrl} → ${localPath}`);
          } else {
            console.warn(`HH | Sound ${i}: download failed, keeping URL: ${soundUrl}`);
          }
        }
        // Clean up extra fields that Foundry doesn't need
        delete sound.audio_url;
        delete sound.original_filename;
        delete sound.original_path;
        localSounds.push(sound);
      }
    }

    const isV14 = game.release?.generation >= 14;
    console.log(`HH | Scene import: Foundry v${game.release?.generation}, isV14=${isV14}, imagePath=${localImagePath}`);

    let sceneData;

    if (isV14) {
      // v14: background moved to levels system
      sceneData = {
        name: item.name,
        width: d.map_width || 4000,
        height: d.map_height || 3000,
        padding: d.scene_padding ?? 0.25,
        backgroundColor: d.background_color || "#000000",
        grid: {
          type: d.grid_type ?? 1,
          size: d.grid_size ?? 100,
          color: d.grid_color || "#000000",
          alpha: d.grid_opacity ?? 0.2,
        },
        environment: {
          base: { color: d.background_color || "#000000" },
          globalLight: { enabled: d.has_global_illumination ?? false },
          darknessLevel: d.darkness_level ?? 0,
        },
        visibility: {
          tokenVision: d.token_vision ?? true,
          fogExploration: d.fog_exploration ?? true,
        },
        navigation: true,
        walls: d.walls || [],
        lights: d.lights || [],
        sounds: localSounds,
        flags: { [MODULE_ID]: { sourceId: item.id, version: item.version } },
      };
    } else {
      // v11-v13: legacy scene data model
      sceneData = {
        name: item.name,
        img: localImagePath,
        background: { src: localImagePath },
        width: d.map_width || 4000,
        height: d.map_height || 3000,
        padding: d.scene_padding ?? 0.25,
        backgroundColor: d.background_color || "#000000",
        grid: {
          type: d.grid_type ?? 1,
          size: d.grid_size ?? 100,
          color: d.grid_color || "#000000",
          alpha: d.grid_opacity ?? 0.2,
        },
        darkness: d.darkness_level ?? 0,
        globalLight: d.has_global_illumination ?? false,
        tokenVision: d.token_vision ?? true,
        fogExploration: d.fog_exploration ?? true,
        navigation: true,
        walls: d.walls || [],
        lights: d.lights || [],
        sounds: localSounds,
        flags: { [MODULE_ID]: { sourceId: item.id, version: item.version } },
      };
    }

    const results = {};

    try {
      // Check for existing scene with same source ID
      const existing = game.scenes.find(s => s.getFlag(MODULE_ID, "sourceId") === item.id);
      if (existing) {
        await existing.update(sceneData);
        results.scene = existing;
        ui.notifications.info(`Updated scene "${item.name}".`);
      } else {
        results.scene = await Scene.create(sceneData);
        ui.notifications.info(`Created scene "${item.name}".`);
      }

      // Set the background image
      if (results.scene && localImagePath) {
        if (isV14) {
          // v14: set background via the initial level
          try {
            const levels = results.scene.levels?.contents || [];
            const initialLevel = levels[0];
            if (initialLevel) {
              await initialLevel.update({ background: { src: localImagePath } });
              console.log(`HH | Set background on initial level: ${localImagePath}`);
            } else {
              // Create the initial level with the background
              await results.scene.createEmbeddedDocuments("SceneLevel", [{
                name: "Ground",
                elevation: 0,
                background: { src: localImagePath },
              }]);
              console.log(`HH | Created initial level with background: ${localImagePath}`);
            }
          } catch (err) {
            console.warn("HH | Failed to set level background, trying legacy fallback:", err);
            await results.scene.update({ background: { src: localImagePath } });
          }
        } else {
          const currentBg = results.scene.background?.src;
          if (!currentBg || currentBg !== localImagePath) {
            await results.scene.update({ background: { src: localImagePath }, img: localImagePath });
          }
        }
      }

      // Generate thumbnail
      if (results.scene) {
        try {
          const thumb = await results.scene.createThumbnail();
          if (thumb?.thumb) {
            await results.scene.update({ thumb: thumb.thumb });
          }
        } catch (err) {
          console.warn("HH | Could not generate scene thumbnail:", err);
        }
      }
    } catch (err) {
      console.error("HH | Failed to import map as scene:", err);
      throw new Error("Scene import failed: " + err.message);
    }

    return results;
  }

  static async importMonster(item) {
    const actorData = this.mapMonsterToDnd5e(item);
    const results = {};
    // Fetch and import inventory items first
    const inventory = item.data?.inventory || [];

    try {
      const compendiumName = game.settings.get(MODULE_ID, "compendiumName") + "-actors";
      let pack = game.packs.get(`world.${compendiumName}`);
      if (!pack) {
        pack = await CompendiumCollection.createCompendium({
          name: compendiumName,
          label: "Relics & Realms NPC Imports",
          type: "Actor", system: "dnd5e",
        });
      }
      await pack.getIndex();
      const existing = pack.index.find(e => e.name === item.name);
      if (existing) {
        const doc = await pack.getDocument(existing._id);
        await doc.update(actorData);
        results.compendium = doc;
      } else {
        const created = await Actor.createDocuments([actorData], { pack: pack.collection });
        results.compendium = created[0];
      }
      // Add abilities to compendium actor
      const compActor = results.compendium;
      if (compActor) {
        try {
          const oldItems = compActor.items.filter(i => i.getFlag(MODULE_ID, "monsterAbility"));
          if (oldItems.length > 0) {
            await compActor.deleteEmbeddedDocuments("Item", oldItems.map(i => i.id));
          }
          const abilityItems = this.buildMonsterItems(item.data || {});
          if (abilityItems.length > 0) {
            await compActor.createEmbeddedDocuments("Item", abilityItems);
          }
        } catch (err) { console.warn("HH | Failed to add abilities to compendium actor:", err); }
      }
    } catch (err) { console.warn("HH | Failed to import monster to compendium:", err); }

    if (game.settings.get(MODULE_ID, "importToItems")) {
      try {
        const existing = game.actors.find(a => a.getFlag(MODULE_ID, "sourceId") === item.id);
        let actor;
        if (existing) {
          await existing.update(actorData);
          actor = existing;
        } else {
          actor = await Actor.create(actorData);
        }
        results.worldActor = actor;

        // Import monster abilities as embedded items
        if (actor) {
          try {
            // Clear old embedded items from previous imports
            const oldItems = actor.items.filter(i => i.getFlag(MODULE_ID, "monsterAbility"));
            if (oldItems.length > 0) {
              await actor.deleteEmbeddedDocuments("Item", oldItems.map(i => i.id));
            }
            const abilityItems = this.buildMonsterItems(item.data || {});
            if (abilityItems.length > 0) {
              await actor.createEmbeddedDocuments("Item", abilityItems);
              console.log(`HH | Created ${abilityItems.length} ability items on ${item.name}`);
            }
          } catch (err) { console.warn("HH | Failed to create monster abilities:", err); }
        }

        // Import inventory items onto the actor
        if (actor && inventory.length > 0) {
          for (const invItem of inventory) {
            try {
              const fullItem = await HHApi.getContentItem(invItem.content_item_id);
              const itemData = HHImporter.mapToDnd5e(fullItem);
              itemData.system = itemData.system || {};
              itemData.system.quantity = invItem.quantity || 1;
              await actor.createEmbeddedDocuments("Item", [itemData]);
            } catch (err) {
              console.warn("HH | Failed to import inventory item:", invItem.name, err);
            }
          }
        }
      } catch (err) { console.warn("HH | Failed to import monster to world:", err); }
    }

    return results;
  }

  static mapToDnd5e(item) {
    const base = {
      name: item.name,
      type: this.mapContentType(item.content_type),
      img: HHApi.fullImageFor(item) || this.getDefaultIcon(item.content_type),
      system: { description: { value: item.description || "" }, sourceItem: "" },
      flags: { [MODULE_ID]: { sourceId: item.id, version: item.version } },
    };
    const d = item.data || {};
    switch (item.content_type) {
      case "weapon": return this.mapWeapon(base, d);
      case "spell": return this.mapSpell(base, d);
      case "armor":
      case "equipment": return this.mapEquipment(base, d, item.content_type);
      case "feat":
      case "feature": return this.mapFeat(base, d);
      default: return base;
    }
  }

  static mapContentType(contentType) {
    const map = {
      weapon: "weapon", armor: "equipment", equipment: "equipment",
      spell: "spell", feat: "feat",
      monster: "npc", class: "class", subclass: "subclass", background: "background",
      map: "scene",
    };
    return map[contentType] || "loot";
  }

  static getDefaultIcon(contentType) {
    const icons = {
      weapon: "icons/svg/sword.svg", armor: "icons/svg/shield.svg",
      equipment: "icons/svg/item-bag.svg", spell: "icons/svg/lightning.svg",
      feat: "icons/svg/book.svg",
      monster: "icons/svg/skull.svg", class: "icons/svg/statue.svg",
      background: "icons/svg/ruins.svg", map: "icons/svg/village.svg",
    };
    return icons[contentType] || "icons/svg/item-bag.svg";
  }

  static mapWeapon(base, d) {
    // Build properties as array, add mgc if magical bonus
    const props = this.mapWeaponProperties(d.properties || []);
    if (d.magical_bonus && d.magical_bonus > 0 && !props.includes("mgc")) props.push("mgc");

    // Map weapon type name to dnd5e baseItem key
    const weaponTypeMap = {
      "battleaxe": "battleaxe", "blowgun": "blowgun", "club": "club",
      "dagger": "dagger", "dart": "dart", "flail": "flail",
      "glaive": "glaive", "greataxe": "greataxe", "greatclub": "greatclub",
      "greatsword": "greatsword", "halberd": "halberd",
      "hand crossbow": "handcrossbow", "handaxe": "handaxe",
      "heavy crossbow": "heavycrossbow", "javelin": "javelin", "lance": "lance",
      "light crossbow": "lightcrossbow", "light hammer": "lighthammer",
      "longbow": "longbow", "longsword": "longsword", "mace": "mace",
      "maul": "maul", "morningstar": "morningstar", "net": "net",
      "pike": "pike", "quarterstaff": "quarterstaff", "rapier": "rapier",
      "scimitar": "scimitar", "shortbow": "shortbow", "shortsword": "shortsword",
      "sickle": "sickle", "spear": "spear", "trident": "trident",
      "war pick": "warpick", "warhammer": "warhammer", "whip": "whip",
    };

    const category = d.weapon_category || "martial";
    const baseItem = d.weapon_type ? (weaponTypeMap[d.weapon_type] || d.weapon_type) : "";

    // Determine weapon classification value (simpleM, martialM, simpleR, martialR)
    const rangedTypes = ["blowgun", "hand crossbow", "handcrossbow", "heavy crossbow", "heavycrossbow",
      "light crossbow", "lightcrossbow", "longbow", "shortbow", "dart"];
    const isRanged = rangedTypes.includes(d.weapon_type || "");
    const typeValue = category === "simple"
      ? (isRanged ? "simpleR" : "simpleM")
      : (isRanged ? "martialR" : "martialM");

    const description = (base.system?.description?.value || "") +
      (d.special_effects ? `<p><em>${d.special_effects}</em></p>` : "") +
      (d.attunement_requirements ? `<p><strong>Attunement:</strong> ${d.attunement_requirements}</p>` : "");

    return foundry.utils.mergeObject(base, {
      system: {
        description: { value: description },
        quantity: 1,
        weight: { value: d.weight || 0, units: "lb" },
        price: { value: d.price || 0, denomination: d.price_unit || "gp" },
        rarity: d.rarity || "common",
        magicalBonus: d.magical_bonus > 0 ? d.magical_bonus : null,
        proficient: 1,
        type: { value: typeValue, baseItem: baseItem },
        damage: {
          base: {
            number: this.parseDiceCount(d.damage_formula || "1d6"),
            denomination: this.parseDiceSides(d.damage_formula || "1d6"),
            types: d.damage_type ? [d.damage_type] : ["slashing"],
            bonus: d.magical_bonus > 0 ? String(d.magical_bonus) : "",
          },
        },
        range: { value: d.range_normal || null, long: d.range_long || null, units: "ft" },
        properties: props,
        attunement: d.requires_attunement ? 1 : 0,
        uses: d.uses ? {
          value: d.uses,
          max: String(d.uses),
          per: d.uses_per || "day",
          recovery: d.recharge || "",
        } : { value: 0, max: "", per: null },
        activation: {
          type: d.activation_type || "action",
          cost: d.activation_cost || 1,
        },
      },
    });
  }

  static parseDiceCount(formula) {
    const match = formula.match(/^(\d+)d(\d+)/i);
    return match ? parseInt(match[1]) : 1;
  }

  static parseDiceSides(formula) {
    const match = formula.match(/^(\d+)d(\d+)/i);
    return match ? parseInt(match[2]) : 6;
  }

  static mapWeaponProperties(properties) {
    const propMap = {
      "ammunition": "amm", "finesse": "fin", "heavy": "hvy", "light": "lgt",
      "loading": "lod", "magical": "mgc", "reach": "rch", "silvered": "sil",
      "special": "spc", "thrown": "thr", "two-handed": "two", "versatile": "ver",
    };
    const result = [];
    for (const prop of properties) {
      const mapped = propMap[prop];
      if (mapped) result.push(mapped);
    }
    return result;
  }

  static mapSpell(base, d) {
    // Append class list to description if present
    const descValue = base.system.description.value || "";
    const classes = (d.classes || []);
    const classLine = classes.length > 0 ? `<p><em><strong>Spell Lists:</strong> ${classes.join(", ")}</em></p>` : "";
    const fullDesc = classLine ? descValue + classLine : descValue;

    return foundry.utils.mergeObject(base, {
      system: {
        description: { value: fullDesc },
        level: d.level ?? 1,
        school: (d.school || "evocation").substring(0, 3),
        properties: this.mapSpellComponents(d),
        materials: { value: d.material_description || "", consumed: false, cost: 0, supply: 0 },
        range: this.parseSpellRange(d.range),
        duration: this.parseSpellDuration(d.duration),
        activities: {
          "dnd5eactivity000": {
            _id: "dnd5eactivity000",
            type: d.save_ability ? "save" : "utility",
            activation: { type: "action", override: false },
            damage: {
              onSave: "half",
              parts: d.damage_formula ? [{
                number: this.parseDiceCount(d.damage_formula),
                denomination: this.parseDiceSides(d.damage_formula),
                types: d.damage_type ? [d.damage_type] : [],
                bonus: "",
                custom: { enabled: false, formula: "" },
                scaling: { number: 1 },
              }] : [],
            },
            save: d.save_ability ? {
              ability: [d.save_ability.substring(0, 3)],
              dc: { calculation: "spellcasting", formula: "" },
            } : undefined,
          },
        },
      },
    });
  }

  static mapSpellComponents(d) {
    const props = [];
    if (d.components_verbal) props.push("vocal");
    if (d.components_somatic) props.push("somatic");
    if (d.components_material) props.push("material");
    if (d.duration && d.duration.toLowerCase().includes("concentration")) props.push("concentration");
    if (d.ritual) props.push("ritual");
    return props;
  }

  static parseSpellRange(rangeStr) {
    if (!rangeStr) return { value: 0, units: "ft", special: "" };
    const lower = rangeStr.toLowerCase().trim();
    if (lower === "self") return { value: 0, units: "self", special: "" };
    if (lower === "touch") return { value: 0, units: "touch", special: "" };
    if (lower === "unlimited") return { value: 0, units: "any", special: "" };
    const match = lower.match(/(\d+)\s*feet?/);
    if (match) return { value: parseInt(match[1]), units: "ft", special: "" };
    return { value: 0, units: "spec", special: rangeStr };
  }

  static parseSpellDuration(durationStr) {
    if (!durationStr) return { value: 0, units: "inst", special: "" };
    const lower = durationStr.toLowerCase().trim();
    if (lower === "instantaneous") return { value: 0, units: "inst", special: "" };
    if (lower.includes("permanent") || lower.includes("until dispelled")) return { value: 0, units: "perm", special: "" };
    const concMatch = lower.match(/concentration.*?(\d+)\s*(minute|hour|round)/);
    if (concMatch) {
      const unit = concMatch[2].startsWith("minute") ? "minute" : concMatch[2].startsWith("hour") ? "hour" : "round";
      return { value: parseInt(concMatch[1]), units: unit, special: "" };
    }
    const match = lower.match(/(\d+)\s*(minute|hour|round|day)/);
    if (match) {
      const unit = match[2].startsWith("minute") ? "minute" : match[2].startsWith("hour") ? "hour" : match[2].startsWith("day") ? "day" : "round";
      return { value: parseInt(match[1]), units: unit, special: "" };
    }
    return { value: 0, units: "spec", special: durationStr };
  }

  static mapEquipment(base, d, contentType) {
    const isArmor = contentType === "armor";
    const isShield = d.armor_type === "shield";
    const description = (base.system?.description?.value || "") +
      (d.special_effects ? `<p><em>${d.special_effects}</em></p>` : "") +
      (d.attunement_requirements ? `<p><strong>Attunement:</strong> ${d.attunement_requirements}</p>` : "");

    const armorTypeMap = {
      "light": "light", "medium": "medium", "heavy": "heavy",
      "shield": "shield", "natural": "natural",
    };

    const props = [];
    if (d.requires_attunement) props.push("mgc");
    if (d.stealth_disadvantage) props.push("stealthDisadvantage");
    if (d.magical_bonus > 0) props.push("mgc");

    return foundry.utils.mergeObject(base, {
      type: "equipment",
      system: {
        description: { value: description },
        quantity: 1,
        weight: { value: d.weight || 0, units: "lb" },
        price: { value: d.price || 0, denomination: d.price_unit || "gp" },
        rarity: d.rarity || "common",
        armor: isArmor ? {
          value: isShield ? (d.ac_bonus || 2) : (d.ac_base || 10),
          magicalBonus: d.magical_bonus || null,
          dex: (d.dex_cap !== null && d.dex_cap !== undefined) ? d.dex_cap : null,
        } : undefined,
        type: { value: isArmor ? (armorTypeMap[d.armor_type] || "medium") : (d.equipment_type || "trinket") },
        strength: d.strength_requirement || null,
        properties: props,
        attunement: d.requires_attunement ? 1 : 0,
        uses: d.uses ? {
          value: d.uses, max: String(d.uses),
          per: d.uses_per || "day", recovery: d.recharge || "",
        } : { value: 0, max: "", per: null },
        activation: d.activation_type ? {
          type: d.activation_type, cost: d.activation_cost || 1,
        } : undefined,
      },
    });
  }

  static mapFeat(base, d) {
    const description = (base.system?.description?.value || "") +
      (d.special_effects ? `<p>${d.special_effects}</p>` : "") +
      (d.ability_score_improvement ? `<p><strong>ASI:</strong> ${d.ability_score_improvement}</p>` : "") +
      (d.proficiencies_granted ? `<p><strong>Proficiencies:</strong> ${d.proficiencies_granted}</p>` : "");

    return foundry.utils.mergeObject(base, {
      system: {
        description: { value: description },
        prerequisites: {
          value: d.prerequisites || "",
          level: d.prerequisite_level || null,
        },
        uses: d.uses ? {
          value: d.uses, max: String(d.uses),
          per: d.uses_per || "day", recovery: d.recharge || "",
        } : { value: 0, max: "", per: null },
        activation: d.activation_type ? {
          type: d.activation_type, cost: d.activation_cost || 1,
        } : undefined,
      },
    });
  }

  static async setBonusDamage(doc, d) {
    if (!d.bonus_damage_formula) return;
    const activity = doc.system.activities?.contents?.[0];
    if (!activity) return;
    await activity.update({
      "damage.parts": [{
        number: this.parseDiceCount(d.bonus_damage_formula),
        denomination: this.parseDiceSides(d.bonus_damage_formula),
        types: d.bonus_damage_type ? [d.bonus_damage_type] : [],
        bonus: "",
        custom: { enabled: false, formula: "" },
        scaling: { number: 1 },
      }],
    });
  }

  /** Build embedded Item documents for monster traits, actions, reactions, etc. */
  static buildMonsterItems(d) {
    const items = [];
    const flag = { [MODULE_ID]: { monsterAbility: true } };

    // Helper to detect attack actions and parse them
    const parseAttack = (desc) => {
      // Match patterns like "+7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage"
      const atkMatch = desc.match(/([+-]\d+)\s+to hit.*?(?:reach|range)\s+([\d/]+\s*ft\.)/i);
      const dmgMatch = desc.match(/Hit:\s*\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s*(\w+)\s*damage/i);
      return { atkMatch, dmgMatch };
    };

    const buildAbility = (name, desc, activationType, activationCost) => {
      const item = {
        name,
        type: "feat",
        system: {
          description: { value: `<p>${desc}</p>` },
          activation: { type: activationType, cost: activationCost || 1 },
          sourceItem: "",
        },
        flags: flag,
      };

      // Try to parse as an attack
      const { atkMatch, dmgMatch } = parseAttack(desc);
      if (atkMatch) {
        item.type = "weapon";
        const isRanged = desc.toLowerCase().includes("ranged") || desc.toLowerCase().includes("range ");
        item.system.actionType = isRanged ? "rwak" : "mwak";
        item.system.attackBonus = atkMatch[1];
        item.system.range = { value: parseInt(atkMatch[2]) || 5, units: "ft" };
        if (dmgMatch) {
          const formula = dmgMatch[1].replace(/\s/g, "");
          item.system.damage = {
            parts: [[formula, dmgMatch[2].toLowerCase()]],
          };
        }
        item.system.type = { value: "natural" };
        item.system.proficient = true;
      }
      return item;
    };

    // Traits (passive abilities)
    if (d.traits?.length) {
      for (const t of d.traits) {
        items.push({
          name: t.name,
          type: "feat",
          system: {
            description: { value: `<p>${t.description}</p>` },
            activation: { type: "" },
            type: { value: "monster" },
            sourceItem: "",
          },
          flags: flag,
        });
      }
    }

    // Actions
    if (d.actions?.length) {
      for (const a of d.actions) {
        items.push(buildAbility(a.name, a.description, "action", 1));
      }
    }

    // Bonus Actions
    if (d.bonus_actions?.length) {
      for (const a of d.bonus_actions) {
        items.push(buildAbility(a.name, a.description, "bonus", 1));
      }
    }

    // Reactions
    if (d.reactions?.length) {
      for (const r of d.reactions) {
        items.push(buildAbility(r.name, r.description, "reaction", 1));
      }
    }

    // Legendary Actions
    if (d.legendary_actions?.length) {
      for (const la of d.legendary_actions) {
        const item = buildAbility(la.name, la.description, "legendary", la.cost || 1);
        items.push(item);
      }
    }

    // Lair Actions
    if (d.lair_actions?.length) {
      for (const la of d.lair_actions) {
        items.push({
          name: la.name || "Lair Action",
          type: "feat",
          system: {
            description: { value: `<p>${la.description}</p>` },
            activation: { type: "lair", cost: 1 },
            type: { value: "monster" },
            sourceItem: "",
          },
          flags: flag,
        });
      }
    }

    return items;
  }

  static mapMonsterToDnd5e(item) {
    const d = item.data || {};
    const sizeMap = {
      tiny: "tiny", small: "sm", medium: "med",
      large: "lg", huge: "huge", gargantuan: "grg",
    };
    const crMap = {
      "0": 0, "1/8": 0.125, "1/4": 0.25, "1/2": 0.5,
      "1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,
      "11":11,"12":12,"13":13,"14":14,"15":15,"16":16,"17":17,"18":18,
      "19":19,"20":20,"21":21,"22":22,"23":23,"24":24,"25":25,
      "26":26,"27":27,"28":28,"29":29,"30":30,
    };
    const xpMap = {
      0:10, 0.125:25, 0.25:50, 0.5:100, 1:200, 2:450, 3:700, 4:1100,
      5:1800, 6:2300, 7:2900, 8:3900, 9:5000, 10:5900, 11:7200, 12:8400,
      13:10000, 14:11500, 15:13000, 16:15000, 17:18000, 18:20000, 19:22000,
      20:25000, 21:33000, 22:41000, 23:50000, 24:62000, 25:75000,
      26:90000, 27:105000, 28:120000, 29:135000, 30:155000,
    };
    const cr = crMap[d.cr] ?? 1;
    const size = sizeMap[d.size?.toLowerCase()] ?? "med";
    const speed = parseInt(d.speed) || 30;

    // Build biography from description + traits, actions, reactions, legendary actions
    let bio = item.description || "";

    if (d.traits?.length) {
      bio += "<h3>Traits</h3>";
      for (const t of d.traits) {
        bio += `<p><strong><em>${t.name}.</em></strong> ${t.description}</p>`;
      }
    }
    if (d.actions?.length) {
      bio += "<h3>Actions</h3>";
      for (const a of d.actions) {
        bio += `<p><strong><em>${a.name}.</em></strong> ${a.description}</p>`;
      }
    }
    if (d.bonus_actions?.length) {
      bio += "<h3>Bonus Actions</h3>";
      for (const a of d.bonus_actions) {
        bio += `<p><strong><em>${a.name}.</em></strong> ${a.description}</p>`;
      }
    }
    if (d.reactions?.length) {
      bio += "<h3>Reactions</h3>";
      for (const r of d.reactions) {
        bio += `<p><strong><em>${r.name}.</em></strong> ${r.description}</p>`;
      }
    }
    if (d.legendary_actions?.length) {
      bio += "<h3>Legendary Actions</h3>";
      if (d.legendary_description) bio += `<p>${d.legendary_description}</p>`;
      for (const la of d.legendary_actions) {
        bio += `<p><strong><em>${la.name}${la.cost > 1 ? ` (Costs ${la.cost} Actions)` : ''}.</em></strong> ${la.description}</p>`;
      }
    }
    if (d.lair_actions?.length) {
      bio += "<h3>Lair Actions</h3>";
      if (d.lair_actions_description) bio += `<p>${d.lair_actions_description}</p>`;
      for (const la of d.lair_actions) {
        bio += `<p>${la.description}</p>`;
      }
    }
    if (d.mythic_actions?.length) {
      bio += "<h3>Mythic Actions</h3>";
      for (const ma of d.mythic_actions) {
        bio += `<p><strong><em>${ma.name}.</em></strong> ${ma.description}</p>`;
      }
    }

    // Parse damage/condition traits
    const parseCsv = (str) => str ? str.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    const di = parseCsv(d.damage_immunities);
    const dr = parseCsv(d.damage_resistances);
    const dv = parseCsv(d.damage_vulnerabilities);
    const ci = parseCsv(d.condition_immunities);

    // Parse saving throw proficiencies
    const savingThrows = {};
    if (d.saving_throws) {
      const stParts = d.saving_throws.split(",").map(s => s.trim());
      for (const part of stParts) {
        const match = part.match(/(str|dex|con|int|wis|cha)/i);
        if (match) savingThrows[match[1].toLowerCase()] = { proficient: 1 };
      }
    }

    // Parse skill proficiencies
    const skills = {};
    if (d.skills) {
      const skillMap = {
        acrobatics: "acr", "animal handling": "ani", arcana: "arc", athletics: "ath",
        deception: "dec", history: "his", insight: "ins", intimidation: "itm",
        investigation: "inv", medicine: "med", nature: "nat", perception: "prc",
        performance: "prf", persuasion: "per", religion: "rel", "sleight of hand": "slt",
        stealth: "ste", survival: "sur",
      };
      const skillParts = d.skills.split(",").map(s => s.trim());
      for (const part of skillParts) {
        const match = part.match(/^([a-z\s]+)\s*[+-]\s*(\d+)/i);
        if (match) {
          const key = skillMap[match[1].trim().toLowerCase()];
          if (key) skills[key] = { value: 1 };
        }
      }
    }

    // Parse speed components
    const movement = { walk: speed, units: "ft" };
    if (d.speed) {
      const speedStr = d.speed.toString();
      const flyMatch = speedStr.match(/fly\s+(\d+)/i);
      const swimMatch = speedStr.match(/swim\s+(\d+)/i);
      const burrowMatch = speedStr.match(/burrow\s+(\d+)/i);
      const climbMatch = speedStr.match(/climb\s+(\d+)/i);
      if (flyMatch) movement.fly = parseInt(flyMatch[1]);
      if (swimMatch) movement.swim = parseInt(swimMatch[1]);
      if (burrowMatch) movement.burrow = parseInt(burrowMatch[1]);
      if (climbMatch) movement.climb = parseInt(climbMatch[1]);
      if (speedStr.toLowerCase().includes("hover")) movement.hover = true;
    }

    return {
      name: item.name,
      type: "npc",
      img: HHApi.fullImageFor(item) || "icons/svg/skull.svg",
      prototypeToken: {
        name: item.name,
        displayName: 20,
        actorLink: false,
        texture: {
          src: HHApi.fullTokenFor(item) || "icons/svg/skull.svg",
          scaleX: 1,
          scaleY: 1,
        },
        width: size === "lg" ? 2 : size === "huge" ? 3 : size === "grg" ? 4 : 1,
        height: size === "lg" ? 2 : size === "huge" ? 3 : size === "grg" ? 4 : 1,
        disposition: -1,
        displayBars: 20,
        bar1: { attribute: "attributes.hp" },
      },
      system: {
        abilities: {
          str: { value: d.str || 10, proficient: savingThrows.str ? 1 : 0 },
          dex: { value: d.dex || 10, proficient: savingThrows.dex ? 1 : 0 },
          con: { value: d.con || 10, proficient: savingThrows.con ? 1 : 0 },
          int: { value: d.int || 10, proficient: savingThrows.int ? 1 : 0 },
          wis: { value: d.wis || 10, proficient: savingThrows.wis ? 1 : 0 },
          cha: { value: d.cha || 10, proficient: savingThrows.cha ? 1 : 0 },
        },
        attributes: {
          ac: { calc: d.ac ? "flat" : "default", flat: d.ac || null },
          hp: { value: d.hp || 10, max: d.hp || 10, formula: d.hp_formula || "" },
          movement,
        },
        details: {
          biography: { value: bio },
          type: { value: d.monster_type || "humanoid", custom: "" },
          alignment: d.alignment || "",
          cr: cr,
          xp: { value: xpMap[cr] ?? 200 },
          source: { custom: "Relics & Realms" },
        },
        traits: {
          size: size,
          di: { value: di },
          dr: { value: dr },
          dv: { value: dv },
          ci: { value: ci },
          languages: { value: d.languages ? d.languages.split(",").map(s => s.trim().toLowerCase()) : [] },
        },
        skills,
        attributes: {
          ac: { calc: d.ac ? "flat" : "default", flat: d.ac || null },
          hp: { value: d.hp || 10, max: d.hp || 10, formula: d.hp_formula || "" },
          movement,
          senses: this.parseSenses(d.senses),
        },
      },
      flags: { [MODULE_ID]: { sourceId: item.id, version: item.version } },
    };
  }

  static parseSenses(sensesStr) {
    if (!sensesStr) return {};
    const senses = {};
    const darkMatch = sensesStr.match(/darkvision\s+(\d+)/i);
    const blindMatch = sensesStr.match(/blindsight\s+(\d+)/i);
    const trueMatch = sensesStr.match(/truesight\s+(\d+)/i);
    const tremMatch = sensesStr.match(/tremorsense\s+(\d+)/i);
    const passiveMatch = sensesStr.match(/passive\s+perception\s+(\d+)/i);
    if (darkMatch) senses.darkvision = parseInt(darkMatch[1]);
    if (blindMatch) senses.blindsight = parseInt(blindMatch[1]);
    if (trueMatch) senses.truesight = parseInt(trueMatch[1]);
    if (tremMatch) senses.tremorsense = parseInt(tremMatch[1]);
    if (passiveMatch) senses.passivePerception = parseInt(passiveMatch[1]);
    senses.units = "ft";
    return senses;
  }
}