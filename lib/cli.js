/**
 * The external-CLI backend: which speedtest program is installed, how to make it emit JSON, and
 * how to read what it emits.
 *
 * `speedtest` on PATH is not necessarily Ookla's: the Python speedtest-cli installs an alias of
 * that name, and the two take incompatible options (`--format=json --accept-license` vs `--json`).
 * So a candidate is identified by what `--version` prints, never by the name it was found under.
 */

import {execFile} from 'node:child_process';

import {fromLibrespeed, fromOokla, fromSpeedtestCli} from './result.js';

/** Probed in this order; the first one that identifies itself wins. */
export const CANDIDATES = ['speedtest', 'speedtest-cli', 'librespeed-cli'];

export const FLAVOURS = {
    ookla: {
        label: 'Ookla Speedtest CLI',
        // the licence prompts are interactive and would hang a service; HOME is read-only for it
        args: ['--format=json', '--accept-license', '--accept-gdpr'],
        serverArgs: (id) => ['-s', String(id)],
        parse: fromOokla,
    },
    'speedtest-cli': {
        label: 'Python speedtest-cli',
        args: ['--json'],
        serverArgs: (id) => ['--server', String(id)],
        parse: fromSpeedtestCli,
    },
    librespeed: {
        label: 'librespeed-cli',
        args: ['--json'],
        serverArgs: (id) => ['--server', String(id)],
        parse: fromLibrespeed,
    },
};

/**
 * Identify a program from its `--version` output.
 *
 * Ookla prints "Speedtest by Ookla 1.2.0.84 (…) Linux/x86_64…", librespeed-cli prints its project
 * URL and copyright (some builds carry no version at all), and the Python speedtest-cli prints a
 * bare "2.1.3". librespeed is tested before anything else that mentions speedtest-cli, because its
 * banner contains the URL github.com/librespeed/speedtest-cli.
 *
 * @param {string} output combined stdout+stderr of `<command> --version`
 * @returns {'ookla' | 'speedtest-cli' | 'librespeed' | null}
 */
export function detectFlavour(output) {
    const s = String(output || '');
    if (/librespeed/i.test(s)) {
        return 'librespeed';
    }
    if (/ookla/i.test(s)) {
        return 'ookla';
    }
    if (/^\s*v?\d+\.\d+(\.\d+)?\s*$/m.test(s)) {
        return 'speedtest-cli';
    }
    return null;
}

/** The full argument list for one run. */
export function buildArgs(flavour, {serverId} = {}) {
    const spec = FLAVOURS[flavour];
    if (!spec) {
        throw new Error(`unknown speedtest cli flavour "${flavour}"`);
    }
    return [...spec.args, ...(serverId ? spec.serverArgs(serverId) : [])];
}

/**
 * Read a program's stdout as JSON. Ookla emits exactly one object, but a wrapper script or a
 * deprecation notice on stdout would otherwise poison the parse, so the last line that parses
 * on its own is the fallback.
 */
export function parseJson(stdout) {
    const text = String(stdout || '').trim();
    if (!text) {
        throw new Error('the speedtest cli produced no output');
    }
    try {
        return JSON.parse(text);
    } catch {
        const lines = text.split('\n').reverse();
        for (const line of lines) {
            if (!line.trim()) {
                continue;
            }
            try {
                return JSON.parse(line);
            } catch {
                // keep looking
            }
        }
        throw new Error(`the speedtest cli did not produce JSON: ${text.slice(0, 200)}`);
    }
}

/** Raw JSON of a run → the normalised result. */
export function parseOutput(flavour, stdout) {
    const spec = FLAVOURS[flavour];
    if (!spec) {
        throw new Error(`unknown speedtest cli flavour "${flavour}"`);
    }
    return spec.parse(parseJson(stdout));
}

/** What to tell a user who has no speedtest program installed. */
export function installHints() {
    return [
        'no speedtest cli found. install one of:',
        '  Debian/Ubuntu   sudo apt install speedtest-cli        (or: librespeed-cli)',
        '  Arch            sudo pacman -S speedtest-cli',
        '  Fedora/RHEL     sudo dnf install speedtest-cli',
        "  Ookla's own     https://www.speedtest.net/apps/cli    (their repo, most accurate)",
        'or drop --backend cli to use the built-in javascript backend, which needs no install.',
    ].join('\n');
}

const run = (command, args, options) =>
    new Promise((resolve) => {
        execFile(command, args, options, (err, stdout, stderr) =>
            resolve({err, stdout: String(stdout || ''), stderr: String(stderr || '')}),
        );
    });

/**
 * Find a usable speedtest program.
 *
 * @param {object} [input]
 * @param {string} [input.command] probe only this one (from --cli-command)
 * @param {(cmd: string, args: string[], opts: object) => Promise<{err, stdout, stderr}>} [input.exec] for tests
 * @param {object} [input.env] environment for the probe
 * @returns {Promise<{command: string, flavour: string, label: string, version: string}>}
 */
export async function detect({command, exec = run, env} = {}) {
    const candidates = command ? [command] : CANDIDATES;
    const tried = [];
    for (const candidate of candidates) {
        const {err, stdout, stderr} = await exec(candidate, ['--version'], {timeout: 15000, env});
        const output = `${stdout}\n${stderr}`;
        // ENOENT simply means "not installed"; anything else is worth repeating to the user
        if (err && err.code === 'ENOENT') {
            tried.push(`${candidate}: not found`);
            continue;
        }
        const flavour = detectFlavour(output);
        if (!flavour) {
            tried.push(`${candidate}: unrecognised (${output.trim().split('\n')[0] || 'no --version output'})`);
            continue;
        }
        const version = (output.match(/\d+\.\d+(\.\d+)*/) || [])[0] || 'unknown';
        return {command: candidate, flavour, label: FLAVOURS[flavour].label, version};
    }
    const detail = tried.length ? `\ntried: ${tried.join('; ')}` : '';
    const err = new Error(`${installHints()}${detail}`);
    err.code = 'ENOCLI';
    // the full message is several lines of install hints; `short` is what fits in a status topic
    err.short = command
        ? `speedtest cli "${command}" not found or not recognised`
        : 'no speedtest cli found - install one, or use --backend js (see the log for hints)';
    throw err;
}

/**
 * One measurement through the external program.
 *
 * @param {object} input
 * @param {{command: string, flavour: string}} input.cli from detect()
 * @param {number} [input.serverId]
 * @param {number} [input.timeout] seconds
 * @param {string} [input.home] HOME for the child — Ookla writes its licence state there and the
 *        service unit's ProtectHome makes the real one unwritable
 * @param {object} [input.log]
 */
export async function measure({cli, serverId, timeout = 300, home, log} = {}) {
    const args = buildArgs(cli.flavour, {serverId});
    const env = {...process.env, ...(home && {HOME: home})};
    log?.debug('cli >', cli.command, args.join(' '));
    const {err, stdout, stderr} = await run(cli.command, args, {
        timeout: Math.max(1, timeout) * 1000,
        maxBuffer: 4 * 1024 * 1024,
        env,
    });
    if (err) {
        if (err.killed) {
            throw new Error(`${cli.command} timed out after ${timeout}s`);
        }
        const detail = String(stderr || stdout || err.message)
            .trim()
            .split('\n')
            .slice(-3)
            .join(' ');
        throw new Error(`${cli.command} failed: ${detail || err.message}`);
    }
    log?.debug('cli <', stdout.trim().slice(0, 500));
    return parseOutput(cli.flavour, stdout);
}
