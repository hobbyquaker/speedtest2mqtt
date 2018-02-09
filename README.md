# speedtest2mqtt

[![mqtt-smarthome](https://img.shields.io/badge/mqtt-smarthome-blue.svg)](https://github.com/mqtt-smarthome/mqtt-smarthome)
[![License][mit-badge]][mit-url]

> Run speedtest-cli and publish results via MQTT

### Install

Prerequisites: needs mosquitto_pub and of cource speedtest-cli. On Debian/Ubuntu do: 
`sudo apt install mosquitto-clients speedtest-cli`

```
cd /usr/local/bin
sudo wget https://raw.githubusercontent.com/hobbyquaker/speedtest2mqtt/master/speedtest2mqtt
sudo chmod a+x speedtest2mqtt
```

If neccessary adjust paths and params.


### Topics and Payloads:

* `<name>/status/Ping` `{"val":"29.214","ts":1518035980012,"unit":"ms"}`
* `<name>/status/Download` `{"val":"49.51","ts":1518035980012,"unit":"Mbit/s"}`
* `<name>/status/Upload` `{"val":"9.51","ts":1518035980012,"unit":"Mbit/s"}`


## License

MIT © [Sebastian Raff](https://github.com/hobbyquaker)

[mit-badge]: https://img.shields.io/badge/License-MIT-blue.svg?style=flat
[mit-url]: LICENSE
