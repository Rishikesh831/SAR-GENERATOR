/**
 * Standardized API Response Utilities
 * Ensures consistent response format across all endpoints
 */

export const sendResponse = (
  res,
  statusCode = 200,
  data = null,
  message = '',
  success = true,
  error = null
) => {
  res.status(statusCode).json({
    success,
    data,
    message,
    error,
    timestamp: new Date().toISOString(),
  });
};

export const sendError = (
  res,
  statusCode = 500,
  errorMessage = 'Internal Server Error',
  details = null
) => {
  res.status(statusCode).json({
    success: false,
    data: null,
    message: errorMessage,
    error: details || errorMessage,
    timestamp: new Date().toISOString(),
  });
};

export const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  sendResponse(res, statusCode, data, message, true, null);
};

export const sendValidationError = (res, errorDetails) => {
  sendError(res, 400, 'Validation Error', errorDetails);
};

export const sendNotFound = (res, resource = 'Resource') => {
  sendError(res, 404, `${resource} not found`);
};

export const sendUnauthorized = (res, message = 'Unauthorized') => {
  sendError(res, 401, message);
};

export const sendForbidden = (res, message = 'Forbidden') => {
  sendError(res, 403, message);
};
