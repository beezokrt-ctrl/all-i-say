import { respondToUtterance } from "./services/responses.js";
import { bindBetweenChooser } from "./between-chooser.js";
import { mountDurability } from "./durability-controls.js";
import { shellView, feedView, bridgeView } from "./views.js";
import { getArchive, createUtterance } from "./services/archive.js";
import { createCapture } from "./services/artifacts.js";
import { renderLibrary } from "./views/library.js";
import { getUtteranceInspection } from "./services/inspect.js";
import { inspectView } from "./views/inspect.js";
import { searchArchive } from "./services/search.js";
import {
  getConstellationPlaces,
  getLegacyThreadGatherings,
  placeUtterance,
  withdrawUtteranceMembership,
  startConstellationFromUtterance,
} from "./services/constellations.js";
import { placesView, constellationDetailView, legacyGatheringDetailView } from "./views/places.js";
import { getBetweenData } from "./services/between.js";

export class AllISayApp {
  constructor(root) {
    this.root = root;
    this.entries = [];
    this.route = "home";
    this.returnRoute = "home";
    this.returnScroll = 0;
    this.driftId = null;
    this.inspectId = null;
    this.inspectRevision = 0;
    this.placesDirty = false;
    this.placeDetail = null;
    this.responseDrafts = new Map();
    this.searchQuery = "";
    this.scrollPositions = new Map();
    this.searchRevision = 0;
    this.betweenRevision = 0;
  }
  async init() {
    const archive = await getArchive();
    const existing = await archive.listUtterances({ status: "kept", limit: Infinity });
    this.entries = existing.length ? existing : await this.seed();
  }
  async seed() {
    return this.loadEntries();
  }
  async loadEntries() {
    const archive = await getArchive();
    return archive.listUtterances({ status: "kept", limit: Infinity });
  }
  async refreshFromArchive() {
    this.entries = await this.loadEntries();
    this.refreshDataViews();
  }
  mount() {
    this.root.innerHTML = shellView(this.entries);
    this.bind();
    bindBetweenChooser(this.root, {
      getEntries: () => this.entries,
      onChoose: (slot, id) => {
        document.querySelector("#between" + slot).value = id;
        this.updateBetweenLabels();
        this.renderBetween();
      },
    });
    this.refreshDataViews();
    mountDurability(this.root, {
      onImported: async () => {
        await this.refreshFromArchive();
        this.navigate(this.route);
      },
    });
  }
  bind() {
    this.root.addEventListener("click", async (event) => {
      if (!event.target.closest("#mobileMore,#mobileMoreMenu")) this.closeMobileMore();
      const route = event.target.closest("[data-route]")?.dataset.route;
      if (route) this.navigate(route);
      const related = event.target.closest("[data-open-related]");
      if (related) this.inspect(related.dataset.openRelated, { follow: true });
      if (event.target.id === "copyWords") this.copyWords();
      if (event.target.id === "placeBeside") this.placeBeside();
      if (event.target.id === "saveEntry") this.saveEntry();
      if (event.target.id === "mobileMore") this.toggleMobileMore();
      if (event.target.id === "newDrift") this.renderDrift();
      if (event.target.id === "driftInspect" && this.driftId) this.inspect(this.driftId);
      if (event.target.id === "inspectBack") {
        if (this.inspectTrail?.length) {
          const previous = this.inspectTrail.pop();
          await this.inspect(previous.id);
          window.scrollTo({ top: previous.scroll, behavior: "instant" });
          return;
        }
        if (this.returnRoute === "places" && this.placesDirty) {
          await this.renderPlaces();
          this.placesDirty = false;
        }
        await this.navigate(this.returnRoute || "home", {
          refresh: !!this.responseViewsDirty,
          scrollTop: this.returnScroll,
        });
        this.responseViewsDirty = false;
        const returnEntryId = this.returnFocus?.dataset.entryId;
        const focusTarget = this.returnFocus?.isConnected
          ? this.returnFocus
          : [...document.querySelectorAll(".panel.is-active [data-entry-id]")].find(
              (el) => el.dataset.entryId === returnEntryId,
            );
        focusTarget?.focus({ preventScroll: true });
      }
      if (event.target.id === "openConstellationPicker") this.toggleConstellationPicker(true);
      if (event.target.id === "closeConstellationPicker") this.toggleConstellationPicker(false);
      const gather = event.target.closest("[data-gather-constellation]");
      if (gather) await this.gatherInto(gather.dataset.gatherConstellation);
      const withdrawal = event.target.closest("[data-withdraw-membership]");
      if (withdrawal) await this.withdrawGathering(withdrawal.dataset.withdrawMembership);
      const constellation = event.target.closest("[data-constellation-id]");
      if (constellation) this.renderConstellation(constellation.dataset.constellationId);
      const legacy = event.target.closest("[data-legacy-place]");
      if (legacy) this.renderLegacyPlace(legacy.dataset.legacyPlace);
      const entry = event.target.closest("[data-entry-id]");
      if (entry) this.inspect(entry.dataset.entryId);
    });
    this.root.addEventListener("submit", async (event) => {
      if (event.target.id === "responseForm") {
        event.preventDefault();
        await this.saveResponse();
      }
      if (event.target.id === "searchForm") {
        event.preventDefault();
        this.renderSearch(document.querySelector("#searchInput")?.value || "");
      }
      if (event.target.id === "newConstellationForm") {
        event.preventDefault();
        await this.startConstellation(document.querySelector("#newConstellationName")?.value || "");
      }
    });
    this.root.addEventListener("input", (event) => {
      if (event.target.id === "responseText") this.rememberResponseDraft();
      if (event.target.id === "searchInput") this.searchQuery = event.target.value;
      if (event.target.id === "constellationFilter") this.filterConstellations(event.target.value);
    });
    this.root.addEventListener("change", (event) => {
      if (event.target.id === "responseType") this.rememberResponseDraft();
    });
    this.root.addEventListener("keydown", (event) => {
      this.keepPickerFocus(event);
      if (event.key === "Escape" && !document.querySelector("#mobileMoreMenu").hidden) {
        this.closeMobileMore();
        document.querySelector("#mobileMore")?.focus();
      }
      const entry = event.target.closest?.("[data-entry-id]");
      if (entry && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        this.inspect(entry.dataset.entryId);
      }
      if (event.key === "Escape" && this.route === "inspect") {
        event.preventDefault();
        this.toggleConstellationPicker(false);
      }
    });
  }
  async navigate(route, { refresh = true, scrollTop } = {}) {
    this.scrollPositions.set(this.route, window.scrollY);
    const destination = scrollTop ?? (route === "inspect" ? 0 : (this.scrollPositions.get(route) ?? 0));
    this.route = route;
    document.querySelectorAll(".panel").forEach((el) => el.classList.toggle("is-active", el.id === route));
    document
      .querySelectorAll(".nav-button,.mobile-nav-button")
      .forEach((el) => el.classList.toggle("is-active", el.dataset.route === route));
    document.querySelector("#mobileMore")?.classList.toggle("is-active", route === "search" || route === "places");
    this.closeMobileMore();
    window.scrollTo({ top: destination, behavior: "instant" });
    if (refresh) {
      if (route === "drift" && !this.driftId) this.renderDrift();
      if (route === "between") await this.renderBetween();
      if (route === "library") await this.renderLibrary();
      if (route === "search") await this.renderSearch(this.searchQuery);
      if (route === "places") await this.renderPlaces();
      if (this.route === route) window.scrollTo({ top: destination, behavior: "instant" });
    }
  }
  toggleMobileMore() {
    const menu = document.querySelector("#mobileMoreMenu"),
      button = document.querySelector("#mobileMore");
    if (!menu || !button) return;
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }
  closeMobileMore() {
    const menu = document.querySelector("#mobileMoreMenu"),
      button = document.querySelector("#mobileMore");
    if (menu) menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }
  async saveEntry() {
    if (this.saving) return;
    this.saving = true;
    const button = document.querySelector("#saveEntry"),
      message = document.querySelector("#saveMessage");
    button.disabled = true;
    message.textContent = "";
    try {
      await this.persistEntry();
    } catch {
      message.textContent = "Could not finish saving. Your words are still here. Try again.";
    } finally {
      this.saving = false;
      button.disabled = false;
    }
  }
  async persistEntry() {
    const input = document.querySelector("#entryText");
    const fileInput = document.querySelector("#artifactFile");
    const transcriptionInput = document.querySelector("#artifactTranscription");
    const file = fileInput?.files?.[0];
    const transcriptionText = transcriptionInput?.value || "";
    const submittedText = input?.value || "";
    if (!input?.value.trim() && !file) {
      document.querySelector("#saveMessage").textContent = "Write something or attach a file first.";
      input?.focus();
      return;
    }
    const now = new Date();
    const localDay = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const words = {
      text: input?.value || null,
      temporal: file
        ? { earliest: null, latest: null, precision: "unknown", display: null }
        : {
            earliest: localDay,
            latest: localDay,
            precision: "day",
            display: now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
          },
      source: { type: file ? "imported" : "typed", artifactIds: [] },
      metadata: {
        form: "unknown",
        threads: [],
        status: input?.value.trim() ? "kept" : "awaiting-transcription",
      },
    };
    if (file) {
      const transcription = transcriptionText ? {
        text: transcriptionText,
        attestation: { state: "confirmed-by-author", confirmedAt: now.toISOString() },
        provenance: { origin: "author" },
      } : null;
      await createCapture(file, {
        kind: file.type.startsWith("audio/") ? "audio" : "photo",
        mimeType: file.type, capturedAt: null,
      }, words, transcription);
    } else await createUtterance(words);
    await this.finishSaySave(input, fileInput, transcriptionInput, {
      text: submittedText, file, transcriptionText,
    });
  }
  async finishSaySave(input, fileInput, transcriptionInput, submitted) {
    const changed = (input?.value || "") !== submitted.text ||
      (transcriptionInput?.value || "") !== submitted.transcriptionText ||
      fileInput?.files?.[0] !== submitted.file;
    try {
      if (!changed) {
        if (input) { input.value = ""; input.blur(); }
        if (fileInput) fileInput.value = "";
        if (transcriptionInput) transcriptionInput.value = "";
      }
      const message = document.querySelector("#saveMessage");
      if (message) message.textContent = "Kept in your record.";
      await this.refreshFromArchive();
      if (changed) return;
      await this.navigate("home", { scrollTop: 0 });
      document.querySelector("#recordMessage").textContent = "Kept in your record.";
    } catch {
      document.querySelector("#saveMessage").textContent = "Kept in your record. The view could not refresh.";
    }
  }
  refreshDataViews() {
    document.querySelector("#count").textContent =
      `${this.entries.length} position${this.entries.length === 1 ? "" : "s"}`;
    document.querySelector("#feed").innerHTML = feedView(this.entries.slice(0, 6));
    this.updateBetweenLabels();
  }
  updateBetweenLabels() {
    for (const [slot, index] of [
      ["A", 0],
      ["B", this.entries.length - 1],
    ]) {
      const button = document.querySelector("#between" + slot);
      const entry = this.entries.find((e) => e.id === button.value) || this.entries[index];
      button.value = entry?.id || "";
      button.querySelector(".between-preview").textContent = entry?.text ?? "Choose from your record";
    }
  }
  rememberResponseDraft() {
    const input = document.querySelector("#responseText");
    const targetId = document.querySelector("#responseForm")?.dataset.targetId;
    if (input && targetId)
      this.responseDrafts.set(targetId, {
        text: input.value,
        type: document.querySelector("#responseType").value,
      });
  }
  restoreResponseDraft() {
    const draft = this.responseDrafts.get(this.inspectId),
      input = document.querySelector("#responseText");
    if (draft && input) {
      input.value = draft.text;
      document.querySelector("#responseType").value = draft.type;
      if (draft.text) input.closest("details").open = true;
    }
  }
  async saveResponse() {
    if (this.savingResponse) return;
    const form = document.querySelector("#responseForm"),
      input = form.querySelector("#responseText");
    const targetId = form.dataset.targetId,
      button = form.querySelector("#saveResponse"),
      message = form.querySelector("#responseMessage");
    if (!targetId || targetId !== this.inspectId) {
      message.textContent = "Could not keep your response. Your words are still here. Try again.";
      return;
    }
    this.rememberResponseDraft();
    const submittedDraft = this.responseDrafts.get(targetId);
    this.savingResponse = true;
    button.disabled = true;
    input.readOnly = true;
    message.textContent = "Keeping your response…";
    let saved;
    try {
      saved = await respondToUtterance({
        targetId,
        text: input.value,
        type: form.querySelector("#responseType").value,
        provenance: { origin: "author" },
      });
    } catch {
      message.textContent = "Could not keep your response. Your words are still here. Try again.";
    } finally {
      this.savingResponse = false;
      button.disabled = false;
      input.readOnly = false;
    }
    if (!saved) return;
    if (this.responseDrafts.get(targetId) === submittedDraft) this.responseDrafts.delete(targetId);
    this.responseViewsDirty = true;
    input.value = "";
    message.textContent = "Response kept.";
    try {
      await this.refreshFromArchive();
      if (this.route === "inspect" && this.inspectId === targetId && !this.responseDrafts.has(targetId)) {
        await this.inspect(saved.utterance.id, { follow: true });
        document.querySelector("#inspectActionMessage").textContent =
          "Response kept. You can return to either position or respond again.";
      }
    } catch {
      message.textContent = "Response kept. Reload to see it in your record.";
    }
  }
  async copyWords() {
    const button = document.querySelector("#copyWords"),
      status = document.querySelector("#inspectActionMessage");
    button.disabled = true;
    try {
      await navigator.clipboard.writeText(this.inspectedText);
      status.textContent = "Exact words copied.";
    } catch {
      status.textContent = "Could not copy. You can select the words above and copy them.";
    } finally {
      button.disabled = false;
    }
  }
  placeBeside() {
    document.querySelector("#betweenA").value = this.inspectId;
    this.updateBetweenLabels();
    this.navigate("between", { scrollTop: 0 });
    document.querySelector("#betweenB").click();
  }
  renderDrift() {
    if (!this.entries.length) {
      document.querySelector("#driftQuote").textContent = "Nothing to encounter yet.";
      document.querySelector("#driftInspect").hidden = true;
      return;
    }
    const pool = this.entries.length > 1 ? this.entries.filter((e) => e.id !== this.driftId) : this.entries;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    this.driftId = entry.id;
    document.querySelector("#driftQuote").textContent =
      entry.text ?? "[Artifact preserved; no canonical utterance text]";
    document.querySelector("#driftMeta").textContent = entry.temporal?.display || "Undated";
    const inspect = document.querySelector("#driftInspect");
    if (inspect) inspect.hidden = false;
  }
  async renderBetween() {
    if (!this.entries.length) {
      document.querySelector("#bridge").textContent = "Keep two positions to place them beside one another.";
      return;
    }
    const aid = document.querySelector("#betweenA")?.value,
      bid = document.querySelector("#betweenB")?.value,
      mount = document.querySelector("#bridge");
    if (!aid || !bid || !mount) return;
    const revision = ++this.betweenRevision;
    const data = await getBetweenData(aid, bid);
    if (revision !== this.betweenRevision) return;
    mount.innerHTML = bridgeView(data.from, data.to, data.relations);
  }
  async renderLibrary() {
    const mount = document.querySelector("#libraryMount");
    if (mount) mount.innerHTML = await renderLibrary({});
  }
  async renderSearch(query = "") {
    const mount = document.querySelector("#searchMount");
    if (!mount) return;
    this.searchQuery = query;
    const revision = ++this.searchRevision;
    const results = query ? await searchArchive(query) : [];
    if (revision !== this.searchRevision || query !== this.searchQuery) return;
    const markup = this.searchMarkup(results, query);
    if (mount.querySelector("#searchForm")) {
      const template = document.createElement("template");
      template.innerHTML = markup;
      mount
        .querySelector(".library-results")
        .replaceChildren(...template.content.querySelector(".library-results").childNodes);
    } else mount.innerHTML = markup;
  }
  searchMarkup(results, query) {
    const items = results
      .map(
        (item) =>
          '<article class="library-item" tabindex="0" data-entry-id="' +
          this.escape(item.id) +
          '"><div class="eyebrow">' +
          this.escape(item.temporal?.display || "Undated") +
          '</div><blockquote class="entry-quote">' +
          this.escape(item.text ?? "[Artifact preserved]") +
          "</blockquote></article>",
      )
      .join("");
    return (
      (
        '<div class="eyebrow">Search</div><h2 class="big-title">Find your exact words.</h2>' +
        '<form id="searchForm" class="search-form"><input id="searchInput" ' +
        'class="search-input" value="'
      ) +
      this.escape(query) +
      (
        '" aria-label="Search the record" placeholder="Words, earlier thread, or form">' +
        '<button class="button-primary">Search</button></form><div class="library-results">'
      ) +
      (query
        ? items || '<p class="note">Nothing matches those words.</p>'
        : '<p class="note">Search the record without changing it.</p>') +
      "</div>"
    );
  }
  escape(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
    );
  }
  async renderPlaces() {
    const mount = document.querySelector("#placesMount");
    if (!mount) return;
    const [places, legacy] = await Promise.all([getConstellationPlaces(), getLegacyThreadGatherings()]);
    this.places = places;
    this.legacyPlaces = legacy;
    mount.innerHTML = placesView(places, legacy);
    if (this.placeDetail?.kind === "constellation") this.renderConstellation(this.placeDetail.id, false);
    if (this.placeDetail?.kind === "legacy") this.renderLegacyPlace(this.placeDetail.name, false);
  }
  renderConstellation(id, scroll = true) {
    const place = this.places?.find((x) => x.constellation.id === id),
      mount = document.querySelector("#placeDetail");
    if (!place || !mount) return;
    this.placeDetail = { kind: "constellation", id };
    mount.innerHTML = constellationDetailView(place);
    if (scroll)
      mount.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
  }
  renderLegacyPlace(name, scroll = true) {
    const place = this.legacyPlaces?.find((x) => x.name === name),
      mount = document.querySelector("#placeDetail");
    if (!place || !mount) return;
    this.placeDetail = { kind: "legacy", name };
    mount.innerHTML = legacyGatheringDetailView(place);
    if (scroll)
      mount.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
  }
  toggleConstellationPicker(open) {
    const picker = document.querySelector("#constellationPicker");
    if (!picker) return;
    if (open) {
      picker.hidden = false;
      picker.showModal();
      document.querySelector("#constellationFilter")?.focus();
    } else {
      picker.close();
      picker.hidden = true;
      document.querySelector("#openConstellationPicker")?.focus();
    }
  }
  keepPickerFocus(event) {
    const picker = document.querySelector("#constellationPicker");
    if (event.key !== "Tab" || !picker?.open) return;
    const controls = [...picker.querySelectorAll("button,input,select,textarea,a[href]")].filter(
      (el) => !el.disabled && el.getClientRects().length,
    );
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  filterConstellations(query) {
    const clean = String(query || "")
      .trim()
      .toLowerCase();
    let visible = 0;
    document.querySelectorAll("#constellationChoices [data-gather-constellation]").forEach((choice) => {
      const match = !clean || choice.dataset.constellationName.includes(clean);
      choice.hidden = !match;
      if (match) visible += 1;
    });
    const empty = document.querySelector("#constellationNoMatch");
    if (empty) empty.hidden = !clean || visible > 0;
  }
  setGatheringError(message = "") {
    const target = document.querySelector("#gatheringError");
    if (target) target.textContent = message;
  }
  async refreshInspect() {
    if (!this.inspectId) return;
    const mount = document.querySelector("#inspectMount");
    if (mount) {
      const revision = ++this.inspectRevision;
      const inspection = await getUtteranceInspection(this.inspectId);
      if (revision !== this.inspectRevision) return;
      this.inspectedText = inspection?.utterance.text;
      mount.innerHTML = inspectView(inspection);
      this.restoreResponseDraft();
      document.querySelector("#openConstellationPicker")?.focus({ preventScroll: true });
    }
  }
  async gatherInto(constellationId) {
    if (!this.inspectId) return;
    this.setGatheringError("");
    try {
      await placeUtterance(this.inspectId, constellationId);
      this.placesDirty = true;
      await this.refreshInspect();
    } catch (error) {
      this.setGatheringError(error.message || "Could not gather these words.");
    }
  }
  async withdrawGathering(membershipId) {
    this.setGatheringError("");
    try {
      await withdrawUtteranceMembership(membershipId);
      this.placesDirty = true;
      await this.refreshInspect();
    } catch (error) {
      this.setGatheringError(error.message || "Could not withdraw this placement.");
    }
  }
  async startConstellation(name) {
    if (!this.inspectId) return;
    this.setGatheringError("");
    try {
      await startConstellationFromUtterance(name, this.inspectId);
      this.placesDirty = true;
      await this.refreshInspect();
    } catch (error) {
      this.setGatheringError(error.message || "Could not start that constellation.");
    }
  }
  async inspect(id, { follow = false } = {}) {
    const mount = document.querySelector("#inspectMount");
    if (!mount) return;
    if (follow && this.route === "inspect")
      (this.inspectTrail ??= []).push({ id: this.inspectId, scroll: window.scrollY });
    if (this.route !== "inspect") {
      this.inspectTrail = [];
      this.returnFocus = document.activeElement;
      this.returnRoute = this.route;
      this.returnScroll = window.scrollY;
    }
    this.inspectId = id;
    const revision = ++this.inspectRevision;
    const inspection = await getUtteranceInspection(id);
    if (revision !== this.inspectRevision) return;
    this.inspectedText = inspection?.utterance.text;
    mount.innerHTML = inspectView(inspection);
    this.restoreResponseDraft();
    this.navigate("inspect");
    document.querySelector("#inspectBack")?.focus({ preventScroll: true });
  }
}

function boot() {
  const root = document.querySelector("#app");
  if (!root) return;
  const app = new AllISayApp(root);
  app
    .init()
    .then(() => app.mount())
    .catch(() => {
      root.innerHTML =
        (
          '<main class="main"><h1>Could not open your archive.</h1><p>' +
          'Close other All I Say windows, then reload to try again. Your existing records have ' +
          'not been replaced.</p><button id="retryArchive">Try again</button></main>'
        );
      root.querySelector("#retryArchive").addEventListener("click", () => location.reload());
    });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
