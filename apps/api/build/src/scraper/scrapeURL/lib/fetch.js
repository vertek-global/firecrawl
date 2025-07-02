"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.robustFetch = robustFetch;
const zod_1 = require("zod");
const Sentry = __importStar(require("@sentry/node"));
const mock_1 = require("./mock");
const types_1 = require("../../../controllers/v1/types");
const scrape_1 = require("../engines/fire-engine/scrape");
const undici_1 = require("undici");
const cacheableLookup_1 = require("./cacheableLookup");
async function robustFetch({ url, logger, method = "GET", body, headers, schema, ignoreResponse = false, ignoreFailure = false, requestId = crypto.randomUUID(), tryCount = 1, tryCooldown, mock, abort, }) {
    abort?.throwIfAborted();
    const params = {
        url,
        logger,
        method,
        body,
        headers,
        schema,
        ignoreResponse,
        ignoreFailure,
        tryCount,
        tryCooldown,
        abort,
    };
    // omit pdf file content from logs
    const logParams = {
        ...params,
        body: body?.input ? {
            ...body,
            input: {
                ...body.input,
                file_content: undefined,
            },
        } : body,
        logger: undefined,
    };
    let response;
    if (mock === null) {
        let request;
        try {
            request = await (0, undici_1.fetch)(url, {
                method,
                headers: {
                    ...(body instanceof undici_1.FormData
                        ? {}
                        : body !== undefined
                            ? {
                                "Content-Type": "application/json",
                            }
                            : {}),
                    ...(headers !== undefined ? headers : {}),
                },
                signal: abort,
                dispatcher: new undici_1.Agent({
                    headersTimeout: 0,
                    bodyTimeout: 0,
                    connect: {
                        lookup: cacheableLookup_1.cacheableLookup.lookup,
                    },
                }),
                ...(body instanceof undici_1.FormData
                    ? {
                        body,
                    }
                    : body !== undefined
                        ? {
                            body: JSON.stringify(body),
                        }
                        : {}),
            });
        }
        catch (error) {
            if (error instanceof types_1.TimeoutSignal) {
                throw error;
            }
            else if (!ignoreFailure) {
                Sentry.captureException(error);
                if (tryCount > 1) {
                    logger.debug("Request failed, trying " + (tryCount - 1) + " more times", { params: logParams, error, requestId });
                    return await robustFetch({
                        ...params,
                        requestId,
                        tryCount: tryCount - 1,
                        mock,
                    });
                }
                else {
                    logger.debug("Request failed", { params: logParams, error, requestId });
                    throw new Error("Request failed", {
                        cause: {
                            params,
                            requestId,
                            error,
                        },
                    });
                }
            }
            else {
                return null;
            }
        }
        if (ignoreResponse === true) {
            return null;
        }
        const resp = await request.text();
        response = {
            status: request.status,
            headers: request.headers,
            body: resp, // NOTE: can this throw an exception?
        };
    }
    else {
        if (ignoreResponse === true) {
            return null;
        }
        const makeRequestTypeId = (request) => {
            let trueUrl = request.url.startsWith(scrape_1.fireEngineURL)
                ? request.url.replace(scrape_1.fireEngineURL, "<fire-engine>")
                : request.url;
            let out = trueUrl + ";" + request.method;
            if (trueUrl.startsWith("<fire-engine>") &&
                request.method === "POST") {
                out += "f-e;" + request.body?.engine + ";" + request.body?.url;
            }
            return out;
        };
        const thisId = makeRequestTypeId(params);
        const matchingMocks = mock.requests
            .filter((x) => makeRequestTypeId(x.options) === thisId)
            .sort((a, b) => a.time - b.time);
        const nextI = mock.tracker[thisId] ?? 0;
        mock.tracker[thisId] = nextI + 1;
        if (!matchingMocks[nextI]) {
            throw new Error("Failed to mock request -- no mock targets found.");
        }
        response = {
            ...matchingMocks[nextI].result,
            headers: new Headers(matchingMocks[nextI].result.headers),
        };
    }
    if (response.status >= 300) {
        if (tryCount > 1) {
            logger.debug("Request sent failure status, trying " + (tryCount - 1) + " more times", { params: logParams, response: { status: response.status, body: response.body }, requestId });
            if (tryCooldown !== undefined) {
                await new Promise((resolve) => setTimeout(() => resolve(null), tryCooldown));
            }
            return await robustFetch({
                ...params,
                requestId,
                tryCount: tryCount - 1,
                mock,
            });
        }
        else {
            logger.debug("Request sent failure status", {
                params: logParams,
                response: { status: response.status, body: response.body },
                requestId,
            });
            throw new Error("Request sent failure status", {
                cause: {
                    params: logParams,
                    response: { status: response.status, body: response.body },
                    requestId,
                },
            });
        }
    }
    if (mock === null) {
        await (0, mock_1.saveMock)({
            ...params,
            logger: undefined,
            schema: undefined,
            headers: undefined,
        }, response);
    }
    let data;
    try {
        data = JSON.parse(response.body);
    }
    catch (error) {
        logger.debug("Request sent malformed JSON", {
            params: logParams,
            response: { status: response.status, body: response.body },
            requestId,
        });
        throw new Error("Request sent malformed JSON", {
            cause: {
                params: logParams,
                response,
                requestId,
            },
        });
    }
    if (schema) {
        try {
            data = schema.parse(data);
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                logger.debug("Response does not match provided schema", {
                    params: logParams,
                    response: { status: response.status, body: response.body },
                    requestId,
                    error,
                    schema,
                });
                throw new Error("Response does not match provided schema", {
                    cause: {
                        params: logParams,
                        response,
                        requestId,
                        error,
                        schema,
                    },
                });
            }
            else {
                logger.debug("Parsing response with provided schema failed", {
                    params: logParams,
                    response: { status: response.status, body: response.body },
                    requestId,
                    error,
                    schema,
                });
                throw new Error("Parsing response with provided schema failed", {
                    cause: {
                        params: logParams,
                        response,
                        requestId,
                        error,
                        schema,
                    },
                });
            }
        }
    }
    return data;
}
//# sourceMappingURL=fetch.js.map