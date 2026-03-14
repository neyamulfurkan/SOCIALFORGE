'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = {
  label?: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors',
            error && 'border-error focus:border-error focus:ring-error/20',
            className,
          )}
          {...rest}
        />
        {error ? (
          <p className="text-xs text-error">{error}</p>
        ) : hint ? (
          <p className="text-xs text-text-secondary">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

export type TextareaProps = {
  label?: string;
  error?: string;
  hint?: string;
  rows?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, rows = 4, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(
            'w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors resize-none',
            error && 'border-error focus:border-error focus:ring-error/20',
            className,
          )}
          {...rest}
        />
        {error ? (
          <p className="text-xs text-error">{error}</p>
        ) : hint ? (
          <p className="text-xs text-text-secondary">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

export { Input, Textarea };
export default Input;