import { Router } from 'express';

import { asyncHandler } from '../../core/utils/async-handler.js';
import { showHealth } from './health.controller.js';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(showHealth));
