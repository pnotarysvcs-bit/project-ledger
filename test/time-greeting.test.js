import test from 'node:test';
import assert from 'node:assert/strict';

import { greetingForCentralTime, hourInCentralTime } from '../src/time-greeting.js';

test('Central Time hour is used instead of the server timezone', () => {
  assert.equal(hourInCentralTime(new Date('2026-08-04T15:18:00Z')), 10);
});

test('morning, afternoon, and evening greetings follow Central Time', () => {
  assert.equal(greetingForCentralTime(new Date('2026-08-04T15:18:00Z')), 'Good morning');
  assert.equal(greetingForCentralTime(new Date('2026-08-04T19:00:00Z')), 'Good afternoon');
  assert.equal(greetingForCentralTime(new Date('2026-08-05T01:00:00Z')), 'Good evening');
});
