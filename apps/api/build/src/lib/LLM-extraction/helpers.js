"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.numTokensFromString = numTokensFromString;
const tiktoken_1 = require("@dqbd/tiktoken");
// This function calculates the number of tokens in a text string using GPT-3.5-turbo model
function numTokensFromString(message, model) {
    const encoder = (0, tiktoken_1.encoding_for_model)(model);
    // Encode the message into tokens
    let tokens;
    try {
        tokens = encoder.encode(message);
    }
    catch (error) {
        message = message.replace("<|endoftext|>", "");
        tokens = encoder.encode(message);
    }
    // Free the encoder resources after use
    encoder.free();
    // Return the number of tokens
    return tokens.length;
}
//# sourceMappingURL=helpers.js.map