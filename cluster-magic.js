const _cluster = require('cluster');
const _os = require('os');
const _logger = require('logging-facility').getLogger('cluster');
const _numDefaultWorkers = _os.cpus().length * 2;
const _workerManager = require('./lib/worker-manager');
const _hotReload = require('./lib/hot-reload')

// cluster startup
function initializeCluster(options={}){

    // flag to indicate hot-reloading is active
    let reloadInProgress = false;

    // num workers set via env ?
    let numWorkers = options.numWorkers || parseInt(process.env.NUM_WORKERS + '') || 0;

    // limit worker threads
    if (isNaN(numWorkers) || numWorkers < 2 || numWorkers > 50){
        numWorkers = _numDefaultWorkers;
    }

    // show num workers
    _logger.notice(`master process ${process.pid} online`);
    _logger.notice(`starting ${numWorkers} workers (default=${_numDefaultWorkers})`);

    // initialize restrat delay observer
    _workerManager.initRestartObserver();
 
    // gracefull cluster shutdown
    /* eslint no-process-exit: 0 */
    process.on('SIGTERM', () => {
        _logger.notice(`graceful shutdown requested by SIGTERM`);
        _workerManager.shutdown()
            .then(() => {
                _logger.info(`workers disconnected`);
                process.exit(0);
            });
    });
    process.on('SIGINT', () => {
        _logger.notice(`graceful shutdown requested by SIGINT`);
        _workerManager.shutdown()
            .then(() => {
                _logger.info(`workers disconnected`);
                process.exit(0);
            });
    });

    // reload event
    process.on('SIGHUP', () => {
        _logger.notice('hot-reloading requested by SIGHUP');

        // reload active ?
        if (reloadInProgress === true){
            _logger.warn('process reload already initialized');
            return;
        }

        // set reload flag
        reloadInProgress = true;

        // trigger reload
        _hotReload()
            .then(() => {
                _logger.notice('hot-reloading FINISHED');
                reloadInProgress = false;
            });
    });

    // observer workers (all instances)
    _cluster.on('exit', (worker, code, signal) => {
        // gracefull shutdown/disconnect ?
        if (worker.exitedAfterDisconnect === true) {
            _logger.info(`worker ${worker.process.pid} exited after disconnnect`);
            return;
        }

        // killed by signal ?
        if (signal){
            // log external signals
            _logger.alert(`worker ${worker.process.pid} terminated by signal ${signal} - restarting..`);
        }else{
            // log unexpected behaviour
            _logger.alert(`worker ${worker.process.pid} died - ${code}/${signal} - restarting..`);
        }

        // restart worker - should never throw an error
        _workerManager.start(true)
            .catch(err => {
                _logger.alert(`starting new worker failed`, err);
            });
    });

    // observe worker listening events (networking active)
    _cluster.on('listening', (worker, address) => {
        _logger.info(`worker ${worker.process.pid} is now connected to ${address.address}:${address.port}`);
    });

    // spawn n workers
    return Promise.all(Array(numWorkers).fill(0).map(() => _workerManager.start()));
}

module.exports = {
    init: function(application, options={}){
        // is master process ?
        if (_cluster.isMaster){
            // try to initialize the cluster (async)
            initializeCluster(options)
                .then(() => {
                    _logger.notice('cluster online');
                })
                .catch(err => {
                    _logger.emergency('cannot initialize cluster', err);
                })

        // new child process startup
        }else{
            application.init();
        }
    }
}
