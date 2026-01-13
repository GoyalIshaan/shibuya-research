import { NextResponse } from 'next/server';

/**
 * Standardized error response helper
 * @param message - Error message to return
 * @param status - HTTP status code (default: 500)
 */
export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standardized success response helper
 * @param data - Data to include in the response
 * @param status - HTTP status code (default: 200)
 */
export function successResponse(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}
