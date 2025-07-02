"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentIntent = createPaymentIntent;
const logger_1 = require("../../lib/logger");
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY ?? "");
async function getCustomerDefaultPaymentMethod(customerId) {
    const paymentMethods = await stripe.customers.listPaymentMethods(customerId, {
        limit: 3,
    });
    return paymentMethods.data[0] ?? null;
}
async function createPaymentIntent(team_id, customer_id) {
    try {
        const defaultPaymentMethod = await getCustomerDefaultPaymentMethod(customer_id);
        if (!defaultPaymentMethod) {
            logger_1.logger.error(`No default payment method found for customer: ${customer_id}`);
            return { return_status: "failed", charge_id: "" };
        }
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1100,
            currency: "usd",
            customer: customer_id,
            description: "Firecrawl: Auto re-charge of 1000 credits",
            payment_method_types: [defaultPaymentMethod?.type ?? "card"],
            payment_method: defaultPaymentMethod?.id,
            off_session: true,
            confirm: true,
        });
        if (paymentIntent.status === "succeeded") {
            logger_1.logger.info(`Payment succeeded for team: ${team_id}`);
            return { return_status: "succeeded", charge_id: paymentIntent.id };
        }
        else if (paymentIntent.status === "requires_action" ||
            paymentIntent.status === "processing" ||
            paymentIntent.status === "requires_capture") {
            logger_1.logger.warn(`Payment requires further action for team: ${team_id}`);
            return { return_status: "requires_action", charge_id: paymentIntent.id };
        }
        else {
            logger_1.logger.error(`Payment failed for team: ${team_id}`);
            return { return_status: "failed", charge_id: paymentIntent.id };
        }
    }
    catch (error) {
        logger_1.logger.error(`Failed to create or confirm PaymentIntent for team: ${team_id}`);
        console.error(error);
        return { return_status: "failed", charge_id: "" };
    }
}
//# sourceMappingURL=stripe.js.map