# speedtest2mqtt

[![mqtt-smarthome](https://img.shields.io/badge/mqtt-smarthome-blue.svg)](https://github.com/mqtt-smarthome/mqtt-smarthome)
[![npm version](https://img.shields.io/npm/v/speedtest2mqtt.svg)](https://www.npmjs.com/package/speedtest2mqtt)
[![CI](https://github.com/hobbyquaker/speedtest2mqtt/actions/workflows/ci.yml/badge.svg)](https://github.com/hobbyquaker/speedtest2mqtt/actions/workflows/ci.yml)
[![License][mit-badge]][mit-url]

> Measure internet download, upload, ping and jitter, and publish the results via MQTT.

Built on [mqtt-interfaces-core](https://github.com/hobbyquaker/mqtt-interfaces-core), following the
[mqtt-smarthome](https://github.com/mqtt-smarthome/mqtt-smarthome) architecture, with Home Assistant
discovery, a systemd installer and a Docker image — like the other `xyz2mqtt` adapters.

**A test runs only when you ask for it**, by publishing to `speedtest/set/run`. There is no interval
option, on purpose: a speedtest saturates the line for half a minute and skews every other
measurement taken while it runs, so _when_ it happens is a scheduling decision for whoever owns the
network. See [Scheduling](#scheduling).

Out of the box it needs **no external program** — the measurement is done by a pure JavaScript
implementation of Ookla's protocol. If you would rather use an installed speedtest CLI, see
[Backends](#backends).

## Install

```
sudo npm install -g speedtest2mqtt
speedtest2mqtt -u mqtt://broker
```

As a systemd service (creates `speedtest2mqtt@speedtest`, an unprivileged user, and
`/etc/speedtest2mqtt/speedtest.env`):

```
sudo speedtest2mqtt --install -n speedtest -u mqtt://broker
```

Remove it again with `sudo speedtest2mqtt --uninstall -n speedtest`.

### Docker

```
docker run -d --restart unless-stopped --name speedtest2mqtt \
  -e SPEEDTEST2MQTT_MQTT_URL=mqtt://broker \
  ghcr.io/hobbyquaker/speedtest2mqtt
```

Every option is available as an environment variable (`SPEEDTEST2MQTT_<OPTION>`), and the
unprefixed `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` work as a fallback. The image ships no
speedtest program, so it uses the built-in JavaScript backend.

## Backends

| `--backend`      | What it uses                                                                                                                   | Needs                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `js` _(default)_ | [universal-speedtest](https://www.npmjs.com/package/universal-speedtest), a pure JavaScript implementation of Ookla's protocol | nothing                   |
| `cli`            | an installed speedtest program, auto-detected                                                                                  | one of the programs below |

`--backend cli` probes `speedtest`, `speedtest-cli` and `librespeed-cli` in that order and
identifies each one by what its `--version` prints, not by the name it was found under — the Python
`speedtest-cli` installs an alias called `speedtest`, and it takes completely different options from
Ookla's own binary of the same name. Pin one with `--cli-command /usr/bin/speedtest`.

| Program                                                          | Detected as     | Jitter | Notes                                                       |
| ---------------------------------------------------------------- | --------------- | ------ | ----------------------------------------------------------- |
| [Ookla Speedtest CLI](https://www.speedtest.net/apps/cli)        | `ookla`         | yes    | the official one; also reports packet loss and a result URL |
| [speedtest-cli](https://github.com/sivel/speedtest-cli) (Python) | `speedtest-cli` | no     | in every distro's repos; unmaintained since 2021            |
| [librespeed-cli](https://github.com/librespeed/speedtest-cli)    | `librespeed`    | yes    | LibreSpeed servers, not Ookla's                             |

Installing one:

```
Debian/Ubuntu   sudo apt install speedtest-cli        # or: librespeed-cli
Arch            sudo pacman -S speedtest-cli
Fedora/RHEL     sudo dnf install speedtest-cli
Ookla's own     https://www.speedtest.net/apps/cli    (their own repository)
```

If none is found the adapter says so, with these hints, and keeps running — install one and the next
`set/run` picks it up without a restart.

## Scheduling

The adapter never tests on its own. Trigger it from wherever you already schedule things:

```
# every night at 04:00, from cron
0 4 * * *  mosquitto_pub -h broker -t speedtest/set/run -n
```

```yaml
# Home Assistant: the Run test button, on a schedule
automation:
  - trigger:
      - trigger: time_pattern
        hours: '/6'
    action:
      - action: button.press
        target: {entity_id: button.speedtest_run_test}
```

## Options

| Option             | Env                             | Default            | Description                                                 |
| ------------------ | ------------------------------- | ------------------ | ----------------------------------------------------------- |
| `-b, --backend`    | `SPEEDTEST2MQTT_BACKEND`        | `js`               | `js` (built in, no install) or `cli` (an installed program) |
| `--cli-command`    | `SPEEDTEST2MQTT_CLI_COMMAND`    | _(probe)_          | speedtest program for `--backend cli`                       |
| `-s, --server-id`  | `SPEEDTEST2MQTT_SERVER_ID`      | _(nearest)_        | pin the test to one speedtest server id                     |
| `-t, --timeout`    | `SPEEDTEST2MQTT_TIMEOUT`        | `300`              | seconds a single test may take                              |
| `--publish-result` | `SPEEDTEST2MQTT_PUBLISH_RESULT` | `false`            | also publish the full result on `<name>/status/result`      |
| `--state-dir`      | `SPEEDTEST2MQTT_STATE_DIR`      | `$STATE_DIRECTORY` | `HOME` for `--backend cli`                                  |
| `-u, --mqtt-url`   | `SPEEDTEST2MQTT_MQTT_URL`       | `mqtt://localhost` | broker url                                                  |
| `-n, --name`       | `SPEEDTEST2MQTT_NAME`           | `speedtest`        | instance name and topic prefix                              |
| `-v, --verbosity`  | `SPEEDTEST2MQTT_VERBOSITY`      | `info`             | `error`, `warn`, `info`, `debug`                            |

`--help` lists these plus the shared options every adapter has (MQTT credentials and TLS,
`--json-payloads`, `--ha-discovery`, `--ha-prefix`, `--maintenance`, `--stats-interval`).
`--config-schema` prints the whole configuration as a JSON Schema.

## Topics

Status topics are retained, payload `{"val": …, "ts": …, "lc": …}` unless the instance runs with
`--no-json-payloads`.

| Topic                       | Example payload                                    | Unit     |
| --------------------------- | -------------------------------------------------- | -------- |
| `speedtest/connected`       | `2`                                                | 0/1/2    |
| `speedtest/status/download` | `{"val":253.2,"ts":1756554028000,"lc":…}`          | Mbit/s   |
| `speedtest/status/upload`   | `{"val":38.18,…}`                                  | Mbit/s   |
| `speedtest/status/ping`     | `{"val":5.69,…}`                                   | ms       |
| `speedtest/status/jitter`   | `{"val":0.35,…}`                                   | ms       |
| `speedtest/status/running`  | `{"val":false,…}`                                  | boolean  |
| `speedtest/status/server`   | `{"val":"Deutsche Telekom, Stuttgart, Germany",…}` |          |
| `speedtest/status/isp`      | `{"val":"Deutsche Telekom AG",…}`                  |          |
| `speedtest/status/last_run` | `{"val":"2026-08-30T11:40:28.000Z",…}`             | ISO 8601 |
| `speedtest/status/error`    | `{"val":"",…}`                                     |          |
| `speedtest/status/result`   | the full result object                             | opt-in   |
| `speedtest/info`            | version, backend, timeout                          | retained |

`jitter` is absent when measuring with the Python `speedtest-cli`, which does not report it.
`result` needs `--publish-result` and carries the fields the topics above leave out: `packetLoss`,
`bytesSent`, `bytesReceived`, `serverId` and, with the Ookla CLI, the shareable result `url`.

### Commands

| Topic               | Payload  | Effect       |
| ------------------- | -------- | ------------ |
| `speedtest/set/run` | anything | start a test |

While a test runs `status/running` is `true` and further `set/run` messages are ignored with a
warning — two concurrent tests would measure each other. On failure the reason lands in
`status/error`, which is cleared again by the next successful run.

`speedtest/maintenance/set/loglevel` and `…/restart` come from the core.

## Home Assistant

MQTT discovery is on by default (`--no-ha-discovery` to turn it off). One device appears with
Download, Upload, Ping and Jitter sensors, a **Run test** button, and Running / Server / ISP /
Last run / Last error as diagnostics. Download and upload use the `data_rate` device class, so they
plot in Mbit/s and can be converted per-entity; `last_run` is a `timestamp`.

The sensors read _unknown_ until the first test has run, which is the honest state of a bridge that
measures only on request.

## Development

```
npm install
npm test
npm run lint
node index.js -u mqtt://broker -v debug
```

`npm run deploy` builds a tarball, installs it into `/usr/local/lib/node_modules/speedtest2mqtt` on
a remote host and restarts the `speedtest2mqtt@*` units there.

## Upgrading from 1.x

Version 1 was a Node script, later a shell script wrapping `speedtest-cli` and `mosquitto_pub`.
2.0 is a rewrite and the topics changed:

| 1.x                         | 2.0                         |
| --------------------------- | --------------------------- |
| `speedtest/status/Ping`     | `speedtest/status/ping`     |
| `speedtest/status/Download` | `speedtest/status/download` |
| `speedtest/status/Upload`   | `speedtest/status/upload`   |

The old script ran a test on every invocation and was driven by cron; 2.0 is a daemon that tests on
`speedtest/set/run`, so the cron line becomes a `mosquitto_pub` (see [Scheduling](#scheduling)).
Values are still Mbit/s and ms.

## License

MIT © [Sebastian Raff](https://github.com/hobbyquaker)

[mit-badge]: https://img.shields.io/badge/License-MIT-blue.svg?style=flat
[mit-url]: LICENSE
