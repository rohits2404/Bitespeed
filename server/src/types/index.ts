export interface IdentifyRequest {
    email?: string | null;
    phoneNumber?: string | null;
}

export interface IdentifyResponse {
    contact: {
        primaryContactId: number;
        emails: string[];
        phoneNumbers: string[];
        secondaryContactIds: number[];
    };
}

export interface Contact {
    id: number;
    phoneNumber: string | null;
    email: string | null;
    linkedId: number | null;
    linkPrecedence: 'primary' | 'secondary';
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface ConsolidatedContact {
    primary: Contact;
    secondaries: Contact[];
    emails: Set<string>;
    phoneNumbers: Set<string>;
}

export interface SearchCriteria {
    email?: string | null;
    phoneNumber?: string | null;
}

export interface ContactMatchResult {
    existingContacts: Contact[];
    matchedByEmail: Contact[];
    matchedByPhone: Contact[];
}