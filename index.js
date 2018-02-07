#!/usr/bin/env node

const cp = require('child_process');
const log = require('yalm');
const Mqtt = require('mqtt');
const config = require('./config.js');
const pkg = require('./package.json');

process.title = pkg.name;

log.setLevel(config.verbosity);

log.info(pkg.name + ' ' + pkg.version + ' starting');

let mqttConnected;

log.info('mqtt trying to connect', config.url.replace(/:[^@/]+@/, '@'));
const mqtt = Mqtt.connect(config.url, {
    rejectUnauthorized: !config.insecure
});

function mqttPub(topic, payload, options) {
    if (typeof payload !== 'string') {
        payload = JSON.stringify(payload);
    }
    log.debug('mqtt >', topic, payload);
    mqtt.publish(topic, payload, options);
}

mqtt.on('connect', () => {
    log.info('mqtt connected ' + config.url.replace(/:[^@/]+@/, '@'));
    mqttConnected = true;
});

mqtt.on('close', () => {
    if (mqttConnected) {
        mqttConnected = false;
        log.info('mqtt closed ' + config.url.replace(/:[^@/]+@/, '@'));
    }
});

mqtt.on('error', err => {
    log.error('mqtt', err);
});

let cmd = config.path + ' --simple';

if (config.server) {
    cmd += ' --server ' + config.server;
}

log.info('exec', cmd);
cp.exec(cmd, (err, stdout) => {
    if (err) {
        log.error(err);
        process.exit(1);
    } else {
        const ts = (new Date()).getTime();
        const lines = stdout.split('\n');
        lines.forEach(line => {
            const match = line.match(/([a-zA-Z]+): ([0-9.]+) (.*)/);
            if (!match) {
                return;
            }
            const [, key, val, unit] = match;
            const payload = {val, ts, unit};
            if (config.server) {
                payload.server = config.server;
            }
            mqttPub(config.name + '/status/' + key, payload);
        });
        log.info('done');
        setTimeout(() => {
            mqtt.end();
        }, 1000);
    }
});
