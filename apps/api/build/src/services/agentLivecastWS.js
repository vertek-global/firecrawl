"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachWsProxy = attachWsProxy;
const dotenv_1 = require("dotenv");
const logger_1 = require("../lib/logger");
(0, dotenv_1.configDotenv)();
/**
 * Attaches WebSocket proxying logic to the Express application
 * This function should be called after creating the Express app but before starting the server
 */
function attachWsProxy(app) {
    logger_1.logger.info('Attaching WebSocket proxy to Express app');
    // Make sure express-ws is properly initialized
    if (!app.ws) {
        logger_1.logger.error('Express app does not have WebSocket support. Make sure express-ws is properly initialized.');
        return;
    }
    // Define the WebSocket route
    app.ws('/agent-livecast', (clientWs, req) => {
        try {
            console.log(req.url);
            const url = new URL(req.url ?? '', 'http://placeholder/');
            const sessionIdParam = url.searchParams.get('userProvidedId') || '';
            const workerWsUrl = `${process.env.FIRE_ENGINE_BETA_URL?.replace('http', 'ws')}?userProvidedId=${sessionIdParam}`;
            console.log(workerWsUrl);
            const wsWorker = new WebSocket(workerWsUrl);
            wsWorker.onopen = () => {
                // clientWs is your user's browser socket
                // wsWorker is the worker's socket
                // Forward messages from the user -> worker
                clientWs.on('message', (dataFromClient) => {
                    wsWorker.send(dataFromClient);
                });
                // Forward messages from the worker -> user
                wsWorker.onmessage = (event) => {
                    clientWs.send(event.data);
                };
                // Close events
                clientWs.on('close', () => wsWorker.close());
                wsWorker.onclose = () => clientWs.close();
            };
        }
        catch (error) {
            console.error('Error in wsProxy upgrade:', error);
            clientWs.close();
        }
    });
    logger_1.logger.info('WebSocket proxy successfully attached to Express app');
}
//# sourceMappingURL=agentLivecastWS.js.map