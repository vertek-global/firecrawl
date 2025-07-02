"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomError = void 0;
class CustomError extends Error {
    statusCode;
    status;
    message;
    dataIngestionJob;
    constructor(statusCode, status, message = "", dataIngestionJob) {
        super(message);
        this.statusCode = statusCode;
        this.status = status;
        this.message = message;
        this.dataIngestionJob = dataIngestionJob;
        Object.setPrototypeOf(this, CustomError.prototype);
    }
}
exports.CustomError = CustomError;
//# sourceMappingURL=custom-error.js.map