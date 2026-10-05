# ADR-001: Utterance text is immutable

Status: Accepted

`Utterance.text` has no update path. A correction is a new Utterance plus a Relation. This preserves earlier words
instead of silently replacing them.
