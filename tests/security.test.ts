import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

// The token module reads this at call time; set it before importing anything
// that touches it.
process.env.EMPLOYEE_SESSION_SECRET = 'test-secret-value-that-is-long-enough-32';

describe('employee session tokens', () => {
  let createSessionToken: typeof import('@/lib/auth/session-token').createSessionToken;
  let verifySessionToken: typeof import('@/lib/auth/session-token').verifySessionToken;

  before(async () => {
    ({ createSessionToken, verifySessionToken } = await import('@/lib/auth/session-token'));
  });

  it('round-trips a valid session', async () => {
    const token = await createSessionToken({ sub: 'employee-uuid', code: 'NP12345' });
    const session = await verifySessionToken(token);

    assert.ok(session);
    assert.equal(session.sub, 'employee-uuid');
    assert.equal(session.code, 'NP12345');
    assert.ok(session.exp * 1000 > Date.now());
  });

  it('rejects a token whose payload has been edited', async () => {
    const token = await createSessionToken({ sub: 'employee-a', code: 'NP00001' });
    const [, signature] = token.split('.');

    // Forge a payload naming a different employee, keeping the old signature.
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'employee-b', code: 'NP99999', exp: Math.floor(Date.now() / 1000) + 600 }),
    )
      .toString('base64url');

    assert.equal(await verifySessionToken(`${forgedPayload}.${signature}`), null);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken({ sub: 'employee-a', code: 'NP00001' });

    process.env.EMPLOYEE_SESSION_SECRET = 'a-completely-different-secret-value-32ch';
    const result = await verifySessionToken(token);
    process.env.EMPLOYEE_SESSION_SECRET = 'test-secret-value-that-is-long-enough-32';

    assert.equal(result, null);
  });

  it('rejects an expired token', async () => {
    const token = await createSessionToken({ sub: 'employee-a', code: 'NP00001' }, -10);
    assert.equal(await verifySessionToken(token), null);
  });

  it('rejects malformed and missing tokens', async () => {
    assert.equal(await verifySessionToken(undefined), null);
    assert.equal(await verifySessionToken(''), null);
    assert.equal(await verifySessionToken('garbage'), null);
    assert.equal(await verifySessionToken('a.b.c'), null);
  });

  it('refuses to sign with a weak secret', async () => {
    const previous = process.env.EMPLOYEE_SESSION_SECRET;
    process.env.EMPLOYEE_SESSION_SECRET = 'short';
    await assert.rejects(() => createSessionToken({ sub: 'x', code: 'Y' }), /at least 32/);
    process.env.EMPLOYEE_SESSION_SECRET = previous;
  });
});

describe('input validation', () => {
  it('normalises computer codes to upper case and trims them', async () => {
    const { computerCodeSchema } = await import('@/lib/validation/schemas');
    assert.equal(computerCodeSchema.parse('  np12345  '), 'NP12345');
  });

  it('rejects codes that are too short, too long or contain odd characters', async () => {
    const { computerCodeSchema } = await import('@/lib/validation/schemas');
    for (const bad of ['ab', 'x'.repeat(33), 'NP 123', "NP';drop table", '<script>']) {
      assert.ok(!computerCodeSchema.safeParse(bad).success, `expected ${bad} to be rejected`);
    }
  });

  it('only accepts present or absent as a status', async () => {
    const { markAttendanceSchema } = await import('@/lib/validation/schemas');
    assert.ok(markAttendanceSchema.safeParse({ date: '2026-09-25', status: 'present' }).success);
    assert.ok(!markAttendanceSchema.safeParse({ date: '2026-09-25', status: 'maybe' }).success);
    assert.ok(!markAttendanceSchema.safeParse({ date: '2026-09-31', status: 'present' }).success);
  });

  it('caps remark length and treats blank remarks as null', async () => {
    const { markAttendanceSchema } = await import('@/lib/validation/schemas');

    const blank = markAttendanceSchema.parse({
      date: '2026-09-25',
      status: 'absent',
      remark: '   ',
    });
    assert.equal(blank.remark, null);

    assert.ok(
      !markAttendanceSchema.safeParse({
        date: '2026-09-25',
        status: 'absent',
        remark: 'x'.repeat(301),
      }).success,
    );
  });

  it('rejects photo files that are too large or the wrong type', async () => {
    const { validatePhotoFile } = await import('@/lib/validation/schemas');

    const executable = new File([new Uint8Array([1, 2, 3])], 'virus.exe', {
      type: 'application/x-msdownload',
    });
    assert.match(validatePhotoFile(executable) ?? '', /JPG, PNG or WebP/);

    const huge = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    assert.match(validatePhotoFile(huge) ?? '', /too large/);

    const good = new File([new Uint8Array(1024)], 'ok.png', { type: 'image/png' });
    assert.equal(validatePhotoFile(good), null);
  });

  it('refuses an export range that runs backwards', async () => {
    const { exportRequestSchema } = await import('@/lib/validation/schemas');
    assert.ok(
      exportRequestSchema.safeParse({ fromMonth: '2026-01', toMonth: '2026-09', format: 'xlsx' })
        .success,
    );
    assert.ok(
      !exportRequestSchema.safeParse({ fromMonth: '2026-09', toMonth: '2026-01', format: 'xlsx' })
        .success,
    );
  });
});
