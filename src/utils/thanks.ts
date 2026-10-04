import { THANKS_RECIPIENT } from '../config/constants';

/**
 * Builds the "thank you" direct message, shown to the user before it is sent.
 * @param {string} senderName - The user's display name (or handle).
 * @param {Date} now - When it is sent.
 * @returns {string} The message, mentioning its recipient.
 */
export function buildThanksMessage(senderName: string, now: Date): string {
  return `🤗 ${senderName} is sending you a thank you!\nToday at ${now.toLocaleString()}\nCC: ${THANKS_RECIPIENT}`;
}
