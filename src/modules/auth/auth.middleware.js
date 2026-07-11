import { AuthenticationError } from '../../core/errors/app-error.js';
import * as authRepository from './auth.repository.js';

function toSafeUser(user) {
  return {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
  };
}

export async function loadCurrentUser(request, response, next) {
  response.locals.currentUser = null;

  const rawUserId = request.session?.userId;
  if (!rawUserId) {
    next();
    return;
  }

  let userId;
  try {
    userId = BigInt(rawUserId);
  } catch {
    delete request.session.userId;
    next();
    return;
  }

  try {
    const user = await authRepository.findActiveUserById(userId);

    if (!user) {
      delete request.session.userId;
      next();
      return;
    }

    request.context = {
      ...(request.context ?? {}),
      user,
    };
    response.locals.currentUser = toSafeUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuthentication(request, _response, next) {
  if (!request.context?.user) {
    next(new AuthenticationError());
    return;
  }

  next();
}

export function requireGuest(request, response, next) {
  if (request.context?.user) {
    response.redirect(303, '/');
    return;
  }

  next();
}
