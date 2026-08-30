# Agent instructions — speedtest2mqtt

## What this is

speedtest2mqtt measures internet download, upload, ping and jitter and publishes the results over
MQTT. One of the `xyz2mqtt` adapters by the same author: all follow the
[mqtt-smarthome](https://github.com/mqtt-smarthome/mqtt-smarthome) architecture and are built on
[mqtt-interfaces-core](https://github.com/hobbyquaker/mqtt-interfaces-core)
(`../mqtt-interfaces-core` when checked out next to this repo — generic fixes go there; its README
is the complete guide to building an adapter). Consistency with the core's conventions and with
govee2mqtt / wiim2mqtt / cul2mqtt is a hard requirement.

**A test runs only on `<name>/set/run`, never on a timer and never at start-up.** This is a
deliberate constraint, not an omission: a speedtest saturates the line for ~30 s and skews every
other measurement taken while it runs, so scheduling belongs to cron, a Home Assistant automation
or mqttpc. Do not add an interval option.

## MQTT conventions

`<name>/connected` (0/1/2 — 2 once a backend is usable), `<name>/status/<item>` retained
`{val, ts, lc}`, `<name>/set/run` the only command, `<name>/info`, `maintenance/*` from the core.
Items: `download`, `upload` (Mbit/s), `ping`, `jitter` (ms), `running`, `server`, `isp`, `last_run`
(ISO 8601), `error`, and `result` under `--publish-result`. Topic names are API — the 1.x → 2.0
rename table is in the README; do not rename again outside a major release.

## Code layout (ES modules, node >= 20.19)

- `index.js` — `createAdapter()` + wiring: backend selection, `runTest()` with the concurrency
  guard, `handleSet()` for `set/run`. The set handler deliberately does not await the run: a test
  takes ~30 s and must not block the MQTT loop; progress is on `status/running`.
- `lib/result.js` — **pure**: every backend's raw JSON → one result shape. The unit conversions live
  here because the backends disagree (Ookla reports bytes/s, the Python CLI bits/s, librespeed and
  universal-speedtest Mbit/s already). Everything above this module sees only Mbit/s and ms.
- `lib/cli.js` — the external-program backend: `detectFlavour()` (pure), `detect()` (exec
  injectable), `buildArgs()`, `parseJson()`, `parseOutput()`, `installHints()`, `measure()`.
  Identification is by `--version` output, never by the command name — see below.
- `lib/js.js` — the default backend, a thin wrapper over `universal-speedtest`.
- `lib/hadiscovery.js` — **pure**: `discoveryModel()` → one HA device block.
- `lib/install.js`, `config.js` — core wiring.
- `test/` — `node:test` for every pure module; `test/fixtures/*.json` are **real** captured outputs
  of the three CLIs, not invented ones. Keep them that way.

## The `speedtest` name trap

`speedtest` on PATH is not necessarily Ookla's. The Python `speedtest-cli` installs an alias of that
name, and the two take incompatible options (`--format=json --accept-license` vs `--json`) and emit
different JSON with different units. `lib/cli.js` therefore runs `<command> --version` and matches
the output: `/librespeed/i` first (its banner contains the URL `librespeed/speedtest-cli`, which
would otherwise look like the Python one), then `/ookla/i`, then a bare version number for the
Python CLI. Never shortcut this to a name or `which` check.

## Style & practices

Plain JavaScript ESM, 4 spaces, single quotes, eslint + prettier (`npm run lint`, `npm run format`),
`npm test`. Dependencies: `mqtt-interfaces-core` and `universal-speedtest` only (`mqtt`, `yargs`
come with the core); `fast-xml-parser` is pinned through `overrides` to clear an advisory in
universal-speedtest's tree. Log `cli >` / `cli <` at debug; a failed test is `warn`, not `error` —
an unreachable speedtest server is normal operation. A missing CLI is logged `error` once but does
not exit: exiting would make the systemd unit restart in a loop, and the adapter recovers on its own
when a program is installed later.

## Running / testing live

```
node index.js -u mqtt://broker -v debug
mosquitto_pub -h broker -t speedtest/set/run -n
node index.js -u mqtt://broker -b cli -v debug     # needs a speedtest program installed
```

A real run takes 20–40 s and moves real traffic (~100–500 MB on a fast line) — do not loop it in
tests. Unit tests never touch the network.
