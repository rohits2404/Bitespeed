import { prisma } from "../db";
import { type Contact, LinkPrecedence } from "../generated/prisma/client";
import { ContactRepository } from "../repositories/contact.repository";
import type { IdentifyRequest, IdentifyResponse } from "../types";
import { logger } from "../utils/logger";

export class IdentityService {

    private repo = new ContactRepository();

    async identify(
        request: IdentifyRequest
    ): Promise<IdentifyResponse> {

        const { email, phoneNumber } = request;

        return prisma.$transaction(async () => {

        /**
         * STEP 1
         * Find direct matches
         */
        const matches = await this.repo.findMatchingContacts(
            email,
            phoneNumber
        );

        /**
         * CASE 1 — Completely new user
         */
        if (!matches.length) {
            const primary = await this.repo.createPrimary(
                email,
                phoneNumber
            );

            return this.buildResponse(primary, []);
        }

        /**
         * STEP 2
         * Collect ALL related identity roots
         */
        const rootIds = new Set<number>();

        for (const contact of matches) {
            if (contact.linkPrecedence === "primary") {
                rootIds.add(contact.id);
            }

            if (contact.linkedId) {
                rootIds.add(contact.linkedId);
            }
        }

        /**
         * STEP 3
         * Fetch FULL identity cluster
         */
        const cluster =
            await this.repo.findClusterByPrimaryIds([
                ...rootIds,
            ]);

        /**
         * STEP 4
         * Oldest contact becomes TRUE primary
         */
        const sortedCluster = cluster.sort((a, b) =>
            a.createdAt.getTime() -
            b.createdAt.getTime()
        );

        const primary = sortedCluster[0];

        if (!primary) {
            throw new Error("Primary contact could not be determined");
        }

        /**
         * STEP 5
         * Convert extra primaries → secondary
         */
        const extraPrimaries = cluster.filter(
            c =>
            c.linkPrecedence ===
                LinkPrecedence.primary &&
            c.id !== primary.id
        );

        for (const contact of extraPrimaries) {
            await this.repo.convertToSecondary(
                contact.id,
                primary.id
            );
        }

        /**
         * STEP 6
         * Refresh cluster after merge
         */
        const updatedCluster =await this.repo.findClusterByPrimaryIds([
            primary.id,
        ]);

        /**
         * STEP 7
         * Prevent duplicate secondary creation
         */
        const emailExists = email
            ? updatedCluster.some(
                c => c.email === email
            )
        : true;

        const phoneExists = phoneNumber
        ? updatedCluster.some(
            c =>
            c.phoneNumber === phoneNumber
        ): true;

        let finalCluster = [...updatedCluster];

        /**
         * STEP 8
         * Create secondary if new info introduced
         */
        if (!emailExists || !phoneExists) {
            logger.info(
                "Creating secondary contact"
            );

            const secondary = await this.repo.createSecondary(
                primary.id,
                email,
                phoneNumber
            );

            finalCluster.push(secondary);
        }

        /**
         * STEP 9
         * Build response
         */
        const secondaries = finalCluster.filter(
            c =>
            c.linkPrecedence ===
            LinkPrecedence.secondary
        );

        return this.buildResponse(
            primary,
            secondaries
        );
    })}

    /**
     * RESPONSE BUILDER
     */
    private buildResponse(
        primary: Contact,
        secondaries: Contact[]
    ): IdentifyResponse {

        const emails = new Set<string>();
        const phones = new Set<string>();
        const secondaryIds: number[] = [];

        if (primary.email) emails.add(primary.email);
        if (primary.phoneNumber) phones.add(primary.phoneNumber);

        for (const sec of secondaries) {
            if (sec.email) emails.add(sec.email);
            if (sec.phoneNumber) phones.add(sec.phoneNumber);

            secondaryIds.push(sec.id);
        }

        return {
            contact: {
                primaryContactId: primary.id,
                emails: [...emails],
                phoneNumbers: [...phones],
                secondaryContactIds: secondaryIds,
            },
        };
    }
}