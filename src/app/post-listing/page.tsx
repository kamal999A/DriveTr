'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, X, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import CarDamageSelector from '@/components/damage-selector/CarDamageSelector';
import type { DamagedPart } from '@/types';

const MAKES = ['BMW','Mercedes','Toyota','Honda','Ford','Audi','Volkswagen','Hyundai','Kia','Renault','Fiat','Volvo','Nissan','Mazda','Subaru','Peugeot','Citroën','Seat','Skoda','Opel'];
const FUEL_TYPES = ['Petrol','Diesel','Hybrid','Electric','LPG'];
const TRANSMISSIONS = ['Manual','Automatic','Semi-Automatic'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, i) => CURRENT_YEAR + 1 - i);
const COLOURS = ['White','Black','Silver','Red','Blue','Grey','Green','Brown','Yellow','Orange'];
const ENGINES = ['0.9','1.0','1.2','1.4','1.5','1.6','1.8','2.0','2.2','2.5','3.0','3.5','4.0+'];
const CITIES = ['Istanbul','Ankara','Izmir','Bursa','Antalya','Konya','Adana','Gaziantep','Kocaeli','Mersin','Diyarbakır','Hatay','Manisa','Kayseri','Samsun','Balıkesir','Kahramanmaraş','Van','Malatya','Erzurum'];

type Step = 'basics' | 'details' | 'photos' | 'damage' | 'review';
const STEPS: Step[] = ['basics', 'details', 'photos', 'damage', 'review'];

function PostListingPageInner() {
  const { user, profile, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const supabase = createClient();

  const [step, setStep] = useState<Step>('basics');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [damage, setDamage] = useState<DamagedPart[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    make: '', model: '', year: '2020', colour: 'White',
    mileage: '', engine_size: '1.6', fuel_type: 'Petrol',
    transmission: 'Manual', price: '', currency: 'TL',
    city: 'Istanbul', description: '',
  });

  useEffect(() => {
    if (!editId) return;
    supabase.from('car_listings').select('*').eq('id', editId).single().then(({ data }) => {
      if (!data) return;
      setForm({
        make: data.make, model: data.model, year: String(data.year),
        colour: data.colour, mileage: String(data.mileage),
        engine_size: data.engine_size, fuel_type: data.fuel_type,
        transmission: data.transmission, price: String(data.price),
        currency: data.currency, city: data.city, description: data.description || '',
      });
      setPhotoUrls(data.photos || []);
      setDamage(data.damage_parts || []);
    });
  }, [editId]);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-required">
        <h2>Sign in required</h2>
        <p>You need to be logged in to post a listing.</p>
        <button className="btn btn-primary" onClick={() => router.push('/auth/login')}>Sign In</button>
      </div>
    );
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 10 - photos.length - photoUrls.length);
    setPhotos(p => [...p, ...arr].slice(0, 10));
  };

  const removePhoto = (i: number) => setPhotos(p => p.filter((_, idx) => idx !== i));
  const removeExistingPhoto = (i: number) => setPhotoUrls(p => p.filter((_, idx) => idx !== i));

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [...photoUrls];
    for (const file of photos) {
      const filename = `${user.id}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      const { data, error } = await supabase.storage.from('car-photos').upload(filename, file, { upsert: true });
      if (error) throw new Error(`Photo upload failed: ${error.message}`);
      if (data) {
        const { data: pub } = supabase.storage.from('car-photos').getPublicUrl(data.path);
        urls.push(pub.publicUrl);
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!form.make || !form.model || !form.price || !form.mileage) {
      setError('Please fill all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const uploadedUrls = await uploadPhotos();
      const payload = {
        make: form.make,
        model: form.model,
        year: parseInt(form.year),
        colour: form.colour,
        mileage: parseInt(form.mileage),
        engine_size: form.engine_size,
        fuel_type: form.fuel_type,
        transmission: form.transmission,
        price: parseFloat(form.price),
        currency: form.currency,
        city: form.city,
        description: form.description || null,
        photos: uploadedUrls,
        damage_parts: damage,
      };

      if (editId) {
        const { error } = await supabase.from('car_listings').update(payload).eq('id', editId);
        if (error) throw new Error(error.message);
        router.push(`/cars/${editId}`);
      } else {
        const { data, error } = await supabase.from('car_listings')
          .insert({ ...payload, user_id: user.id, status: 'active' })
          .select().single();
        if (error) throw new Error(error.message);
        router.push(`/cars/${data.id}`);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);
  const nextStep = () => setStep(STEPS[stepIndex + 1]);
  const prevStep = () => setStep(STEPS[stepIndex - 1]);

  return (
    <div className="post-page">
      <div className="container">
        <h1 className="page-title">{editId ? t.postListing.editTitle : t.postListing.title}</h1>

        <div className="step-indicator">
          {STEPS.map((s, i) => {
            const stepLabels = [t.postListing.basics, t.postListing.details, t.postListing.photos, t.postListing.damage, t.postListing.review];
            return (
            <React.Fragment key={s}>
              <div
                className={`step-dot ${s === step ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
                onClick={() => i < stepIndex && setStep(s)}
              >
                <span className="step-num">{i + 1}</span>
                <span className="step-label">{stepLabels[i]}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`step-line ${i < stepIndex ? 'done' : ''}`} />}
            </React.Fragment>
            );
          })}
        </div>

        <div className="post-card card">
          {error && <div className="post-error">{error}</div>}

          {step === 'basics' && (
            <div className="step-content">
              <div className="step-header">
                <div className="step-header-icon">1</div>
                <div>
                  <h2 className="step-title">{t.postListing.basics_label}</h2>
                  <p className="step-desc">Vehicle identity — make, model, year, colour and location.</p>
                </div>
              </div>
              <div className="form-section">
                <div className="form-section-label">Vehicle</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">{t.car.make} *</label>
                    <select className="form-select" value={form.make} onChange={set('make')} required>
                      <option value="">Select make...</option>
                      {MAKES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.car.model} *</label>
                    <input type="text" className="form-input" value={form.model} onChange={set('model')} placeholder="e.g. 320i, Corolla..." required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.car.year} *</label>
                    <select className="form-select" value={form.year} onChange={set('year')}>
                      {YEARS.map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.car.colour}</label>
                    <select className="form-select" value={form.colour} onChange={set('colour')}>
                      {COLOURS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-section">
                <div className="form-section-label">Location</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">{t.car.city}</label>
                    <select className="form-select" value={form.city} onChange={set('city')}>
                      {CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="step-content">
              <div className="step-header">
                <div className="step-header-icon">2</div>
                <div>
                  <h2 className="step-title">{t.postListing.details_label}</h2>
                  <p className="step-desc">Technical specs, mileage, and asking price.</p>
                </div>
              </div>
              <div className="form-section">
                <div className="form-section-label">Specs</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">{t.car.mileage} (km) *</label>
                    <input type="number" className="form-input" value={form.mileage} onChange={set('mileage')} placeholder="e.g. 85000" min={0} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.car.engine}</label>
                    <select className="form-select" value={form.engine_size} onChange={set('engine_size')}>
                      {ENGINES.map(e => <option key={e} value={e}>{e}L</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.car.fuel}</label>
                    <select className="form-select" value={form.fuel_type} onChange={set('fuel_type')}>
                      {FUEL_TYPES.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.car.transmission}</label>
                    <select className="form-select" value={form.transmission} onChange={set('transmission')}>
                      {TRANSMISSIONS.map(tr => <option key={tr}>{tr}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-section">
                <div className="form-section-label">Pricing</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">{t.car.price} *</label>
                    <div className="price-input-row">
                      <select className="form-select" value={form.currency} onChange={set('currency')} style={{ width: 90 }}>
                        <option value="TL">₺ TL</option>
                        <option value="EUR">€ EUR</option>
                      </select>
                      <input type="number" className="form-input" value={form.price} onChange={set('price')} placeholder="e.g. 450000" min={0} required />
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-section">
                <div className="form-section-label">Description</div>
                <div className="form-group" style={{ marginTop: 4 }}>
                  <label className="form-label">{t.car.description}</label>
                  <textarea className="form-textarea" value={form.description} onChange={set('description')} placeholder="Describe the car's condition, history, extras..." rows={4} />
                </div>
              </div>
            </div>
          )}

          {step === 'photos' && (
            <div className="step-content">
              <div className="step-header">
                <div className="step-header-icon">3</div>
                <div>
                  <h2 className="step-title">{t.postListing.photosTitle}</h2>
                  <p className="step-desc">{t.postListing.photosHint}</p>
                </div>
              </div>
              <div className="form-section">
                <div className="form-section-label">Upload</div>
                <div
                  className="dropzone"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}
                >
                  <Upload size={32} className="drop-icon" />
                  <p>{t.postListing.dragDrop} <strong>{t.postListing.browse}</strong></p>
                  <span className="drop-hint">{t.postListing.photoFormat}</span>
                  <input
                    ref={fileRef} type="file" multiple accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => addPhotos(e.target.files)}
                  />
                </div>
              </div>

              {(photoUrls.length > 0 || photos.length > 0) && (
                <div className="form-section">
                  <div className="form-section-label">
                    Photos <span className="section-badge">{photoUrls.length + photos.length} / 10</span>
                  </div>
                  <div className="photo-grid">
                    {photoUrls.map((url, i) => (
                      <div key={`ex-${i}`} className="photo-thumb">
                        <img src={url} alt="" />
                        <button className="photo-remove" onClick={() => removeExistingPhoto(i)}><X size={12} /></button>
                      </div>
                    ))}
                    {photos.map((file, i) => (
                      <div key={`new-${i}`} className="photo-thumb">
                        <img src={URL.createObjectURL(file)} alt="" />
                        <button className="photo-remove" onClick={() => removePhoto(i)}><X size={12} /></button>
                        <span className="photo-new-badge">New</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'damage' && (
            <div className="step-content">
              <div className="step-header">
                <div className="step-header-icon">4</div>
                <div>
                  <h2 className="step-title">{t.car.damage}</h2>
                  <p className="step-desc">{t.damage.subtitle}</p>
                </div>
              </div>
              <div className="form-section">
                <div className="form-section-label">Damage Map</div>
                <div style={{ marginTop: 4 }}>
                  <CarDamageSelector value={damage} onChange={setDamage} />
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="step-content">
              <div className="step-header">
                <div className="step-header-icon">5</div>
                <div>
                  <h2 className="step-title">{t.postListing.reviewTitle}</h2>
                  <p className="step-desc">Check everything before publishing your listing.</p>
                </div>
              </div>
              <div className="review-grid">
                <div className="review-section">
                  <div className="review-section-hd">{t.postListing.basics_label}</div>
                  <div className="review-specs">
                    {[
                      [t.car.make, form.make], [t.car.model, form.model], [t.car.year, form.year],
                      [t.car.colour, form.colour], [t.car.city, form.city],
                    ].map(([k,v]) => (
                      <div key={k} className="review-row">
                        <span className="review-key">{k}</span>
                        <strong className="review-val">{v}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="review-section">
                  <div className="review-section-hd">{t.postListing.details_label}</div>
                  <div className="review-specs">
                    {[
                      [t.car.mileage, `${form.mileage} km`],
                      [t.car.engine, `${form.engine_size}L`],
                      [t.car.fuel, form.fuel_type],
                      [t.car.transmission, form.transmission],
                    ].map(([k,v]) => (
                      <div key={k} className="review-row">
                        <span className="review-key">{k}</span>
                        <strong className="review-val">{v}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="review-section review-price-section">
                  <div className="review-section-hd">{t.car.price}</div>
                  <div className="review-price">
                    {form.currency === 'TL' ? '₺' : '€'}{parseFloat(form.price || '0').toLocaleString()}
                  </div>
                  <div className="review-currency-badge">{form.currency}</div>
                </div>
                <div className="review-section">
                  <div className="review-section-hd">{t.car.photos}</div>
                  <div className="review-photos-count">
                    <span className="review-count-num">{photoUrls.length + photos.length}</span>
                    <span className="review-count-label">/ 10 {t.postListing.photosSelected}</span>
                  </div>
                </div>
                {damage.length > 0 && (
                  <div className="review-section">
                    <div className="review-section-hd">
                      {t.car.damage} <span className="section-badge">{damage.length}</span>
                    </div>
                    <div className="review-damage-list">
                      {damage.map(d => <span key={d.label} className="review-damage-tag">{d.label}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="step-nav">
            {stepIndex > 0 && (
              <button className="btn btn-ghost" onClick={prevStep}>← {t.postListing.back}</button>
            )}
            <div style={{ flex: 1 }} />
            {stepIndex < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={nextStep}>
                {t.postListing.next} <ChevronRight size={15} />
              </button>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : editId ? t.postListing.update : t.postListing.submit}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .post-page { padding: 28px 0 60px; }
        .auth-required { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; }

        .step-indicator { display: flex; align-items: center; margin-bottom: 24px; }
        .step-dot { display: flex; align-items: center; gap: 8px; cursor: default; flex-shrink: 0; }
        .step-dot.done { cursor: pointer; }
        .step-num { width: 30px; height: 30px; border-radius: 50%; background: #e8e8e8; color: #888; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; transition: all 0.2s; border: 2px solid transparent; }
        .step-dot.active .step-num { background: #ae050a; color: #fff; border-color: #ae050a; box-shadow: 0 0 0 3px rgba(174,5,10,0.15); }
        .step-dot.done .step-num { background: #1a7a1a; color: #fff; border-color: #1a7a1a; }
        .step-label { font-size: 12px; font-weight: 600; color: #aaa; white-space: nowrap; }
        .step-dot.active .step-label { color: #ae050a; }
        .step-dot.done .step-label { color: #1a7a1a; }
        .step-line { flex: 1; height: 2px; background: #e8e8e8; margin: 0 10px; border-radius: 2px; }
        .step-line.done { background: #1a7a1a; }

        .post-card { padding: 0; min-height: 400px; display: flex; flex-direction: column; overflow: hidden; border: 2px solid #e8b4b4; }
        .post-error { background: #ffeaea; border: 1px solid #ffb3b3; color: #ae050a; padding: 10px 14px; font-size: 13px; margin: 20px 28px 0; border-radius: 6px; }
        .step-content { flex: 1; }

        .step-header { display: flex; align-items: flex-start; gap: 14px; padding: 22px 28px 20px; border-bottom: 2px solid #f0c0c0; background: #fff8f8; }
        .step-header-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #ae050a, #c8373c); color: #fff; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .step-title { font-family: 'Montserrat', sans-serif; font-size: 17px; font-weight: 700; margin: 0 0 3px; color: #1a1a1a; }
        .step-desc { font-size: 13px; color: #888; margin: 0; line-height: 1.5; }

        .form-section { padding: 20px 28px; border-bottom: 1px solid #f0c0c0; }
        .form-section:last-of-type { border-bottom: none; }
        .form-section-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #ae050a; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .form-section-label::after { content: ''; flex: 1; height: 2px; background: linear-gradient(to right, #e8b4b4, transparent); }
        .section-badge { background: #ae050a; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; letter-spacing: 0; text-transform: none; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .price-input-row { display: flex; gap: 8px; }

        .dropzone { border: 2px dashed #ddd; border-radius: 10px; padding: 40px 24px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafafa; }
        .dropzone:hover { border-color: #ae050a; background: rgba(174,5,10,0.02); }
        .drop-icon { color: #ccc; margin: 0 auto 12px; }
        .dropzone p { font-size: 14px; color: #555; margin: 0 0 6px; }
        .drop-hint { font-size: 12px; color: #aaa; }
        .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
        .photo-thumb { position: relative; aspect-ratio: 4/3; border-radius: 8px; overflow: hidden; border: 1px solid #e8e8e8; }
        .photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .photo-remove { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; }
        .photo-new-badge { position: absolute; bottom: 4px; left: 4px; background: #1a7a1a; color: #fff; font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 700; }

        .review-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; padding: 20px 28px; }
        .review-section { background: #fff; border: 1px solid #ebebeb; border-radius: 10px; padding: 16px; }
        .review-section-hd { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #ae050a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f5f5f5; display: flex; align-items: center; gap: 6px; }
        .review-specs { display: flex; flex-direction: column; }
        .review-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f8f8f8; }
        .review-row:last-child { border-bottom: none; }
        .review-key { font-size: 12px; color: #888; }
        .review-val { font-size: 13px; color: #1a1a1a; font-weight: 600; }
        .review-price-section { background: linear-gradient(135deg, #fff8f8, #fff); border-color: #f0c0c0; }
        .review-price { font-family: 'Montserrat', sans-serif; font-size: 26px; font-weight: 800; color: #ae050a; line-height: 1; margin: 4px 0; }
        .review-currency-badge { display: inline-block; background: #ffeaea; color: #ae050a; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 6px; }
        .review-photos-count { display: flex; align-items: baseline; gap: 4px; margin-top: 4px; }
        .review-count-num { font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800; color: #1a1a1a; }
        .review-count-label { font-size: 12px; color: #888; }
        .review-damage-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
        .review-damage-tag { background: #ffeaea; color: #ae050a; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; border: 1px solid #ffcccc; }

        .step-nav { display: flex; align-items: center; padding: 18px 28px; border-top: 2px solid #f0c0c0; gap: 10px; background: #fff8f8; }

        @media (max-width: 640px) {
          .step-label { display: none; }
          .step-indicator { justify-content: center; }
          .step-header { padding: 16px; gap: 10px; }
          .step-header-icon { width: 30px; height: 30px; font-size: 13px; border-radius: 8px; }
          .step-title { font-size: 15px; }
          .form-section { padding: 14px 16px; }
          .form-grid { grid-template-columns: 1fr; gap: 12px; }
          .dropzone { padding: 24px 16px; }
          .review-grid { padding: 14px 16px; grid-template-columns: 1fr; }
          .step-nav { padding: 14px 16px; flex-wrap: wrap; }
          .post-error { margin: 14px 16px 0; }
        }
        @media (max-width: 480px) {
          .photo-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  );
}


export default function PostListingPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>}>
      <PostListingPageInner />
    </Suspense>
  );
}
