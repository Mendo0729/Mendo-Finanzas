function mapIssues(error) {
  const fieldErrors = {};

  for (const issue of error?.issues ?? []) {
    const field = Array.isArray(issue.path) ? issue.path[0] : null;
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

export function validateAuthForm({ schema, view, pageTitle }) {
  return function authFormValidation(request, response, next) {
    try {
      request.validated = {
        ...(request.validated ?? {}),
        body: schema.parse(request.body),
      };
      next();
    } catch (error) {
      if (!Array.isArray(error?.issues)) {
        next(error);
        return;
      }

      response.status(400).render(view, {
        pageTitle,
        values: {
          name: typeof request.body?.name === 'string' ? request.body.name : '',
          email: typeof request.body?.email === 'string' ? request.body.email : '',
        },
        fieldErrors: mapIssues(error),
        formError: null,
      });
    }
  };
}
