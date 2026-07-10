function runSessionMethod(request, method) {
  return new Promise((resolve, reject) => {
    request.session[method]((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function regenerateSession(request) {
  return runSessionMethod(request, 'regenerate');
}

export function saveSession(request) {
  return runSessionMethod(request, 'save');
}

export function destroySession(request) {
  return runSessionMethod(request, 'destroy');
}
