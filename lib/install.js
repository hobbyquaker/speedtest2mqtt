/**
 * --install / --uninstall: systemd template service speedtest2mqtt@<name> (mqtt-interfaces-core
 * installer). Nothing privileged is needed — outbound HTTP only — so the default hardening and
 * the unprivileged service user stand. `--backend cli` runs another program under that same
 * sandbox, which is why the adapter points the child's HOME at the state directory: ProtectHome
 * hides the real one, and Ookla's CLI wants to write its licence acknowledgement somewhere.
 */

import {createInstaller} from 'mqtt-interfaces-core';

export const SERVICE = 'speedtest2mqtt';
export const ENV_PREFIX = 'SPEEDTEST2MQTT';

const installer = createInstaller({
    service: SERVICE,
    envPrefix: ENV_PREFIX,
    description: `${SERVICE} %i - internet speed tests to MQTT`,
    documentation: 'https://github.com/hobbyquaker/speedtest2mqtt',
});

export const {unitFile, envFile, installService, uninstallService, handle} = installer;
