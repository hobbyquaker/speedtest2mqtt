import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

import {discoveryModel} from '../lib/hadiscovery.js';

describe('discoveryModel', () => {
    test('measurements, a run button and the diagnostics', () => {
        const {device, components} = discoveryModel({name: 'speedtest', backend: 'universal-speedtest'});
        assert.equal(device.mdl, 'universal-speedtest');

        assert.equal(components.download.p, 'sensor');
        assert.equal(components.download.stat_t, 'speedtest/status/download');
        assert.equal(components.download.uniq_id, 'speedtest2mqtt_speedtest_download');
        assert.equal(components.download.dev_cla, 'data_rate');
        assert.equal(components.download.unit_of_meas, 'Mbit/s');
        assert.equal(components.ping.unit_of_meas, 'ms');
        assert.equal(components.ping.dev_cla, 'duration');

        // the only command, and a button carries no state topic
        assert.equal(components.run.p, 'button');
        assert.equal(components.run.cmd_t, 'speedtest/set/run');
        assert.equal(components.run.stat_t, undefined);

        assert.equal(components.running.p, 'binary_sensor');
        assert.equal(components.running.dev_cla, 'running');
        assert.equal(components.last_run.dev_cla, 'timestamp');
        assert.equal(components.server.ent_cat, 'diagnostic');
    });

    test('no jitter sensor for a backend that does not measure jitter', () => {
        const withJitter = discoveryModel({name: 'speedtest'});
        const without = discoveryModel({name: 'speedtest', jitter: false});
        assert.equal(withJitter.components.jitter.unit_of_meas, 'ms');
        assert.equal(without.components.jitter, undefined);
        assert.equal(without.components.ping.unit_of_meas, 'ms'); // the rest is unchanged
    });

    test('--no-json-payloads changes the templates', () => {
        const json = discoveryModel({name: 'speedtest'});
        const plain = discoveryModel({name: 'speedtest', jsonPayloads: false});
        assert.equal(json.components.download.val_tpl, '{{ value_json.val }}');
        assert.equal(plain.components.download.val_tpl, undefined);
        assert.match(json.components.running.val_tpl, /value_json\.val/);
        assert.match(plain.components.running.val_tpl, /value == 'true'/);
    });

    test('the instance name drives the id and every topic', () => {
        const {components} = discoveryModel({name: 'dsl'});
        assert.equal(components.upload.uniq_id, 'speedtest2mqtt_dsl_upload');
        assert.equal(components.upload.stat_t, 'dsl/status/upload');
        assert.equal(components.run.cmd_t, 'dsl/set/run');
    });
});
