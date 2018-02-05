const _cluster = require('cluster');
const _worker = require('./worker-manager');
const _logger = require('logging-facility').getLogger('cluster');

// hot-restart the cluster without downtime (restart workers in a row)
module.exports = function hotReload(){

    // get currently active workers
    const restartList = Object.keys(_cluster.workers);

    // restart each worker
    return Promise.all(restartList.map(async workerID => {
        // start new child process
        const newWorker = await _worker.start();

        // remove old worker when the new one is online!
        newWorker.once('listening', () => {

            // get worker by id
            const worker = _cluster.workers[workerID];

            // handle disconnect timeouts -> worker killed and throws an error
            _worker.stop(worker)
                .catch(err => {
                    _logger.error(err);
                });
        });
    }));
}
