# homebridge-blinds

`homebridge-blinds-cmd2` is a plugin for Homebridge.

Control your `console`-based blinds via Homebridge!

This plugin was also inspired by [homebridge-blinds-cmd](https://github.com/hjdhjd/homebridge-blinds-cmd) written by hjdhjd.

For installation instructions please see the README files of [homebridge-blinds](https://github.com/zwerch/homebridge-blinds/blob/master/README.md) and [homebridge-blinds-cmd](https://github.com/hjdhjd/homebridge-blinds-cmd/blob/master/README.md).

## Configuration

Add the accessory in `config.json` in your home directory inside `.homebridge`.

```js
    {
      "accessory": "BlindsCMD2",
      "name": "Window",
      "up_cmd": "/path/to/script up",
      "down_cmd": "/path/to/script down",
      "stop_cmd": "/path/to/script halt",
      "motion_time": 10000,
      "response_lag": 0,
      "trigger_stop_at_boundaries": false,
      "verbose": false
    }
```

`motion_time` is the time, in milliseconds, for your blinds to move from up to down. This should only include the time the motor is running.

`response_lag` is an optional parameter used to improve the calculation for setting a specific blinds position. It takes into account the delay of the device you are using control the blinds (RF transmitter or otherwise). This is useful since it will do a better job of not under/overshooting the target:

`success_codes` allows you to define which HTTP response codes indicate a successful server response. If omitted, it defaults to 200.

`trigger_stop_at_boundaries` allows you to choose if a stop command should be fired or not when moving the blinds to position 0 or 100.  Most blinds dont require this command and will stop by themself, for such blinds it is advised to set this to `false`.

`verbose` is optional and shows `getTargetPosition` / `getTargetState` / `getCurrentPosition` requests
