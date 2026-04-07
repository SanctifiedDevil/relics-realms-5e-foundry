const MODULE_ID = "homebrew-hub-5e";
const MODULE_TITLE = "Relics & Realms Bazaar";

Hooks.once("init", () => {
  console.log(`${MODULE_TITLE} | Initializing`);

  game.settings.register(MODULE_ID, "apiUrl", {
    name: "API URL",
    hint: "The URL of your Relics & Realms Bazaar server",
    scope: "world", config: true, type: String,
    default: "http://192.168.1.76:3000",
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
  static async getLibrary(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/library${query ? "?" + query : ""}`);
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
    btn.className = "ui-control plain icon fa-solid fa-dragon";
    btn.setAttribute("data-action", "tab");
    btn.setAttribute("data-tab", "rrb-bazaar");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("data-group", "primary");
    btn.setAttribute("aria-label", "Relics & Realms Bazaar");
    btn.setAttribute("data-tooltip", "Relics & Realms Bazaar");
    btn.style.color = "#a855f7";

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
      title: "Relics & Realms Bazaar",
      template: "modules/homebrew-hub-5e/templates/login.html",
      width: 360, height: "auto", resizable: false,
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
      title: "Relics & Realms Bazaar",
      template: "modules/homebrew-hub-5e/templates/browser.html",
      width: 520, height: 640, resizable: true,
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
      const title = mode === "mine" ? "My Creations" : "My Library";
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
      statusEl.html("<span style=\"color:var(--rrb-text-muted);font-size:0.75rem;\">Not signed in</span>");
      actionsEl.html(
        "<button class=\"rrb-auth-btn\" id=\"rrb-bar-login\">Sign In</button>"
      );
      this._html.find("#rrb-bar-login").click(() => {
        new HHLoginApp().render(true);
        this.close();
      });
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
      statusEl.html("<span style=\"color:#fca5a5;font-size:0.75rem;\">Session expired</span>");
      actionsEl.html(
        "<button class=\"rrb-auth-btn\" id=\"rrb-bar-login\">Sign In</button>"
      );
      this._html.find("#rrb-bar-login").click(() => {
        new HHLoginApp().render(true);
        this.close();
      });
    }
  }

  async _loadCategories() {
    console.log("HH | Loading categories");
    const html = this._html;
    const grid = html.find("#rrb-category-grid");

    const categories = [
      { type: "pack",       label: "Packs",       icon: "&#9672;" },
      { type: "weapon",     label: "Weapons",     icon: "&#9876;" },
      { type: "spell",      label: "Spells",      icon: "&#10022;" },
      { type: "monster",    label: "Monsters",    icon: "&#9760;" },
      { type: "armor",      label: "Armor",       icon: "&#9737;" },
      { type: "equipment",  label: "Equipment",   icon: "&#9674;" },
      { type: "feat",       label: "Feats",       icon: "&#9733;" },
      { type: "feature",    label: "Features",    icon: "&#9670;" },
      { type: "background", label: "Backgrounds", icon: "&#9812;" },
      { type: "journal",     label: "Journals",     icon: "&#9998;" },
    ];

    let counts = {};
    try {
      const mode = this._mode || "mine";
      const countPromises = categories.map(c =>
        c.type === "pack"
          ? HHApi.getPacks({ system: "dnd5e", limit: 1 })
              .then(d => ({ type: c.type, count: d.pagination?.total || 0 }))
              .catch(() => ({ type: c.type, count: 0 }))
          : mode === "library"
            ? HHApi.getLibrary({ type: c.type, limit: 1 })
                .then(d => ({ type: c.type, count: d.pagination?.total || 0 }))
                .catch(() => ({ type: c.type, count: 0 }))
            : HHApi.getContent({ system: "dnd5e", type: c.type, limit: 1, author: "me" })
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
          <div class="rrb-cat-icon">${cat.icon}</div>
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
    const params = { system: "dnd5e", page: this._page, limit: 20 };
    if (this._currentType) params.type = this._currentType;
    if (this._search) params.search = this._search;
    try {
      const data = await HHApi.getContent(params);
      this._items = data.items || [];
      this._totalPages = data.pagination?.pages || 1;
    } catch (err) {
      ui.notifications.error(`R&R Bazaar: ${err.message}`);
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
        ? `<img src="${item.image_url}" class="rrb-item-img" alt="${item.name}" />`
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
      ? `<img src="${fullItem.image_url}" class="rrb-preview-img" alt="${fullItem.name}" />`
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
    } else if (["feat","feature","background"].includes(fullItem.content_type)) {
      statsHtml = `
        ${d.prerequisites ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Prerequisites</span><span class="rrb-stat-value">${d.prerequisites}</span></div>` : ""}
        ${d.usage ? `<div class="rrb-stat-row"><span class="rrb-stat-label">Usage</span><span class="rrb-stat-value">${d.usage}</span></div>` : ""}
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
  const params = { system: "dnd5e", page: this._page, limit: 20 };
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
    list.html('<div class="rrb-status"><div class="rrb-status-icon">&#9672;</div><p>No packs found</p></div>');
    return;
  }

  let html2 = "";
  for (const pack of this._packs) {
    const imgHtml = pack.image_url
      ? '<img src="' + pack.image_url + '" class="rrb-item-img" alt="' + pack.name + '" />'
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
      + '<span class="rrb-badge" style="background:rgba(124,58,237,0.2);color:#c4b5fd;border:1px solid rgba(124,58,237,0.3);">pack</span>'
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
      ui.notifications.info("Pack imported successfully.");
    } catch (err) {
      btn.prop("disabled", false).text("Import");
      ui.notifications.error("Pack import failed: " + err.message);
    }
  });
};

HHBrowserApp.prototype._showPackPreview = async function(packId) {
  let pack;
  try {
    pack = await HHApi.getPack(packId);
  } catch (err) {
    ui.notifications.error("Could not load pack details.");
    return;
  }

  this._html.find("#rrb-preview-title").text(pack.name);

  const imgHtml = pack.image_url
    ? '<img src="' + pack.image_url + '" class="rrb-preview-img" alt="' + pack.name + '" />'
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
        ? '<img src="' + item.image_url + '" style="width:20px;height:20px;object-fit:cover;border-radius:3px;" />'
        : "";
      rows += '<div class="rrb-stat-row">'
        + '<span class="rrb-stat-label" style="display:flex;align-items:center;gap:0.4rem;">'
        + thumbHtml + item.name + '</span>'
        + '<span class="rrb-badge rrb-badge-' + item.content_type + '" style="font-size:0.62rem;">'
        + item.content_type + '</span></div>';
    }
    itemsHtml = '<div class="rrb-preview-stats">'
      + '<div style="font-family:Cinzel,serif;font-size:0.68rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--rrb-accent-violet-light);margin-bottom:0.5rem;">'
      + 'Pack Contents (' + items.length + ' items)</div>'
      + rows + '</div>';
  } else {
    itemsHtml = '<p style="color:var(--rrb-text-muted);font-size:0.8rem;">No items in this pack yet.</p>';
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
    + '<span class="rrb-badge" style="background:rgba(124,58,237,0.2);color:#c4b5fd;border:1px solid rgba(124,58,237,0.3);">pack</span>'
    + '<span class="rrb-badge rrb-badge-version">v' + pack.version + '</span>'
    + authorHtml + '</div>' + tagsHtml + '</div></div>'
    + descHtml + itemsHtml
    + '<button class="rrb-import-btn rrb-import-full" data-id="' + pack.id + '" data-name="' + pack.name + '">'
    + 'Import Entire Pack</button>'
  );

  this._showScreen("preview");

  const self = this;
  this._html.find(".rrb-import-full").click(async function(e) {
    const id = $(e.currentTarget).data("id");
    const name = $(e.currentTarget).data("name");
    const btn = $(e.currentTarget);
    btn.prop("disabled", true).text("Importing pack...");
    try {
      await HHImporter.importPack(id);
      btn.text("Pack Imported!");
      ui.notifications.info("Pack imported successfully.");
    } catch (err) {
      btn.prop("disabled", false).text("Import Entire Pack");
      ui.notifications.error("Pack import failed: " + err.message);
    }
  });
};
class HHImporter {
  static async importPack(packId) {
    const pack = await HHApi.getPack(packId);
    const items = pack.pack_items || [];

    if (!items.length) {
      throw new Error("This pack has no items to import.");
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
      ui.notifications.warn(`Pack imported with ${results.failed.length} error(s): ${results.failed.join(", ")}`);
    } else {
      ui.notifications.info("Pack imported: " + results.success.length + " items added.");
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

  static async importJournal(item) {
    const d = item.data || {};
    const pages = d.pages || [{ title: item.name, content: item.description || "", sort_order: 0 }];

    const journalData = {
      name: item.name,
      img: item.image_url || null,
      flags: { [MODULE_ID]: { sourceId: item.id, version: item.version } },
      pages: pages.map((page, idx) => ({
        name: page.title || "Page " + (idx + 1),
        type: "text",
        sort_order: (page.sort_order || idx) * 100000,
        text: {
          content: page.content || "",
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

  static async importMonster(item) {
    const actorData = this.mapMonsterToDnd5e(item);
    const results = {};

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
    } catch (err) { console.warn("HH | Failed to import monster to compendium:", err); }

    if (game.settings.get(MODULE_ID, "importToItems")) {
      try {
        const existing = game.actors.find(a => a.getFlag(MODULE_ID, "sourceId") === item.id);
        if (existing) {
          await existing.update(actorData);
          results.worldActor = existing;
        } else {
          results.worldActor = await Actor.create(actorData);
        }
      } catch (err) { console.warn("HH | Failed to import monster to world:", err); }
    }

    return results;
  }

  static mapToDnd5e(item) {
    const base = {
      name: item.name,
      type: this.mapContentType(item.content_type),
      img: item.image_url || this.getDefaultIcon(item.content_type),
      system: { description: { value: item.description || "" } },
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
      spell: "spell", feat: "feat", feature: "feat",
      monster: "npc", class: "class", subclass: "subclass", background: "background",
    };
    return map[contentType] || "loot";
  }

  static getDefaultIcon(contentType) {
    const icons = {
      weapon: "icons/svg/sword.svg", armor: "icons/svg/shield.svg",
      equipment: "icons/svg/item-bag.svg", spell: "icons/svg/lightning.svg",
      feat: "icons/svg/book.svg", feature: "icons/svg/book.svg",
      monster: "icons/svg/skull.svg", class: "icons/svg/statue.svg",
      background: "icons/svg/ruins.svg",
    };
    return icons[contentType] || "icons/svg/item-bag.svg";
  }

  static mapWeapon(base, d) {
    return foundry.utils.mergeObject(base, {
      system: {
        description: base.system.description,
        quantity: 1,
        weight: { value: d.weight || 0, units: "lb" },
        price: { value: d.price || 0, denomination: "gp" },
        rarity: d.rarity || "common",
        damage: {
          base: {
            number: this.parseDiceCount(d.damage_formula || "1d6"),
            denomination: this.parseDiceSides(d.damage_formula || "1d6"),
            types: d.damage_type ? [d.damage_type] : ["slashing"],
            bonus: "",
          },
        },
        range: { value: d.range_normal || null, long: d.range_long || null, units: "ft" },
        properties: this.mapWeaponProperties(d.properties || []),
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
    return foundry.utils.mergeObject(base, {
      system: {
        description: base.system.description,
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
    return foundry.utils.mergeObject(base, {
      type: "equipment",
      system: {
        description: base.system.description,
        quantity: 1,
        weight: { value: d.weight || 0, units: "lb" },
        price: { value: d.price || 0, denomination: "gp" },
        rarity: d.rarity || "common",
        armor: contentType === "armor" ? { value: d.ac_base || 10, dex: null } : undefined,
        properties: d.requires_attunement ? { mgc: true } : {},
      },
    });
  }

  static mapFeat(base, d) {
    return foundry.utils.mergeObject(base, {
      system: {
        description: base.system.description,
        prerequisites: { value: d.prerequisites || "" },
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
    return {
      name: item.name,
      type: "npc",
      img: item.image_url || "icons/svg/skull.svg",
      system: {
        abilities: {
          str: { value: d.str || 10 }, dex: { value: d.dex || 10 },
          con: { value: d.con || 10 }, int: { value: d.int || 10 },
          wis: { value: d.wis || 10 }, cha: { value: d.cha || 10 },
        },
        attributes: {
          ac: { calc: d.ac ? "flat" : "default", flat: d.ac || null },
          hp: { value: d.hp || 10, max: d.hp || 10, formula: d.hp_formula || "" },
          movement: { walk: speed, units: "ft" },
        },
        details: {
          biography: { value: item.description || "" },
          type: { value: d.monster_type || "humanoid", custom: "" },
          alignment: d.alignment || "",
          cr: cr,
          xp: { value: xpMap[cr] ?? 200 },
        },
        traits: { size: size },
      },
      flags: { [MODULE_ID]: { sourceId: item.id, version: item.version } },
    };
  }
}