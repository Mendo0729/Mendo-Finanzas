export function asyncHandler(handler) {
  return function wrappedAsyncHandler(request, response, next) {
    return Promise.resolve(handler(request, response, next)).catch(next);
  };
}
