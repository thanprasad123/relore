import React, { useState } from 'react';
import { AppStore } from '../core/store';
import { User } from '../types';
import { ArrowRightLeft, ShieldCheck, CheckCircle2, Lock, Sparkles, ExternalLink } from 'lucide-react';
import { ZayqEyebrow } from '../components/Zayq';
import { getWalletState } from '../core/mst/wallet';

interface Props {
    listingId: string;
    currentUser: User;
    onNavigate: (view: string, param?: string) => void;
    onOpenMSTExplorer: (txHash?: string) => void;
}

export const EscrowHandoverView: React.FC<Props> = ({
    listingId,
    currentUser,
    onNavigate,
    onOpenMSTExplorer
}) => {
    const listing = AppStore.getListingById(listingId) || AppStore.getListings()[0];
    const passport = AppStore.getPassportById(listing.passportId);

    const [sellerInputCode, setSellerInputCode] = useState('');
    const [buyerInputCode, setBuyerInputCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isInitiating, setIsInitiating] = useState(false);
    const [initiationTx, setInitiationTx] = useState('');
    const [handoverError, setHandoverError] = useState('');
    const [transferSuccess, setTransferSuccess] = useState<{ passportId: string; txHash: string } | null>(null);

    if (!passport) return null;

    const handleSellerInitiate = async () => {
        setHandoverError('');
        const wallet = getWalletState();
        if (!wallet.connected || !wallet.address) {
            setHandoverError('Connect the seller’s MST Testnet wallet before initiating the on-chain transfer.');
            return;
        }
        if (!listing.buyerWalletAddress) {
            setHandoverError('The buyer must connect their MST wallet and restart the purchase so the transfer can target that wallet.');
            return;
        }
        setIsInitiating(true);
        try {
            const txHash = await AppStore.initiateOnChainOwnershipTransfer(listing.id, currentUser);
            setInitiationTx(txHash);
        } catch (error) {
            setHandoverError(error instanceof Error ? error.message : 'The seller could not initiate the MST transfer.');
        } finally {
            setIsInitiating(false);
        }
    };

    const handleConfirmHandover = async (e: React.FormEvent) => {
        e.preventDefault();
        setHandoverError('');
        if (listing.status !== 'PENDING_TRANSFER' || currentUser.id !== listing.buyerId) {
            setHandoverError('Only the buyer on this pending purchase can confirm the handover.');
            return;
        }
        if (sellerInputCode !== listing.handoverCodeSeller || buyerInputCode !== listing.handoverCodeBuyer) {
            setHandoverError('Those handover codes do not match. Check both codes with the buyer and seller.');
            return;
        }
        setIsSubmitting(true);

        // Execute Smart Contract Ownership Transfer
        try {
            const { passport: updatedPassport, transferTx } = await AppStore.executeOwnershipTransfer(listing.id, currentUser);
            setTransferSuccess({ passportId: updatedPassport.passportId, txHash: transferTx });
        } catch (error) {
            setHandoverError(error instanceof Error ? error.message : 'The handover could not be confirmed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <ZayqEyebrow tone="purple">
                    <ArrowRightLeft size={14} />
                    Product passport ownership handover
                </ZayqEyebrow>
                <h1 className="text-2xl font-extrabold text-white font-sans">Physical Handover & Dual Confirmation</h1>
                <p className="text-xs text-slate-400 font-mono">
                    Purchase started for Passport <strong className="text-cyan-300">{passport.passportId}</strong>
                </p>
            </div>

            {transferSuccess ? (
                <div className="bg-gradient-to-br from-slate-900 to-cyan-950/80 border-2 border-cyan-500/70 rounded-2xl p-8 text-center space-y-6 shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 border-2 border-cyan-400/50 flex items-center justify-center mx-auto">
                        <CheckCircle2 size={36} />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-extrabold text-white font-sans">{transferSuccess.txHash ? 'Ownership transfer confirmed on MST' : 'Demo handover saved in this browser'}</h2>
                        <p className="text-xs text-slate-300">{transferSuccess.txHash ? 'The passport owner changed on-chain and its ownership history stays attached.' : 'This demo updates only this browser. It did not transfer money or change on-chain ownership.'}</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left text-xs font-mono space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Persistent Passport ID:</span>
                            <span className="text-cyan-300 font-bold">{transferSuccess.passportId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">New Verified Owner:</span>
                            <span className="text-emerald-400 font-bold">{currentUser.name} (Owner #2)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">{transferSuccess.txHash ? 'MST transaction:' : 'Network status:'}</span>
                            {transferSuccess.txHash ? <button onClick={() => onOpenMSTExplorer(transferSuccess.txHash)} className="text-cyan-400 hover:underline flex items-center gap-1"><span>{transferSuccess.txHash.slice(0, 16)}...</span><ExternalLink size={12} /></button> : <span className="text-amber-700 font-semibold">Local demo only</span>}
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3 justify-center">
                        <button
                            onClick={() => onNavigate('passport-detail', transferSuccess.passportId)}
                            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-900/30"
                        >
                            <span>Inspect Updated Passport History</span>
                            <ShieldCheck size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleConfirmHandover} className="zayq-glass-card rounded-2xl p-6 space-y-6">
                    {/* Item Card */}
                    <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <img src={passport.imageUrl} alt={passport.model} className="w-16 h-16 rounded-lg object-cover" />
                        <div>
                            <span className="text-[10px] font-mono text-cyan-400">PASSPORT {passport.passportId}</span>
                            <h4 className="font-bold text-sm text-white">{passport.model}</h4>
                            <p className="text-xs text-slate-400 font-mono">Price: ₹{listing.price.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-200 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                            <Lock size={14} />
                            <span>Dual Handover Verification Rules</span>
                        </div>
                        <p>The seller first signs an MST transaction naming the buyer’s wallet. After the physical handover, the buyer signs a second transaction to complete ownership transfer. No payment is handled by this contract.</p>
                    </div>

                    {currentUser.id === listing.sellerId && !listing.chainTransferInitiated && (
                        <button type="button" onClick={handleSellerInitiate} disabled={isInitiating} className="w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-50">
                            {isInitiating ? 'Waiting for seller wallet…' : 'Seller: initiate MST ownership transfer'}
                        </button>
                    )}
                    {listing.chainTransferInitiated && (
                        <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                            Seller transfer initiated on MST. {initiationTx && <span className="font-mono">Transaction: {initiationTx.slice(0, 16)}…</span>} The buyer can now confirm after entering both handover codes.
                        </p>
                    )}

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                        <p className="font-semibold text-white">Share your handover code at the in-person exchange</p>
                        {currentUser.id === listing.buyerId ? (
                            <p className="mt-2">Your buyer code: <strong className="font-mono text-emerald-300">{listing.handoverCodeBuyer}</strong>. Give this to the seller, then enter the seller’s code below.</p>
                        ) : currentUser.id === listing.sellerId ? (
                            <p className="mt-2">Seller code: <strong className="font-mono text-cyan-300">{listing.handoverCodeSeller}</strong>. Share this with the buyer at handover.</p>
                        ) : <p className="mt-2">Switch to the buyer or seller account to view its handover code.</p>}
                    </div>

                    {currentUser.id === listing.buyerId && !listing.chainTransferInitiated && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Waiting for the seller to initiate the transfer from their MST wallet.</p>}
                    {currentUser.id !== listing.buyerId && currentUser.id !== listing.sellerId && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Switch to the seller to initiate the transfer, then to the buyer to confirm.</p>}
                    {handoverError && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{handoverError}</p>}
                    {/* Dual Code Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                            <label className="block text-xs font-semibold text-slate-300">Seller Handover Code</label>
                            <input
                                type="text"
                                required
                                value={sellerInputCode}
                                onChange={(e) => setSellerInputCode(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center text-lg font-mono font-bold text-cyan-300 outline-none"
                            />
                            <span className="text-[10px] text-slate-500 block text-center">Provided by Seller ({listing.sellerName})</span>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                            <label className="block text-xs font-semibold text-slate-300">Buyer Confirmation Code</label>
                            <input
                                type="text"
                                required
                                value={buyerInputCode}
                                onChange={(e) => setBuyerInputCode(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center text-lg font-mono font-bold text-emerald-300 outline-none"
                            />
                            <span className="text-[10px] text-slate-500 block text-center">Provided by the buyer</span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || currentUser.id !== listing.buyerId || !listing.chainTransferInitiated}
                        className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <span>Waiting for MST confirmation…</span>
                        ) : (
                            <>
                                <ArrowRightLeft size={16} />
                        <span>Confirm handover and update passport</span>
                            </>
                        )}
                    </button>
                </form>
            )}
        </div>
    );
};
