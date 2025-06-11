import { NextResponse } from 'next/server';

/**
 * Utility functions for API routes to handle common operations and error handling
 */

/**
 * Handles API errors consistently across all routes
 * @param error The error that occurred
 * @param defaultMessage Default error message to return if error doesn't have a message
 * @param status HTTP status code to return
 * @returns NextResponse with appropriate error format
 */
export const handleApiError = (
  error: unknown,
  defaultMessage: string = 'Error interno del servidor',
  status: number = 500
): NextResponse => {
  console.error(`API Error: ${defaultMessage}`, error);

  // If error has a message property, use it
  const errorMessage = error instanceof Error
    ? error.message
    : defaultMessage;

  return NextResponse.json({ error: errorMessage }, { status });
};

/**
 * Validates and parses an ID parameter from a string to a number
 * @param idParam ID parameter as string
 * @returns Object with parsed ID or error response
 */
export const validateIdParam = (idParam: string): { id?: number; errorResponse?: NextResponse } => {
  const id = parseInt(idParam);

  if (isNaN(id)) {
    return {
      errorResponse: NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      )
    };
  }

  return { id };
};

/**
 * Creates a success response with the provided data
 * @param data Data to include in the response
 * @param status HTTP status code (defaults to 200)
 * @returns NextResponse with the data
 */
export const createSuccessResponse = (data: unknown, status: number = 200): NextResponse => {
  return NextResponse.json(data, { status });
};
