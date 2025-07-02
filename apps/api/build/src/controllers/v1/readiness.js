"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readinessController = readinessController;
async function readinessController(req, res) {
    // TODO: add checks when the application is ready to serve traffic
    res.status(200).json({ status: "ok" });
}
//# sourceMappingURL=readiness.js.map