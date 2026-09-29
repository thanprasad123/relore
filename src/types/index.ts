export type ProductCategory = 'SMARTPHONE' | 'LAPTOP';

export type VerificationLevel =
    | 'SELLER_REPORTED'
    | 'IDENTITY_VERIFIED'
    | 'OWNERSHIP_VERIFIED'
    | 'PROFESSIONALLY_INSPECTED'
    | 'MANUFACTURER_VERIFIED';

export type ProductStatus =
    | 'ACTIVE'
    | 'FOR_SALE'
    | 'TRANSFER_PENDING'
    | 'DISPUTED'
    | 'FLAGGED'
    | 'STOLEN'
    | 'RECOVERED'
    | 'RETIRED';

export type RiskLevel = 'LOW_RISK' | 'REVIEW_REQUIRED' | 'HIGH_RISK';

export type UserRole = 'CONSUMER' | 'SELLER' | 'SERVICE_CENTER' | 'INSPECTOR' | 'ADMIN';

export interface User {
    id: string;
    name: string;
    email: string;
    /** Connected EVM wallet for signing product and marketplace transactions. */
    walletAddress?: string;
    sellerStatus?: 'NOT_APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
    role: UserRole;
    mstIdentityDid: string;
    saralVerified: boolean;
    avatarUrl?: string;
    reputationScore: number;
}

export interface ProductIdentifier {
    category: ProductCategory;
    serialNumber?: string;
    imei?: string;
    serviceTag?: string;
    model: string;
    brand: string;
    hashedIdentifier: string;
}

export interface EvidenceDocument {
    id: string;
    type: 'INVOICE' | 'ID_PROOF' | 'DEVICE_PHOTO' | 'SERVICE_REPORT' | 'INSPECTION_CERT';
    title: string;
    fileUrl: string;
    fileHash: string;
    uploadedAt: string;
    verified: boolean;
}

export interface Attestation {
    id: string;
    passportId: string;
    claim: VerificationLevel | 'OWNERSHIP_CLAIM' | 'CONDITION_CLAIM' | 'SERVICE_CLAIM';
    issuerId: string;
    issuerName: string;
    issuerRole: UserRole;
    issuerDid: string;
    evidenceHash: string;
    evidenceSummary: string;
    timestamp: string;
    mstTxHash?: string;
    status: 'VALID' | 'REVOKED';
}

export interface OwnershipHistory {
    id: string;
    passportId: string;
    ownerId: string;
    ownerName: string;
    ownerDid: string;
    acquiredAt: string;
    relinquishedAt?: string;
    transferTxHash: string;
    verificationLevelAtTransfer: VerificationLevel;
}

export interface ServiceRecord {
    id: string;
    passportId: string;
    serviceCenterId: string;
    serviceCenterName: string;
    serviceCenterDid: string;
    date: string;
    serviceType: 'BATTERY_REPLACEMENT' | 'DISPLAY_REPAIR' | 'LOGIC_BOARD' | 'GENERAL_MAINTENANCE' | 'REFURBISHMENT';
    description: string;
    partsReplaced: string[];
    documentHash: string;
    mstTxHash: string;
}

export interface InspectionRecord {
    id: string;
    passportId: string;
    inspectorName: string;
    inspectorDid: string;
    date: string;
    displayCondition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    bodyCondition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    batteryHealthPct?: number;
    functionalStatus: 'FULLY_FUNCTIONAL' | 'MINOR_DEFECT' | 'MAJOR_DEFECT';
    overallScore: string;
    notes: string;
    evidenceHashes: string[];
    mstTxHash: string;
}

export interface WarrantyRecord {
    id: string;
    passportId: string;
    provider: string;
    status: 'ACTIVE' | 'EXPIRED' | 'VOIDED' | 'TRANSFERRED';
    coverageType: 'MANUFACTURER' | 'EXTENDED' | 'REFURBISHER';
    startDate: string;
    expiryDate: string;
    transferrable: boolean;
    mstAnchorHash: string;
}

export type LifecycleEventType =
    | 'PURCHASED'
    | 'INSPECTED'
    | 'SERVICED'
    | 'LISTED'
    | 'CANCELLED'
    | 'SOLD'
    | 'TRANSFERRED'
    | 'DISPUTED'
    | 'FLAGGED'
    | 'STOLEN'
    | 'RECOVERED'
    | 'RETIRED';

export interface LifecycleEvent {
    id: string;
    passportId: string;
    eventType: LifecycleEventType;
    title: string;
    description: string;
    actorName: string;
    actorDid: string;
    timestamp: string;
    mstTxHash: string;
    blockNumber: number;
}

export interface DisputeRecord {
    id: string;
    passportId: string;
    claimantId: string;
    claimantName: string;
    reason: 'STOLEN_REPORT' | 'SERIAL_CLONE' | 'FRAUDULENT_LISTING' | 'SERVICE_DISPUTE';
    description: string;
    evidenceHashes: string[];
    status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
    createdAt: string;
    resolvedAt?: string;
    mstDisputeAnchorTx?: string;
}

export interface ConditionReport {
    display: 'NOT_ASSESSED' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    body: 'NOT_ASSESSED' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    batteryHealthPct: number | null;
    keyboardPorts: 'NOT_ASSESSED' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    observations: string[];
}

export interface ProductPassport {
    passportId: string; // e.g. PP-82941
    category: ProductCategory;
    brand: string;
    model: string;
    releaseYear: number;
    imageUrl: string;
    additionalImages: string[];
    identifier: ProductIdentifier;
    verificationLevel: VerificationLevel;
    currentStatus: ProductStatus;
    currentOwnerId: string;
    currentOwnerName: string;
    currentOwnerDid: string;
    riskLevel: RiskLevel;
    riskScore: number; // 0 - 100
    riskSignals: string[];
    createdAt: string;
    updatedAt: string;

    // Embedded summary records & relations
    ownershipHistory: OwnershipHistory[];
    attestations: Attestation[];
    serviceRecords: ServiceRecord[];
    inspectionRecords: InspectionRecord[];
    warrantyRecord?: WarrantyRecord;
    lifecycleHistory: LifecycleEvent[];
    disputes: DisputeRecord[];
    conditionReport: ConditionReport;
}

export interface MarketplaceListing {
    id: string;
    passportId: string;
    sellerId: string;
    buyerId?: string;
    buyerWalletAddress?: string;
    chainTransferInitiated?: boolean;
    sellerName: string;
    sellerReputation: number;
    sellerDid: string;
    price: number; // In INR or USD
    currency: 'INR' | 'USD';
    location: string;
    title: string;
    description: string;
    status: 'PENDING_REVIEW' | 'ACTIVE' | 'PENDING_TRANSFER' | 'SOLD' | 'CANCELLED' | 'REJECTED';
    listedAt: string;
    escrowStatus?: 'IDLE' | 'PURCHASE_STARTED' | 'HANDOVER_CONFIRMED' | 'RELEASED';
    handoverCodeSeller?: string;
    handoverCodeBuyer?: string;
}

export interface MSTAnchor {
    id: string;
    eventId: string;
    passportId: string;
    chain: 'MST_MAINNET' | 'MST_TESTNET';
    contractAddress: string;
    contractName: 'ProductPassportRegistry' | 'OwnershipRegistry' | 'AttestationRegistry' | 'LifecycleRegistry' | 'ServiceRegistry' | 'WarrantyRegistry' | 'MarketplaceRegistry';
    transactionHash: string;
    blockNumber: number;
    status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'LOCAL_ONLY';
    /** True when the UI generated a local demo receipt instead of a network transaction. */
    simulated?: boolean;
    createdAt: string;
    confirmedAt?: string;
    errorMessage?: string;
    payloadHash: string;
}

export interface WASMifyProof {
    proofId: string;
    passportId: string;
    computationType: 'SERIAL_INTEGRITY_CHECK' | 'OWNERSHIP_SIGNATURE_PROOF' | 'FRAUD_RISK_COMPUTATION';
    inputHash: string;
    outputResult: string;
    executionTimeMs: number;
    wasmModuleHash: string;
    verifiedOnMST: boolean;
}
