cluster-magic
===========================================

run multi-threaded node.js network applications using the native [cluster module](https://nodejs.org/api/cluster.html)

## Features ##

* Run network applications within multiple processes multiplexed by node.js
* Easy to use, configless
* Standalone, no external process managers required
* Respawn dead/failed workers
* Gracefull application shutdown via `sigterm`
* Hot-Reload/Hot-Restart via `sighup`

## Install ##

```bash
$ npm install cluster-magic --save
$ yarn add cluster-magic
```

## Usage ##

**File: application.js**
```js
const net = require('net');

function startup(){
    const server = net.createServer((socket) => {
        // connections never end
    });
    
    server.listen(8000);
}

module.exports = {
    // init hook
    init: startup
};
```

**File: startup.js**
```js
const _cluster = require('cluster-magic');
const _app = require('./application.js');

// start the clustered app (8 workers)
_cluster.init(_app, {
    numWorkers: 8
});
```

## Hot-Restart / Hot-Reload ##

To hot-restart (zero downtime) an application, just send a **SIGHUP** to the master process.
This spawns new workers and disconnects all current workers from the **cluster-proxy**

**Example**

```sh
# send SIGHUP to process 12345
kill -HUP 12345
```

## Signals ##

* **SIGHUP** Restart workers
* **SIGTERM** Gracefull application shutdown

## Environment ##

To specify the number of workers you can easily pass the environment variable `NUM_WORKERS` to the nodejs process. Default is set to `num_cpus*2`


## License ##
cluster-magic is OpenSource and licensed under the Terms of [The MIT License (X11)](http://opensource.org/licenses/MIT) - your're welcome to contribute