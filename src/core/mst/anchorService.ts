import { ethers } from 'ethers';
import { MSTAnchor } from '../../types';
import { MST_CONTRACT_ADDRESSES, getContract } from './contracts';
import { getWalletState } from './wallet';

export class MSTAnchorService {
    private static anchors: MSTAnchor[] = MSTAnchorService.loadAnchors();

    private static loadAnchors(): MSTAnchor[] {
        try {
            const saved = localStorage.getItem('passport-marketplace-anchors');
            return saved ? JSON.parse(saved) as MSTAnchor[] : [];
        } catch {
            return [];
        }
    }

    private static saveAnchors(): void {
        try {
            localStorage.setItem('passport-marketplace-anchors', JSON.stringify(this.anchors));
        } catch (error) {
            console.warn('Could not save browser activity.', error);
        }
    }

    public static getAnchors(): MSTAnchor[] { return [...this.anchors]; }
    public static getAnchorsForPassport(passportId: string): MSTAnchor[] {
        return this.anchors.filter(anchor => anchor.passportId === passportId);
    }

    /** Local activity is explicitly LOCAL_ONLY. Connected-wallet errors are never converted into fake receipts. */
    public static async anchorEvent(
        passportId: string,
        eventId: string,
        contractName: keyof typeof MST_CONTRACT_ADDRESSES,
        payloadHash: string,
        _forceFail = false
    ): Promise<MSTAnchor> {
        const wallet = getWalletState();
        const now = new Date().toISOString();

        if (_forceFail) throw new Error('This activity was rejected and was not saved.');

        if (!wallet.connected || !wallet.signer || wallet.chainId !== 91562037) {
            const localRecord: MSTAnchor = {
                id: `LOCAL-${crypto.randomUUID()}`,
                eventId,
                passportId,
                chain: 'MST_TESTNET',
                contractAddress: MST_CONTRACT_ADDRESSES[contractName] || '',
                contractName,
                transactionHash: '',
                blockNumber: 0,
                status: 'LOCAL_ONLY',
                simulated: true,
                createdAt: now,
                payloadHash,
                errorMessage: 'Saved in this browser only. Connect an MST Testnet wallet and configure deployed contracts to write on-chain.',
            };
            this.anchors.unshift(localRecord);
            this.saveAnchors();
            return localRecord;
        }

        const payloadBytes32 = /^0x[0-9a-fA-F]{64}$/.test(payloadHash) ? payloadHash : ethers.id(payloadHash);
        const txResult = await this.executeRealAnchor(passportId, eventId, contractName, payloadBytes32);
        const anchor: MSTAnchor = {
            id: `ANC-${crypto.randomUUID()}`,
            eventId,
            passportId,
            chain: 'MST_TESTNET',
            contractAddress: txResult.contractAddress,
            contractName,
            transactionHash: txResult.txHash,
            blockNumber: txResult.blockNumber,
            status: 'CONFIRMED',
            simulated: false,
            createdAt: now,
            confirmedAt: now,
            payloadHash: payloadBytes32,
        };
        this.anchors.unshift(anchor);
        this.saveAnchors();
        return anchor;
    }

    /** Register the wallet that created a passport as its first on-chain owner. */
    public static async registerInitialOwner(passportId: string): Promise<MSTAnchor> {
        return this.submitOwnershipAction(passportId, `EVT-OWNER-REGISTER-${passportId}`, 'registerOwnership');
    }

    /** Seller signs this transaction before the buyer can confirm a handover. */
    public static async initiateOwnershipTransfer(passportId: string, buyerAddress: string): Promise<MSTAnchor> {
        if (!ethers.isAddress(buyerAddress)) throw new Error('The buyer must connect a valid MST wallet before the seller starts the transfer.');
        return this.submitOwnershipAction(passportId, `EVT-TRANSFER-INIT-${passportId}`, 'initiateTransfer', buyerAddress);
    }

    /** Buyer signs the contract's second step, which changes the on-chain owner. */
    public static async completeOwnershipTransfer(passportId: string): Promise<MSTAnchor> {
        return this.submitOwnershipAction(passportId, `EVT-TRANSFER-COMPLETE-${passportId}`, 'completeTransfer');
    }

    private static async submitOwnershipAction(
        passportId: string,
        eventId: string,
        method: 'registerOwnership' | 'initiateTransfer' | 'completeTransfer',
        buyerAddress?: string
    ): Promise<MSTAnchor> {
        const wallet = getWalletState();
        if (!wallet.connected || !wallet.signer || wallet.chainId !== 91562037) {
            const localRecord: MSTAnchor = {
                id: `LOCAL-${crypto.randomUUID()}`, eventId, passportId, chain: 'MST_TESTNET',
                contractAddress: MST_CONTRACT_ADDRESSES.OwnershipRegistry, contractName: 'OwnershipRegistry',
                transactionHash: '', blockNumber: 0, status: 'LOCAL_ONLY', simulated: true,
                createdAt: new Date().toISOString(), payloadHash: ethers.id(`${method}:${passportId}`),
                errorMessage: 'Saved in this browser only. Connect an MST Testnet wallet to change on-chain ownership.',
            };
            this.anchors.unshift(localRecord);
            this.saveAnchors();
            return localRecord;
        }

        const address = MST_CONTRACT_ADDRESSES.OwnershipRegistry;
        const contract = getContract('OwnershipRegistry', wallet.signer);
        const runtimeCode = await wallet.provider!.getCode(address);
        if (runtimeCode === '0x') throw new Error('No OwnershipRegistry contract is deployed at the configured address.');
        const tx = method === 'registerOwnership'
            ? await contract.registerOwnership(passportId)
            : method === 'initiateTransfer'
                ? await contract.initiateTransfer(passportId, buyerAddress)
                : await contract.completeTransfer(passportId);
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) throw new Error('MST did not confirm the ownership transaction.');
        const now = new Date().toISOString();
        const anchor: MSTAnchor = {
            id: `ANC-${crypto.randomUUID()}`, eventId, passportId, chain: 'MST_TESTNET',
            contractAddress: address, contractName: 'OwnershipRegistry', transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber, status: 'CONFIRMED', simulated: false,
            createdAt: now, confirmedAt: now, payloadHash: ethers.id(`${method}:${passportId}`),
        };
        this.anchors.unshift(anchor);
        this.saveAnchors();
        return anchor;
    }

    private static async executeRealAnchor(
        passportId: string,
        eventId: string,
        contractName: keyof typeof MST_CONTRACT_ADDRESSES,
        payloadHash: string
    ): Promise<{ txHash: string; blockNumber: number; contractAddress: string }> {
        const resolveReceipt = async (tx: ethers.ContractTransactionResponse, address: string) => {
            const receipt = await tx.wait();
            if (!receipt || receipt.status !== 1) throw new Error('MST did not confirm this transaction.');
            return { txHash: receipt.hash, blockNumber: receipt.blockNumber, contractAddress: address };
        };

        if (contractName === 'ProductPassportRegistry') {
            const wallet = getWalletState();
            if (!wallet.signer) throw new Error('Connect your MST Testnet wallet to submit this transaction.');
            const passportContract = getContract('ProductPassportRegistry', wallet.signer);
            if (await wallet.provider!.getCode(MST_CONTRACT_ADDRESSES.ProductPassportRegistry) === '0x') {
                throw new Error('No ProductPassportRegistry contract is deployed at the configured address.');
            }
            const alreadyRegistered = await passportContract.passportExists(passportId);
            if (alreadyRegistered) throw new Error('This passport ID is already registered on MST.');
            const tx = await passportContract.registerPassport(passportId, payloadHash);
            return resolveReceipt(tx, MST_CONTRACT_ADDRESSES.ProductPassportRegistry);
        }

        if (contractName === 'OwnershipRegistry') {
            throw new Error('Ownership transfer needs a seller-initiated transfer and buyer wallet confirmation. This action cannot be safely submitted through the current one-step handover screen.');
        }

        const registry = contractName === 'MarketplaceRegistry' || contractName === 'WarrantyRegistry'
            ? 'LifecycleRegistry'
            : contractName;
        const wallet = getWalletState();
        if (!wallet.signer) throw new Error('Connect your MST Testnet wallet to submit this transaction.');
        const contract = getContract(registry, wallet.signer);
        if (await wallet.provider!.getCode(MST_CONTRACT_ADDRESSES[registry]) === '0x') {
            throw new Error(`No ${registry} contract is deployed at the configured address.`);
        }
        let tx: ethers.ContractTransactionResponse;
        if (registry === 'AttestationRegistry') tx = await contract.addAttestation(passportId, eventId, payloadHash);
        else if (registry === 'ServiceRegistry') tx = await contract.recordService(passportId, eventId, payloadHash);
        else tx = await contract.logEvent(passportId, `${contractName}:${eventId}`, payloadHash);
        return resolveReceipt(tx, MST_CONTRACT_ADDRESSES[registry]);
    }

    /** Demo-local entries are never replayed as transactions. */
    public static async retryFailedAnchors(): Promise<number> {
        return 0;
    }
}
