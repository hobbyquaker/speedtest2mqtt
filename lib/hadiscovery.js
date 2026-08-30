/**
 * Home Assistant discovery: one device with the four measurements, a Run button and the
 * diagnostics. Pure — measurements in, device block out; the core publishes it.
 *
 * There is no state until the first test has run, and a speedtest is explicitly not periodic, so
 * every sensor gets `stat_cla: measurement` but none of them a device that reports continuously:
 * HA shows "unknown" until someone presses Run, which is the honest picture.
 */

import {discoveryId, entity} from 'mqtt-interfaces-core';

/**
 * @param {object} input
 * @param {string} input.name instance name / topic prefix
 * @param {string} [input.backend] shown as the device model
 * @param {boolean} [input.jsonPayloads]
 * @param {boolean} [input.jitter] the backend measures jitter (the Python speedtest-cli does not)
 */
export function discoveryModel({name, backend, jsonPayloads = true, jitter = true}) {
    const id = discoveryId('speedtest2mqtt', name);
    const e = (item, platform, label, more = {}) => entity({id, name, item, platform, label, jsonPayloads, ...more});
    const rate = (item, label, icon) =>
        e(item, 'sensor', label, {
            icon,
            extra: {dev_cla: 'data_rate', unit_of_meas: 'Mbit/s', stat_cla: 'measurement', sug_dsp_prc: 1},
        });
    const duration = (item, label, icon) =>
        e(item, 'sensor', label, {
            icon,
            extra: {dev_cla: 'duration', unit_of_meas: 'ms', stat_cla: 'measurement', sug_dsp_prc: 1},
        });

    const components = {
        download: rate('download', 'Download', 'mdi:download-network'),
        upload: rate('upload', 'Upload', 'mdi:upload-network'),
        ping: duration('ping', 'Ping', 'mdi:speedometer'),
        run: e('run', 'button', 'Run test', {command: true, icon: 'mdi:play-circle'}),
        running: e('running', 'binary_sensor', 'Running', {
            category: 'diagnostic',
            extra: {
                dev_cla: 'running',
                val_tpl: jsonPayloads
                    ? "{{ 'ON' if value_json.val else 'OFF' }}"
                    : "{{ 'ON' if value == 'true' else 'OFF' }}",
            },
        }),
        server: e('server', 'sensor', 'Server', {category: 'diagnostic', icon: 'mdi:server-network'}),
        isp: e('isp', 'sensor', 'ISP', {category: 'diagnostic', icon: 'mdi:web'}),
        last_run: e('last_run', 'sensor', 'Last run', {
            category: 'diagnostic',
            icon: 'mdi:clock-outline',
            extra: {dev_cla: 'timestamp'},
        }),
        error: e('error', 'sensor', 'Last error', {category: 'diagnostic', icon: 'mdi:alert-circle-outline'}),
    };
    if (jitter) {
        components.jitter = duration('jitter', 'Jitter', 'mdi:sine-wave');
    }

    return {
        device: {mf: 'speedtest2mqtt', ...(backend && {mdl: backend})},
        components,
    };
}
