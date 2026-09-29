import {
    ProductPassport,
    MarketplaceListing,
    User,
    ServiceRecord,
    DisputeRecord,
    Attestation,
    LifecycleEvent,
    VerificationLevel,
    ProductStatus,
    ProductCategory
} from '../types';
import { MSTAnchorService } from './mst/anchorService';
import { getWalletState } from './mst/wallet';
import { WASMifyBridge } from './mst/wasmify';
import { VerificationEngine } from './verifiers/verificationEngine';
import { id as keccak256 } from 'ethers';
import { createListingRecord, createPassportRecord, getMyMarketplace, getPublicMarketplace } from './api';

export const CURRENT_USER: User = {
    id: 'USR-18392',
    name: 'Arjun Mehta',
    email: 'arjun.mehta@example.com',
    role: 'SELLER',
    mstIdentityDid: 'did:mst:saral:93821849',
    saralVerified: true,
    reputationScore: 98,
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
};

export const DEMO_ADMIN: User = {
    id: 'USR-ADMIN-001',
    name: 'MST Marketplace Admin',
    email: 'admin@passportmst.demo',
    role: 'ADMIN',
    mstIdentityDid: 'did:mst:identity:platform-admin-001',
    saralVerified: true,
    reputationScore: 100
};

export const DEMO_BUYER: User = {
    id: 'USR-49201',
    name: 'Priya Verma',
    email: 'priya.verma@example.com',
    role: 'CONSUMER',
    mstIdentityDid: 'did:mst:saral:49201827',
    saralVerified: true,
    reputationScore: 95,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'
};

export const DEMO_SERVICE_CENTER: User = {
    id: 'USR-SVC-901',
    name: 'iCare Authorized Service Center',
    email: 'support@icare-tech.com',
    role: 'SERVICE_CENTER',
    mstIdentityDid: 'did:mst:identity:service-center-901',
    saralVerified: true,
    reputationScore: 99
};

export const DEMO_INSPECTOR: User = {
    id: 'USR-INSP-55',
    name: 'TechCert Labs (Certified Inspector)',
    email: 'verify@techcert.io',
    role: 'INSPECTOR',
    mstIdentityDid: 'did:mst:identity:inspector-55',
    saralVerified: true,
    reputationScore: 100
};

// Initial Pre-seeded Passports
const INITIAL_PASSPORTS: ProductPassport[] = [
    {
        passportId: 'PP-82941',
        category: 'LAPTOP',
        brand: 'Apple',
        model: 'MacBook Air M3 (15-inch, 16GB RAM, 512GB SSD)',
        releaseYear: 2024,
        imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
        additionalImages: [
            'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80'
        ],
        identifier: {
            category: 'LAPTOP',
            serialNumber: 'C02G1928M3XX',
            serviceTag: 'APPLE-MBA-M3-9281',
            model: 'MacBook Air M3',
            brand: 'Apple',
            hashedIdentifier: '0x9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d'
        },
        verificationLevel: 'PROFESSIONALLY_INSPECTED',
        currentStatus: 'FOR_SALE',
        currentOwnerId: 'USR-18392',
        currentOwnerName: 'Arjun Mehta',
        currentOwnerDid: 'did:mst:saral:93821849',
        riskLevel: 'LOW_RISK',
        riskScore: 4,
        riskSignals: ['Verified invoice match', 'Identity verified on-chain', 'Service history match'],
        createdAt: '2025-03-15T10:14:00Z',
        updatedAt: '2026-09-20T12:00:00Z',
        ownershipHistory: [
            {
                id: 'OWN-1',
                passportId: 'PP-82941',
                ownerId: 'USR-18392',
                ownerName: 'Arjun Mehta (Original Purchaser)',
                ownerDid: 'did:mst:saral:93821849',
                acquiredAt: '2025-03-15T10:14:00Z',
                transferTxHash: '0xa49f2b8c91d8e123f4567890abcdef1234567890abcdef1234567890abcdef12',
                verificationLevelAtTransfer: 'OWNERSHIP_VERIFIED'
            }
        ],
        attestations: [
            {
                id: 'ATT-101',
                passportId: 'PP-82941',
                claim: 'IDENTITY_VERIFIED',
                issuerId: 'SYS-PLATFORM',
                issuerName: 'Product Passport Verification Engine',
                issuerRole: 'ADMIN',
                issuerDid: 'did:mst:identity:platform-root',
                evidenceHash: '0x9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d',
                evidenceSummary: 'Serial number C02G1928M3XX cryptographically hashed and verified against manufacturer registry.',
                timestamp: '2025-03-15T10:14:04Z',
                mstTxHash: '0xa49f2b8c91d8e123f4567890abcdef1234567890abcdef1234567890abcdef12',
                status: 'VALID'
            },
            {
                id: 'ATT-102',
                passportId: 'PP-82941',
                claim: 'OWNERSHIP_VERIFIED',
                issuerId: 'SYS-PLATFORM',
                issuerName: 'Product Passport Verification Engine',
                issuerRole: 'ADMIN',
                issuerDid: 'did:mst:identity:platform-root',
                evidenceHash: '0x3f7a1b9c2d8e4f5a6b0c1d2e3f4a5b6c',
                evidenceSummary: 'Verified official tax invoice matching user Arjun Mehta and Apple Store purchase receipt.',
                timestamp: '2025-03-16T14:22:05Z',
                mstTxHash: '0xb58e1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
                status: 'VALID'
            },
            {
                id: 'ATT-103',
                passportId: 'PP-82941',
                claim: 'PROFESSIONALLY_INSPECTED',
                issuerId: 'USR-INSP-55',
                issuerName: 'TechCert Labs',
                issuerRole: 'INSPECTOR',
                issuerDid: 'did:mst:identity:inspector-55',
                evidenceHash: '0x8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b',
                evidenceSummary: 'Comprehensive 42-point physical hardware diagnostics test passed with 98% rating.',
                timestamp: '2026-02-14T09:30:00Z',
                mstTxHash: '0xd78a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
                status: 'VALID'
            }
        ],
        serviceRecords: [
            {
                id: 'SVC-881',
                passportId: 'PP-82941',
                serviceCenterId: 'USR-SVC-901',
                serviceCenterName: 'iCare Authorized Service Center',
                serviceCenterDid: 'did:mst:identity:service-center-901',
                date: '2026-01-10T11:05:00Z',
                serviceType: 'BATTERY_REPLACEMENT',
                description: 'Routine battery replacement under AppleCare warranty. Genuine OEM battery installed.',
                partsReplaced: ['Original OEM 66.5Wh Lithium Polymer Battery'],
                documentHash: '0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e',
                mstTxHash: '0xc67f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f'
            }
        ],
        inspectionRecords: [
            {
                id: 'INSP-901',
                passportId: 'PP-82941',
                inspectorName: 'TechCert Labs',
                inspectorDid: 'did:mst:identity:inspector-55',
                date: '2026-02-14T09:30:00Z',
                displayCondition: 'EXCELLENT',
                bodyCondition: 'EXCELLENT',
                batteryHealthPct: 100,
                functionalStatus: 'FULLY_FUNCTIONAL',
                overallScore: '9.8 / 10',
                notes: 'Mint condition. Display glass pristine. Keyboard has zero shine. Genuine replacement battery with 100% capacity.',
                evidenceHashes: ['0x8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b'],
                mstTxHash: '0xd78a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a'
            }
        ],
        warrantyRecord: {
            id: 'WAR-771',
            passportId: 'PP-82941',
            provider: 'AppleCare+ Protection Plan',
            status: 'ACTIVE',
            coverageType: 'MANUFACTURER',
            startDate: '2025-03-15',
            expiryDate: '2028-03-15',
            transferrable: true,
            mstAnchorHash: '0x550192a830192830192839102830192830192831'
        },
        lifecycleHistory: [
            {
                id: 'LFC-1',
                passportId: 'PP-82941',
                eventType: 'PURCHASED',
                title: 'Original Purchase & Identity Registration',
                description: 'Product registered with persistent Passport ID PP-82941 by Arjun Mehta.',
                actorName: 'Arjun Mehta',
                actorDid: 'did:mst:saral:93821849',
                timestamp: '2025-03-15T10:14:00Z',
                mstTxHash: '0xa49f2b8c91d8e123f4567890abcdef1234567890abcdef1234567890abcdef12',
                blockNumber: 18492001
            },
            {
                id: 'LFC-2',
                passportId: 'PP-82941',
                eventType: 'SERVICED',
                title: 'OEM Battery Replacement',
                description: 'Serviced by iCare Authorized Center. Genuine battery installed.',
                actorName: 'iCare Authorized Service Center',
                actorDid: 'did:mst:identity:service-center-901',
                timestamp: '2026-01-10T11:05:00Z',
                mstTxHash: '0xc67f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f',
                blockNumber: 18492030
            },
            {
                id: 'LFC-3',
                passportId: 'PP-82941',
                eventType: 'INSPECTED',
                title: 'Certified Physical & Hardware Inspection',
                description: 'Inspected by TechCert Labs. Hardware integrity verified 9.8/10.',
                actorName: 'TechCert Labs',
                actorDid: 'did:mst:identity:inspector-55',
                timestamp: '2026-02-14T09:30:00Z',
                mstTxHash: '0xd78a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
                blockNumber: 18492040
            },
            {
                id: 'LFC-4',
                passportId: 'PP-82941',
                eventType: 'LISTED',
                title: 'Marketplace Listing Created',
                description: 'Listed for resale on Product Passport Marketplace at ₹62,000.',
                actorName: 'Arjun Mehta',
                actorDid: 'did:mst:saral:93821849',
                timestamp: '2026-09-20T12:00:00Z',
                mstTxHash: '0xe89b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
                blockNumber: 18492045
            }
        ],
        disputes: [],
        conditionReport: {
            display: 'EXCELLENT',
            body: 'EXCELLENT',
            batteryHealthPct: 100,
            keyboardPorts: 'EXCELLENT',
            observations: [
                'No hairline screen cracks detected.',
                'No dents detected on the aluminum body.',
                'Verified Service Record: Battery health confirmed at 100% capacity.'
            ]
        }
    },
    {
        passportId: 'PP-91823',
        category: 'SMARTPHONE',
        brand: 'Apple',
        model: 'iPhone 15 Pro (128GB, Natural Titanium)',
        releaseYear: 2023,
        imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80',
        additionalImages: [
            'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80'
        ],
        identifier: {
            category: 'SMARTPHONE',
            imei: '358921098492010',
            serialNumber: 'DX9C10284912',
            model: 'iPhone 15 Pro',
            brand: 'Apple',
            hashedIdentifier: '0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e'
        },
        verificationLevel: 'OWNERSHIP_VERIFIED',
        currentStatus: 'FOR_SALE',
        currentOwnerId: 'USR-88201',
        currentOwnerName: 'Sneha Sharma',
        currentOwnerDid: 'did:mst:saral:88201938',
        riskLevel: 'LOW_RISK',
        riskScore: 8,
        riskSignals: ['Invoice hash matched on-chain', 'IMEI format valid'],
        createdAt: '2024-11-10T08:20:00Z',
        updatedAt: '2026-09-22T15:30:00Z',
        ownershipHistory: [
            {
                id: 'OWN-91823-1',
                passportId: 'PP-91823',
                ownerId: 'USR-88201',
                ownerName: 'Sneha Sharma',
                ownerDid: 'did:mst:saral:88201938',
                acquiredAt: '2024-11-10T08:20:00Z',
                transferTxHash: '0xf123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                verificationLevelAtTransfer: 'OWNERSHIP_VERIFIED'
            }
        ],
        attestations: [],
        serviceRecords: [],
        inspectionRecords: [],
        warrantyRecord: {
            id: 'WAR-91823',
            passportId: 'PP-91823',
            provider: 'Apple Limited Warranty',
            status: 'ACTIVE',
            coverageType: 'MANUFACTURER',
            startDate: '2024-11-10',
            expiryDate: '2025-11-10',
            transferrable: true,
            mstAnchorHash: '0x10293847561029384756102938475610'
        },
        lifecycleHistory: [
            {
                id: 'LFC-91823-1',
                passportId: 'PP-91823',
                eventType: 'PURCHASED',
                title: 'Original Identity Registration',
                description: 'iPhone 15 Pro registered with a sample IMEI.',
                actorName: 'Sneha Sharma',
                actorDid: 'did:mst:saral:88201938',
                timestamp: '2024-11-10T08:20:00Z',
                mstTxHash: '0xf123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                blockNumber: 18400100
            }
        ],
        disputes: [],
        conditionReport: {
            display: 'EXCELLENT',
            body: 'GOOD',
            batteryHealthPct: 93,
            keyboardPorts: 'EXCELLENT',
            observations: ['Minor micro-scratches on titanium bezel.', 'Screen glass is scratch-free.']
        }
    },
    {
        passportId: 'PP-73910',
        category: 'LAPTOP',
        brand: 'Lenovo',
        model: 'ThinkPad X1 Carbon Gen 11 (Core i7, 32GB RAM, 1TB SSD)',
        releaseYear: 2023,
        imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80',
        additionalImages: [],
        identifier: {
            category: 'LAPTOP',
            serialNumber: 'PF492018',
            serviceTag: 'LEN-X1C11-9201',
            model: 'ThinkPad X1 Carbon Gen 11',
            brand: 'Lenovo',
            hashedIdentifier: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f'
        },
        verificationLevel: 'IDENTITY_VERIFIED',
        currentStatus: 'FOR_SALE',
        currentOwnerId: 'USR-90210',
        currentOwnerName: 'Vikram Sen',
        currentOwnerDid: 'did:mst:saral:90210382',
        riskLevel: 'LOW_RISK',
        riskScore: 12,
        riskSignals: ['Serial format validated'],
        createdAt: '2024-08-12T11:00:00Z',
        updatedAt: '2026-09-18T14:10:00Z',
        ownershipHistory: [],
        attestations: [],
        serviceRecords: [],
        inspectionRecords: [],
        lifecycleHistory: [],
        disputes: [],
        conditionReport: {
            display: 'EXCELLENT',
            body: 'GOOD',
            batteryHealthPct: 88,
            keyboardPorts: 'EXCELLENT',
            observations: ['Keyboard clean with minimal key shine.']
        }
    }
];

const INITIAL_LISTINGS: MarketplaceListing[] = [
    {
        id: 'LST-82941',
        passportId: 'PP-82941',
        sellerId: 'USR-18392',
        sellerName: 'Arjun Mehta',
        sellerReputation: 98,
        sellerDid: 'did:mst:saral:93821849',
        price: 62000,
        currency: 'INR',
        location: 'Bangalore, KA',
        title: 'Apple MacBook Air M3 (15-inch, 16GB RAM) - Verifiable Mint Condition',
        description: 'Selling my pristine MacBook Air M3. Identity and ownership verified on MST blockchain with full iCare replacement battery service history and TechCert 9.8/10 inspection score. AppleCare+ valid till 2028.',
        status: 'ACTIVE',
        listedAt: '2026-09-20T12:00:00Z'
    },
    {
        id: 'LST-91823',
        passportId: 'PP-91823',
        sellerId: 'USR-88201',
        sellerName: 'Sneha Sharma',
        sellerReputation: 96,
        sellerDid: 'did:mst:saral:88201938',
        price: 84500,
        currency: 'INR',
        location: 'Mumbai, MH',
        title: 'iPhone 15 Pro Natural Titanium 128GB - MST Verified Ownership',
        description: 'Clean phone, original box with matched IMEI attestation. Battery 93%. Transfer available instantly on Product Passport.',
        status: 'ACTIVE',
        listedAt: '2026-09-22T15:30:00Z'
    },
    {
        id: 'LST-73910',
        passportId: 'PP-73910',
        sellerId: 'USR-90210',
        sellerName: 'Vikram Sen',
        sellerReputation: 92,
        sellerDid: 'did:mst:saral:90210382',
        price: 95000,
        currency: 'INR',
        location: 'Delhi NCR',
        title: 'Lenovo ThinkPad X1 Carbon Gen 11 (32GB / 1TB SSD)',
        description: 'Enterprise laptop in great condition. Serial PF492018 identity anchored.',
        status: 'ACTIVE',
        listedAt: '2026-09-18T14:10:00Z'
    }
];

export class AppStore {
    private static passports: ProductPassport[] = AppStore.readSaved('passport-marketplace-passports', INITIAL_PASSPORTS);
    private static listings: MarketplaceListing[] = AppStore.readSaved('passport-marketplace-listings', INITIAL_LISTINGS);

    /** Merge shared API records into this browser's read cache; local demo records remain local. */
    public static async syncFromApi(walletAddress?: string): Promise<void> {
        try {
            const [publicData, privateData] = await Promise.all([
                getPublicMarketplace(),
                walletAddress ? getMyMarketplace().catch(() => ({ passports: [], listings: [] })) : Promise.resolve({ passports: [], listings: [] }),
            ]);
            const passports = new Map<string, ProductPassport>(this.passports.map(passport => [passport.passportId, passport]));
            [...publicData.passports, ...privateData.passports].forEach(passport => {
                const local = passports.get(passport.passportId);
                passports.set(passport.passportId, local ? {
                    ...local, ...passport,
                    ownershipHistory: local.ownershipHistory.length ? local.ownershipHistory : passport.ownershipHistory,
                    attestations: local.attestations.length ? local.attestations : passport.attestations,
                    serviceRecords: local.serviceRecords.length ? local.serviceRecords : passport.serviceRecords,
                    inspectionRecords: local.inspectionRecords.length ? local.inspectionRecords : passport.inspectionRecords,
                    lifecycleHistory: local.lifecycleHistory.length ? local.lifecycleHistory : passport.lifecycleHistory,
                    disputes: local.disputes.length ? local.disputes : passport.disputes,
                } : passport);
            });
            const listings = new Map<string, MarketplaceListing>(this.listings.map(listing => [listing.id, listing]));
            [...publicData.listings, ...privateData.listings].forEach(listing => {
                const local = listings.get(listing.id);
                listings.set(listing.id, local ? { ...local, ...listing } : listing);
            });
            this.passports = [...passports.values()];
            this.listings = [...listings.values()];
            this.save();
        } catch {
            // The app can still open in local-demo mode when the API has not been started.
        }
    }

    private static readSaved<T>(key: string, fallback: T): T {
        try {
            const saved = localStorage.getItem(key);
            return AppStore.stripSampleTransactionHashes(saved ? JSON.parse(saved) as T : fallback);
        } catch {
            return AppStore.stripSampleTransactionHashes(fallback);
        }
    }

    /** Remove old hard-coded sample hashes without touching genuine user transaction hashes. */
    private static stripSampleTransactionHashes<T>(value: T): T {
        const sampleHashes = new Set([
            '0xa49f2b8c91d8e123f4567890abcdef1234567890abcdef1234567890abcdef12',
            '0xb58e1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
            '0xd78a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
            '0xc67f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f',
            '0xe89b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
            '0xf123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        ]);
        const clean = (item: unknown): void => {
            if (Array.isArray(item)) item.forEach(clean);
            else if (item && typeof item === 'object') {
                Object.entries(item).forEach(([key, nested]) => {
                    if (typeof nested === 'string' && sampleHashes.has(nested)) (item as Record<string, unknown>)[key] = '';
                    else clean(nested);
                });
            }
        };
        clean(value);
        return value;
    }

    private static save(): void {
        try {
            localStorage.setItem('passport-marketplace-passports', JSON.stringify(this.passports));
            localStorage.setItem('passport-marketplace-listings', JSON.stringify(this.listings));
        } catch (error) {
            console.warn('Could not save marketplace demo data in this browser.', error);
        }
    }

    public static getPassports(): ProductPassport[] {
        return [...this.passports];
    }

    public static getPassportById(id: string): ProductPassport | undefined {
        return this.passports.find(p => p.passportId === id);
    }

    public static getListings(): MarketplaceListing[] {
        return [...this.listings];
    }

    public static getListingById(id: string): MarketplaceListing | undefined {
        return this.listings.find(l => l.id === id);
    }

    // --- ACTIONS ---

    // 1. Create Product Passport
    public static async createPassport(data: {
        category: ProductCategory;
        brand: string;
        model: string;
        releaseYear: number;
        serialNumber?: string;
        imei?: string;
        serviceTag?: string;
        imageUrl: string;
        invoiceTitle?: string;
        invoiceHash?: string;
        currentUser: User;
    }): Promise<{ passport: ProductPassport; anchorTx: string }> {
        const rawId = data.serialNumber || data.imei || data.serviceTag || '';
        const wallet = getWalletState();
        if (wallet.connected && (!data.currentUser.walletAddress || wallet.address?.toLowerCase() !== data.currentUser.walletAddress.toLowerCase())) {
            throw new Error('Connect the wallet linked to the current marketplace account before registering this passport.');
        }

        // Calculate hashed identifier
        const hashedIdentifier = keccak256(rawId);

        const passportId = `PP-${Math.floor(80000 + Math.random() * 19999)}`;
        const now = new Date().toISOString();

        // Run Verifiers
        const identifierObj = {
            category: data.category,
            serialNumber: data.serialNumber,
            imei: data.imei,
            serviceTag: data.serviceTag,
            model: data.model,
            brand: data.brand,
            hashedIdentifier
        };

        const idVerif = VerificationEngine.verifyIdentifier(identifierObj);
        if (idVerif.status !== 'VERIFIED') {
            throw new Error(idVerif.notes);
        }
        const riskAnalysis = VerificationEngine.evaluateRisk(
            identifierObj,
            this.passports.map(p => ({ identifierHash: p.identifier.hashedIdentifier, passportId: p.passportId, currentOwnerId: p.currentOwnerId })),
            data.invoiceHash ? [{ id: 'EV-1', type: 'INVOICE', title: data.invoiceTitle || 'Invoice', fileUrl: '', fileHash: data.invoiceHash, uploadedAt: now, verified: true }] : []
        );

        // Run WASMify Proof
        await WASMifyBridge.executeVerificationProof(passportId, 'SERIAL_INTEGRITY_CHECK', identifierObj);

        // Anchor on MST ProductPassportRegistry
        const anchor = await MSTAnchorService.anchorEvent(
            passportId,
            `EVT-REGISTER-${passportId}`,
            'ProductPassportRegistry',
            hashedIdentifier
        );
        const ownershipAnchor = await MSTAnchorService.registerInitialOwner(passportId);
        const attestationAnchor = await MSTAnchorService.anchorEvent(
            passportId,
            'IDENTITY_VERIFIED',
            'AttestationRegistry',
            hashedIdentifier
        );

        const initialLifecycle: LifecycleEvent = {
            id: `LFC-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId,
            eventType: 'PURCHASED',
            title: anchor.status === 'CONFIRMED' ? 'Passport Registered & Identity Anchored on MST' : 'Passport Saved Locally',
            description: anchor.status === 'CONFIRMED'
                ? `Product identity registered by ${data.currentUser.name} on MST Testnet.`
                : `Product identity created by ${data.currentUser.name}; no MST transaction was submitted.`,
            actorName: data.currentUser.name,
            actorDid: data.currentUser.mstIdentityDid,
            timestamp: now,
            mstTxHash: anchor.transactionHash,
            blockNumber: anchor.blockNumber
        };

        const newPassport: ProductPassport = {
            passportId,
            category: data.category,
            brand: data.brand,
            model: data.model,
            releaseYear: data.releaseYear,
            imageUrl: data.imageUrl || (data.category === 'SMARTPHONE'
                ? 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80'
                : 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80'),
            additionalImages: [],
            identifier: identifierObj,
            verificationLevel: data.invoiceHash ? 'OWNERSHIP_VERIFIED' : 'IDENTITY_VERIFIED',
            currentStatus: 'ACTIVE',
            currentOwnerId: data.currentUser.id,
            currentOwnerName: data.currentUser.name,
            currentOwnerDid: data.currentUser.mstIdentityDid,
            riskLevel: riskAnalysis.riskLevel,
            riskScore: riskAnalysis.riskScore,
            riskSignals: riskAnalysis.signals,
            createdAt: now,
            updatedAt: now,
            ownershipHistory: [
                {
                    id: `OWN-${passportId}`,
                    passportId,
                    ownerId: data.currentUser.id,
                    ownerName: data.currentUser.name,
                    ownerDid: data.currentUser.mstIdentityDid,
                    acquiredAt: now,
                    transferTxHash: ownershipAnchor.transactionHash,
                    verificationLevelAtTransfer: data.invoiceHash ? 'OWNERSHIP_VERIFIED' : 'IDENTITY_VERIFIED'
                }
            ],
            attestations: [
                {
                    id: `ATT-${Math.floor(1000 + Math.random() * 9000)}`,
                    passportId,
                    claim: 'IDENTITY_VERIFIED',
                    issuerId: 'SYS-PLATFORM',
                    issuerName: 'Product Passport Verification Engine',
                    issuerRole: 'ADMIN',
                    issuerDid: 'did:mst:identity:platform-root',
                    evidenceHash: hashedIdentifier,
                    evidenceSummary: `Category identifier verified: ${rawId}`,
                    timestamp: now,
                    mstTxHash: attestationAnchor.transactionHash,
                    status: 'VALID'
                }
            ],
            serviceRecords: [],
            inspectionRecords: [],
            lifecycleHistory: [initialLifecycle],
            disputes: [],
            conditionReport: {
                display: 'NOT_ASSESSED',
                body: 'NOT_ASSESSED',
                batteryHealthPct: null,
                keyboardPorts: 'NOT_ASSESSED',
                observations: []
            }
        };

        if (data.currentUser.walletAddress) {
            await createPassportRecord({
                passportId,
                category: data.category,
                brand: data.brand,
                model: data.model,
                releaseYear: data.releaseYear,
                imageUrl: newPassport.imageUrl,
                identifierHash: hashedIdentifier,
            });
        }

        this.passports.unshift(newPassport);
        this.save();
        return { passport: newPassport, anchorTx: anchor.transactionHash };
    }

    // 2. Create Marketplace Listing
    public static async createListing(
        passportId: string,
        price: number,
        location: string,
        title: string,
        description: string,
        seller: User
    ): Promise<MarketplaceListing> {
        const passport = this.getPassportById(passportId);
        if (!passport) throw new Error('Passport not found');
        if (passport.currentOwnerId !== seller.id) throw new Error('Only the current passport owner can create a listing.');
        if (passport.currentStatus === 'STOLEN' || passport.currentStatus === 'DISPUTED') throw new Error('This passport cannot be listed while it is under review.');
        if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a valid asking price.');
        if (this.listings.some(item => item.passportId === passportId && ['PENDING_REVIEW', 'ACTIVE', 'PENDING_TRANSFER'].includes(item.status))) {
            throw new Error('This passport already has an active listing.');
        }

        const listingId = `LST-${Math.floor(10000 + Math.random() * 90000)}`;
        const now = new Date().toISOString();

        const listing: MarketplaceListing = {
            id: listingId,
            passportId,
            sellerId: seller.id,
            sellerName: seller.name,
            sellerReputation: seller.reputationScore,
            sellerDid: seller.mstIdentityDid,
            price,
            currency: 'INR',
            location,
            title,
            description,
            status: 'ACTIVE',
            listedAt: now,
            escrowStatus: 'IDLE'
        };

        if (seller.walletAddress) {
            const sharedListing = await createListingRecord({ passportId, price, location, title, description });
            Object.assign(listing, sharedListing);
        }

        // Update passport status to FOR_SALE
        passport.currentStatus = 'FOR_SALE';
        passport.updatedAt = now;

        // Anchor event
        const anchor = await MSTAnchorService.anchorEvent(
            passportId,
            `EVT-LIST-${listingId}`,
            'MarketplaceRegistry',
            `0xLIST_${listingId}`
        );

        passport.lifecycleHistory.unshift({
            id: `LFC-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId,
            eventType: 'LISTED',
            title: 'Marketplace Listing Published',
            description: `Item listed for sale at ₹${price.toLocaleString()} by ${seller.name}.`,
            actorName: seller.name,
            actorDid: seller.mstIdentityDid,
            timestamp: now,
            mstTxHash: anchor.transactionHash,
            blockNumber: anchor.blockNumber
        });

        this.listings.unshift(listing);
        this.save();
        return listing;
    }

    // 3. Buyer Initiates Protected Purchase (Escrow Deposit)
    public static async initiatePurchase(listingId: string, buyer: User): Promise<MarketplaceListing> {
        const listing = this.getListingById(listingId);
        if (!listing) throw new Error('Listing not found');
        const passport = this.getPassportById(listing.passportId);
        if (!passport) throw new Error('Passport not found');
        if (listing.status !== 'ACTIVE') throw new Error('This listing is no longer available.');
        if (listing.sellerId === buyer.id) throw new Error('You cannot buy your own listing.');
        const wallet = getWalletState();
        if (!buyer.walletAddress || !wallet.connected || wallet.chainId !== 91562037 || wallet.address?.toLowerCase() !== buyer.walletAddress.toLowerCase()) {
            throw new Error('Connect the buyer’s MST Testnet wallet and use the matching marketplace account before starting an ownership transfer.');
        }

        const handoverSeller = Math.floor(100000 + Math.random() * 900000).toString();
        const handoverBuyer = Math.floor(100000 + Math.random() * 900000).toString();

        listing.status = 'PENDING_TRANSFER';
        listing.buyerId = buyer.id;
        listing.buyerWalletAddress = buyer.walletAddress;
        listing.chainTransferInitiated = false;
        listing.escrowStatus = 'PURCHASE_STARTED';
        listing.handoverCodeSeller = handoverSeller;
        listing.handoverCodeBuyer = handoverBuyer;

        passport.currentStatus = 'TRANSFER_PENDING';
        passport.updatedAt = new Date().toISOString();
        this.save();

        return listing;
    }

    /** The current owner must sign the seller side of the on-chain transfer. */
    public static async initiateOnChainOwnershipTransfer(listingId: string, seller: User): Promise<string> {
        const listing = this.getListingById(listingId);
        if (!listing || listing.status !== 'PENDING_TRANSFER') throw new Error('There is no pending purchase to transfer.');
        if (listing.sellerId !== seller.id) throw new Error('Only the seller can initiate the ownership transfer.');
        if (!listing.buyerWalletAddress) throw new Error('The buyer must connect their MST wallet before the seller can initiate the transfer.');
        if (listing.chainTransferInitiated) throw new Error('The seller has already initiated this on-chain transfer.');
        const wallet = getWalletState();
        if (!seller.walletAddress || wallet.address?.toLowerCase() !== seller.walletAddress.toLowerCase()) {
            throw new Error('Connect the wallet linked to the seller account that currently owns this passport.');
        }

        const anchor = await MSTAnchorService.initiateOwnershipTransfer(listing.passportId, listing.buyerWalletAddress);
        if (anchor.status !== 'CONFIRMED') throw new Error('Connect the seller wallet and configure OwnershipRegistry before initiating an on-chain transfer.');
        listing.chainTransferInitiated = true;
        this.save();
        return anchor.transactionHash;
    }

    public static async cancelListing(listingId: string, seller: User): Promise<void> {
        const listing = this.getListingById(listingId);
        if (!listing) throw new Error('Listing not found');
        if (listing.sellerId !== seller.id) throw new Error('Only the seller can cancel this listing.');
        if (listing.status !== 'ACTIVE') throw new Error('Only active listings can be cancelled.');
        const passport = this.getPassportById(listing.passportId);
        if (!passport) throw new Error('Passport not found');

        listing.status = 'CANCELLED';
        passport.currentStatus = 'ACTIVE';
        passport.updatedAt = new Date().toISOString();
        const anchor = await MSTAnchorService.anchorEvent(passport.passportId, `EVT-CANCEL-${listing.id}`, 'MarketplaceRegistry', `0xCANCEL_${listing.id}`);
        passport.lifecycleHistory.unshift({
            id: `LFC-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId: passport.passportId,
            eventType: 'CANCELLED',
            title: 'Marketplace listing cancelled',
            description: `Listing cancelled by ${seller.name}. The product passport remains active.`,
            actorName: seller.name,
            actorDid: seller.mstIdentityDid,
            timestamp: passport.updatedAt,
            mstTxHash: anchor.transactionHash,
            blockNumber: anchor.blockNumber
        });
        this.save();
    }

    // 4. Complete Handover & Transfer Ownership on MST
    public static async executeOwnershipTransfer(
        listingId: string,
        buyer: User
    ): Promise<{ passport: ProductPassport; transferTx: string }> {
        const listing = this.getListingById(listingId);
        if (!listing) throw new Error('Listing not found');
        const passport = this.getPassportById(listing.passportId);
        if (!passport) throw new Error('Passport not found');
        if (listing.status !== 'PENDING_TRANSFER' || listing.escrowStatus !== 'PURCHASE_STARTED') {
            throw new Error('There is no pending purchase to complete.');
        }
        if (listing.buyerId !== buyer.id) throw new Error('Only the buyer on this purchase can receive the passport.');
        const wallet = getWalletState();
        if (!buyer.walletAddress || wallet.address?.toLowerCase() !== buyer.walletAddress.toLowerCase()) {
            throw new Error('Connect the buyer wallet selected for this purchase before confirming the transfer.');
        }

        const previousOwnerName = passport.currentOwnerName;
        const now = new Date().toISOString();

        // Call MST OwnershipRegistry.completeTransfer
        if (!listing.chainTransferInitiated) {
            throw new Error('The seller must initiate this transfer with their MST wallet before the buyer can confirm it.');
        }
        const anchor = await MSTAnchorService.completeOwnershipTransfer(passport.passportId);
        if (anchor.status !== 'CONFIRMED') {
            throw new Error('Connect the buyer wallet and confirm the on-chain ownership transfer. Local demo data was not changed.');
        }

        // Update Passport Owner
        passport.currentOwnerId = buyer.id;
        passport.currentOwnerName = buyer.name;
        passport.currentOwnerDid = buyer.mstIdentityDid;
        passport.currentStatus = 'ACTIVE';
        passport.updatedAt = now;

        // Update Ownership History
        if (passport.ownershipHistory.length > 0) {
            passport.ownershipHistory[0].relinquishedAt = now;
        }

        passport.ownershipHistory.unshift({
            id: `OWN-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId: passport.passportId,
            ownerId: buyer.id,
            ownerName: `${buyer.name} (Owner #${passport.ownershipHistory.length + 1})`,
            ownerDid: buyer.mstIdentityDid,
            acquiredAt: now,
            transferTxHash: anchor.transactionHash,
            verificationLevelAtTransfer: passport.verificationLevel
        });

        // Add Lifecycle Event
        passport.lifecycleHistory.unshift({
            id: `LFC-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId: passport.passportId,
            eventType: 'TRANSFERRED',
            title: 'Verifiable Ownership Transferred on MST',
            description: `Ownership transferred from ${previousOwnerName} to ${buyer.name} on MST Testnet. This marketplace does not collect payment. Passport ID ${passport.passportId} preserved.`,
            actorName: buyer.name,
            actorDid: buyer.mstIdentityDid,
            timestamp: now,
            mstTxHash: anchor.transactionHash,
            blockNumber: anchor.blockNumber
        });

        // Update Listing
        listing.status = 'SOLD';
        listing.escrowStatus = 'RELEASED';
        this.save();

        return { passport, transferTx: anchor.transactionHash };
    }

    // 5. Add Service Record by Service Center
    public static async addServiceRecord(
        passportId: string,
        serviceData: {
            serviceType: ServiceRecord['serviceType'];
            description: string;
            partsReplaced: string[];
            serviceCenterUser: User;
        }
    ): Promise<ServiceRecord> {
        const passport = this.getPassportById(passportId);
        if (!passport) throw new Error('Passport not found');

        const now = new Date().toISOString();
        const docHash = `0xSERVICE_${Math.floor(100000 + Math.random() * 900000)}`;

        const anchor = await MSTAnchorService.anchorEvent(
            passportId,
            `EVT-SERVICE-${Math.floor(1000 + Math.random() * 9000)}`,
            'ServiceRegistry',
            docHash
        );

        const record: ServiceRecord = {
            id: `SVC-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId,
            serviceCenterId: serviceData.serviceCenterUser.id,
            serviceCenterName: serviceData.serviceCenterUser.name,
            serviceCenterDid: serviceData.serviceCenterUser.mstIdentityDid,
            date: now,
            serviceType: serviceData.serviceType,
            description: serviceData.description,
            partsReplaced: serviceData.partsReplaced,
            documentHash: docHash,
            mstTxHash: anchor.transactionHash
        };

        passport.serviceRecords.unshift(record);
        passport.updatedAt = now;

        // Add lifecycle event
        passport.lifecycleHistory.unshift({
            id: `LFC-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId,
            eventType: 'SERVICED',
            title: `Service Attestation: ${serviceData.serviceType.replace('_', ' ')}`,
            description: serviceData.description,
            actorName: serviceData.serviceCenterUser.name,
            actorDid: serviceData.serviceCenterUser.mstIdentityDid,
            timestamp: now,
            mstTxHash: anchor.transactionHash,
            blockNumber: anchor.blockNumber
        });

        return record;
    }

    // 6. Report Stolen Product / File Dispute
    public static async reportStolen(
        passportId: string,
        claimant: User,
        reason: DisputeRecord['reason'],
        description: string
    ): Promise<DisputeRecord> {
        const passport = this.getPassportById(passportId);
        if (!passport) throw new Error('Passport not found');

        const now = new Date().toISOString();
        const anchor = await MSTAnchorService.anchorEvent(
            passportId,
            `EVT-DISPUTE-${passportId}`,
            'LifecycleRegistry',
            `0xSTOLEN_FLAG_${passportId}`,
            false
        );

        const dispute: DisputeRecord = {
            id: `DSP-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId,
            claimantId: claimant.id,
            claimantName: claimant.name,
            reason,
            description,
            evidenceHashes: [`0xEVID_${Math.floor(10000 + Math.random() * 90000)}`],
            status: 'UNDER_REVIEW',
            createdAt: now,
            mstDisputeAnchorTx: anchor.transactionHash
        };

        passport.disputes.unshift(dispute);
        passport.currentStatus = 'STOLEN';
        passport.riskLevel = 'HIGH_RISK';
        passport.riskScore = 95;
        passport.riskSignals.unshift('CRITICAL: Stolen theft report filed with evidence on MST.');
        passport.updatedAt = now;

        // Lifecycle
        passport.lifecycleHistory.unshift({
            id: `LFC-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId,
            eventType: 'STOLEN',
            title: 'CRITICAL: Product Flagged as Stolen',
            description: `Reported stolen by ${claimant.name}: ${description}`,
            actorName: claimant.name,
            actorDid: claimant.mstIdentityDid,
            timestamp: now,
            mstTxHash: anchor.transactionHash,
            blockNumber: anchor.blockNumber
        });

        return dispute;
    }

    // 7. Resolve Dispute / Clear Stolen Flag
    public static async resolveDispute(
        disputeId: string,
        passportId: string,
        resolution: 'RECOVERED' | 'REJECTED'
    ): Promise<void> {
        const passport = this.getPassportById(passportId);
        if (!passport) return;
        const dispute = passport.disputes.find(d => d.id === disputeId);
        if (dispute) {
            dispute.status = 'RESOLVED';
            dispute.resolvedAt = new Date().toISOString();
        }

        const now = new Date().toISOString();
        const anchor = await MSTAnchorService.anchorEvent(
            passportId,
            `EVT-RECOVER-${passportId}`,
            'LifecycleRegistry',
            `0xRECOVERED_${passportId}`
        );

        passport.currentStatus = resolution === 'RECOVERED' ? 'RECOVERED' : 'ACTIVE';
        passport.riskLevel = 'LOW_RISK';
        passport.riskScore = 10;
        passport.riskSignals = passport.riskSignals.filter(s => !s.includes('CRITICAL'));
        passport.updatedAt = now;

        passport.lifecycleHistory.unshift({
            id: `LFC-${Math.floor(1000 + Math.random() * 9000)}`,
            passportId,
            eventType: 'RECOVERED',
            title: 'Dispute Resolved & Status Recovered',
            description: `Verified police recovery certificate confirmed. Passport status restored to RECOVERED/ACTIVE on MST.`,
            actorName: 'Product Passport Platform Admin',
            actorDid: 'did:mst:identity:admin-root',
            timestamp: now,
            mstTxHash: anchor.transactionHash,
            blockNumber: anchor.blockNumber
        });
    }
}
