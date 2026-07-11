import { AuthenticationError, ConflictError } from '../../core/errors/app-error.js';
import {
  consumePasswordVerificationTime,
  hashPassword,
  verifyPassword,
} from '../../core/security/password.js';
import * as authRepository from './auth.repository.js';

const USER_STATUS_ACTIVE = 1;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export async function registerUser({ name, email, password }) {
  const passwordHash = await hashPassword(password);

  try {
    const user = await authRepository.createUser({ name, email, passwordHash });
    return publicUser(user);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ConflictError('Ya existe una cuenta registrada con ese correo.', {
        code: 'EMAIL_ALREADY_REGISTERED',
        cause: error,
      });
    }

    throw error;
  }
}

export async function authenticateUser({ email, password }) {
  const user = await authRepository.findUserByEmail(email);

  if (!user) {
    await consumePasswordVerificationTime(password);
    throw new AuthenticationError('Correo o contraseña incorrectos.', {
      code: 'INVALID_CREDENTIALS',
    });
  }

  const passwordMatches = await verifyPassword(user.passwordHash, password);

  if (!passwordMatches || user.status !== USER_STATUS_ACTIVE) {
    throw new AuthenticationError('Correo o contraseña incorrectos.', {
      code: 'INVALID_CREDENTIALS',
    });
  }

  const updatedUser = await authRepository.updateLastLogin(user.id);
  return publicUser(updatedUser);
}
