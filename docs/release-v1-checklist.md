# v1.0 release gate

This is a verification record, not a claim that v1.0 has shipped. The proposal/reading stack is unmerged and is not part
of this release candidate.

| Check                     | Evidence                                                                                                                                                 | State                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Complete portable history | PR #17 targets main; JSON round trip preserves tombstones, withdrawn Relations/Memberships and retired Constellations                                    | Tested; unmerged                                               |
| Old export compatibility  | v2 and v3 historical-format fixtures preserve text, labels, date windows and exact timestamps                                                            | Tested with synthetic content                                  |
| Database upgrade          | Real v3 schema layout from commit f983f7b; raw recovery copy commits before source changes; failure leaves original version/records; v5 reopen unchanged | Node and Chromium tested                                       |
| Actual historical exports | Original v2/v3 repository and exporter code produced archived fixtures; every emitted record and artifact byte compared after import                     | Tested with synthetic content; no personal content required    |
| Backup/import UI          | Download, import into fresh browser context, exact content, identical-record skip, malformed JSON and atomic rejection                                   | Tested                                                         |
| Eight surfaces            | Record, Say, Drift, Between, Library, Search, Places, Inspect; empty and populated states; long text; Back; placement                                    | Mobile Chromium emulation tested                               |
| Offline                   | Complete static/dynamic module allowlist, offline reload with HTTP cache disabled, all surfaces reachable                                                | Chromium tested; **iPhone pending**                            |
| Accessibility             | Keyboard-only Say/save; visible focus; native modal focus containment/Escape; 200% text on every surface; reduced-motion rule; axe WCAG A/AA checks      | Automated/emulated checks pass; **real-device review pending** |
| Archive invariants        | Immutable text, constructor provenance, machine write rejection, tombstones, explicit import click, empty public seed                                    | Automated tests                                                |
| Repo close-out            | README content/license distinction; AGENTS reflects actual current capabilities; ADR-008/009; no private archive added                                   | Prepared for review                                            |
| v1.0 tag                  | Must identify the reviewed release commit after all gates pass                                                                                           | **Not created**                                                |

## Run the checks

Install the existing test dependency and run:

```sh
npm install --ignore-scripts
npm test
```

Optional browser checks require externally installed Playwright, axe-core and Chromium; none is an app runtime
dependency. Set NODE_PATH if these are installed outside the checkout. CHROMIUM_PATH is optional when Playwright's
normal browser installation is present.

```sh
CHROMIUM_PATH=/path/to/chromium node scripts/release-browser-check.cjs
MOBILE_WIDTH=320 CHROMIUM_PATH=/path/to/chromium node scripts/release-browser-check.cjs
```

The script serves this checkout on localhost:8766, uses synthetic content in isolated browser contexts, and writes an
optional screenshot to /tmp (override SCREENSHOT_PATH). Never use personal writing as a public test fixture.

## Required real iPhone pass

Use a disposable archive at the intended HTTPS origin, then repeat restoration with a separately retained personal
backup. Record iPhone model, iOS version, Safari versus Home Screen mode, and tested commit.

| Surface | Device checks                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------- |
| Record  | Empty/long entries; 200% text; safe areas; open Inspect and return                              |
| Say     | Software keyboard; caret and Keep reachable; dismiss/reopen keyboard; exact whitespace retained |
| Drift   | Empty state; long text; Inspect and Back                                                        |
| Between | Selectors with keyboard open; long positions; Inspect and Back                                  |
| Library | Empty/long archive; scroll position after Inspect Back                                          |
| Search  | Keyboard; zero results; long result; Inspect Back                                               |
| Places  | Empty state; long names; open a gathered utterance and return                                   |
| Inspect | Exact words; Back; placement sheet focus, keyboard, scrolling and safe areas                    |

Also download and find the backup in Files, restore it, request storage protection, install to Home Screen, wait for
offline readiness, turn on airplane mode, close/reopen, and reload. Confirm both archive data and artifact bytes. Repeat
with larger accessibility text and reduced motion. Browser emulation cannot verify the iOS keyboard, notch/home
indicator, Files handoff, app termination, VoiceOver, or Safari eviction behavior.

## Release sequence

1. Review and explicitly authorize the export hotfix merge.
2. Review the release-hardening diff, including changes overlapping PR #18 and the parked provenance stack. Do not
   automatically merge that stack.
3. Complete the iPhone pass and resolve any failures. Historical compatibility is tested with files produced by the
   original exporters; a personal restore can be checked separately without committing its contents.
4. Explicitly authorize the selected release PR merge(s).
5. Run the release checks against the resulting main commit and tag that exact reviewed commit `v1.0`.

“Continue” and “Go” do not authorize merging. The author has requested the tag; the incomplete validation gates are why
it has not been created yet.

## Current gate status — October 9

The later Next Phase Protocol supersedes the September 28 review waiver below.
Independent review and author phone acceptance remain required. Feature work stays
frozen until Gates A–C pass. Builder test results alone are not gate sign-off.

See [the audit packet](audit-completion.md) for the integrated candidate, exact
test claims, failing-first evidence, remaining checks and the next allowed slice.
The audit branch now triggers the existing Node CI job without opening another
stacked PR. This does not authorize merging, deployment or a release tag.

## Historical release testing — September 28 (review waiver superseded)

At that time the author chose to proceed without Claude review. That waiver is superseded above. All 73 automated tests pass after
reproducing and fixing three additional history failures: unknown Artifact capture dates becoming the current time,
Transcription deletion timestamps being reset during reconstruction, and artifact-only Utterances failing tombstone
validation.

The original v2 and v3 exporters now have checked-in, synthetic-output fixtures. Tests compare all emitted entities and
original media bytes after restoration. No record absent from an old export can be recovered from that export alone. The
real iPhone pass and explicit merge authorization still remain open.
