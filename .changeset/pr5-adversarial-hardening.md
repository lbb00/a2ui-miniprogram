---
"a2ui-miniprogram": patch
---

Honor createSurface catalog aliases, assimilate renderer thenables, bound envelope nesting,
suppress stale renderer RPC completions across surface/session teardown, reset session replay
state, and align public TypeScript declarations with asynchronous processing.

Clarify that registerCatalog stores descriptive metadata only, does not enforce authorization,
and is not an access-control boundary. Remove unsupported runtime-verification/full-conformance
claims and preserve existing dispatch behavior without introducing implicit deny policies.
