import { describe, it, expect } from 'vitest';
import { buildThanksMessage } from './thanks';

describe('buildThanksMessage', () => {
  it('names the sender and mentions the app author', () => {
    const message = buildThanksMessage('Alice', new Date('2030-01-01T12:00:00Z'));
    expect(message.startsWith('🤗 Alice is sending you a thank you!')).toBe(true);
    expect(message.endsWith('CC: @dams@disabled.social')).toBe(true);
  });

  it('neutralizes "@" in the sender name so it cannot mention anyone else', () => {
    const message = buildThanksMessage('Alice @bob@evil.example', new Date());
    expect(message.startsWith('🤗 Alice bob evil.example is sending you a thank you!')).toBe(true);
    expect(message.match(/@/g)).toHaveLength(2); // only the recipient's handle
  });

  it('has no trailing spaces, so the preview shows exactly what is sent', () => {
    expect(buildThanksMessage('Alice', new Date())).not.toMatch(/ \n/);
  });
});
