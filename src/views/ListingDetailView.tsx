import React, { useState } from 'react';
import { AppStore } from '../core/store';
import { User } from '../types';
import { VerificationBadge } from '../components/VerificationBadge';
import { StatusBadge } from '../components/StatusBadge';
import { Shield, Lock, CheckCircle2, ArrowRightLeft, ExternalLink, Wrench, Award, Tag, Sparkles } from 'lucide-react';

interface Props {
    listingId: string;
    currentUser: User;
    onNavigate: (view: string, param?: string) => void;
}

export const ListingDetailView: React.FC<Props> = ({ listingId, currentUser, onNavigate }) => {
    const listing = AppStore.getListingById(listingId);
    const passport = listing ? AppStore.getPassportById(listing.passportId) : undefined;

    const [isProcessing, setIsProcessing] = useState(false);
    const [purchaseError, setPurchaseError] = useState('');

    if (!listing || !passport) return <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4"><h1 className="text-2xl font-bold text-white">Listing not found</h1><p className="text-slate-400">This product may have been removed. Browse active listings to find another item.</p><button onClick={() => onNavigate('marketplace')} className="zayq-btn-primary">Browse marketplace</button></div>;

    const isSeller = listing.sellerId === currentUser.id;

    const handleInitiatePurchase = async () => {
        setPurchaseError('');
        setIsProcessing(true);
        try {
            const updatedListing = await AppStore.initiatePurchase(listing.id, currentUser);
            onNavigate('escrow-handover', updatedListing.id);
        } catch (error) {
            setPurchaseError(error instanceof Error ? error.message : 'Purchase could not be started.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            {/* Listing Top Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Images */}
                <div className="space-y-3">
                    <div className="zayq-glass-card rounded-2xl overflow-hidden relative">
                        <img
                            src={passport.imageUrl}
                            alt={listing.title}
                            className="w-full h-80 object-cover bg-slate-950"
                        />
                        <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
                            <VerificationBadge level={passport.verificationLevel} size="md" />
                            <StatusBadge status={passport.currentStatus} />
                        </div>
                    </div>

                    {passport.additionalImages.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                            {passport.additionalImages.map((img, idx) => (
                                <img
                                    key={idx}
                                    src={img}
                                    alt="Detail"
                                    className="w-full h-24 object-cover rounded-xl border border-slate-800 bg-slate-950"
                                    onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Purchase & Identity Summary */}
                <div className="space-y-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-cyan-400">Passport ID: {passport.passportId}</span>
                            <button
                                onClick={() => onNavigate('passport-detail', passport.passportId)}
                                className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1 font-mono"
                            >
                                <span>View Full Passport History</span>
                                <ExternalLink size={12} />
                            </button>
                        </div>

                        <h1 className="text-2xl font-extrabold text-white font-sans">{listing.title}</h1>
                        <p className="text-xs text-slate-400 font-mono mt-1">Listed from {listing.location}</p>
                    </div>

                    {/* Price & Buy Action Box */}
                    <div className="zayq-glass-card rounded-2xl p-6 space-y-4 shadow-xl">
                        <div className="flex items-baseline justify-between">
                            <div>
                                <span className="text-xs text-slate-400 font-mono block">Verified Price</span>
                                <span className="text-3xl font-extrabold text-white font-mono">₹{listing.price.toLocaleString()}</span>
                            </div>
                            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-mono">
                                MST ownership handover
                            </span>
                        </div>

                        {purchaseError && <p role="alert" className="text-sm text-rose-300">{purchaseError}</p>}
                        <p className="text-xs text-slate-400">The handover uses two MST wallet transactions. This marketplace does not collect or hold payment, and listing data remains browser-local.</p>
                        {listing.status === 'PENDING_REVIEW' ? (
                            <p className="rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-200">This listing is waiting for marketplace admin review before it can be seen by buyers.</p>
                        ) : listing.status === 'REJECTED' ? (
                            <p className="rounded-xl border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">This listing was not approved for publication.</p>
                        ) : listing.status === 'PENDING_TRANSFER' ? (
                            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-xl text-purple-300 text-xs font-mono space-y-2">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <ArrowRightLeft size={16} />
                                    <span>Purchase started · handover pending</span>
                                </div>
                                <button
                                    onClick={() => onNavigate('escrow-handover', listing.id)}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition-colors"
                                >
                                    Open Handover & Dual Confirmation Screen
                                </button>
                            </div>
                        ) : listing.status !== 'ACTIVE' ? (
                            <p className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">This listing is no longer available.</p>
                        ) : isSeller ? (
                            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl font-mono">
                                You are the seller of this listing. Start the MST ownership transfer after a buyer begins the handover. Payments are not handled here.
                            </p>
                        ) : (
                            <button
                                onClick={handleInitiatePurchase}
                                disabled={isProcessing}
                                className="zayq-btn-primary w-full flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <span>Starting handover…</span>
                                ) : (
                                    <>
                                        <Lock size={18} />
                                        <span>Start purchase and handover</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Seller Trust Score */}
                    <div className="zayq-glass-card rounded-2xl p-4 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-bold">
                                {listing.sellerName.charAt(0)}
                            </div>
                            <div>
                                <span className="font-bold text-white font-sans text-sm block">{listing.sellerName}</span>
                                <span className="text-slate-400">{listing.sellerDid}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-emerald-400 font-bold text-sm block">{listing.sellerReputation}/100</span>
                            <span className="text-slate-500 text-[10px]">SARAL Verified Seller</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Description & Passport Verification Summary */}
            <div className="zayq-glass-card rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white font-sans">Seller Description</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{listing.description}</p>

                <div className="pt-4 border-t border-slate-800 space-y-3 font-mono text-xs">
                    <span className="font-bold text-cyan-300 uppercase tracking-wider block">
                        Verifiable Product History Summary ({passport.passportId})
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-slate-500 block text-[10px]">Service History</span>
                            <span className="text-amber-400 font-bold text-sm">{passport.serviceRecords.length} Verified OEM Records</span>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-slate-500 block text-[10px]">Hardware Inspection</span>
                            <span className="text-purple-400 font-bold text-sm">{passport.inspectionRecords[0]?.overallScore || 'Pass'}</span>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-slate-500 block text-[10px]">Warranty Status</span>
                            <span className="text-emerald-400 font-bold text-sm">{passport.warrantyRecord?.status || 'Active'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
