"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoCharge = autoCharge;
const auth_1 = require("../../controllers/auth");
const redlock_1 = require("../redlock");
const supabase_1 = require("../supabase");
const stripe_1 = require("./stripe");
const issue_credits_1 = require("./issue_credits");
const email_notification_1 = require("../notification/email_notification");
const types_1 = require("../../types");
const redis_1 = require("../redis");
const rate_limiter_1 = require("../rate-limiter");
const slack_1 = require("../alerts/slack");
const logger_1 = require("../../lib/logger");
// Define the number of credits to be added during auto-recharge
const AUTO_RECHARGE_CREDITS = 1000;
const AUTO_RECHARGE_COOLDOWN = 600; // 10 minutes in seconds
const MAX_CHARGES_PER_HOUR = 5; // Maximum number of auto-charges per hour
const HOURLY_COUNTER_EXPIRY = 3600; // 1 hour in seconds
/**
 * Attempt to automatically charge a user's account when their credit balance falls below a threshold
 * @param chunk The user's current usage data
 * @param autoRechargeThreshold The credit threshold that triggers auto-recharge
 */
async function autoCharge(chunk, autoRechargeThreshold) {
    const logger = logger_1.logger.child({
        module: "auto_charge",
        method: "autoCharge",
        team_id: chunk.team_id,
        teamId: chunk.team_id,
    });
    const resource = `auto-recharge:${chunk.team_id}`;
    const cooldownKey = `auto-recharge-cooldown:${chunk.team_id}`;
    const hourlyCounterKey = `auto-recharge-hourly:${chunk.team_id}`;
    if (chunk.team_id === "285bb597-6eaf-4b96-801c-51461fc3c543" || chunk.team_id === "dec639a0-98ca-4995-95b5-48ac1ffab5b7") {
        return {
            success: false,
            message: "Auto-recharge failed: blocked team",
            remainingCredits: chunk.remaining_credits,
            chunk,
        };
    }
    try {
        // Check hourly rate limit first without incrementing
        const currentCharges = await rate_limiter_1.redisRateLimitClient.get(hourlyCounterKey);
        const hourlyCharges = currentCharges ? parseInt(currentCharges) : 0;
        if (hourlyCharges >= MAX_CHARGES_PER_HOUR) {
            logger.warn(`Auto-recharge exceeded hourly limit of ${MAX_CHARGES_PER_HOUR}`);
            return {
                success: false,
                message: "Auto-recharge hourly limit exceeded",
                remainingCredits: chunk.remaining_credits,
                chunk,
            };
        }
        // Check cooldown period
        const cooldownValue = await (0, redis_1.getValue)(cooldownKey);
        if (cooldownValue) {
            logger.info(`Auto-recharge is in cooldown period`);
            return {
                success: false,
                message: "Auto-recharge is in cooldown period",
                remainingCredits: chunk.remaining_credits,
                chunk,
            };
        }
        // Use a distributed lock to prevent concurrent auto-charge attempts
        return await redlock_1.redlock.using([resource], 5000, async (signal) => {
            // Recheck all conditions inside the lock to prevent race conditions
            const updatedChunk = await (0, auth_1.getACUC)(chunk.api_key, false, false);
            // Recheck cooldown
            const cooldownValue = await (0, redis_1.getValue)(cooldownKey);
            if (cooldownValue) {
                logger.info(`Auto-recharge is in cooldown period`);
                return {
                    success: false,
                    message: "Auto-recharge is in cooldown period",
                    remainingCredits: chunk.remaining_credits,
                    chunk,
                };
            }
            // Recheck hourly limit inside lock
            const currentCharges = await rate_limiter_1.redisRateLimitClient.get(hourlyCounterKey);
            const hourlyCharges = currentCharges ? parseInt(currentCharges) : 0;
            if (hourlyCharges >= MAX_CHARGES_PER_HOUR) {
                return {
                    success: false,
                    message: "Auto-recharge hourly limit exceeded",
                    remainingCredits: chunk.remaining_credits,
                    chunk,
                };
            }
            if (updatedChunk &&
                updatedChunk.remaining_credits < autoRechargeThreshold) {
                if (chunk.sub_user_id) {
                    // Fetch the customer's Stripe information
                    const { data: customer, error: customersError } = await supabase_1.supabase_rr_service
                        .from("customers")
                        .select("id, stripe_customer_id")
                        .eq("id", chunk.sub_user_id)
                        .single();
                    if (customersError) {
                        logger.error(`Error fetching customer data`, { error: customersError });
                        return {
                            success: false,
                            message: "Error fetching customer data",
                            remainingCredits: chunk.remaining_credits,
                            chunk,
                        };
                    }
                    if (customer && customer.stripe_customer_id) {
                        let issueCreditsSuccess = false;
                        // Set cooldown BEFORE attempting payment
                        await (0, redis_1.setValue)(cooldownKey, "true", AUTO_RECHARGE_COOLDOWN);
                        // Attempt to create a payment intent
                        const paymentStatus = await (0, stripe_1.createPaymentIntent)(chunk.team_id, customer.stripe_customer_id);
                        // If payment is successful or requires further action, issue credits
                        if (paymentStatus.return_status === "succeeded" ||
                            paymentStatus.return_status === "requires_action") {
                            issueCreditsSuccess = await (0, issue_credits_1.issueCredits)(chunk.team_id, AUTO_RECHARGE_CREDITS);
                        }
                        // Record the auto-recharge transaction
                        await supabase_1.supabase_service.from("auto_recharge_transactions").insert({
                            team_id: chunk.team_id,
                            initial_payment_status: paymentStatus.return_status,
                            credits_issued: issueCreditsSuccess ? AUTO_RECHARGE_CREDITS : 0,
                            stripe_charge_id: paymentStatus.charge_id,
                        });
                        // Send a notification if credits were successfully issued
                        if (issueCreditsSuccess) {
                            // Increment hourly counter and set expiry if it doesn't exist
                            await rate_limiter_1.redisRateLimitClient.incr(hourlyCounterKey);
                            await rate_limiter_1.redisRateLimitClient.expire(hourlyCounterKey, HOURLY_COUNTER_EXPIRY, "NX");
                            try {
                                // Check for frequent auto-recharges in the past week
                                const weeklyAutoRechargeKey = `auto-recharge-weekly:${chunk.team_id}`;
                                const weeklyRecharges = await rate_limiter_1.redisRateLimitClient.incr(weeklyAutoRechargeKey);
                                // Set expiry for 7 days if not already set
                                await rate_limiter_1.redisRateLimitClient.expire(weeklyAutoRechargeKey, 7 * 24 * 60 * 60);
                                // If this is the second auto-recharge in a week, send notification
                                if (weeklyRecharges >= 2) {
                                    await (0, email_notification_1.sendNotificationWithCustomDays)(chunk.team_id, types_1.NotificationType.AUTO_RECHARGE_FREQUENT, 7, // Send at most once per week
                                    false);
                                }
                            }
                            catch (error) {
                                logger.error(`Error sending frequent auto-recharge notification`, { error });
                            }
                            await (0, email_notification_1.sendNotification)(chunk.team_id, types_1.NotificationType.AUTO_RECHARGE_SUCCESS, chunk.sub_current_period_start, chunk.sub_current_period_end, chunk, true);
                            // Reset ACUC cache to reflect the new credit balance
                            await (0, auth_1.clearACUC)(chunk.api_key);
                            await (0, auth_1.clearACUCTeam)(chunk.team_id);
                            logger.info(`Auto-recharge successful`, {
                                credits: AUTO_RECHARGE_CREDITS,
                                paymentStatus: paymentStatus.return_status,
                            });
                            if (process.env.SLACK_ADMIN_WEBHOOK_URL) {
                                const webhookCooldownKey = `webhook_cooldown_${chunk.team_id}`;
                                const isInCooldown = await (0, redis_1.getValue)(webhookCooldownKey);
                                if (!isInCooldown) {
                                    (0, slack_1.sendSlackWebhook)(`Auto-recharge: Team ${chunk.team_id}. ${AUTO_RECHARGE_CREDITS} credits added. Payment status: ${paymentStatus.return_status}.`, false, process.env.SLACK_ADMIN_WEBHOOK_URL).catch((error) => {
                                        logger.debug(`Error sending slack notification: ${error}`);
                                    });
                                    // Set cooldown for 1 hour
                                    await (0, redis_1.setValue)(webhookCooldownKey, "true", 60 * 60);
                                }
                            }
                            return {
                                success: true,
                                message: "Auto-recharge successful",
                                remainingCredits: chunk.remaining_credits + AUTO_RECHARGE_CREDITS,
                                chunk: {
                                    ...chunk,
                                    remaining_credits: chunk.remaining_credits + AUTO_RECHARGE_CREDITS,
                                },
                            };
                        }
                        else {
                            logger.error("No Stripe customer ID found for user");
                            return {
                                success: false,
                                message: "No Stripe customer ID found for user",
                                remainingCredits: chunk.remaining_credits,
                                chunk,
                            };
                        }
                    }
                    else {
                        logger.error("No Stripe customer ID found for user");
                        return {
                            success: false,
                            message: "No Stripe customer ID found for user",
                            remainingCredits: chunk.remaining_credits,
                            chunk,
                        };
                    }
                }
                else {
                    logger.error("No sub_user_id found in chunk");
                    return {
                        success: false,
                        message: "No sub_user_id found in chunk",
                        remainingCredits: chunk.remaining_credits,
                        chunk,
                    };
                }
            }
            return {
                success: false,
                message: "No need to auto-recharge",
                remainingCredits: chunk.remaining_credits,
                chunk,
            };
        });
    }
    catch (error) {
        logger.error(`Failed to acquire lock for auto-recharge`, { error });
        return {
            success: false,
            message: "Failed to acquire lock for auto-recharge",
            remainingCredits: chunk.remaining_credits,
            chunk,
        };
    }
}
//# sourceMappingURL=auto_charge.js.map