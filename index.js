let request = require('request');
let exec = require('child_process').exec;
let Service, Characteristic, HomebridgeAPI;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;
    homebridge.registerAccessory(
        'homebridge-blinds-cmd2',
        'BlindsCMD2',
        BlindsCMD2Accessory
    );
};

function BlindsCMD2Accessory(log, config) {
    // global vars
    this.log = log;
    if (!config) {
        this.log.info('No configuration found for homebridge-blinds');
        return;
    }

    // configuration vars
    this.name = config.name;
    this.upCMD = config.up_cmd || false;
    this.downCMD = config.down_cmd || false;
    this.stopCMD = config.stop_cmd || false;
    this.stopAtBoundaries = config.trigger_stop_at_boundaries || false;
    this.motionTime = parseInt(config.motion_time, 10) || 10000;
    this.responseLag = parseInt(config.response_lag, 10) || 0;
    this.verbose = config.verbose || false;

    this.cacheDirectory = HomebridgeAPI.user.persistPath();
    this.storage = require('node-persist');
    this.storage.initSync({
        dir: this.cacheDirectory,
        forgiveParseErrors: true
    });

    // state vars
    this.stopTimeout = null;
    this.lagTimeout = null;
    this.stepInterval = null;
    this.lastPosition = this.storage.getItemSync(this.name) || 0; // last known position of the blinds, down by default
    this.currentTargetPosition = this.lastPosition;

    // register the service and provide the functions
    this.service = new Service.WindowCovering(this.name);

    // the current position (0-100%)
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L493
    this.service
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentPosition.bind(this));

    // the target position (0-100%)
    // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1564
    this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

    this.service
        .getCharacteristic(Characteristic.PositionState)
        .updateValue(Characteristic.PositionState.STOPPED);
}

BlindsCMD2Accessory.prototype.getCurrentPosition = function(callback) {
    if (this.verbose) {
        this.log(`Requested CurrentPosition: ${this.lastPosition}%`);
    }
    callback(null, this.lastPosition);
};

BlindsCMD2Accessory.prototype.getTargetPosition = function(callback) {
    if (this.verbose) {
        this.log(`Requested TargetPosition: ${this.currentTargetPosition}%`);
    }
    callback(null, this.currentTargetPosition);
};

BlindsCMD2Accessory.prototype.setTargetPosition = function(pos, callback) {
    if (this.lagTimeout != null) clearTimeout(this.lagTimeout);
    if (this.stopTimeout != null) clearTimeout(this.stopTimeout);
    if (this.stepInterval != null) clearInterval(this.stepInterval);

    this.currentTargetPosition = pos;
    if (this.currentTargetPosition == this.lastPosition) {
        if (this.currentTargetPosition % 100 > 0) {
            this.log(`Already there: ${this.currentTargetPosition}%`);
            callback(null);
            return;
        } else {
            this.log(
                `Already there: ${this.currentTargetPosition}%, re-sending request`
            );
        }
    }

    const moveUp =
        this.currentTargetPosition > this.lastPosition ||
        this.currentTargetPosition == 1;
    const moveMessage = `Move ${moveUp ? 'up' : 'down'}`;
    this.log(`Requested ${moveMessage} (to ${this.currentTargetPosition}%)`);

    let self = this;

    const startTimestamp = Date.now();
    this.cmdRequest((moveUp ? this.upCMD : this.downCMD), function(err, stdout, stderr) {
        if (err) {
            callback(null);
            return;
        }

        this.storage.setItemSync(this.name, this.currentTargetPosition);
        const motionTimeStep = this.motionTime / 100;
        const waitDelay = Math.abs(this.currentTargetPosition - this.lastPosition) * motionTimeStep;

        this.log(
            `Move request sent (${Date.now() - startTimestamp} ms), waiting ${Math.round(waitDelay / 100) / 10}s (+ ${Math.round(this.responseLag / 100) / 10}s response lag)...`
        );

        // Send stop command before target position is reached to account for response_lag
        if (this.stopAtBoundaries || this.currentTargetPosition % 100 > 0) {
            this.stopTimeout = setTimeout(function() {
                self.cmdRequest(self.stopCMD, function(err) {
                    if (err) {
                        self.log.warn('Stop request failed');
                    } else {
                        self.log('Stop request sent');
                    }
                }.bind(self));
            }, Math.max(waitDelay, 0));
        }

        // Delay for response lag, then track movement of blinds
        this.lagTimeout = setTimeout(function() {
            if (self.verbose) {
                self.log('Timeout finished');
            }
            self.stepInterval = setInterval(function() {
                if (self.lastPosition == self.currentTargetPosition) {
                    self.log(
                        `End ${moveMessage} (to ${self.currentTargetPosition}%)`
                    );
                    self.service
                        .getCharacteristic(Characteristic.CurrentPosition)
                        .updateValue(self.lastPosition);
                    self.service
                        .getCharacteristic(Characteristic.PositionState)
                        .updateValue(Characteristic.PositionState.STOPPED);
                    clearInterval(self.stepInterval);
                } else {
                    self.lastPosition += moveUp ? 1 : -1;
                }
            }, motionTimeStep);
        }, Math.max(this.responseLag, 0));
    }.bind(this));

    callback(null);
};

BlindsCMD2Accessory.prototype.cmdRequest = function(cmd, callback) {
	if (!cmd)
	{
		callback(null);
	} else {
		exec(cmd, function(error, stdout, stderr) {
			callback(error, stdout, stderr)
		});
	}
};

BlindsCMD2Accessory.prototype.getServices = function() {
    return [this.service];
};
