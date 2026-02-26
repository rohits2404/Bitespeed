export const validateIdentifyRequest = (body: any): string | null => {
    if (!body || typeof body !== 'object') {
        return 'Request body must be an object';
    }

    const { email, phoneNumber } = body;

    // Check if at least one field is provided
    if (!email && !phoneNumber) {
        return 'At least one of email or phoneNumber must be provided';
    }

    // Validate email if provided
    if (email !== undefined && email !== null) {
        if (typeof email !== 'string') {
            return 'Email must be a string';
        }
    
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            return 'Invalid email format';
        }
    }

    // Validate phone number if provided
    if (phoneNumber !== undefined && phoneNumber !== null) {
        if (typeof phoneNumber !== 'string') {
            return 'Phone number must be a string';
        }
    
        // Basic phone validation - should be customized based on requirements
        if (phoneNumber && !/^[\d+\-\s()]+$/.test(phoneNumber)) {
            return 'Invalid phone number format';
        }
    }

    return null;
};