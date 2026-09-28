# ADR-004: AI gateway chokepoint

Status: Accepted

AI proposals are routed through one gateway and stored as pending Suggestions. Explicit author acceptance is required before a canonical entity exists.

## Why this boundary exists

All I Say separates what was said, what was later seen in it, and what a machine merely notices. A machine may surface a possible relation, but noticing a relation is not the same act as declaring one.

Acceptance therefore creates a new author assertion. The accepted Relation records that the author chose to place those two positions into declared structure; it does not rewrite the machine's proposal into an author thought, and it does not turn machine confidence into truth. The original Suggestion remains preserved as the source of the proposal, while the Relation points back to it through provenance.

The decision itself has provenance too. Accepting or rejecting is an action taken from a position in time, so the archive records who made that decision and when rather than treating the outcome as if it appeared automatically.

## Position matters in review

A relation can be directional. When a proposal is encountered from one Utterance, the interface must show the direction from the position currently being inspected: `these words → referenced words`, `referenced words → these words`, or a bidirectional form. The user should not have to accept a relation before being able to see what movement the proposal actually asserts.

This is part of the same archive principle used elsewhere: the system should expose the landscape without pretending to stand above it. A proposal is presented as one possible structure seen from a particular position; the author remains the one who decides whether that structure enters the archive.

## Consequences

- AI may create only pending Suggestions.
- A pending Suggestion is visually and structurally distinct from a canonical Relation.
- Accepting a Suggestion atomically creates the canonical entity and records an explicit author decision.
- Rejecting preserves the Suggestion and its decision history without creating canonical structure.
- Accepted canonical structure keeps a link back to the Suggestion that occasioned it.
- Proposal direction, model, confidence, and referenced words must be visible before acceptance where relevant.
- Failure during acceptance must leave the Suggestion pending and create nothing.

## Decision history and source integrity

Inspect retains accepted and rejected relation proposals beside their author decisions, including the decision time and any recorded reason. An accepted proposal links to the author Relation; that Relation links back to the proposal. Withdrawal changes the Relation's current status without undoing its original acceptance.

Import checks the whole accepted pair: endpoints, type, direction, author provenance, canonical entity ID, and reciprocal Suggestion ID. Machine model and confidence stay on the Suggestion. Validation occurs both before import (including dry runs and references already in the archive) and within the atomic write transaction. Inconsistent pairs are rejected, never silently repaired.

Repository lists distinguish an omitted status filter (normal active/kept/pending records) from an explicit undefined status (all preserved history). Export uses the latter. Import preserves Relation withdrawal metadata and Utterance tombstone metadata rather than reconstructing an incomplete history. This changes neither the database layout nor the portable format version.
