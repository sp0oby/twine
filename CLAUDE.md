# CLAUDE.md — Standing Instructions for Claude Code

This file tells Claude Code how to work in the Twine repo. Read it at the start of every session. The user expects you to follow these instructions without restating them.

---

## What this project is

Twine is a Uniswap v4 hook that turns a pool into a continuously-rebalancing pair-trade vehicle. The full specification is in `PROJECT_SPEC.md` — read it before writing any contract code. The build plan is in `TODO.md`. Don't skip to later phases without finishing current ones.

This is **DeFi infrastructure handling real value**. Treat every line of code as adversarial. There is no "this won't matter in practice." If you find yourself thinking that, stop and flag it.

---

## Operating principles

### 1. Spec is source of truth

If the spec says one thing and the code says another, the spec wins — until the spec is explicitly updated. If you believe the spec should change, **say so before changing the code**. Don't quietly diverge.

### 2. Tests are non-negotiable

Every new function gets unit tests in the same PR. Math functions get fuzz tests. Stateful logic gets invariant tests. If you can't write a test, you don't understand the function well enough to write it.

Coverage targets:
- Math libraries: 100% line, 100% branch
- Hook callbacks: 100% line, all revert paths covered
- Vault/governance: 95% line, all access controls covered

### 3. Security mindset, always

For every external function, ask:
- What if the caller is malicious?
- What if the oracle is wrong?
- What if a token implements ERC-20 weirdly (fee-on-transfer, rebasing, reentrant transfer)?
- What if the call is in a reentrant context?
- What if the block timestamp is manipulated within validator tolerance?

Default answers:
- Reentrancy guards on every external entry point that touches state
- Staleness checks on every oracle read
- Use `forceApprove` / `safeApprove`, not raw `approve`
- Use `SafeERC20` for transfers
- Never `transfer()` (the 2300 gas one) — always `call{value:}`
- Sanity-check all external math (Chainlink price > 0, decimals match expected, etc.)

### 4. Don't add dependencies casually

The dependency list is in `foundry.toml` and `package.json`. Adding to it is a decision, not a default. If you want a new dependency:
1. Tell the user
2. Justify it (could we write 30 lines and avoid pulling it in?)
3. Wait for approval

Currently approved:
- `v4-core`, `v4-periphery` (Uniswap)
- `@openzeppelin/contracts` (standards, access control)
- `solady` (gas-sensitive utilities, ERC-6909)
- `@chainlink/contracts` (oracle interfaces)
- `forge-std` (test framework)

### 5. Style

- Solidity 0.8.26 (matches v4)
- Run `forge fmt` before every commit — non-negotiable
- Function order: `constructor`, external/public state-changing, external/public view/pure, internal, private
- NatSpec on every external/public function (`@notice`, `@param`, `@return` at minimum, `@dev` where helpful)
- No magic numbers — declare as `constant` or `immutable` with a comment explaining the value
- Custom errors, not `require` strings (gas + clarity)
- Events for every state change that an indexer would care about

### 6. Solo builder context

The user is building this alone. That has implications:
- Prefer clarity over cleverness — they'll be debugging this in 3 months
- Verbose comments are good comments
- Don't pile up TODOs in code — they get forgotten. Add them to `TODO.md` instead.
- When you encounter ambiguity, ask before assuming

---

## Workflow rules

### Before writing any contract code

1. Read `PROJECT_SPEC.md` (or the relevant section)
2. Check `TODO.md` for the current phase
3. Verify the task you're about to do matches the current phase
4. If it doesn't, ask before proceeding

### Before modifying existing contracts

1. Read the current file fully
2. Read all tests that reference the file
3. Identify which invariants might be affected
4. Propose the change in plain English first if it's non-trivial
5. Make the change
6. Update tests in the same change

### When writing tests

1. Unit tests use a clear naming convention: `test_<function>_<scenario>` for happy paths, `testRevert_<function>_<reason>` for reverts, `testFuzz_<function>_<property>` for fuzz tests, `invariant_<property>` for invariants
2. Use `vm.startPrank` / `vm.stopPrank`, not single-line `vm.prank` for multi-call sequences
3. Assert specific reverts with `vm.expectRevert(SpecificError.selector)`, not blanket `vm.expectRevert()`
4. Test boundary conditions explicitly (off-by-one is a real and recurring source of DeFi bugs)

### When proposing changes to the spec

Open a section at the bottom of `PROJECT_SPEC.md` called "Proposed Changes" and add the proposal there. Don't edit the main spec body until the user confirms.

---

## What NOT to do

### Never

- Push to mainnet without an audit (the user will explicitly authorize this when ready)
- Add `unchecked` blocks without a comment proving overflow is impossible
- Skip the staleness check on oracle reads
- Use `tx.origin` for anything
- Use a hardcoded address (use `immutable` and set in constructor, or a registry pattern)
- Disable a test to make CI green — fix the underlying issue or document why it's pending
- Commit a `console.log` statement
- Commit anything from `.env` or with a private key in it
- Use `block.timestamp` as a randomness source

### Avoid unless explicitly justified

- New external library dependencies
- Storage-slot-level optimizations that obscure intent
- Inline assembly (acceptable only for proven patterns: efficient hashing, `ecrecover`, etc.)
- Modifying v4 imports — we extend, we don't fork
- Changing the public API of any contract that's already been deployed to testnet

---

## Files to be aware of

| Path | Purpose |
|------|---------|
| `PROJECT_SPEC.md` | Canonical spec. Source of truth. |
| `TODO.md` | Build plan, phased. Track progress here. |
| `README.md` | Public-facing summary. |
| `src/TwineHook.sol` | The main hook. The heart of everything. |
| `src/lib/SpreadMath.sol` | Math primitives. Test exhaustively. |
| `src/oracle/` | Oracle adapters. Critical for safety. |
| `test/invariant/` | Invariant tests. Run with high iteration counts. |
| `script/Deploy.s.sol` | Deployment script. Treat as production code, not a one-off. |

---

## Common pitfalls in v4 hook development

These are specific to Uniswap v4. They've burned other hook developers. Learn from them.

1. **Wrong permission bitmask.** The address of a v4 hook *encodes* its permissions. If you change which callbacks the hook implements without re-deploying to a matching address, the hook will be rejected by the PoolManager. Use `HookMiner` (from v4-periphery) when deploying.

2. **Dynamic LP fees do *not* require `beforeSwapReturnDelta`.** (Corrected v0.2 — the earlier claim here was wrong.) To run an asymmetric/dynamic fee, initialize the pool with the dynamic-fee flag and return a fee override as the third return value of `beforeSwap`. `beforeSwapReturnDelta` is a *separate, more invasive* lever that lets the hook skim swap value into its own accounting (custom curves, in-swap protocol fees). Twine v1 does **not** use it: vault and buyback cuts are swept from accrued protocol fees, not skimmed in-swap. Do not add the `beforeSwapReturnDelta` permission bit — it changes the hook's deployed address and adds attack surface for no benefit here.

3. **`PoolManager` calls must be unlocked.** Hook callbacks happen inside a locked context. You can't call certain PoolManager methods directly from a callback. Be explicit about which ones are safe.

4. **Reentrancy is sneaky in v4** because the singleton design means a single transaction can touch multiple pools. Don't assume your hook is the only thing running.

5. **Test on a fork before relying on local mocks.** Some v4 behaviors only show up against real PoolManager state.

---

## When stuck

In order of preference:

1. Check `PROJECT_SPEC.md` — is the answer already there?
2. Check the v4 docs and source: https://docs.uniswap.org/contracts/v4 and the v4-core repo
3. Check `awesome-uniswap-hooks` for prior art
4. Ask the user — explain what you tried and what you're stuck on

Do not silently make a decision that affects the protocol's behavior.

---

## A note on tone

The user is technical, direct, and prefers honesty over hedging. When you're uncertain, say so. When you find a problem, name it. When you disagree with an approach, push back with reasoning. The user explicitly does not want sycophantic agreement — pushback with substance is more useful than agreement without it.
