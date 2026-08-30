import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

process.env.SPEEDTEST2MQTT_MQTT_URL ||= 'mqtt://test';
const {unitFile, envFile} = await import('../lib/install.js');
const {OPTIONS} = await import('../config.js');
const {SHARED_OPTIONS, configSchema} = await import('mqtt-interfaces-core');
const pkg = (await import('../package.json', {with: {type: 'json'}})).default;

describe('install', () => {
    test('unit uses the shared layout, with no extra privileges', () => {
        const unit = unitFile('/usr/bin/node /usr/local/lib/node_modules/speedtest2mqtt/index.js');
        assert.doesNotMatch(unit, /SupplementaryGroups/);
        assert.match(unit, /^EnvironmentFile=-\/etc\/mqtt-interfaces\/broker\.env$/m);
        assert.match(unit, /^EnvironmentFile=\/etc\/speedtest2mqtt\/%i\.env$/m);
        assert.match(unit, /^Environment=SPEEDTEST2MQTT_NAME=%i$/m);
        assert.match(unit, /^SyslogIdentifier=speedtest2mqtt@%i$/m);
        assert.match(unit, /^Restart=always$/m);
        // the cli backend runs another program, but needs no relaxation of the sandbox for it
        assert.match(unit, /^ProtectHome=/m);
    });

    test('env file carries the adapter options', () => {
        const argv = {name: 'speedtest', backend: 'cli', timeout: 120, serverId: 74184, mqttUrl: 'mqtt://b'};
        Object.defineProperty(argv, '$options', {value: {...OPTIONS, ...SHARED_OPTIONS}});
        const out = envFile(argv);
        assert.match(out, /^SPEEDTEST2MQTT_BACKEND=cli$/m);
        assert.match(out, /^SPEEDTEST2MQTT_TIMEOUT=120$/m);
        assert.match(out, /^SPEEDTEST2MQTT_SERVER_ID=74184$/m);
        assert.doesNotMatch(out, /^SPEEDTEST2MQTT_NAME=/m); // the unit sets it from %i
    });

    test('config schema: defaults, env names, and the broker password is the only secret', () => {
        const schema = configSchema({
            pkg,
            envPrefix: 'SPEEDTEST2MQTT',
            options: OPTIONS,
            defaults: {name: 'speedtest'},
        });
        const props = schema.properties;
        assert.equal(props.backend.default, 'js');
        assert.deepEqual(props.backend.enum, ['js', 'cli']);
        assert.equal(props.timeout.default, 300);
        assert.equal(props['publish-result'].default, false);
        assert.equal(props.backend['x-env'], 'SPEEDTEST2MQTT_BACKEND');
        const secrets = Object.entries(props)
            .filter(([, p]) => p['x-secret'])
            .map(([k]) => k);
        assert.deepEqual(secrets, ['mqtt-password']);
    });

    test('no option demands a value, so an instance runs with just a broker url', () => {
        const schema = configSchema({
            pkg,
            envPrefix: 'SPEEDTEST2MQTT',
            options: OPTIONS,
            defaults: {name: 'speedtest'},
        });
        assert.deepEqual(schema.required || [], []);
    });
});
