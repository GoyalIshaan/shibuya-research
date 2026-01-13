/**
 * Validation utilities for API routes
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate that a field exists and is not null/undefined
 */
export function validateRequired(field: unknown, name: string): void {
  if (field === null || field === undefined) {
    throw new ValidationError(`Missing ${name}`);
  }
}

/**
 * Validate that a field is a string
 */
export function validateString(field: unknown, name: string): void {
  if (typeof field !== 'string') {
    throw new ValidationError(`${name} must be a string`);
  }
}

/**
 * Validate that a string is not empty
 */
export function validateNonEmpty(field: unknown, name: string): void {
  validateString(field, name);
  if ((field as string).trim().length === 0) {
    throw new ValidationError(`${name} must be a non-empty string`);
  }
}

/**
 * Validate that a field is a number
 */
export function validateNumber(field: unknown, name: string): void {
  if (typeof field !== 'number' || Number.isNaN(field)) {
    throw new ValidationError(`${name} must be a valid number`);
  }
}

/**
 * Validate that a number is within a range
 */
export function validateRange(
  field: number,
  name: string,
  min: number,
  max: number
): void {
  if (field < min || field > max) {
    throw new ValidationError(`${name} must be between ${min} and ${max}`);
  }
}
