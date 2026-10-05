const { chromium: pw } = require("playwright");
(async () => {
  const fs = require("fs"),
    path = require("path");
  const root = path.resolve(__dirname, "..");
  const server = require("http").createServer((req, res) => {
    let requested;
    try {
      requested = decodeURIComponent(req.url.split("?")[0]);
    } catch {
      res.statusCode = 400;
      res.end();
      return;
    }
    const file = path.resolve(root, "." + (requested === "/" ? "/index.html" : requested));
    if (!file.startsWith(root + path.sep)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    try {
      const data = fs.readFileSync(file);
      res.setHeader(
        "Content-Type",
        {
          ".js": "text/javascript",
          ".html": "text/html",
          ".css": "text/css",
          ".json": "application/json",
          ".webmanifest": "application/manifest+json",
          ".png": "image/png",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((ok) => server.listen(8766, "127.0.0.1", ok));
  const browser = await pw.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: Number(process.env.MOBILE_WIDTH || 390), height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto("http://localhost:8766");
  await page.waitForSelector("#archiveCare");

  const assert = require("node:assert/strict");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const route = async (name) => {
    if (["search", "places"].includes(name)) {
      await page.locator("#mobileMore").click();
      await page.locator('#mobileMoreMenu [data-route="' + name + '"]').click();
    } else await page.locator('.mobile-nav [data-route="' + name + '"]').click();
    await page.waitForSelector("#" + name + ".is-active");
    if (name === "library") await page.waitForSelector("#libraryMount .library-view");
    if (name === "search") await page.waitForSelector("#searchForm");
  };
  const noOverflow = async (label) => {
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
      label + " horizontal overflow",
    );
  };
  await page.waitForFunction(() => document.querySelector("#offlineStatus").textContent === "Ready for offline use.");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.match(await page.locator("#feed").textContent(), /Nothing yet/);
  for (const name of ["home", "write", "drift", "between", "library", "search", "places"]) {
    await route(name);
    await noOverflow("empty " + name);
  }
  await page.locator("#archiveCare > summary").click();
  await page
    .locator("#archiveImport")
    .setInputFiles({ name: "corrupt.json", mimeType: "application/json", buffer: Buffer.from("{bad") });
  await page.locator("#importBackup").click();
  await page.waitForFunction(() => document.querySelector("#importMessage").textContent.includes("not valid JSON"));
  await route("write");
  const words = "  exact words\n" + "unbroken".repeat(25) + "\n  trailing spaces  ";
  await page.locator("#entryText").fill(words);
  await page.locator("#saveEntry").click();
  await page.waitForSelector("#home.is-active");
  await noOverflow("Record long words");
  await page.locator("#feed [data-entry-id]").click();
  await page.waitForSelector("#inspect.is-active");
  assert.equal(await page.locator(".inspect-quote").textContent(), words);
  assert.equal(await page.locator("#inspect").count(), 1);
  await noOverflow("Inspect long words");
  await page.locator("#openConstellationPicker").click();
  assert.equal(await page.evaluate(() => document.activeElement.id), "constellationFilter");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.closest("dialog")?.id), "constellationPicker");
  }
  await page.locator("#newConstellationName").fill("Test place");
  await page.locator("#newConstellationForm button").click();
  await page.waitForFunction(() => document.querySelector("#activeGatherings").textContent.includes("Test place"));
  await page.locator("#openConstellationPicker").click();
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.id), "openConstellationPicker");
  await page.locator("#inspectBack").click();
  await page.waitForSelector("#home.is-active");
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-entry-id")), true);
  for (const name of ["write", "drift", "between", "library", "search", "places"]) {
    await route(name);
    await noOverflow("populated " + name);
  }
  await page.locator("#archiveCare > summary").click();
  await route("library");
  await page.locator("#libraryMount [data-entry-id]").first().waitFor({ state: "visible" });
  assert.ok(
    (await page.locator("#libraryMount [data-entry-id]").first().boundingBox()).y < 430,
    "Library words start in the first screen",
  );
  if (process.env.LIBRARY_SCREENSHOT_PATH) await page.screenshot({ path: process.env.LIBRARY_SCREENSHOT_PATH });
  await page.locator('#libraryMount [data-route="search"]').click();
  await page.waitForSelector("#searchInput");
  await page.locator("#searchInput").fill("no such phrase");
  await page.locator("#searchForm button").click();
  await page.waitForFunction(() => document.querySelector("#searchMount").textContent.includes("Nothing matches"));

  await page.locator("#archiveCare > summary").click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#backupNow").click();
  const download = await downloadEvent;
  const portable = fs.readFileSync(await download.path());
  const exportJSON = JSON.parse(portable);
  assert.equal(exportJSON.utterances[0].text, words);
  assert.equal(exportJSON.utterances[0].metadata.form, "unknown", "Say does not classify words");
  const restoreContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const restorePage = await restoreContext.newPage();
  await restorePage.goto("http://localhost:8766");
  await restorePage.waitForSelector("#archiveCare");
  await restorePage.locator("#archiveCare > summary").click();
  await restorePage
    .locator("#archiveImport")
    .setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: portable });
  await restorePage.locator("#importBackup").click();
  await restorePage.waitForFunction(() =>
    document.querySelector("#importMessage").textContent.includes("Import complete"),
  );
  assert.match(await restorePage.locator("#count").textContent(), /1 position/);
  await restoreContext.close();

  await page.evaluate(async () => {
    const request = (r) =>
      new Promise((ok, no) => {
        r.onsuccess = () => ok(r.result);
        r.onerror = () => no(r.error);
      });
    const r = indexedDB.open("browser-upgrade-check", 3);
    r.onupgradeneeded = () => {
      const store = r.result.createObjectStore("utterances", { keyPath: "id" });
      store.createIndex("createdAt", "createdAt");
      store.createIndex("spokenAt", "spokenAt");
      store.createIndex("status", "metadata.status");
      store.add({
        id: "old",
        text: " untouched ",
        createdAt: "2020-01-01",
        datePrecision: "year",
        displayDate: "2019",
        metadata: { status: "kept" },
      });
    };
    (await request(r)).close();
    const { IndexedDBArchiveRepository } = await import("/js/storage/indexeddb.js");
    const repository = new IndexedDBArchiveRepository({ name: "browser-upgrade-check" });
    const value = await repository.getUtterance("old");
    if (value.text !== " untouched " || value.temporal.earliest !== "2019-01-01")
      throw Error("Browser upgrade lost data");
    const recovery = await request(indexedDB.open("browser-upgrade-check-upgrade-recovery"));
    const rows = await request(recovery.transaction("snapshots").objectStore("snapshots").getAll());
    if (rows.length !== 1 || rows[0].stores.utterances.values[0].displayDate !== "2019")
      throw Error("Missing browser recovery backup");
    recovery.close();
    (await repository.open()).close();
  });
  await page.emulateMedia({ reducedMotion: "reduce" });

  const resetText = () =>
    page.evaluate(() => {
      for (const el of document.querySelectorAll("[data-original-size]")) {
        el.style.fontSize = el.dataset.originalSize;
        delete el.dataset.originalSize;
      }
    });
  const enlargeText = () =>
    page.evaluate(() => {
      const sizes = [...document.querySelectorAll("body *")].map((el) => [el, getComputedStyle(el).fontSize]);
      for (const [el, size] of sizes) {
        el.dataset.originalSize = el.style.fontSize;
        el.style.fontSize = parseFloat(size) * 2 + "px";
      }
    });
  for (const name of ["home", "write", "drift", "between", "library", "search", "places"]) {
    await resetText();
    await route(name);
    await enlargeText();
    await noOverflow("200 percent text " + name);
  }
  await resetText();
  await route("library");
  await page.locator("#libraryMount [data-entry-id]").first().click();
  await page.waitForSelector("#inspect.is-active");
  await enlargeText();
  await noOverflow("200 percent text Inspect");
  await resetText();
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  for (const name of ["home", "write", "drift", "between", "library", "search", "places"]) {
    await route(name);
    const issues = await page.evaluate(async () => {
      const result = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
      return result.violations.map((x) => ({ id: x.id, nodes: x.nodes.map((n) => n.target) }));
    });
    assert.deepEqual(issues, [], name + " accessibility violations");
  }
  await route("library");
  await page.locator("#libraryMount [data-entry-id]").first().click();
  const inspectIssues = await page.evaluate(async () =>
    (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(
      (x) => ({ id: x.id, nodes: x.nodes.map((n) => n.target) }),
    ),
  );
  assert.deepEqual(inspectIssues, [], "Inspect accessibility violations");
  // Cross-surface actions preserve exact words and never create relations.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#copyWords").click();
  await page.waitForFunction(
    () => document.querySelector("#inspectActionMessage").textContent === "Exact words copied.",
  );
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), words);
  await page.locator("#placeBeside").click();
  await page.waitForSelector("#betweenChooser[open]");
  assert.equal(await page.evaluate(() => document.activeElement.id), "betweenFilter");
  await page.locator("#betweenFilter").fill("no matching words");
  await page.waitForFunction(() =>
    document.querySelector("#betweenResultCount").textContent.includes("No words match"),
  );
  await page.locator("#betweenFilter").fill("exact words");
  assert.equal(await page.locator(".word-choice-text").first().textContent(), words);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.closest("dialog")?.id), "betweenChooser");
  }
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  assert.deepEqual(
    await page.evaluate(async () =>
      (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(
        (x) => x.id,
      ),
    ),
    [],
    "chooser accessibility",
  );
  if (process.env.CHOOSER_SCREENSHOT_PATH) await page.screenshot({ path: process.env.CHOOSER_SCREENSHOT_PATH });
  await page.locator("[data-between-choice]").first().click();
  await page.waitForFunction(() => !document.querySelector("#betweenChooser").open);
  const selected = await page.locator("#betweenB").getAttribute("value");
  await route("library");
  await route("between");
  assert.equal(await page.locator("#betweenB").getAttribute("value"), selected);
  await page.locator("#betweenA").click();
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.id), "betweenA");
  await route("library");
  await page.locator("#libraryMount [data-entry-id]").first().waitFor();
  await page.evaluate(() => window.scrollTo(0, 180));
  const rememberedScroll = await page.evaluate(() => window.scrollY);
  await route("home");
  await route("library");
  await page.waitForFunction((expected) => Math.abs(window.scrollY - expected) < 2, rememberedScroll);
  await route("search");
  assert.equal(await page.locator("#searchInput").inputValue(), "no such phrase");
  await page.locator("#searchInput").fill("exact words");
  await page.locator("#searchForm button").click();
  await page.locator("#searchMount [data-entry-id]").first().waitFor();
  await route("library");
  await route("search");
  assert.equal(await page.locator("#searchInput").inputValue(), "exact words");
  await page.locator("#searchMount [data-entry-id]").first().click();
  await page.locator("#inspectBack").click();
  assert.equal(await page.locator("#searchInput").inputValue(), "exact words");
  if (!(await page.locator("#archiveCare").evaluate((el) => el.open)))
    await page.locator("#archiveCare > summary").click();
  const comparisonBackup = page.waitForEvent("download");
  await page.locator("#backupNow").click();
  const afterComparison = JSON.parse(fs.readFileSync(await (await comparisonBackup).path()));
  assert.equal(afterComparison.relations.length, 0);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#archiveCare");
  assert.match(await page.locator("#count").textContent(), /1 position/);
  for (const name of ["home", "write", "drift", "between", "library", "search", "places"]) {
    await route(name);
    await noOverflow("offline " + name);
  }
  await route("library");
  await page.locator("#libraryMount [data-entry-id]").first().click();
  await page.waitForSelector("#inspect.is-active");
  assert.equal(await page.locator(".inspect-quote").textContent(), words);
  const responseWords = "  A later answer\nStill unfinished  ";
  await page.locator(".response-composer > summary").click();
  await page.locator("#responseText").fill(responseWords);
  await page.locator("#responseType").selectOption("contradicts");
  await page.locator("#inspectBack").click();
  await page.locator("#libraryMount [data-entry-id]").first().click();
  assert.equal(
    await page.locator("#responseText").inputValue(),
    responseWords,
    "response draft survives inspection navigation",
  );
  await page.locator("#saveResponse").click();
  await page.waitForFunction((text) => document.querySelector(".inspect-quote")?.textContent === text, responseWords);
  assert.equal(await page.locator(".connected-open .word-choice-text").textContent(), words);
  assert.match(await page.locator(".connected-word").textContent(), /contradicts/);
  assert.equal(await page.evaluate(async (text) => {
    const { getArchive } = await import("./js/services/archive.js");
    const records = await (await getArchive()).listUtterances();
    return records.find((record) => record.text === text).metadata.form;
  }, responseWords), "unknown", "Respond does not classify words");
  await page.locator(".response-composer > summary").click();
  await page.locator("#responseText").fill("A reply to my reply.");
  await page.locator("#saveResponse").click();
  await page.waitForFunction(() => document.querySelector(".inspect-quote")?.textContent === "A reply to my reply.");
  await page.locator("#inspectBack").click();
  await page.waitForFunction((text) => document.querySelector(".inspect-quote")?.textContent === text, responseWords);
  assert.equal(await page.locator(".connected-open").count(), 2);
  await page.locator("#inspectBack").click();
  await page.waitForFunction((text) => document.querySelector(".inspect-quote")?.textContent === text, words);
  await page.locator("#inspectBack").click();
  await page.waitForSelector("#library.is-active");
  await page.waitForFunction(() => document.querySelectorAll("#libraryMount [data-entry-id]").length === 3);
  assert.equal(
    await page.locator("#libraryMount [data-entry-id]").count(),
    3,
    "Back shows new responses without a reload",
  );
  await page.locator("#libraryMount [data-entry-id]").filter({ hasText: "exact words" }).click();
  await page.locator(".connected-open").click();
  await page.waitForFunction((text) => document.querySelector(".inspect-quote")?.textContent === text, responseWords);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#archiveCare");
  await route("library");
  assert.equal(await page.locator("#libraryMount [data-entry-id]").count(), 3);
  await page.locator("#libraryMount [data-entry-id]").filter({ hasText: "A later answer" }).click();
  await page.waitForSelector(".connected-open");
  assert.equal(await page.locator(".connected-open").count(), 2, "response links survive offline reload");
  await page.locator(".response-composer > summary").click();
  await noOverflow("response composer");
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  assert.deepEqual(
    await page.evaluate(async () =>
      (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(
        (x) => x.id,
      ),
    ),
    [],
    "response accessibility",
  );
  await page.screenshot({ path: process.env.SCREENSHOT_PATH || "/tmp/all-i-say-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  const keyboardContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const keyboardPage = await keyboardContext.newPage();
  await keyboardPage.goto("http://localhost:8766");
  await keyboardPage.waitForSelector("#archiveCare");
  await keyboardPage.keyboard.press("Tab");
  await keyboardPage.keyboard.press("Tab");
  await keyboardPage.keyboard.press("Enter");
  await keyboardPage.waitForSelector("#write.is-active");
  for (let i = 0; i < 30 && (await keyboardPage.evaluate(() => document.activeElement.id)) !== "entryText"; i++)
    await keyboardPage.keyboard.press("Tab");
  assert.equal(await keyboardPage.evaluate(() => document.activeElement.id), "entryText");
  assert.equal(await keyboardPage.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "solid");
  await keyboardPage.keyboard.insertText("keyboard only words");
  for (let i = 0; i < 10 && (await keyboardPage.evaluate(() => document.activeElement.id)) !== "saveEntry"; i++)
    await keyboardPage.keyboard.press("Tab");
  await keyboardPage.keyboard.press("Enter");
  await keyboardPage.waitForSelector("#home.is-active");
  assert.match(await keyboardPage.locator("#feed").textContent(), /keyboard only words/);
  await keyboardContext.close();
  console.log(
    (
      'PASS: seven routes plus Inspect; empty/populated/offline reload; exact words; ' +
      'placement; Back focus; corrupt import; zero results; overflow and 200% text; axe ' +
      'WCAG A/AA; download/restore; real IndexedDB upgrade.'
    ),
  );
  await require('./gate-b-browser.cjs')(
    browser, 'http://localhost:8766', Number(process.env.MOBILE_WIDTH || 390)
  );
  await browser.close();
  server.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
