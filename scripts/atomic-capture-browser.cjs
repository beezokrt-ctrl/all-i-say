module.exports = async (browser, url, width) => {
  const assert = require("node:assert/strict");
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage();
  await page.goto(url);
  await page.locator('[data-route="write"]:visible').first().click();
  const text = '  Capture\n"<& 😀  ';
  await page.locator("#entryText").fill(text);
  await page.locator(".compose-attachment summary").click();
  await page.locator("#artifactFile").setInputFiles({
    name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from([0, 255, 42]),
  });
  await page.locator("#artifactTranscription").fill("  reading  ");
  await page.evaluate(() => {
    window.originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "utterances") throw new Error("Injected storage failure");
      return window.originalAdd.apply(this, args);
    };
  });
  await page.locator("#saveEntry").click();
  await page.waitForFunction(() => document.querySelector("#saveMessage").textContent.includes("Could not"));
  assert.equal(await page.locator("#entryText").inputValue(), text);
  assert.equal(await page.locator("#artifactTranscription").inputValue(), "  reading  ");
  const snapshot = () => page.evaluate(async () => {
    const { getArchive } = await import("/js/services/archive.js");
    const archive = await getArchive();
    return {
      words: await archive.listUtterances({ includeHistory: true }),
      artifacts: await archive.listArtifacts(),
      transcriptions: await archive.listTranscriptions(),
    };
  });
  const failed = await snapshot();
  assert.equal(failed.words.length + failed.artifacts.length + failed.transcriptions.length, 0);
  await page.evaluate(() => {
    IDBObjectStore.prototype.add = window.originalAdd;
    document.querySelector("#saveEntry").click();
    document.querySelector("#saveEntry").click();
  });
  await page.waitForSelector("#home.is-active");
  const saved = await snapshot();
  assert.equal(saved.words.length, 1);
  assert.equal(saved.artifacts.length, 1);
  assert.equal(saved.transcriptions.length, 1);
  assert.equal(saved.words[0].text, text);
  assert.deepEqual(saved.words[0].metadata.threads, []);
  assert.equal(saved.transcriptions[0].text, "  reading  ");
  assert.match(await page.locator("#feed").textContent(), /Capture/);
  await context.close();
  console.log("PASS: Say failure keeps draft and rolls back all records; double-tap retry saves one exact capture.");
};
