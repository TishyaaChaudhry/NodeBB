import { EventEmitter } from 'node:events';
import * as nconf from 'nconf';

let real;
let noCluster;
let singleHost;

function get(): any {
    if (real) {
        return real;
    }

    let pubsub;

    if (!nconf.get('isCluster')) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (noCluster) {
            real = noCluster;
            return real;
        }
        noCluster= new EventEmitter();
        noCluster.publish = noCluster.emit.bind(noCluster);
        pubsub = noCluster;
    } else if (nconf.get('singleHostCluster')) {
        if (singleHost) {
            real = singleHost;
            return real;
        }
        singleHost = new EventEmitter();
        if (!process.send) {
            singleHost.publish = singleHost.emit.bind(singleHost);
        } else {
            singleHost.publish = function (event: string, data: any) {
                process.send({
                    action: 'pubsub',
                    event: event,
                    data: data,
                });
            };
            process.on('message', (message:any) => {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (message && typeof message === 'object' && message.action === 'pubsub') {
                    singleHost!.emit(message.event, message.data);
                }
            });
        }
        pubsub = singleHost;
    } else if (nconf.get('redis')) {
        pubsub = require('./database/redis/pubsub');
    } else {
        throw new Error('[[error:redis-required-for-pubsub]]');
    }

    real = pubsub;
    return pubsub;
}

export default {
    publish: function (event: string, data: any) {
        get().publish(event, data);
    },
    on: function (event: string, callback: (data: any) => void) {
        get().on(event, callback);
    },
    removeAllListeners: function (event: string) {
        get().removeAllListeners(event);
    },
    reset: function () {
        real = null;
    },
};
