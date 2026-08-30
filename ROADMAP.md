# speedtest2mqtt — design notes

## 1. What changed and why

1.x was a shell script: `speedtest-cli --simple`, parsed with `sed`, published with
`mosquitto_pub`, driven by cron. It worked, but it had no MQTT identity (no `connected`, no `info`,
no maintenance topics), no Home Assistant discovery, no service installer, and it depended on two
programs being installed and on the Python `speedtest-cli` continuing to work.

That last dependency turned out to be the weak one — see §2 — which is what decided the shape of
2.0: measure in-process by default, and treat an external CLI as an option rather than the
foundation.

## 2. Choosing a measurement backend

Every candidate was tested on a real 240/40 Mbit/s line (expected ≈240 ↓ / 40 ↑).

| Candidate               | License        | Runs in Node? | Measured                                 | Verdict                                                                                      |
| ----------------------- | -------------- | ------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| **universal-speedtest** | MIT            | yes           | 254.6 ↓ / 37.6 ↑, ping 5.83, jitter 2.33 | **chosen**                                                                                   |
| @ginkohub/speedtest-js  | MPL-2.0        | yes           | 232.6 ↓ / 35.8 ↑                         | backup — v0.0.2, one release; on a slow line it reported jitter 282 ms against 21 ms latency |
| @cloudflare/speedtest   | —              | **no**        | —                                        | rejected, see below                                                                          |
| @ookla/speedtest-js-sdk | **UNLICENSED** | —             | —                                        | rejected: proprietary, and this package is MIT                                               |
| speedtest-net           | —              | partly        | —                                        | downloads Ookla's binary anyway; 2021, deprecated deps                                       |
| fast-speedtest-api      | —              | yes           | —                                        | 2019, fast.com, download only                                                                |

**Why not @cloudflare/speedtest**, despite being the best-maintained and dependency-free option: it
is a browser library in a way that shims do not cheaply fix. It needs a `window.location` stub, and
it reads its download timings out of the **Resource Timing API**. Node only populates those if a
`PerformanceObserver` for `resource` is registered, and even then `nextHopProtocol` is `undefined`
while the library calls `.match()` on it unguarded, and the zero-byte latency requests produce no
timing entry at all. A real run ends in `Gave up after 20 retries`. Making it work means
reimplementing resource timing against a browser library's undocumented internals.

**Decision S-1**: `universal-speedtest` is the default backend. It needs no install, which was the
whole point, and it landed closest to the true numbers.
**Decision S-2**: `--backend cli` stays available for anyone who wants the official Ookla numbers,
or who does not want another npm dependency doing the measuring.

## 3. The external CLI backend

Three programs are supported, each with its own flags, JSON schema and units — all three verified
against real captured output, which is what `test/fixtures/` holds:

| Program                | Flags                                          | Speeds in | Jitter | Extras                  |
| ---------------------- | ---------------------------------------------- | --------- | ------ | ----------------------- |
| Ookla `speedtest`      | `--format=json --accept-license --accept-gdpr` | bytes/s   | yes    | packet loss, result URL |
| Python `speedtest-cli` | `--json`                                       | bits/s    | **no** | —                       |
| `librespeed-cli`       | `--json`                                       | Mbit/s    | yes    | array of one run        |

**Decision S-3: identify by `--version`, never by name.** The Python speedtest-cli installs an alias
called `speedtest`, so a machine can have `speedtest` and `speedtest-cli` both pointing at the
Python program — this was true on the author's own Mac — while on another machine `speedtest` is
Ookla's binary taking incompatible options. Matching order is `/librespeed/i` first (its banner
contains the URL `github.com/librespeed/speedtest-cli`, which would otherwise read as the Python
one), then `/ookla/i`, then a bare version number.

**Decision S-4: a missing CLI is not fatal.** It is logged once as an error with per-distro install
hints, published on `status/error`, and retried on the next `set/run`. Exiting would put the systemd
unit into a restart loop, and the failure is one the user fixes with a single `apt install`.

Note on the Python speedtest-cli: unmaintained since April 2021 and shipped at 2.1.3 by Debian, Arch
and Fedora alike. 2.1.3 still works (verified), but an older 1.0.7 from pip crashes outright with
`NameError: name 'DOM' is not defined`. This is why it is not the default and not the recommendation.

## 4. Explicit-command-only

**Decision S-5: no interval option, and no test at start-up.** A speedtest saturates the line for
~30 s and moves hundreds of megabytes; it skews every other measurement taken while it runs and it
costs real money on a metered connection. When to run one is a network-owner decision, so the
adapter exposes `set/run` and nothing else. The README shows the cron and Home Assistant equivalents
of the old cron line.

**Decision S-6: one at a time.** `set/run` while `status/running` is `true` is ignored with a
warning — two overlapping tests measure each other.

## 5. Open questions

- **OQ-S1** — should a run be cancellable (`set/run` with `false`, or a `set/abort`)? Neither
  backend supports cancellation today: the CLI child could be killed, but `universal-speedtest`
  exposes no abort, so the timeout abandons the promise rather than stopping the traffic.
- **OQ-S2** — `--server-id` for the `js` backend resolves against the 100 nearest servers, so a
  deliberately distant server cannot be pinned. Worth paging further only if someone asks.
- **OQ-S3** — packet loss is Ookla-CLI-only, so it lives in `--publish-result` rather than in a
  topic of its own. If a second backend ever reports it, promote it to `status/packet_loss`.
