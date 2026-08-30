import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

import {buildArgs, detect, detectFlavour, installHints, parseJson, parseOutput} from '../lib/cli.js';

// real --version output, captured from the programs themselves
const OOKLA_VERSION = 'Speedtest by Ookla 1.2.0.84 (ea6b6773cf) Linux/x86_64-linux-musl 7.0.6-2-pve x86_64';
const PYTHON_VERSION = '2.1.3';
const LIBRESPEED_VERSION = [
    'librespeed-cli  (built on )',
    'https://github.com/librespeed/speedtest-cli',
    'Licensed under GNU Lesser General Public License v3.0',
    'LibreSpeed\tCopyright (C) 2016-2020 Federico Dossena',
].join('\n');

describe('detectFlavour', () => {
    test('identifies each program by what it prints', () => {
        assert.equal(detectFlavour(OOKLA_VERSION), 'ookla');
        assert.equal(detectFlavour(PYTHON_VERSION), 'speedtest-cli');
        assert.equal(detectFlavour(LIBRESPEED_VERSION), 'librespeed');
    });

    test('librespeed wins over the speedtest-cli in its own banner url', () => {
        // github.com/librespeed/speedtest-cli would otherwise look like the python one
        assert.equal(detectFlavour(LIBRESPEED_VERSION), 'librespeed');
    });

    test('unknown output is not guessed at', () => {
        assert.equal(detectFlavour(''), null);
        assert.equal(detectFlavour('bash: speedtest: command not found'), null);
        assert.equal(detectFlavour(undefined), null);
    });
});

describe('detect', () => {
    const exec = (table) => async (command) => {
        if (!(command in table)) {
            const err = new Error('spawn ENOENT');
            err.code = 'ENOENT';
            return {err, stdout: '', stderr: ''};
        }
        return {err: null, stdout: table[command], stderr: ''};
    };

    test('a `speedtest` that is really the python alias is identified as such', async () => {
        // the trap this exists for: both names exist and both are the python program
        const cli = await detect({exec: exec({speedtest: PYTHON_VERSION, 'speedtest-cli': PYTHON_VERSION})});
        assert.equal(cli.command, 'speedtest');
        assert.equal(cli.flavour, 'speedtest-cli');
        assert.equal(cli.version, '2.1.3');
    });

    test('a real ookla binary under the same name is identified as ookla', async () => {
        const cli = await detect({exec: exec({speedtest: OOKLA_VERSION})});
        assert.equal(cli.flavour, 'ookla');
        assert.equal(cli.version, '1.2.0.84');
    });

    test('falls through to the next candidate when the first is missing', async () => {
        const cli = await detect({exec: exec({'librespeed-cli': LIBRESPEED_VERSION})});
        assert.equal(cli.command, 'librespeed-cli');
        assert.equal(cli.flavour, 'librespeed');
    });

    test('--cli-command probes only that program', async () => {
        await assert.rejects(
            detect({command: 'nope', exec: exec({speedtest: OOKLA_VERSION})}),
            (err) => err.code === 'ENOCLI' && /nope: not found/.test(err.message),
        );
    });

    test('nothing installed gives install hints for each distro family', async () => {
        await assert.rejects(detect({exec: exec({})}), (err) => {
            assert.equal(err.code, 'ENOCLI');
            assert.match(err.message, /apt install speedtest-cli/);
            assert.match(err.message, /pacman -S speedtest-cli/);
            assert.match(err.message, /dnf install speedtest-cli/);
            return true;
        });
    });
});

describe('buildArgs', () => {
    test('each flavour gets its own json flag', () => {
        assert.deepEqual(buildArgs('ookla'), ['--format=json', '--accept-license', '--accept-gdpr']);
        assert.deepEqual(buildArgs('speedtest-cli'), ['--json']);
        assert.deepEqual(buildArgs('librespeed'), ['--json']);
    });

    test('--server-id maps to each flavour’s own option', () => {
        assert.deepEqual(buildArgs('ookla', {serverId: 74184}).slice(-2), ['-s', '74184']);
        assert.deepEqual(buildArgs('speedtest-cli', {serverId: 30945}).slice(-2), ['--server', '30945']);
    });

    test('an unknown flavour throws', () => {
        assert.throws(() => buildArgs('nope'), /unknown speedtest cli flavour/);
    });
});

describe('parseJson', () => {
    test('plain json', () => {
        assert.deepEqual(parseJson('{"a":1}'), {a: 1});
    });

    test('falls back to the last json line when something else printed first', () => {
        assert.deepEqual(parseJson('DeprecationWarning: whatever\n{"a":1}'), {a: 1});
    });

    test('empty and non-json output are reported, not swallowed', () => {
        assert.throws(() => parseJson(''), /produced no output/);
        assert.throws(() => parseJson('total failure'), /did not produce JSON/);
    });
});

describe('parseOutput', () => {
    test('routes to the flavour’s normaliser', () => {
        const r = parseOutput('ookla', JSON.stringify({download: {bandwidth: 1e6}, ping: {latency: 10}}));
        assert.equal(r.download, 8);
        assert.equal(r.ping, 10);
    });
});

describe('installHints', () => {
    test('names the js backend as the no-install way out', () => {
        assert.match(installHints(), /--backend cli/);
    });
});

describe('detect: the short message for a status topic', () => {
    const missing = async () => {
        const err = new Error('spawn ENOENT');
        err.code = 'ENOENT';
        return {err, stdout: '', stderr: ''};
    };

    test('one line, and it names the way out', async () => {
        await assert.rejects(detect({exec: missing}), (err) => {
            assert.doesNotMatch(err.short, /\n/);
            assert.match(err.short, /--backend js/);
            assert.match(err.message, /apt install/); // the full text still has the hints
            return true;
        });
    });

    test('--cli-command names the command that failed', async () => {
        await assert.rejects(detect({command: '/opt/nope', exec: missing}), (err) => {
            assert.equal(err.short, 'speedtest cli "/opt/nope" not found or not recognised');
            return true;
        });
    });
});
