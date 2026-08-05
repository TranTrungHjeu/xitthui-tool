/**
 * Slack notifier for operational alerts.
 *
 * Sends messages to a Slack channel via an Incoming Webhook when
 * critical conditions are detected (e.g. scheduler failure spikes).
 *
 * Env vars:
 *   SLACK_WEBHOOK_URL — Incoming Webhook URL from api.slack.com/messaging/webhooks
 *                       If not set, all notifySlack calls become no-ops (safe to call).
 */

const { httpClient } = require("../utils/httpClient");
const { childLogger } = require("./logger.js");

const log = childLogger("SlackNotifier");

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

/**
 * Send a message to Slack.
 * Silently succeeds if SLACK_WEBHOOK_URL is not configured.
 *
 * @param {string} text - The message text (supports basic Slack formatting).
 * @param {Object} [extra] - Optional Slack Block Kit payload overrides.
 * @returns {Promise<boolean>} - true if sent successfully, false otherwise.
 */
async function notifySlack(text, extra = {}) {
  if (!WEBHOOK_URL) {
    return false;
  }

  try {
    const payload = {
      text,
      ...extra,
    };

    await httpClient.post(WEBHOOK_URL, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000, // 5s — don't block schedulers on Slack being slow
    });

    return true;
  } catch (err) {
    log.warn(
      { err: err.message, webhookConfigured: !!WEBHOOK_URL },
      "[SlackNotifier] Failed to send Slack notification: %s",
      err.message,
    );
    return false;
  }
}

/**
 * Send an alert formatted as a structured Slack Block Kit message.
 *
 * @param {string} severity - "warning" | "error" | "info"
 * @param {string} title - Short alert title
 * @param {string} description - Longer description
 * @param {Object} [fields] - Key-value pairs to show in a table
 * @returns {Promise<boolean>}
 */
async function notifyAlert(severity, title, description, fields = {}) {
  const emoji = {
    warning: ":warning:",
    error: ":rotating_light:",
    info: ":information_source:",
  }[severity] || ":bell:";

  const color = {
    warning: "#FFA500",
    error: "#FF0000",
    info: "#36A64F",
  }[severity] || "#36A64F";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${title}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: description,
      },
    },
  ];

  if (Object.keys(fields).length > 0) {
    const fieldEntries = Object.entries(fields).slice(0, 10); // Max 10 fields
    blocks.push({
      type: "section",
      fields: fieldEntries.map(([key, value]) => ({
        type: "mrkdwn",
        text: `*${key}*\n${value}`,
      })),
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Sent from *mindx-support-tools* at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}> :hourglass: *(Vietnam time)*`,
      },
    ],
  });

  return notifySlack(`${emoji} ${title}`, {
    attachments: [
      {
        color,
        blocks,
      },
    ],
  });
}

module.exports = {
  notifySlack,
  notifyAlert,
};
