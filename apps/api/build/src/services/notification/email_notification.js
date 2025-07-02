"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = sendNotification;
exports.sendNotificationWithCustomDays = sendNotificationWithCustomDays;
const supabase_1 = require("../supabase");
const withAuth_1 = require("../../lib/withAuth");
const resend_1 = require("resend");
const types_1 = require("../../types");
const logger_1 = require("../../../src/lib/logger");
const slack_1 = require("../alerts/slack");
const notification_string_1 = require("./notification_string");
const redlock_1 = require("../redlock");
const redis_1 = require("../redis");
const tracking_1 = require("../ledger/tracking");
const emailTemplates = {
    [types_1.NotificationType.APPROACHING_LIMIT]: {
        subject: "You've used 80% of your credit limit - Firecrawl",
        html: "Hey there,<br/><p>You are approaching your credit limit for this billing period. Your usage right now is around 80% of your total credit limit. Consider upgrading your plan to avoid hitting the limit. Check out our <a href='https://firecrawl.dev/pricing'>pricing page</a> for more info.</p><br/>Thanks,<br/>Firecrawl Team<br/>",
    },
    [types_1.NotificationType.LIMIT_REACHED]: {
        subject: "Credit Limit Reached! Take action now to resume usage - Firecrawl",
        html: "Hey there,<br/><p>You have reached your credit limit for this billing period. To resume usage, please upgrade your plan. Check out our <a href='https://firecrawl.dev/pricing'>pricing page</a> for more info.</p><br/>Thanks,<br/>Firecrawl Team<br/>",
    },
    [types_1.NotificationType.RATE_LIMIT_REACHED]: {
        subject: "Rate Limit Reached - Firecrawl",
        html: "Hey there,<br/><p>You've hit one of the Firecrawl endpoint's rate limit! Take a breather and try again in a few moments. If you need higher rate limits, consider upgrading your plan. Check out our <a href='https://firecrawl.dev/pricing'>pricing page</a> for more info.</p><p>If you have any questions, feel free to reach out to us at <a href='mailto:help@firecrawl.com'>help@firecrawl.com</a></p><br/>Thanks,<br/>Firecrawl Team<br/><br/>Ps. this email is only sent once every 7 days if you reach a rate limit.",
    },
    [types_1.NotificationType.AUTO_RECHARGE_SUCCESS]: {
        subject: "Auto recharge successful - Firecrawl",
        html: "Hey there,<br/><p>Your account was successfully recharged with 1000 credits because your remaining credits were below the threshold. Consider upgrading your plan at <a href='https://firecrawl.dev/pricing'>firecrawl.dev/pricing</a> to avoid hitting the limit.</p><br/>Thanks,<br/>Firecrawl Team<br/>",
    },
    [types_1.NotificationType.AUTO_RECHARGE_FAILED]: {
        subject: "Auto recharge failed - Firecrawl",
        html: "Hey there,<br/><p>Your auto recharge failed. Please try again manually. If the issue persists, please reach out to us at <a href='mailto:help@firecrawl.com'>help@firecrawl.com</a></p><br/>Thanks,<br/>Firecrawl Team<br/>",
    },
    [types_1.NotificationType.AUTO_RECHARGE_FREQUENT]: {
        subject: "Consider upgrading your plan - Firecrawl",
        html: "Hey there,<br/><p>We've noticed frequent auto-recharges on your account. To optimize your costs and get better features, we recommend upgrading to a higher tier plan with:</p><ul><li>More included credits</li><li>Better pricing per credit</li><li>Higher rate limits</li></ul><p>View our plans at <a href='https://firecrawl.dev/pricing'>firecrawl.dev/pricing</a>. If none fit your needs, email us at <a href='mailto:help@firecrawl.com'>help@firecrawl.com</a> with 'Scale pricing' in the subject and we'll quickly help you move to a scale plan.</p><br/>Thanks,<br/>Firecrawl Team<br/>",
    },
    [types_1.NotificationType.CONCURRENCY_LIMIT_REACHED]: {
        subject: "You could be scraping faster - Firecrawl",
        html: `Hey there,
    <br/>
    <p>We've improved our system by transitioning to concurrency limits, allowing faster scraping by default and eliminating* the often rate limit errors.</p>
    <p>You're hitting the concurrency limit for your plan quite often, which means Firecrawl can't scrape as fast as it could. But don't worry, it is not failing your requests and you are still getting your results.</p>
    <p>This is just to let you know that you could be scraping faster by having more concurrent browsers. Consider upgrading your plan at <a href='https://firecrawl.dev/pricing'>firecrawl.dev/pricing</a>.</p>
    <p>You can modify your notification settings anytime at <a href='https://www.firecrawl.dev/app/account-settings'>firecrawl.dev/app/account-settings</a>.</p>
    <br/>Thanks,<br/>Firecrawl Team<br/>`,
    },
};
// Map notification types to email categories
const notificationToEmailCategory = {
    [types_1.NotificationType.APPROACHING_LIMIT]: "system_alerts",
    [types_1.NotificationType.LIMIT_REACHED]: "system_alerts",
    [types_1.NotificationType.RATE_LIMIT_REACHED]: "rate_limit_warnings",
    [types_1.NotificationType.AUTO_RECHARGE_SUCCESS]: "system_alerts",
    [types_1.NotificationType.AUTO_RECHARGE_FAILED]: "system_alerts",
    [types_1.NotificationType.CONCURRENCY_LIMIT_REACHED]: "rate_limit_warnings",
    [types_1.NotificationType.AUTO_RECHARGE_FREQUENT]: "system_alerts",
};
async function sendNotification(team_id, notificationType, startDateString, endDateString, chunk, bypassRecentChecks = false, is_ledger_enabled = false) {
    return (0, withAuth_1.withAuth)(sendNotificationInternal, undefined)(team_id, notificationType, startDateString, endDateString, chunk, bypassRecentChecks, is_ledger_enabled);
}
async function sendEmailNotification(email, notificationType) {
    const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
    try {
        // Get user's email preferences
        const { data: user, error: userError } = await supabase_1.supabase_service
            .from("users")
            .select("id")
            .eq("email", email)
            .single();
        if (userError) {
            logger_1.logger.debug(`Error fetching user: ${userError}`);
            return { success: false };
        }
        // Check user's email preferences
        const { data: preferences, error: prefError } = await supabase_1.supabase_service
            .from("notification_preferences")
            .select("unsubscribed_all, email_preferences")
            .eq("user_id", user.id)
            .single();
        if (prefError) {
            logger_1.logger.debug(`Error fetching preferences: ${prefError}`);
            return { success: false };
        }
        // If user has unsubscribed from all emails or we can't find their preferences, don't send
        if (!preferences || preferences.unsubscribed_all) {
            logger_1.logger.debug(`User ${email} has unsubscribed from all emails or preferences not found`);
            return { success: true }; // Return success since this is an expected case
        }
        // Get the email category for this notification type
        const emailCategory = notificationToEmailCategory[notificationType];
        // If user has unsubscribed from this category of emails, don't send
        if (preferences.email_preferences &&
            Array.isArray(preferences.email_preferences) &&
            !preferences.email_preferences.includes(emailCategory)) {
            logger_1.logger.debug(`User ${email} has unsubscribed from ${emailCategory} emails`);
            return { success: true }; // Return success since this is an expected case
        }
        const { error } = await resend.emails.send({
            from: "Firecrawl <firecrawl@getmendableai.com>",
            to: [email],
            reply_to: "help@firecrawl.com",
            subject: emailTemplates[notificationType].subject,
            html: emailTemplates[notificationType].html,
        });
        if (error) {
            logger_1.logger.debug(`Error sending email: ${error}`);
            return { success: false };
        }
        return { success: true };
    }
    catch (error) {
        logger_1.logger.debug(`Error sending email (2): ${error}`);
        return { success: false };
    }
}
async function sendLedgerEvent(team_id, notificationType) {
    if (notificationType === types_1.NotificationType.CONCURRENCY_LIMIT_REACHED) {
        (0, tracking_1.trackEvent)("concurrent-browser-limit-reached", {
            team_id,
        }).catch((error) => {
            logger_1.logger.warn("Error tracking event", { module: "email_notification", method: "sendLedgerEvent", error });
        });
    }
}
async function sendNotificationInternal(team_id, notificationType, startDateString, endDateString, chunk, bypassRecentChecks = false, is_ledger_enabled = false) {
    if (team_id === "preview" || team_id.startsWith("preview_")) {
        return { success: true };
    }
    return await redlock_1.redlock.using([`notification-lock:${team_id}:${notificationType}`], 5000, async () => {
        if (!bypassRecentChecks) {
            const fifteenDaysAgo = new Date();
            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
            const { data, error } = await supabase_1.supabase_service
                .from("user_notifications")
                .select("*")
                .eq("team_id", team_id)
                .eq("notification_type", notificationType)
                .gte("sent_date", fifteenDaysAgo.toISOString());
            if (error) {
                logger_1.logger.debug(`Error fetching notifications: ${error}`);
                return { success: false };
            }
            if (data.length !== 0) {
                return { success: false };
            }
            // TODO: observation: Free credits people are not receiving notifications
            const { data: recentData, error: recentError } = await supabase_1.supabase_service
                .from("user_notifications")
                .select("*")
                .eq("team_id", team_id)
                .eq("notification_type", notificationType)
                .gte("sent_date", startDateString)
                .lte("sent_date", endDateString);
            if (recentError) {
                logger_1.logger.debug(`Error fetching recent notifications: ${recentError.message}`);
                return { success: false };
            }
            if (recentData.length !== 0) {
                return { success: false };
            }
        }
        console.log(`Sending notification for team_id: ${team_id} and notificationType: ${notificationType}`);
        if (is_ledger_enabled) {
            sendLedgerEvent(team_id, notificationType).catch((error) => {
                logger_1.logger.warn("Error sending ledger event", { module: "email_notification", method: "sendEmail", error });
            });
        }
        // get the emails from the user with the team_id
        const { data: emails, error: emailsError } = await supabase_1.supabase_service
            .from("users")
            .select("email")
            .eq("team_id", team_id);
        if (emailsError) {
            logger_1.logger.debug(`Error fetching emails: ${emailsError}`);
            return { success: false };
        }
        if (!is_ledger_enabled) {
            for (const email of emails) {
                await sendEmailNotification(email.email, notificationType);
            }
        }
        const { error: insertError } = await supabase_1.supabase_service
            .from("user_notifications")
            .insert([
            {
                team_id: team_id,
                notification_type: notificationType,
                sent_date: new Date().toISOString(),
                timestamp: new Date().toISOString(),
            },
        ]);
        if (process.env.SLACK_ADMIN_WEBHOOK_URL && emails.length > 0) {
            (0, slack_1.sendSlackWebhook)(`${(0, notification_string_1.getNotificationString)(notificationType)}: Team ${team_id}, with email ${emails[0].email}. Number of credits used: ${chunk.adjusted_credits_used} | Number of credits in the plan: ${chunk.price_credits}`, false, process.env.SLACK_ADMIN_WEBHOOK_URL).catch((error) => {
                logger_1.logger.debug(`Error sending slack notification: ${error}`);
            });
        }
        if (insertError) {
            logger_1.logger.debug(`Error inserting notification record: ${insertError}`);
            return { success: false };
        }
        return { success: true };
    });
}
async function sendNotificationWithCustomDays(team_id, notificationType, daysBetweenEmails, bypassRecentChecks = false, is_ledger_enabled = false) {
    return (0, withAuth_1.withAuth)(async (team_id, notificationType, daysBetweenEmails, bypassRecentChecks, is_ledger_enabled) => {
        const redisKey = "notification_sent:" + notificationType + ":" + team_id;
        const didSendRecentNotification = (await redis_1.redisEvictConnection.get(redisKey)) !== null;
        if (didSendRecentNotification && !bypassRecentChecks) {
            logger_1.logger.debug(`Notification already sent within the last ${daysBetweenEmails} days for team_id: ${team_id} and notificationType: ${notificationType}`);
            return { success: true };
        }
        await redis_1.redisEvictConnection.set(redisKey, "1", "EX", daysBetweenEmails * 24 * 60 * 60);
        const now = new Date();
        const pastDate = new Date(now.getTime() - daysBetweenEmails * 24 * 60 * 60 * 1000);
        const { data: recentNotifications, error: recentNotificationsError } = await supabase_1.supabase_service
            .from("user_notifications")
            .select("*")
            .eq("team_id", team_id)
            .eq("notification_type", notificationType)
            .gte("sent_date", pastDate.toISOString());
        if (recentNotificationsError) {
            logger_1.logger.debug(`Error fetching recent notifications: ${recentNotificationsError}`);
            await redis_1.redisEvictConnection.del(redisKey); // free up redis, let it try again
            return { success: false };
        }
        if (recentNotifications.length > 0 && !bypassRecentChecks) {
            logger_1.logger.debug(`Notification already sent within the last ${daysBetweenEmails} days for team_id: ${team_id} and notificationType: ${notificationType}`);
            await redis_1.redisEvictConnection.set(redisKey, "1", "EX", daysBetweenEmails * 24 * 60 * 60);
            return { success: true };
        }
        logger_1.logger.info(`Sending notification for team_id: ${team_id} and notificationType: ${notificationType}`);
        // get the emails from the user with the team_id
        const { data: emails, error: emailsError } = await supabase_1.supabase_service
            .from("users")
            .select("email")
            .eq("team_id", team_id);
        if (emailsError) {
            logger_1.logger.debug(`Error fetching emails: ${emailsError}`);
            await redis_1.redisEvictConnection.del(redisKey); // free up redis, let it try again
            return { success: false };
        }
        if (is_ledger_enabled) {
            sendLedgerEvent(team_id, notificationType).catch((error) => {
                logger_1.logger.warn("Error sending ledger event", { module: "email_notification", method: "sendEmail", error });
            });
        }
        if (!is_ledger_enabled) {
            for (const email of emails) {
                await sendEmailNotification(email.email, notificationType);
            }
        }
        const { error: insertError } = await supabase_1.supabase_service
            .from("user_notifications")
            .insert([
            {
                team_id: team_id,
                notification_type: notificationType,
                sent_date: new Date().toISOString(),
                timestamp: new Date().toISOString(),
            },
        ]);
        if (process.env.SLACK_ADMIN_WEBHOOK_URL &&
            emails.length > 0 &&
            notificationType !== types_1.NotificationType.CONCURRENCY_LIMIT_REACHED) {
            (0, slack_1.sendSlackWebhook)(`${(0, notification_string_1.getNotificationString)(notificationType)}: Team ${team_id}, with email ${emails[0].email}.`, false, process.env.SLACK_ADMIN_WEBHOOK_URL).catch((error) => {
                logger_1.logger.debug(`Error sending slack notification: ${error}`);
            });
        }
        if (insertError) {
            logger_1.logger.debug(`Error inserting notification record: ${insertError}`);
            await redis_1.redisEvictConnection.del(redisKey); // free up redis, let it try again
            return { success: false };
        }
        return { success: true };
    }, undefined)(team_id, notificationType, daysBetweenEmails, bypassRecentChecks, is_ledger_enabled);
}
//# sourceMappingURL=email_notification.js.map