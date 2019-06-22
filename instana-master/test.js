'use strict';

require('@instana/collector')({
    agentPort: process.env.AGENT_PORT,
    level: 'warn',
    tracing: {
        forceTransmissionStartingAt: 1
    }
});

const hooked = require('@instana/core/src/tracing/clsHooked');
const instrumentBluebird = require('cls-bluebird');

const ns = hooked.createNamespace('custom');

instrumentBluebird(ns, null /* Bluebird Promise not provided */);