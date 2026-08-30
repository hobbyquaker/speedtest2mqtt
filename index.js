#!/usr/bin/env node

/**
 * speedtest2mqtt — internet speed tests <-> MQTT, mqtt-smarthome convention, on
 * mqtt-interfaces-core.
 *
 * A test runs when, and only when, someone asks for one on `<name>/set/run`. There is no interval
 * option on purpose: a speedtest saturates the line for half a minute and skews every other
 * measurement taken while it runs, so when it happens is a scheduling decision that belongs to
 * whoever owns the network — a cron job, a Home Assistant automation, mqttpc — not to this
 * adapter's default configuration.
 */

import {createAdapter} from 'mqtt-interfaces-core';

import config from './config.js';
import pkg from './package.json' with {type: 'json'};
import * as cliBackend from './lib/cli.js';
import {discoveryModel} from './lib/hadiscovery.js';
import {handle as handleInstall} from './lib/install.js';
import * as jsBackend from './lib/js.js';
import {ITEMS} from './lib/result.js';

handleInstall(config); // --install / --uninstall never reach the rest

/** the resolved external program for --backend cli; null until detected, and if none was found */
let cli = null;
/** why there is no usable cli, so every rejected run can say the same thing */
let cliError = null;
/** a speedtest saturates the line: one at a time, or the numbers are meaningless */
let running = false;

const adapter = createAdapter({
    pkg,
    config,
    deviceLabel: 'speedtest',
    info: () => ({
        backend: config.backend,
        ...(cli && {cli: {command: cli.command, flavour: cli.flavour, version: cli.version}}),
        ...(config.serverId && {serverId: config.serverId}),
        timeout: config.timeout,
    }),
    discovery: () =>
        discoveryModel({
            name: config.name,
            jsonPayloads: config.jsonPayloads,
            backend: cli ? cli.label : 'universal-speedtest',
            // the Python speedtest-cli reports no jitter, so it gets no jitter sensor
            jitter: !(cli && cli.flavour === 'speedtest-cli'),
        }),
    onSet: handleSet,
});
const {log, pubStatus} = adapter;

/*
 * backend
 */

if (config.backend === 'cli') {
    try {
        cli = await cliBackend.detect({command: config.cliCommand, env: childEnv()});
        log.info('cli using', cli.label, cli.version, `(${cli.command})`);
    } catch (err) {
        cliError = err.short || err.message;
        // not fatal: the instance stays visible and starts working the moment a cli is installed,
        // where exiting would only make the unit restart in a loop
        log.error(err.message);
    }
}

/** Ookla's cli writes its licence acknowledgement into HOME, which ProtectHome makes unwritable. */
function childEnv() {
    return config.stateDir ? {...process.env, HOME: config.stateDir} : process.env;
}

async function measure() {
    if (config.backend === 'cli') {
        if (!cli) {
            // try again — a cli installed after the adapter started should just start working
            cli = await cliBackend.detect({command: config.cliCommand, env: childEnv()});
            cliError = null;
            log.info('cli using', cli.label, cli.version, `(${cli.command})`);
            adapter.markDiscoveryDirty();
            adapter.publishDiscovery();
            adapter.publishInfo();
        }
        return cliBackend.measure({
            cli,
            serverId: config.serverId,
            timeout: config.timeout,
            home: config.stateDir,
            log,
        });
    }
    return jsBackend.measure({serverId: config.serverId, timeout: config.timeout, log});
}

/*
 * running a test
 */

function publishResult(result) {
    for (const item of ITEMS) {
        const value = item === 'last_run' ? result.timestamp : result[item];
        if (value !== null && value !== undefined) {
            pubStatus(item, value);
        }
    }
    if (config.publishResult) {
        pubStatus('result', result);
    }
}

async function runTest(trigger) {
    if (running) {
        log.warn('speedtest already running, ignoring', trigger);
        return;
    }
    running = true;
    pubStatus('running', true);
    const started = Date.now();
    log.info('speedtest started by', trigger, `(${config.backend} backend)`);
    try {
        const result = await measure();
        publishResult(result);
        pubStatus('error', '');
        log.info(
            'speedtest done in',
            ((Date.now() - started) / 1000).toFixed(1) + 's:',
            `${result.download} Mbit/s down,`,
            `${result.upload} Mbit/s up,`,
            `${result.ping} ms ping`,
            result.server ? `via ${result.server}` : '',
        );
    } catch (err) {
        log.warn('speedtest failed -', err.message);
        pubStatus('error', err.message);
    } finally {
        running = false;
        pubStatus('running', false);
    }
}

/*
 * commands
 */

async function handleSet(parts, value, topic) {
    if (parts.length === 1 && parts[0] === 'run') {
        if (config.backend === 'cli' && !cli && cliError) {
            throw new Error(cliError);
        }
        // deliberately not awaited: a test takes ~30 s and the set handler should not block the
        // mqtt loop for it; progress and outcome are published on status/running and status/error
        runTest('mqtt');
        return;
    }
    throw new Error(`unknown item ${parts.join('/')} (${topic}) - the only command is set/run`);
}

/*
 * start
 */

adapter.start();
adapter.setDeviceConnected(config.backend !== 'cli' || Boolean(cli));
pubStatus('running', false);
if (cliError) {
    pubStatus('error', cliError);
}
log.info('ready - publish anything to', `${config.name}/set/run`, 'to start a test');
