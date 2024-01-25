import { EventEmitter } from 'events';
import nconf from 'nconf';

interface CustomEventEmitter extends EventEmitter {
    publish(event: string, data: object): void;
}

let real: CustomEventEmitter | null;
let noCluster: CustomEventEmitter | undefined;
let singleHost: CustomEventEmitter | undefined;

function get(): CustomEventEmitter {
    if (real) {
        return real;
    }

    let pubsub: CustomEventEmitter;

    if (!nconf.get('isCluster')) {
        if (noCluster) {
            real = noCluster;
            return real;
        }
        noCluster = new EventEmitter() as CustomEventEmitter;
        // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        noCluster.publish = noCluster.emit.bind(noCluster);
        pubsub = noCluster;
    } else if (nconf.get('singleHostCluster')) {
        if (singleHost) {
            real = singleHost;
            return real;
        }
        singleHost = new EventEmitter() as CustomEventEmitter;
        if (!process.send) {
            singleHost.publish = singleHost.emit.bind(singleHost);
        } else {
            singleHost.publish = function (event: string, data: object) {
                process.send({
                    action: 'pubsub',
                    event,
                    data,
                });
            };
            process.on('message', (message: object) => {
                if (message && typeof message === 'object' && (message as any).action === 'pubsub') {
                    const pubsubMessage = message as { action: string, event: string, data: any };
                    singleHost.emit(pubsubMessage.event, pubsubMessage.data);
                }
            });
        }
        pubsub = singleHost;
    } else if (nconf.get('redis')) {
        // Assuming this is a valid import path for your Redis module
        /* eslint-disable */
        pubsub = require('./database/redis/pubsub') as CustomEventEmitter;
    } else {
        throw new Error('[[error:redis-required-for-pubsub]]');
    }

    real = pubsub;
    return pubsub;
}

export default {
    publish: function (event: string, data: object) {
        get().publish(event, data);
    },
    on: function (event: string, callback: (...args: any[]) => void) {
        get().on(event, callback);
    },
    removeAllListeners: function (event: string) {
        get().removeAllListeners(event);
    },
    reset: function () {
        real = null;
    },
};
