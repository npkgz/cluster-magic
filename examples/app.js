const http = require('http');

function startup(){
    const server = http.createServer((req, res) => {
        const ip = res.socket.remoteAddress;
        const port = res.socket.remotePort;
        res.end(`Your IP address is ${ip} and your source port is ${port}.`);
    }).listen(8000);
}

module.exports = {
    // init hook
    init: startup
};