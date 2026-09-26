import { createUtterance } from '../../domain/utterance.js';
import { FORM_TYPES } from '../../../data/schema.js';

const LEGACY_KIND_MAP = {
  'statement': 'fragment',
  'question': 'question',
  'fragment': 'fragment',
  'lyric': 'lyric',
  'fiction': 'fiction',
  'essay': 'essay',
  'note': 'note',
  'correction': 'correction'
};

function mapLegacyKind(kind) {
  if (!kind || !FORM_TYPES.includes(kind)) {
    return LEGACY_KIND_MAP[kind] || 'unknown';
  }
  return kind;
}

function parseDate(dateString) {
  if (!dateString) return { earliest: null, latest: null, precision: 'unknown' };
  const cleaned = String(dateString).trim();
  if (!cleaned) return { earliest: null, latest: null, precision: 'unknown' };

  const yearMatch = cleaned.match(/(\d{4})/);
  if (!yearMatch) return { earliest: null, latest: null, precision: 'unknown', display: cleaned };
  const year = yearMatch[1];

  const monthAbbr = cleaned.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  if (monthAbbr) {
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const month = months[monthAbbr[1].toLowerCase()];
    const dayMatch = cleaned.match(/(\d{1,2})/);
    if (dayMatch) {
      const day = String(dayMatch[1]).padStart(2, '0');
      const exact = `${year}-${String(month).padStart(2, '0')}-${day}`;
      return { earliest: exact, latest: exact, precision: 'day', display: cleaned };
    }
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(Number(year), month, 0).getDate();
    const lastDayStr = String(lastDay).padStart(2, '0');
    return { earliest: firstDay, latest: `${year}-${String(month).padStart(2, '0')}-${lastDayStr}`, precision: 'month', display: cleaned };
  }

  return { earliest: `${year}-01-01`, latest: `${year}-12-31`, precision: 'year', display: cleaned };
}

export async function migrateV2toV3(v2Entries = [], { includeTimestampError = false } = {}) {
  const v3Utterances = [];
  const errors = [];

  for (const v2 of v2Entries) {
    try {
      if (!v2.id) throw new Error('V2 entry missing id');
      if (!v2.text) throw new Error('V2 entry missing text');

      const temporal = parseDate(v2.date);
      const form = mapLegacyKind(v2.kind);
      const threads = Array.isArray(v2.threads) ? v2.threads : [];

      const v3 = createUtterance({
        id: v2.id,
        text: v2.text,
        createdAt: v2.createdAt || new Date().toISOString(),
        spokenAt: temporal.earliest || null,
        datePrecision: temporal.precision,
        displayDate: temporal.display || v2.date || null,
        source: {
          type: 'imported',
          conversationId: null,
          context: null,
          artifactIds: []
        },
        metadata: {
          form,
          threads,
          status: 'kept'
        }
      });

      v3Utterances.push(v3);
    } catch (error) {
      errors.push({ v2Entry: v2, reason: error.message });
      if (includeTimestampError) throw error;
    }
  }

  if (errors.length > 0) {
    const err = new Error(`Migration failed: ${errors.length} of ${v2Entries.length} entries could not be transformed`);
    err.failedEntries = errors;
    throw err;
  }

  return v3Utterances;
}
