import {parseConfig} from 'mqtt-interfaces-core';

import pkg from './package.json' with {type: 'json'};

export const OPTIONS = {
    backend: {
        alias: 'b',
        type: 'string',
        describe: 'how to measure: js (built in, no install) or cli (an installed speedtest program)',
        choices: ['js', 'cli'],
        default: 'js',
    },
    'cli-command': {
        type: 'string',
        describe: 'speedtest program for --backend cli (default: probe speedtest, speedtest-cli, librespeed-cli)',
    },
    'server-id': {
        alias: 's',
        type: 'number',
        describe: 'pin the test to this speedtest server id (default: the backend picks the nearest)',
    },
    timeout: {
        alias: 't',
        type: 'number',
        describe: 'seconds a single test may take before it is given up on',
        default: 300,
    },
    'publish-result': {
        type: 'boolean',
        describe: 'additionally publish the full result (bytes, packet loss, result url) on <name>/status/result',
        default: false,
    },
    'state-dir': {
        type: 'string',
        describe: 'directory used as HOME for --backend cli (default: $STATE_DIRECTORY)',
        default: process.env.STATE_DIRECTORY,
    },
};

export default parseConfig({
    pkg,
    options: OPTIONS,
    defaults: {name: 'speedtest'},
    examples: [
        ['$0 -u mqtt://broker', 'run in the foreground; test on speedtest/set/run'],
        ['$0 -u mqtt://broker -b cli', 'measure with an installed speedtest program'],
        ['sudo $0 --install -n speedtest -u mqtt://broker', 'install as service speedtest2mqtt@speedtest'],
    ],
});
