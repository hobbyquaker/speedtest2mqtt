# speedtest2mqtt

[![mqtt-smarthome](https://img.shields.io/badge/mqtt-smarthome-blue.svg)](https://github.com/mqtt-smarthome/mqtt-smarthome)
[![NPM version](https://badge.fury.io/js/speedtest2mqtt.svg)](http://badge.fury.io/js/speedtest2mqtt)
[![Dependency Status](https://img.shields.io/gemnasium/hobbyquaker/speedtest2mqtt.svg?maxAge=2592000)](https://gemnasium.com/github.com/hobbyquaker/speedtest2mqtt)
[![Build Status](https://travis-ci.org/hobbyquaker/speedtest2mqtt.svg?branch=master)](https://travis-ci.org/hobbyquaker/speedtest2mqtt)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![License][mit-badge]][mit-url]

> Run speedtest-cli and publish results via MQTT

### Install

`$ sudo npm install -g speedtest2mqtt`


### Command Line Options

``` 
Usage: speedtest2mqtt [options]

Options:
  -v, --verbosity  possible values: "error", "warn", "info", "debug"
                                                               [default: "info"]
  -n, --name       instance name. used as topic prefix    [default: "speedtest"]
  -k, --insecure   allow ssl connections without valid certificate     [boolean]
  -u, --url        mqtt broker url                 [default: "mqtt://127.0.0.1"]
  -s, --server     speedtest server
  -p, --path       speedtest-cli path        [default: "/usr/bin/speedtest-cli"]
  -h, --help       Show help                                           [boolean]
  --version        Show version number                                 [boolean]

```


### Topics and Payloads:

* `<name>/status/Ping` `{"val":"29.214","ts":1518035980012,"unit":"ms"}`
* `<name>/status/Download` `{"val":"49.51","ts":1518035980012,"unit":"Mbit/s"}`
* `<name>/status/Upload` `{"val":"9.51","ts":1518035980012,"unit":"Mbit/s"}`


## License

MIT © [Sebastian Raff](https://github.com/hobbyquaker)

[mit-badge]: https://img.shields.io/badge/License-MIT-blue.svg?style=flat
[mit-url]: LICENSE
