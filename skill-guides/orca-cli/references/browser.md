# Built-in browser commands

Use a snapshot-interact-re-snapshot loop:

```text
OMDX goto --url https://example.com --json
OMDX snapshot --json
OMDX click --element @e3 --json
OMDX snapshot --json
```

Common commands:

```text
OMDX goto --url <url> --json
OMDX back --json
OMDX reload --json
OMDX snapshot --json
OMDX screenshot --json
OMDX full-screenshot --json
OMDX pdf --json
OMDX click --element <ref> --json
OMDX fill --element <ref> --value <text> --json
OMDX type --input <text> --json
OMDX select --element <ref> --value <value> --json
OMDX check --element <ref> --json
OMDX scroll --direction down --amount 1000 --json
OMDX hover --element <ref> --json
OMDX focus --element <ref> --json
OMDX keypress --key Enter --json
OMDX upload --element <ref> --files <paths> --json
OMDX wait --text <text> --json
OMDX wait --url <substring> --json
OMDX wait --selector <css> --json
OMDX wait --load networkidle --json
OMDX eval --expression <js> --json
OMDX tab list --json
OMDX tab create --url <url> --json
OMDX tab switch --index <n> --json
OMDX tab close --index <n> --json
OMDX cookie get --json
OMDX capture start --json
OMDX console --limit 50 --json
OMDX network --limit 50 --json
OMDX exec --command "help" --json
```

Browser rules:

- Re-snapshot after navigation, tab switches, clicks that change the page, and any `browser_stale_ref`.
- Refs like `@e1` are assigned by `snapshot`, scoped to one tab, and invalidated by navigation or tab switch.
- Browser commands default to the current worktree and its active tab. Use `--worktree all` only intentionally.
- For concurrent browser work, run `OMDX tab list --json`, read `tabs[].browserPageId`, and pass `--page <browserPageId>` on later commands.
- Use typed tab commands (`OMDX tab list/create/close/switch`), not `OMDX exec --command "tab ..."`, so Oh My DevX keeps UI state synchronized.
- Prefer `wait --text`, `--url`, `--selector`, or `--load` after async page changes instead of bare timeouts.
- Anything not listed above goes through `OMDX exec --command "<agent-browser command>"`.
- If `fill` or `type` fails on a custom input, try `OMDX focus --element @e1 --json` then `OMDX inserttext --text "text" --json`.
- A client-hosted page renders in the paired desktop's browser engine, so every command against it needs that desktop online and returns `browser_host_unavailable` while it is closed, asleep, or disconnected. Server-hosted pages run with no desktop attached; prefer them for long or unattended automation.

Common recoveries:

- `browser_no_tab`: open a tab with `OMDX tab create --url <url> --json`.
- `browser_stale_ref`: run `OMDX snapshot --json` and retry with fresh refs.
- `browser_tab_not_found`: run `OMDX tab list --json` before switching or closing.
- `browser_host_unavailable`: the desktop hosting the page is offline. Bring it back, or recreate the page with server placement if the work must outlive the desktop session.
