import { prisma } from "../db";
import { type Contact, LinkPrecedence } from "../generated/prisma/client";
import { logger } from "../utils/logger";

export class ContactRepository {

    private buildWhere(email?: string | null, phoneNumber?: string | null) {
        const OR = [];

        if (email) OR.push({ email });
        if (phoneNumber) OR.push({ phoneNumber });

        return OR.length ? { OR } : undefined;
    }

    async findMatchingContacts(
        email?: string | null,
        phoneNumber?: string | null
    ): Promise<Contact[]> {
        try {
            const where = this.buildWhere(email, phoneNumber);

            if (!where) return [];

            return prisma.contact.findMany({
                where,
                orderBy: { createdAt: "asc" },
            });
        } catch (error) {
            logger.error("findMatchingContacts failed", error);
            throw error;
        }
    }

    async findClusterByPrimaryIds(ids: number[]) {
        return prisma.contact.findMany({
            where: {
                OR: [
                    { id: { in: ids } },
                    { linkedId: { in: ids } }
                ]
            },
            orderBy: {
                createdAt: "asc"
            }
        });
    }

    async createPrimary(
        email?: string | null,
        phoneNumber?: string | null
    ) {
        return prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: LinkPrecedence.primary,
            },
        });
    }

    async createSecondary(
        primaryId: number,
        email?: string | null,
        phoneNumber?: string | null
    ) {
        return prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkedId: primaryId,
                linkPrecedence: LinkPrecedence.secondary,
            },
        });
    }

    async convertToSecondary(id: number, primaryId: number) {
        return prisma.contact.update({
            where: { id },
            data: {
                linkedId: primaryId,
                linkPrecedence: LinkPrecedence.secondary,
            },
        });
    }
}