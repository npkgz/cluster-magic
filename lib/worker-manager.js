const _cluster = require('cluster');
const _logger = require('logging-facility').getLogger('cluster');
let _restartCounter = 0;
let _workerShutdownTimeout = 10*1000;

// decrement restart counter - 1per minute
function initRestartObserver(){
    setInterval(() => {
        if (_restartCounter > 0){
            _restartCounter--;
        }
    }, 1000*60);
}

// start a new worker
function startWorker(triggeredByError=false){
    return new Promise(function(resolve){
        // default restart delay
        let restartDelay = 0;

        // worker restart because of died process ?
        if (triggeredByError === true){
            // increment restart counter
            _restartCounter++;
        }

        // delayed restart ?
        if (_restartCounter > 10){
            // calculate restart delay (min: 2s)
            restartDelay = 200 * _restartCounter;

            // trigger alert message
            _logger.alert(`delayed worker-restart of ${restartDelay/1000}s - number of failed processes: ${_restartCounter}`);
        }

        // trigger async fork
        setTimeout(() => {
            // create a new child process
            // note: this method RELOADS the entire js file/module! - it is NOT a classical process.fork() !
            // this allows you to hot-reload your application by restarting the workers
            const worker = _cluster.fork();

            // return worker
            resolve(worker);

        }, restartDelay);
    });
}

// worker gracefull shutdown
function stopWorker(worker){
    return new Promise(function(resolve, reject){
        // set kill timeout
        const killTimeout = setTimeout(() => {
            // kill the worker
            worker.kill();
            
            // failed to disconnect within given time
            reject(new Error(`process ${worker.process.pid} killed by timeout of ${_workerShutdownTimeout/1000}s - disconnect() failed`));
        }, _workerShutdownTimeout);

        // wait for exit + disconnect
        worker.on('disconnect', () => {
            _logger.log(`disconnect event ${worker.process.pid}`);
            // disable kill timer
            clearTimeout(killTimeout);

            // ok
            resolve();
        });

        // trigger disconnect
        worker.disconnect();
    });
}

// shutdown all workers
function shutdown(){
    // trigger stop on all workers
    // catch errors thrown by killed workers
    return Promise.all(Object.values(_cluster.workers).map(worker => stopWorker(worker).catch(err => _logger.error(err))));
}

// set the shutdown timeout of a worker process which triggers kill() after disconnect() does not take effect
function setWorkerShutdownTimeout(timeout){
    _workerShutdownTimeout = timeout;
}

module.exports = {
    start: startWorker,
    stop: stopWorker,
    shutdown: shutdown,
    initRestartObserver: initRestartObserver,
    setWorkerShutdownTimeout: setWorkerShutdownTimeout
};