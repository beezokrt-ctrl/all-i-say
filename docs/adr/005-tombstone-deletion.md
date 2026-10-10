# ADR-005: Tombstone deletion by default

Status: Accepted

Default deletion preserves recoverability. Permanent purge is a separate, explicit, confirmed operation.

## Repeated withdrawal and tombstoning

Author approved October 10, 2026: repeating a withdrawal is a successful no-op,
preserving the original date and reason. The same preservation rule applies to
an already-tombstoned Utterance. A repeated call returns the existing record.

Read the status inside the same readwrite transaction as the first transition.
Concurrent calls therefore preserve the first committed assertion. Do not fill
in a missing historic timestamp or replace a reason on retry. Existing records
are not migrated. Changing the reason is not an implicit side effect of deletion.

This decision covers Relation and Membership withdrawal and Utterance
tombstoning. Transcription attestation is a separate lifecycle; its confirmation
policy is not changed by this decision.
