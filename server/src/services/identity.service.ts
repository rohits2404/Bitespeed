import { type Contact, LinkPrecedence } from "../generated/prisma/client";
import { ContactRepository } from "../repositories/contact.repository";
import type { IdentifyRequest, IdentifyResponse } from "../types";
import { logger } from "../utils/logger";

export class IdentityService {

    private repo: ContactRepository;

    constructor() {
        this.repo = new ContactRepository();
    }

    async identify(request: IdentifyRequest): Promise<IdentifyResponse> {
        try {
            const { email, phoneNumber } = request;

            // Find contacts matching email or phone
            const matches = await this.repo.findMatchingContacts(
                email,
                phoneNumber
            );

            /**
             * CASE 1
             * No existing contact → create primary
             */
            if (!matches.length) {
                logger.info("Creating new primary contact");

                const primary = await this.repo.createPrimary(
                    email,
                    phoneNumber
                );

                return this.buildResponse(primary, []);
            }

            /**
             * Find oldest contact
             */
            const [oldest] = matches.sort(
                (a, b) =>
                a.createdAt.getTime() - b.createdAt.getTime()
            );

            if (!oldest) {
                throw new Error("Unable to determine identity root");
            }

            /**
             * Determine primary identity id
             */
            const primaryId = oldest.linkPrecedence === LinkPrecedence.primary ? oldest.id : oldest.linkedId!;

            /**
             * Fetch full identity cluster
             */
            const cluster = await this.repo.findIdentityCluster(primaryId);

            const primary = cluster.find(
                c => c.linkPrecedence === LinkPrecedence.primary
            );

            if (!primary) {
                throw new Error("Primary contact not found");
            }

            /**
             * Merge accidental multiple primaries
             */
            const extraPrimaries = cluster.filter(c =>
                c.linkPrecedence === LinkPrecedence.primary &&
                c.id !== primary.id
            );

            for (const contact of extraPrimaries) {
                await this.repo.convertToSecondary(
                    contact.id,
                    primary.id
                );
            }

            /**
             * Check if new information exists
             */
            const emailExists = email ? cluster.some(c => c.email === email) : true;

            const phoneExists = phoneNumber ? cluster.some(c => c.phoneNumber === phoneNumber) : true;

            let updatedCluster = [...cluster];

            /**
             * Create secondary if new info introduced
             */
            if (!emailExists || !phoneExists) {
                logger.info("Creating secondary contact");

                const secondary = await this.repo.createSecondary(
                    primary.id,
                    email,
                    phoneNumber
                );

                updatedCluster.push(secondary);
            }

            const secondaries = updatedCluster.filter(
                c => c.linkPrecedence === LinkPrecedence.secondary
            );

            return this.buildResponse(primary, secondaries);

        } catch (error) {
            logger.error("Identity resolution failed", error);
            throw error;
        }
    }

    /**
     * Build API response
     */
    private buildResponse(
        primary: Contact,
        secondaries: Contact[]
    ): IdentifyResponse {

        const emails = new Set<string>();
        const phoneNumbers = new Set<string>();
        const secondaryContactIds: number[] = [];

        if (primary.email) emails.add(primary.email);
        if (primary.phoneNumber) phoneNumbers.add(primary.phoneNumber);

        for (const secondary of secondaries) {
            if (secondary.email)
                emails.add(secondary.email);

            if (secondary.phoneNumber)
                phoneNumbers.add(secondary.phoneNumber);

            secondaryContactIds.push(secondary.id);
        }

        return {
            contact: {
                primaryContactId: primary.id,
                emails: [...emails],
                phoneNumbers: [...phoneNumbers],
                secondaryContactIds,
            },
        };
    }
}