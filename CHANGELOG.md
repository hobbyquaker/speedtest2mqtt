# Changelog

## 2.0.0

Complete rewrite on [mqtt-interfaces-core](https://github.com/hobbyquaker/mqtt-interfaces-core),
replacing both the 1.x Node script and the shell script that succeeded it.

### Breaking

- **Topics are lower case**: `status/Ping`, `status/Download` and `status/Upload` are now
  `status/ping`, `status/download` and `status/upload`, per the mqtt-smarthome convention that item
  names are snake_case. Units are unchanged (Mbit/s, ms).
- **A test no longer runs on start-up.** 1.x measured once per invocation and was driven by cron;
  2.0 is a daemon that measures when `speedtest/set/run` arrives. Replace the cron line with
  `mosquitto_pub -h broker -t speedtest/set/run -n`, or press the Run test button in Home Assistant.
  There is deliberately no interval option: a speedtest saturates the line for half a minute and
  skews everything else measured while it runs, so scheduling belongs to whoever owns the network.
- The standalone `speedtest2mqtt` shell script is gone, along with its dependency on
  `mosquitto_pub`. Install the npm package, a Docker image or a systemd service instead.

### Added

- **No external program needed.** The default `--backend js` measures with
  [universal-speedtest](https://www.npmjs.com/package/universal-speedtest), a pure JavaScript
  implementation of Ookla's protocol, so a bare Node install is enough.
- **`--backend cli`** for anyone who prefers an installed speedtest program. It probes `speedtest`,
  `speedtest-cli` and `librespeed-cli` and identifies each by its `--version` output rather than by
  the name it was found under — the Python speedtest-cli installs an alias called `speedtest`, and
  it takes entirely different options from Ookla's binary of the same name, so going by the name
  alone gets it wrong on any machine with both. Ookla, the Python speedtest-cli and librespeed-cli
  are all supported, each with its own JSON schema and units. When none is installed the adapter
  prints install hints for Debian/Ubuntu, Arch, Fedora/RHEL and Ookla's own repository, keeps
  running, and picks up a program installed later without a restart.
- `jitter` alongside `ping`, `download` and `upload`; `server`, `isp`, `last_run`, `running` and
  `error` as diagnostics. `--publish-result` adds the full result (`packetLoss`, `bytesSent`,
  `bytesReceived`, `serverId`, and the shareable result URL from the Ookla CLI).
- **Home Assistant discovery**: one device with the four measurements, a Run test button and the
  diagnostics. Download and upload carry the `data_rate` device class, `last_run` `timestamp`. The
  jitter sensor is omitted for the Python speedtest-cli, which does not measure it.
- `--server-id` to pin the test to one server, `--timeout` (default 300 s), and the shared options
  every adapter has: MQTT credentials and TLS, `--json-payloads`, `--maintenance`,
  `--stats-interval`, `--config-schema`.
- **systemd installer** (`--install` / `--uninstall`, template unit `speedtest2mqtt@<name>`,
  unprivileged user, sandboxed) and a multi-arch **Docker image** on
  `ghcr.io/hobbyquaker/speedtest2mqtt`.

### Notes

- Concurrent runs are refused: `set/run` while `status/running` is `true` is ignored with a warning,
  because two overlapping tests measure each other rather than the line.
- The CLI backend runs its child with `HOME` pointed at the state directory. The service unit's
  `ProtectHome` makes the real one unwritable, and Ookla's CLI wants to record its licence
  acknowledgement somewhere — the adapter also passes `--accept-license --accept-gdpr` on every run,
  since an interactive prompt would hang a service.

## 1.0.2

The original: a Node script, later replaced in the repository by a shell script wrapping
`speedtest-cli` and `mosquitto_pub`.
