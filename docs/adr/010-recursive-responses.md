# ADR 010: Responding through utterances and declared relations

Status: accepted for implementation; release PR remains subject to author review.

The mission is a recursive way for the author to talk to themself: encounter
past words, speak back, and return to either position later.

A response is a new Utterance with a directional Relation from the response to
the addressed Utterance. The author explicitly chooses responds-to (the neutral
default), continues, returns-to, corrects, contradicts, or develops. These are
existing relation types. No thread container owns the words, and the UI does
not infer agreement, contradiction, or correction.

The repository creates both entities in one IndexedDB transaction. The target
must exist and not be tombstoned at commit time. This action requires explicit
author provenance. A failed insert leaves neither new entity behind. The new
words carry their actual creation date; the target's chronology is unchanged.

Inspect shows the exact connected words, direction, relation status and origin.
Withdrawn relations remain visibly withdrawn; unavailable target words are
identified without inventing text. Connections can be followed in either
direction, and the next response uses the same operation. Back retraces the
inspection path before returning to the originating surface.

This needs no database store, schema version or export format change. Existing
exports already preserve utterances and relations. No AI execution is added.
