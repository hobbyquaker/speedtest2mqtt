/**
 * Pure normalisation of every backend's raw output into one result shape.
 *
 * Backends disagree on units — Ookla reports bytes/s, the Python speedtest-cli bits/s,
 * librespeed and universal-speedtest Mbit/s already — so the conversion lives here, next to the
 * schemas it belongs to, and `index.js` only ever sees `Mbit/s` and `ms`.
 */

/** The item set published under <name>/status/ after a run. */
export const ITEMS = ['download', 'upload', 'ping', 'jitter', 'server', 'isp', 'last_run'];

const round = (value, digits = 2) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return null;
    }
    const f = 10 ** digits;
    return Math.round(n * f) / f;
};

const text = (value) => {
    const s = value === undefined || value === null ? '' : String(value).trim();
    return s || null;
};

const int = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
};

/** ISO 8601 with a timezone, which is what HA's `timestamp` device class needs. */
function isoTime(value) {
    const d = value === undefined ? new Date() : new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * @typedef {object} Result
 * @property {number|null} download Mbit/s
 * @property {number|null} upload Mbit/s
 * @property {number|null} ping ms
 * @property {number|null} jitter ms — null where the backend does not measure it
 * @property {number|null} packetLoss percent, or null
 * @property {string|null} server human readable server description
 * @property {number|null} serverId backend's server id, for --server-id
 * @property {string|null} isp
 * @property {number|null} bytesSent
 * @property {number|null} bytesReceived
 * @property {string|null} url shareable result page, Ookla only
 * @property {string} timestamp ISO 8601
 */

const result = (fields) => ({
    download: null,
    upload: null,
    ping: null,
    jitter: null,
    packetLoss: null,
    server: null,
    serverId: null,
    isp: null,
    bytesSent: null,
    bytesReceived: null,
    url: null,
    ...fields,
});

/** Ookla `speedtest --format=json`: bandwidth in bytes/s. */
export function fromOokla(raw) {
    const server = raw.server || {};
    const place = [server.name, server.location, server.country].filter(Boolean).join(', ');
    return result({
        download: round((Number(raw.download?.bandwidth) * 8) / 1e6),
        upload: round((Number(raw.upload?.bandwidth) * 8) / 1e6),
        ping: round(raw.ping?.latency),
        jitter: round(raw.ping?.jitter),
        packetLoss: raw.packetLoss === undefined ? null : round(raw.packetLoss),
        server: text(place),
        serverId: int(server.id),
        isp: text(raw.isp),
        bytesSent: int(raw.upload?.bytes),
        bytesReceived: int(raw.download?.bytes),
        url: text(raw.result?.url),
        timestamp: isoTime(raw.timestamp),
    });
}

/** Python `speedtest-cli --json`: bits/s, and no jitter at all. */
export function fromSpeedtestCli(raw) {
    const server = raw.server || {};
    const place = [server.sponsor, server.name, server.country].filter(Boolean).join(', ');
    return result({
        download: round(Number(raw.download) / 1e6),
        upload: round(Number(raw.upload) / 1e6),
        ping: round(raw.ping),
        jitter: null,
        server: text(place),
        serverId: int(server.id),
        isp: text(raw.client?.isp),
        bytesSent: int(raw.bytes_sent),
        bytesReceived: int(raw.bytes_received),
        timestamp: isoTime(raw.timestamp),
    });
}

/** `librespeed-cli --json`: an array of one run, Mbit/s already. */
export function fromLibrespeed(raw) {
    const run = Array.isArray(raw) ? raw[0] : raw;
    if (!run) {
        throw new Error('librespeed-cli returned an empty result array');
    }
    return result({
        download: round(run.download),
        upload: round(run.upload),
        ping: round(run.ping),
        jitter: round(run.jitter),
        server: text(run.server?.name),
        isp: text(run.client?.org),
        bytesSent: int(run.bytes_sent),
        bytesReceived: int(run.bytes_received),
        timestamp: isoTime(run.timestamp),
    });
}

/** universal-speedtest's `performOoklaTest()` result, configured to report Mbit/s. */
export function fromUniversal(raw) {
    const server = raw.bestServer || {};
    const place = [server.sponsor, server.name, server.country].filter(Boolean).join(', ');
    return result({
        download: round(raw.downloadResult?.speed),
        upload: round(raw.uploadResult?.speed),
        ping: round(raw.pingResult?.latency),
        jitter: round(raw.pingResult?.jitter),
        server: text(place),
        serverId: int(server.id),
        isp: text(raw.client?.isp),
        bytesSent: int(raw.uploadResult?.transferredBytes),
        bytesReceived: int(raw.downloadResult?.transferredBytes),
        timestamp: isoTime(),
    });
}
