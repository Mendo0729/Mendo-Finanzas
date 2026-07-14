function isSensitiveRequest(request) {
  return (
    Boolean(request.context?.user) ||
    request.path.startsWith('/auth') ||
    request.path.startsWith('/security')
  );
}

export function preventSensitiveResponseCaching(request, response, next) {
  if (isSensitiveRequest(request)) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
  }

  next();
}
