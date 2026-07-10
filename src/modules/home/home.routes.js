import { Router } from 'express';

import { asyncHandler } from '../../core/utils/async-handler.js';
import { showHome } from './home.controller.js';

export const homeRouter = Router();

homeRouter.get('/', asyncHandler(showHome));
