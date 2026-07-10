export function notFoundHandler(request, response) {
  response.status(404).render('errors/404', {
    pageTitle: 'Página no encontrada',
    requestedPath: request.originalUrl,
  });
}
