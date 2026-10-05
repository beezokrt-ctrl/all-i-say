const assert = require('node:assert/strict');
const fs = require('node:fs');

async function openArchive(browser, origin, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-01-20T12:34:56.000Z'));
  await page.goto(origin);
  await page.waitForSelector('#archiveCare');
  const empty = await readRecords(page);
  assert.ok(Object.values(empty).every(rows => rows.length === 0), 'destination starts empty');
  return { context, page };
}

async function readRecords(page) {
  return page.evaluate(async () => {
    const { getArchive } = await import('/js/services/archive.js');
    const { comparableRecords } = await import('/scripts/fixtures/gate-b-archive.js');
    return comparableRecords(await (await getArchive()).getExportSnapshot());
  });
}

async function backUp(page) {
  if (!await page.locator('#archiveCare').evaluate(el => el.open)) {
    await page.locator('#archiveCare > summary').click();
  }
  const downloading = page.waitForEvent('download');
  await page.locator('#backupNow').click();
  const bytes = fs.readFileSync(await (await downloading).path());
  return { bytes, payload: JSON.parse(bytes) };
}

async function restoreAndCompare(page, backup, expected) {
  await page.locator('#archiveCare > summary').click();
  await page.locator('#archiveImport').setInputFiles({
    name: 'gate-b-backup.json', mimeType: 'application/json', buffer: backup.bytes
  });
  await page.locator('#importBackup').click();
  await page.waitForFunction(() => document.querySelector('#importMessage').textContent.includes('Import complete'));
  assert.deepEqual(await readRecords(page), expected, 'all restored records and artifact bytes');
  const again = await backUp(page);
  assert.deepEqual(again.payload, backup.payload, 'full second export, including exportedAt');
  await page.locator('.mobile-nav [data-route="library"]').click();
  await page.waitForSelector('#library.is-active');
  await page.locator('#libraryMount [data-entry-id="gate-b-uncertain"]').click();
  const words = expected.utterances.find(record => record.id === 'gate-b-uncertain').text;
  assert.equal(await page.locator('.inspect-quote').textContent(), words, 'exact restored words in Inspect');
}

module.exports = async function gateB(browser, origin, width) {
  const source = await openArchive(browser, origin, width);
  const destination = await openArchive(browser, origin, width);
  try {
    const expected = await source.page.evaluate(async () => {
      const { getArchive } = await import('/js/services/archive.js');
      const { buildGateBArchive, comparableRecords } = await import('/scripts/fixtures/gate-b-archive.js');
      return comparableRecords(await buildGateBArchive(await getArchive()));
    });
    assert.deepEqual(await readRecords(source.page), expected, 'source contains the complete fixture');
    const backup = await backUp(source.page);
    assert.deepEqual(backup.payload.utterances, expected.utterances, 'backup includes tombstones');
    assert.deepEqual(backup.payload.relations, expected.relations, 'backup includes withdrawn relations');
    await restoreAndCompare(destination.page, backup, expected);
    console.log('PASS Gate B: actual backup/restore buttons preserve every record and artifact byte; re-export equal.');
  } finally {
    await source.context.close();
    await destination.context.close();
  }
};
