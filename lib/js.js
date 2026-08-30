/**
 * The default backend: universal-speedtest, a pure-JavaScript implementation of Ookla's protocol.
 * No binary to install, which is the whole point — the adapter works out of the box on a bare
 * Node install, and `--backend cli` is there for anyone who wants the official numbers instead.
 */

import {SpeedUnits, UniversalSpeedTest} from 'universal-speedtest';

import {fromUniversal} from './result.js';

/** How many servers to page in when --server-id has to be resolved to a server object. */
const SERVER_LIST = 100;

function client() {
    return new UniversalSpeedTest({
        debug: false, // it logs straight to console; adapter logging goes through `log`
        tests: {measureDownload: true, measureUpload: true},
        units: {downloadUnit: SpeedUnits.Mbps, uploadUnit: SpeedUnits.Mbps},
    });
}

/**
 * Resolve --server-id against the server list.
 * @returns {Promise<object>} the server object performOoklaTest() wants
 */
export async function findServer(serverId, {log, speedtest} = {}) {
    const st = speedtest || client();
    const servers = await st.listOoklaServers(SERVER_LIST);
    const wanted = String(serverId);
    const server = servers.find((s) => String(s.id) === wanted);
    if (!server) {
        throw new Error(
            `server id ${serverId} is not among the ${servers.length} nearest servers; ` +
                'omit --server-id to let the backend choose, or use --backend cli',
        );
    }
    log?.debug('js server', server.id, server.sponsor, server.name);
    return server;
}

/**
 * One measurement.
 *
 * @param {object} [input]
 * @param {number|string} [input.serverId]
 * @param {number} [input.timeout] seconds
 * @param {object} [input.log]
 */
export async function measure({serverId, timeout = 300, log} = {}) {
    const st = client();
    const server = serverId ? await findServer(serverId, {log, speedtest: st}) : undefined;
    log?.debug('js starting ookla test');

    // the library exposes no cancellation, so a hung run is abandoned rather than aborted; it holds
    // no socket the adapter needs back, and the `running` guard keeps a second run from starting
    let timer;
    const expiry = new Promise((_resolve, reject) => {
        timer = setTimeout(
            () => reject(new Error(`speedtest timed out after ${timeout}s`)),
            Math.max(1, timeout) * 1000,
        );
    });
    try {
        const raw = await Promise.race([st.performOoklaTest(server), expiry]);
        log?.debug('js result', JSON.stringify(raw?.pingResult || {}));
        return fromUniversal(raw);
    } finally {
        clearTimeout(timer);
    }
}
