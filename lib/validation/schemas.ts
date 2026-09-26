import { z } from 'zod';
import { isValidDateStr } from '@/lib/date/nepal';
import {
  ALLOWED_PHOTO_TYPES,
  MAX_BULK_EMPLOYEES,
  MAX_PHOTO_BYTES,
  MAX_REMARK_LENGTH,
} from '@/lib/config';

/**
 * Computer codes are alphanumeric with optional dashes/underscores, e.g. NP12345.
 * Kept deliberately permissive so an existing Excel sheet imports cleanly, but
 * tight enough to reject injection-ish input and stray spreadsheet formatting.
 */
export const computerCodeSchema = z
  .string({ message: 'Computer code is required.' })
  .trim()
  .min(3, 'Computer code must be at least 3 characters.')
  .max(32, 'Computer code must be 32 characters or fewer.')
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Computer code contains invalid characters.')
  .transform((value) => value.toUpperCase());

export const dateStrSchema = z
  .string()
  .refine(isValidDateStr, 'Please provide a valid date in YYYY-MM-DD format.');

export const attendanceStatusSchema = z.enum(['present', 'absent', 'leave'], {
  message: 'Status must be present, absent or leave.',
});

/** Staff may only set the two states they are responsible for. */
export const staffAttendanceStatusSchema = z.enum(['present', 'absent'], {
  message: 'Status must be either present or absent.',
});

export const remarkSchema = z
  .string()
  .trim()
  .max(MAX_REMARK_LENGTH, `Remark must be ${MAX_REMARK_LENGTH} characters or fewer.`)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

/** Employee-facing: the employee id is taken from the session, never the body. */
export const markAttendanceSchema = z.object({
  date: dateStrSchema,
  // Deliberately the staff-only set: leave is assigned by an administrator.
  status: staffAttendanceStatusSchema,
  remark: remarkSchema,
});

export const yearMonthSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const lookupSchema = z.object({
  computerCode: computerCodeSchema,
});

export const exportFormatSchema = z.enum(['xlsx', 'csv', 'pdf']);

export const exportRequestSchema = z
  .object({
    fromMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid start month.'),
    toMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid end month.'),
    format: exportFormatSchema,
  })
  .refine((value) => value.fromMonth <= value.toMonth, {
    message: 'The start month must not be after the end month.',
    path: ['fromMonth'],
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const employeeInputSchema = z.object({
  computer_code: computerCodeSchema,
  full_name: z.string().trim().min(2, 'Full name is required.').max(120),
  rank: optionalText(80),
  department: optionalText(120),
  office: optionalText(120),
  phone: optionalText(40),
  email: z
    .union([z.string().trim().email('Please enter a valid email address.'), z.literal('')])
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  is_active: z.boolean().optional().default(true),
});

export const employeeUpdateSchema = employeeInputSchema.partial().extend({
  computer_code: computerCodeSchema.optional(),
});

/**
 * One change applied to several staff at once, from the staff list.
 *
 * A field that is absent is left alone on every selected person; a field that
 * is present overwrites it. There is deliberately no way to blank a rank or a
 * type in bulk — an empty box means "keep what is there", because that is what
 * an empty box looks like it means, and a bulk wipe is not something anyone
 * should be able to do by leaving a field untouched.
 */
export const employeeBulkUpdateSchema = z
  .object({
    ids: z
      .array(z.string().uuid('Invalid staff reference.'))
      .min(1, 'Select at least one staff member.')
      .max(MAX_BULK_EMPLOYEES, `You can change at most ${MAX_BULK_EMPLOYEES} staff at a time.`)
      // The same id twice is harmless but points at a confused caller, and the
      // "how many were changed" count would not match what was asked for.
      .transform((ids) => Array.from(new Set(ids))),
    rank: z.string().trim().min(1, 'Rank cannot be blank.').max(80).optional(),
    department: z.string().trim().min(1, 'Type of staff cannot be blank.').max(120).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.rank !== undefined || value.department !== undefined || value.is_active !== undefined,
    { message: 'Choose at least one thing to change.', path: ['rank'] },
  );

/** Admin attendance edits carry an explicit employee id — admins may act for anyone. */
export const adminAttendanceSchema = z.object({
  employeeId: z.string().uuid('Invalid employee reference.'),
  date: dateStrSchema,
  status: z.union([attendanceStatusSchema, z.literal('clear')]),
  remark: remarkSchema,
});

export const adminAttendanceQuerySchema = z.object({
  from: dateStrSchema,
  to: dateStrSchema,
  employeeId: z.string().uuid().optional(),
  department: z.string().trim().max(120).optional(),
  status: z.union([attendanceStatusSchema, z.literal('all')]).optional().default('all'),
});

export function validatePhotoFile(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type as (typeof ALLOWED_PHOTO_TYPES)[number])) {
    return 'Please choose a JPG, PNG or WebP image.';
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `Image is too large. Maximum size is ${Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} MB.`;
  }
  if (file.size === 0) {
    return 'The selected file is empty.';
  }
  return null;
}

/** Turns a ZodError into one friendly sentence for a toast. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Please check the information you entered.';
}

/**
 * An administrator changing their own email or password.
 *
 * The current password is always required. The session alone is not enough:
 * if somebody walked up to an unlocked laptop, they must not be able to take
 * the account over by silently changing the login details.
 */
export const adminAccountUpdateSchema = z
  .object({
    currentPassword: z.string().min(1, 'Please enter your current password.'),
    newEmail: z
      .union([z.string().trim().email('Please enter a valid email address.'), z.literal('')])
      .optional()
      .transform((value) => (value ? value.toLowerCase() : undefined)),
    newPassword: z
      .union([
        z
          .string()
          .min(8, 'The new password must be at least 8 characters.')
          .max(72, 'The new password must be 72 characters or fewer.'),
        z.literal(''),
      ])
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .refine((value) => value.newEmail !== undefined || value.newPassword !== undefined, {
    message: 'Enter a new email address or a new password.',
    path: ['newEmail'],
  });

/** Creating or editing a holiday rule. */
export const holidayInputSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the holiday a name.').max(80),
    note: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
    recurrence: z.enum(['once', 'weekly', 'monthly'], {
      message: 'Choose how often this holiday repeats.',
    }),
    weekday: z.coerce.number().int().min(0).max(6).optional().nullable(),
    bsDay: z.coerce.number().int().min(1).max(32).optional().nullable(),
    startDate: dateStrSchema,
    endDate: z.union([dateStrSchema, z.literal('')]).optional().nullable()
      .transform((v) => (v ? v : null)),
    isActive: z.boolean().optional().default(true),
  })
  .refine((v) => v.recurrence !== 'weekly' || v.weekday !== null && v.weekday !== undefined, {
    message: 'Choose which day of the week.',
    path: ['weekday'],
  })
  .refine((v) => v.recurrence !== 'monthly' || v.bsDay !== null && v.bsDay !== undefined, {
    message: 'Choose which day of the Nepali month.',
    path: ['bsDay'],
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: 'The end date must not be before the start date.',
    path: ['endDate'],
  });

/** An administrator assigning leave across a range of days. */
export const assignLeaveSchema = z
  .object({
    fromDate: dateStrSchema,
    toDate: dateStrSchema,
    remark: remarkSchema,
    /** Clears the days instead of setting them, for undoing a mistake. */
    clear: z.boolean().optional().default(false),
  })
  .refine((value) => value.fromDate <= value.toDate, {
    message: 'The start date must not be after the end date.',
    path: ['fromDate'],
  });
