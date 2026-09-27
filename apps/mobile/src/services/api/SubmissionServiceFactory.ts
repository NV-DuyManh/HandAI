import { ENV } from '../../config/env';
import { MockSubmissionService } from './MockSubmissionService';
import { SpringSubmissionService } from './SpringSubmissionService';
import { SubmissionService } from '../../types';

export const getSubmissionService = (): SubmissionService => {
  return ENV.USE_MOCK ? MockSubmissionService : SpringSubmissionService;
};
