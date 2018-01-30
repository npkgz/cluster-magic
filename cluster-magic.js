const _cluster = require('cluster');
const _os = require('os');
const _logger = require('logging-facility').getLogger('cluster');
const _workerShutdownTimeout = 10*1000;
const _numDefaultWorkers = _os.cpus().length * 2;

function startWorker(){
    // create a new child process
    // note: this method RELOADS the entire js file/module! - it is NOT a classical process.fork() !
    // this allows you to hot-reload your application by restarting the workers
    return _cluster.fork();
}

// worker gracefull shutdown
function stopWorker(worker, cb){
    // flag
    let cbResolved = false;
    function resolve(err){
        // singleton
        if (cbResolved === false){
            cbResolved = true;
            cb(err);
        }
    }

    // set kill timeout
    const killTimeout = setTimeout(() => {
        // kill the worker
        worker.kill();
         
        // failed to disconnect within given time
        resolve(new Error('process killed by timeout - disconnect() failed'));
    }, _workerShutdownTimeout);

    // trigger disconnect
    worker.disconnect();

    // wait for exit + disconnect
    worker.on('disconnect', () => {
        // disable kill timer
        clearTimeout(killTimeout);

        // ok
        resolve(null);
    });
}

// hot-restart the cluster without downtime (restart workers in a row)
function hotReload(cb){

    // get currently active workers
    const restartList = Object.keys(_cluster.workers);

    // counter of processed workers
    let numRestartedWorkers = restartList.length;

    // restart each worker
    restartList.map((workerID) => {
        // start new child process
        const newWorker = startWorker();

        // remove old worker when the new one is online!
        newWorker.once('listening', () => {

            // get worker by id
            const worker = _cluster.workers[workerID];

            stopWorker(worker, () => {
                // decrement job finish counter
                numRestartedWorkers--;

                // all workers restarted ?
                if (numRestartedWorkers<=0){
                    cb(null, true);
                }
            });
        })
    });
}

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
    _logger.info(`master process ${process.pid} online`);
    _logger.info(`starting ${numWorkers} workers (default=${_numDefaultWorkers})`);

    // gracefull cluster shutdown
    /* eslint no-process-exit: 0 */
    process.on('SIGTERM', () => {
        _logger.info(`graceful shutdown requested by SIGTERM`);
        _cluster.disconnect(() => {
            _logger.info(`workers disconnected`);
            process.exit(0);
        });
    });

    // reload event
    process.on('SIGHUP', () => {
        _logger.info('hot-reloading requested by SIGHUP');

        // reload active ?
        if (reloadInProgress === true){
            _logger.warn('process reload already initialized');
            return;
        }

        // set reload flag
        reloadInProgress = true;

        // trigger reload
        hotReload(() => {
            _logger.info('hot-reloading FINISHED');
            reloadInProgress = false;
        });
    });

    // observer workers (all instances)
    _cluster.on('exit', (worker, code, signal) => {
        // gracefull shutdown/disconnect ?
        if (worker.exitedAfterDisconnect === true) {
            _logger.info(`worker ${worker.process.pid} disconnnected`);
            return;
        }

        // log unexpected behaviour
        _logger.warn(`worker ${worker.process.pid} died - ${code}/${signal} - restarting..`);

        // restart worker
        startWorker()
    });

    // observe worker listening events (networking active)
    _cluster.on('listening', (worker, address) => {
        _logger.info(`worker ${worker.process.pid} is now connected to ${address.address}:${address.port}`);
    });

    // spawn n workers
    for (let i = 0; i<numWorkers ; i++){
        startWorker();
    }
}

module.exports = {
    init: function(application, options={}){
        // is master process ?
        if (_cluster.isMaster){
            initializeCluster(options);

        // new child process startup
        }else{
            application.init();
        }
    }
}
