import assert from 'node:assert/strict';
import { AppFault, configureLogging, ensure, fault, getLoggingConfig } from './logger';

// Quiet the error logging during the test run.
configureLogging({ level: 'silent' });

// 'continue' policy: fault logs and returns, never throws.
configureLogging({ policy: 'continue' });
assert.equal(getLoggingConfig().policy, 'continue');
assert.doesNotThrow(() => fault('test.continue', { a: 1 }));
assert.doesNotThrow(() => ensure(false, 'test.ensure.continue'));

// 'throw' policy: fault throws an AppFault carrying code + detail.
configureLogging({ policy: 'throw' });
assert.throws(() => fault('test.throw', { reason: 'boom' }), (err: unknown) => {
  assert.ok(err instanceof AppFault);
  assert.equal((err as AppFault).code, 'test.throw');
  assert.deepEqual((err as AppFault).detail, { reason: 'boom' });
  return true;
});
assert.throws(() => ensure(false, 'test.ensure.throw'), AppFault);
// A satisfied assertion never faults.
assert.doesNotThrow(() => ensure(true, 'test.ensure.ok'));

console.log('Logger policy tests passed');
