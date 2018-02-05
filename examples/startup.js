const _cluster = require('../cluster-magic');
const _app = require('./app.js');

// start the clustered app (10 workers)
_cluster.init(_app, {
    numWorkers: 10
});