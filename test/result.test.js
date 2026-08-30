import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describe, test} from 'node:test';

import {fromLibrespeed, fromOokla, fromSpeedtestCli, fromUniversal} from '../lib/result.js';

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

describe('result normalisation', () => {
    test('ookla: bandwidth is bytes/s, so it is scaled by 8', () => {
        const r = fromOokla(fixture('ookla'));
        assert.equal(r.download, 253.2); // 31649880 * 8 / 1e6
        assert.equal(r.upload, 38.18);
        assert.equal(r.ping, 5.69);
        assert.equal(r.jitter, 0.35);
        assert.equal(r.packetLoss, 0);
        assert.equal(r.server, 'Deutsche Telekom, Stuttgart, Germany');
        assert.equal(r.serverId, 74184);
        assert.equal(r.isp, 'Deutsche Telekom AG');
        assert.equal(r.bytesReceived, 129999580);
        assert.match(r.url, /^https:\/\/www\.speedtest\.net\/result\//);
        assert.equal(r.timestamp, '2026-08-30T11:40:28.000Z');
    });

    test('speedtest-cli: bits/s, and it measures no jitter', () => {
        const r = fromSpeedtestCli(fixture('speedtest-cli'));
        assert.equal(r.download, 199.67);
        assert.equal(r.upload, 38.38);
        assert.equal(r.ping, 70.49);
        assert.equal(r.jitter, null);
        assert.equal(r.server, 'MEO, Gaia, Portugal');
        assert.equal(r.serverId, 30945); // a string in the raw json
        assert.equal(r.isp, 'Deutsche Telekom AG');
        assert.equal(r.url, null);
    });

    test('librespeed: an array of one run, already in Mbit/s', () => {
        const r = fromLibrespeed(fixture('librespeed'));
        assert.equal(r.download, 7.7);
        assert.equal(r.upload, 38.22);
        assert.equal(r.jitter, 76.75);
        assert.equal(r.server, 'Frankfurt, Germany (Clouvider)');
        assert.equal(r.isp, 'Example ISP');
        assert.equal(r.serverId, null);
    });

    test('librespeed: an empty array is an error, not a result of nulls', () => {
        assert.throws(() => fromLibrespeed([]), /empty result array/);
    });

    test('universal-speedtest', () => {
        const r = fromUniversal({
            pingResult: {latency: 5.83, jitter: 2.33},
            downloadResult: {speed: 254.6, transferredBytes: 472140912},
            uploadResult: {speed: 37.57, transferredBytes: 68626320},
            bestServer: {id: 4166, sponsor: 'Deutsche Telekom', name: 'Stuttgart', country: 'Germany'},
            client: {isp: 'O2 Deutschland'},
        });
        assert.equal(r.download, 254.6);
        assert.equal(r.upload, 37.57);
        assert.equal(r.jitter, 2.33);
        assert.equal(r.server, 'Deutsche Telekom, Stuttgart, Germany');
        assert.equal(r.isp, 'O2 Deutschland');
        assert.match(r.timestamp, /^\d{4}-\d\d-\d\dT/);
    });

    test('missing numbers become null rather than NaN', () => {
        const r = fromOokla({});
        assert.equal(r.download, null);
        assert.equal(r.ping, null);
        assert.equal(r.server, null);
        assert.equal(r.packetLoss, null);
    });

    test('an unparseable timestamp falls back to now', () => {
        const r = fromSpeedtestCli({timestamp: 'not a date'});
        assert.match(r.timestamp, /^\d{4}-\d\d-\d\dT/);
    });
});
