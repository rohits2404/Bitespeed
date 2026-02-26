import type { Request, Response } from 'express';
import { IdentityService } from '../services/identity.service';
import type { IdentifyRequest } from '../types';
import { logger } from '../utils/logger';
import { validateIdentifyRequest } from '../utils/validation';

export class IdentifyController {
    private identityService: IdentityService;

    constructor() {
        this.identityService = new IdentityService();
    }

    identify = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
    
        try {
            // Validate request body
            const validationError = validateIdentifyRequest(req.body);
            if (validationError) {
                res.status(400).json({
                    error: 'Bad Request',
                    message: validationError,
                });
                return;
            }

            const request: IdentifyRequest = {
                email: req.body.email,
                phoneNumber: req.body.phoneNumber,
            };

            logger.info("Processing identify request");

            const response = await this.identityService.identify(request);

            const processingTime = Date.now() - startTime;
            logger.info('Identify request completed:', { 
                processingTime,
                primaryContactId: response.contact.primaryContactId 
            });

            res.status(200).json(response);
        } catch (error) {
            logger.error('Error in identify controller:', error);
            
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred',
            });
        }
    };
}