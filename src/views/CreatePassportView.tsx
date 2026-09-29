import React, { useState } from 'react';
import { ArrowLeft, Image, Laptop, ShieldCheck, Smartphone, Upload, X } from 'lucide-react';
import { User, ProductCategory } from '../types';
import { AppStore } from '../core/store';
import { getWalletState } from '../core/mst/wallet';
import { isValidImei } from '../core/verifiers/verificationEngine';

interface Props {
    currentUser: User;
    onNavigate: (view: string, param?: string) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 160 * 1024;

function readBlobAsDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The photo could not be read.'));
        reader.onerror = () => reject(new Error('The photo could not be read.'));
        reader.readAsDataURL(blob);
    });
}

async function prepareProductImage(file: File): Promise<string> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Choose a JPG, PNG, or WebP photo.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('Choose a photo smaller than 10 MB.');
    }

    const bitmap = await createImageBitmap(file);
    try {
        let scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
        let quality = 0.82;
        let blob: Blob | null = null;

        for (let attempt = 0; attempt < 12; attempt++) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Your browser could not process this photo.');
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
            if (!blob) throw new Error('Your browser could not process this photo.');
            if (blob.size <= MAX_STORED_IMAGE_BYTES) break;
            if (quality > 0.5) quality -= 0.08;
            else scale *= 0.82;
        }

        if (!blob || blob.size > MAX_STORED_IMAGE_BYTES) {
            throw new Error('This photo could not be compressed enough. Choose a smaller image.');
        }
        return readBlobAsDataUrl(blob);
    } finally {
        bitmap.close();
    }
}

export const CreatePassportView: React.FC<Props> = ({ currentUser, onNavigate }) => {
    const [category, setCategory] = useState<ProductCategory>('LAPTOP');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [releaseYear, setReleaseYear] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [imei, setImei] = useState('');
    const [serviceTag, setServiceTag] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError('');

        const year = Number(releaseYear);
        if (!brand.trim() || !model.trim()) {
            setFormError('Enter the product brand and model.');
            return;
        }
        if (!Number.isInteger(year) || year < 1970 || year > CURRENT_YEAR) {
            setFormError(`Enter a release year between 1970 and ${CURRENT_YEAR}.`);
            return;
        }
        if (!getWalletState().connected) {
            setFormError('Connect BridgeKey from the top of the page before creating a passport.');
            return;
        }
        if (category === 'LAPTOP' && serialNumber.trim().length < 5) {
            setFormError('Enter a serial number with at least 5 characters.');
            return;
        }
        if (category === 'SMARTPHONE' && !isValidImei(imei.trim())) {
            setFormError('Enter a 15-digit IMEI with a valid check digit.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { passport } = await AppStore.createPassport({
                category,
                brand: brand.trim(),
                model: model.trim(),
                releaseYear: year,
                serialNumber: serialNumber.trim() || undefined,
                imei: imei.trim() || undefined,
                serviceTag: serviceTag.trim() || undefined,
                imageUrl: imageUrl.trim(),
                currentUser,
            });
            onNavigate('passport-detail', passport.passportId);
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'The passport could not be created.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = 'zayq-input';
    const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-800';

    return (
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
            <button type="button" onClick={() => onNavigate('marketplace')} className="zayq-btn-ghost inline-flex items-center gap-2">
                <ArrowLeft size={16} /> Back to marketplace
            </button>

            <section className="zayq-glass-card rounded-2xl p-6 sm:p-8">
                <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-800">
                    <ShieldCheck size={18} /> Product passport
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Add a product</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Enter the product details buyers can use to identify it. Your BridgeKey wallet will ask you to approve the MST Testnet transaction.
                </p>
            </section>

            <form onSubmit={handleSubmit} className="zayq-glass-card space-y-6 rounded-2xl p-5 sm:p-8">
                <div>
                    <label className={labelClass} htmlFor="product-category">Product type</label>
                    <div className="relative">
                        {category === 'LAPTOP' ? <Laptop size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-500" /> : <Smartphone size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-500" />}
                        <select id="product-category" value={category} onChange={event => setCategory(event.target.value as ProductCategory)} className={`${inputClass} has-leading-icon`}>
                            <option value="LAPTOP">Laptop or computer</option>
                            <option value="SMARTPHONE">Smartphone</option>
                        </select>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className={labelClass} htmlFor="product-brand">Brand</label>
                        <input id="product-brand" autoComplete="organization" required maxLength={80} value={brand} onChange={event => setBrand(event.target.value)} placeholder="e.g. Apple" className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass} htmlFor="product-year">Release year</label>
                        <input id="product-year" required type="number" inputMode="numeric" min="1970" max={CURRENT_YEAR} value={releaseYear} onChange={event => setReleaseYear(event.target.value)} placeholder={`e.g. ${CURRENT_YEAR}`} className={inputClass} />
                    </div>
                </div>

                <div>
                    <label className={labelClass} htmlFor="product-model">Model</label>
                    <input id="product-model" required maxLength={160} value={model} onChange={event => setModel(event.target.value)} placeholder={category === 'LAPTOP' ? 'e.g. MacBook Pro 14-inch' : 'e.g. Galaxy S24'} className={inputClass} />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h2 className="mb-1 text-sm font-semibold text-slate-900">Device identifier</h2>
                    <p className="mb-4 text-xs leading-5 text-slate-600">Use the number printed on the device or its original packaging.</p>

                    {category === 'SMARTPHONE' ? (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass} htmlFor="product-imei">IMEI <span className="font-normal text-slate-500">(15 digits)</span></label>
                                <input id="product-imei" required type="text" inputMode="numeric" autoComplete="off" maxLength={15} value={imei} onChange={event => setImei(event.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="15-digit IMEI" className={`${inputClass} font-mono`} />
                                <p className="mt-1 text-xs leading-5 text-slate-500">Checks the IMEI check digit. It does not check carrier or lost-device databases.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass} htmlFor="product-serial">Serial number</label>
                                <input id="product-serial" required autoComplete="off" maxLength={100} value={serialNumber} onChange={event => setSerialNumber(event.target.value)} placeholder="Serial number" className={`${inputClass} font-mono`} />
                            </div>
                            <div>
                                <label className={labelClass} htmlFor="product-service-tag">Service tag <span className="font-normal text-slate-500">(optional)</span></label>
                                <input id="product-service-tag" autoComplete="off" maxLength={100} value={serviceTag} onChange={event => setServiceTag(event.target.value)} placeholder="If your device has one" className={`${inputClass} font-mono`} />
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <label className={labelClass} htmlFor="product-photo">Product photo <span className="font-normal text-slate-500">(optional)</span></label>
                    <input
                        id="product-photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={async event => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = '';
                            if (!file) return;
                            setFormError('');
                            try {
                                setImageUrl(await prepareProductImage(file));
                            } catch (error) {
                                setFormError(error instanceof Error ? error.message : 'The photo could not be processed.');
                            }
                        }}
                    />
                    {imageUrl ? (
                        <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
                            <img src={imageUrl} alt="Selected product" className="h-20 w-24 rounded-lg object-cover" />
                            <div className="flex flex-wrap gap-2">
                                <label htmlFor="product-photo" className="zayq-btn-ghost inline-flex cursor-pointer items-center gap-2">
                                    <Upload size={16} /> Change photo
                                </label>
                                <button type="button" onClick={() => setImageUrl('')} className="zayq-btn-ghost inline-flex items-center gap-2">
                                    <X size={16} /> Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        <label htmlFor="product-photo" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 hover:border-teal-600">
                            <Image size={20} className="text-slate-500" />
                            <span><span className="font-semibold text-teal-800">Choose a photo</span> or browse your device</span>
                            <span className="text-xs text-slate-500">Use a clear, well-lit photo showing the whole device.</span>
                            <span className="text-xs text-slate-500">JPG, PNG, or WebP · up to 10 MB · resized automatically</span>
                        </label>
                    )}
                    <p className="mt-1.5 text-xs text-slate-500">Optional. The photo is resized and saved with this product passport.</p>
                </div>

                {formError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">{formError}</p>}

                <div className="border-t border-slate-200 pt-5">
                    <button type="submit" disabled={isSubmitting} className="zayq-btn-primary w-full sm:w-auto">
                        {isSubmitting ? 'Waiting for wallet approval…' : 'Create product passport'}
                    </button>
                    <p className="mt-2 text-xs text-slate-500">This creates a product record on MST Testnet. No payment is taken.</p>
                </div>
            </form>
        </div>
    );
};
