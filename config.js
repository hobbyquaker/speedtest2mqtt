module.exports = require('yargs')
    .usage('Usage: $0 [options]')
    .describe('v', 'possible values: "error", "warn", "info", "debug"')
    .describe('n', 'instance name. used as topic prefix')
    .describe('k', 'allow ssl connections without valid certificate')
    .describe('u', 'mqtt broker url')
    .describe('s', 'speedtest server')
    .describe('p', 'speedtest-cli path')
    .describe('h', 'show help')
    .alias({
        h: 'help',
        n: 'name',
        u: 'url',
        k: 'insecure',
        v: 'verbosity',
        s: 'server',
        p: 'path'
    })
    .default({
        u: 'mqtt://127.0.0.1',
        n: 'speedtest',
        v: 'info',
        p: '/usr/bin/speedtest-cli'
    })
    .boolean('k')
    .version()
    .help('help')
    .argv;
