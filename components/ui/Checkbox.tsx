'use client';

import { useEffect, useRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Read out by screen readers. The box carries no visible text of its own, so
   * without this a column of them is just "checkbox, checkbox, checkbox".
   */
  label: string;
  /** Some, but not all, of the rows this box covers are ticked. */
  indeterminate?: boolean;
}

/**
 * A plain tick box with a target you can actually hit.
 *
 * The wrapper is a `<label>`, not a `<span>`: a label passes its clicks to the
 * input it contains, so the whole padded square toggles the box. With a plain
 * `<span>` only the 16px box itself responds, and every near-miss — which on a
 * phone is most taps — silently does nothing, which reads as the tick box
 * being broken.
 */
export function Checkbox({ label, indeterminate = false, className = '', ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property with no matching HTML attribute, so it
  // cannot be set through JSX — it has to be written onto the node.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      className={`inline-flex cursor-pointer items-center justify-center p-3 ${
        props.disabled ? 'cursor-not-allowed' : ''
      }`}
    >
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        className={`h-4 w-4 cursor-[inherit] rounded border-slate-300 accent-navy-800 disabled:opacity-50 ${className}`}
        {...props}
      />
    </label>
  );
}
