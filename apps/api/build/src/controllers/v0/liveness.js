"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.livenessController = livenessController;
async function livenessController(req, res) {
    //TODO: add checks if the application is live and healthy like checking the redis connection
    res.status(200).json({ status: "ok" });
}
//# sourceMappingURL=liveness.js.map