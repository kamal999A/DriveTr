'use client';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SlidersHorizontal, Search, X, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import CarCard from '@/components/car/CarCard';
import type { CarListing, CarFilters } from '@/types';

const MAKES        = ['BMW','Mercedes','Toyota','Honda','Ford','Audi','Volkswagen','Hyundai','Kia','Renault','Fiat','Volvo','Nissan','Mazda','Subaru','Peugeot','Citroën','Seat','Skoda','Opel'];
const FUEL_TYPES   = ['Petrol','Diesel','Hybrid','Electric','LPG'];
const TRANSMISSIONS= ['Manual','Automatic','Semi-Automatic'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS        = Array.from({ length: 31 }, (_, i) => CURRENT_YEAR + 1 - i); // includes next model year
const COLOURS      = ['White','Black','Silver','Red','Blue','Grey','Green','Brown','Yellow','Orange'];
const ENGINES      = ['1.0','1.2','1.4','1.5','1.6','1.8','2.0','2.2','2.5','3.0','3.5','4.0+'];
const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc',  label: 'Oldest First' },
  { value: 'price:asc',       label: 'Price: Low → High' },
  { value: 'price:desc',      label: 'Price: High → Low' },
  { value: 'year:desc',       label: 'Year: Newest' },
  { value: 'mileage:asc',     label: 'Mileage: Lowest' },
];

function CarsPageInner() {
  const { t }          = useI18n();
  const { user }       = useAuth();
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const supabase       = createClient();
  const searchRef      = useRef<HTMLInputElement>(null);

  const [listings, setListings]   = useState<CarListing[]>([]);
  const [savedIds, setSavedIds]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [page, setPage]           = useState(1);
  const [sort, setSort]           = useState('created_at:desc');
  const PER_PAGE = 20;

  const [filters, setFilters] = useState<CarFilters>({
    make: searchParams.get('make') || undefined,
  });
  const [search, setSearch]   = useState(searchParams.get('q') || '');
  const [inputVal, setInputVal] = useState(searchParams.get('q') || '');

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const [sortCol, sortDir] = sort.split(':');
    let query = supabase
      .from('car_listings')
      .select('*, seller:profiles(id,name,surname,avatar_url)', { count: 'exact' })
      .eq('status', 'active')
      .order(sortCol, { ascending: sortDir === 'asc' })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

    if (search) {
      // Commas and parentheses are PostgREST or() syntax — strip them so a
      // search like "2.0 TDI, manual" doesn't break the query.
      const safe = search.replace(/[,()]/g, ' ').trim();
      if (safe) query = query.or(`make.ilike.%${safe}%,model.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
    if (filters.make)       query = query.ilike('make', filters.make);
    if (filters.model)      query = query.ilike('model', `%${filters.model}%`);
    if (filters.year_min)   query = query.gte('year', filters.year_min);
    if (filters.year_max)   query = query.lte('year', filters.year_max);
    if (filters.colour)     query = query.ilike('colour', filters.colour);
    if (filters.engine_size)query = query.eq('engine_size', filters.engine_size);
    if (filters.fuel_type)  query = query.eq('fuel_type', filters.fuel_type);
    if (filters.transmission) query = query.eq('transmission', filters.transmission);
    if (filters.price_min)  query = query.gte('price', filters.price_min);
    if (filters.price_max)  query = query.lte('price', filters.price_max);
    if (filters.mileage_max)query = query.lte('mileage', filters.mileage_max);

    const { data, count } = await query;
    if (data) setListings(data as CarListing[]);
    if (count != null) setTotal(count);
    setLoading(false);
  }, [filters, search, page, sort]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // Keep state in sync with the URL — without this, searching from the navbar
  // while already on /cars (router.push('/cars?q=…')) silently does nothing,
  // because the initial useState only read the params once at mount.
  useEffect(() => {
    const q    = searchParams.get('q') || '';
    const make = searchParams.get('make') || undefined;
    setSearch(q);
    setInputVal(q);
    setFilters(f => (f.make === make ? f : { ...f, make }));
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    supabase.from('saved_cars').select('listing_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setSavedIds(new Set(data.map((s: any) => s.listing_id)));
      });
  }, [user]);

  const setF = (k: keyof CarFilters) => (v: string | undefined) => {
    setFilters(f => ({ ...f, [k]: v || undefined }));
    setPage(1);
  };

  const resetAll = () => { setFilters({}); setSearch(''); setInputVal(''); setPage(1); };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputVal.trim());
    setPage(1);
  };

  const activeCount = Object.values(filters).filter(Boolean).length + (search ? 1 : 0);

  const pages = Math.ceil(total / PER_PAGE);

  return (
    <div className="cp-page">
      {/* ── Top bar ── */}
      <div className="cp-topbar">
        <div className="container cp-topbar-inner">
          <div className="cp-topbar-left">
            <h1 className="cp-title">{t.nav.allListings}</h1>
            <span className="cp-count">
              {loading ? '…' : `${total.toLocaleString()} cars`}
            </span>
          </div>

          {/* Search */}
          <form className="cp-search-form" onSubmit={handleSearch}>
            <div className="cp-search-box">
              <Search size={16} className="cp-search-icon" />
              <input
                ref={searchRef}
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Make, model, keyword…"
                className="cp-search-input"
              />
              {inputVal && (
                <button type="button" className="cp-search-clear" onClick={() => { setInputVal(''); setSearch(''); }}>
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit" className="cp-search-btn">
              <Search size={15} /> Search
            </button>
          </form>

          <div className="cp-topbar-right">
            {/* Sort */}
            <div className="cp-sort-wrap">
              <select className="cp-sort" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={14} className="cp-sort-icon" />
            </div>

            {/* Filter toggle */}
            <button
              className={`cp-filter-btn ${sidebarOpen ? 'open' : ''}`}
              onClick={() => setSidebarOpen(v => !v)}
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeCount > 0 && <span className="cp-filter-badge">{activeCount}</span>}
              {sidebarOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>
      </div>

      <div className="container cp-body">
        <div className={`cp-layout ${sidebarOpen ? 'with-sidebar' : 'no-sidebar'}`}>

          {/* ── Filter sidebar ── */}
          {sidebarOpen && (
            <aside className="cp-sidebar">
              <div className="cp-sidebar-hdr">
                <span className="cp-sidebar-title">
                  <SlidersHorizontal size={14} /> Filters
                  {activeCount > 0 && <span className="cp-sidebar-badge">{activeCount}</span>}
                </span>
                {activeCount > 0 && (
                  <button className="cp-reset-btn" onClick={resetAll}>
                    <RotateCcw size={12} /> Reset
                  </button>
                )}
              </div>

              <FilterSection title="Make">
                <select className="cp-select" value={filters.make || ''} onChange={e => setF('make')(e.target.value)}>
                  <option value="">Any make</option>
                  {MAKES.map(m => <option key={m}>{m}</option>)}
                </select>
              </FilterSection>

              <FilterSection title="Year">
                <div className="cp-range">
                  <select className="cp-select" value={filters.year_min || ''} onChange={e => setF('year_min')(e.target.value)}>
                    <option value="">From</option>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                  <span className="cp-range-sep">—</span>
                  <select className="cp-select" value={filters.year_max || ''} onChange={e => setF('year_max')(e.target.value)}>
                    <option value="">To</option>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </FilterSection>

              <FilterSection title="Price (₺)">
                <div className="cp-range">
                  <input className="cp-input" type="number" placeholder="Min" value={filters.price_min || ''} onChange={e => setF('price_min')(e.target.value)} />
                  <span className="cp-range-sep">—</span>
                  <input className="cp-input" type="number" placeholder="Max" value={filters.price_max || ''} onChange={e => setF('price_max')(e.target.value)} />
                </div>
              </FilterSection>

              <FilterSection title="Fuel Type">
                <div className="cp-pills">
                  {FUEL_TYPES.map(f => (
                    <button
                      key={f}
                      className={`cp-pill ${filters.fuel_type === f ? 'active' : ''}`}
                      onClick={() => setF('fuel_type')(filters.fuel_type === f ? undefined : f)}
                    >{f}</button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Transmission">
                <div className="cp-pills">
                  {TRANSMISSIONS.map(tr => (
                    <button
                      key={tr}
                      className={`cp-pill ${filters.transmission === tr ? 'active' : ''}`}
                      onClick={() => setF('transmission')(filters.transmission === tr ? undefined : tr)}
                    >{tr}</button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Colour">
                <div className="cp-color-grid">
                  {COLOURS.map(c => (
                    <button
                      key={c}
                      className={`cp-color-pill ${filters.colour === c ? 'active' : ''}`}
                      onClick={() => setF('colour')(filters.colour === c ? undefined : c)}
                    >{c}</button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Engine Size">
                <select className="cp-select" value={filters.engine_size || ''} onChange={e => setF('engine_size')(e.target.value)}>
                  <option value="">Any</option>
                  {ENGINES.map(e => <option key={e} value={e}>{e}L</option>)}
                </select>
              </FilterSection>

              <FilterSection title="Max Mileage (km)">
                <input className="cp-input" type="number" placeholder="e.g. 100000" value={filters.mileage_max || ''} onChange={e => setF('mileage_max')(e.target.value)} />
              </FilterSection>
            </aside>
          )}

          {/* ── Results grid ── */}
          <main className="cp-results">
            {/* Active filter chips */}
            {activeCount > 0 && (
              <div className="cp-active-filters">
                {search && (
                  <span className="cp-chip">
                    Search: "{search}"
                    <button onClick={() => { setSearch(''); setInputVal(''); }}><X size={11} /></button>
                  </span>
                )}
                {filters.make && (
                  <span className="cp-chip">
                    {filters.make}
                    <button onClick={() => setF('make')(undefined)}><X size={11} /></button>
                  </span>
                )}
                {filters.fuel_type && (
                  <span className="cp-chip">
                    {filters.fuel_type}
                    <button onClick={() => setF('fuel_type')(undefined)}><X size={11} /></button>
                  </span>
                )}
                {filters.transmission && (
                  <span className="cp-chip">
                    {filters.transmission}
                    <button onClick={() => setF('transmission')(undefined)}><X size={11} /></button>
                  </span>
                )}
                {filters.colour && (
                  <span className="cp-chip">
                    {filters.colour}
                    <button onClick={() => setF('colour')(undefined)}><X size={11} /></button>
                  </span>
                )}
                {(filters.year_min || filters.year_max) && (
                  <span className="cp-chip">
                    {filters.year_min || '—'} – {filters.year_max || '—'}
                    <button onClick={() => { setF('year_min')(undefined); setF('year_max')(undefined); }}><X size={11} /></button>
                  </span>
                )}
                {(filters.price_min || filters.price_max) && (
                  <span className="cp-chip">
                    ₺{filters.price_min || '0'} – ₺{filters.price_max || '∞'}
                    <button onClick={() => { setF('price_min')(undefined); setF('price_max')(undefined); }}><X size={11} /></button>
                  </span>
                )}
                <button className="cp-chip-clear" onClick={resetAll}>Clear all</button>
              </div>
            )}

            {loading ? (
              <div className="grid-listings">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="cp-skeleton" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="cp-empty">
                <div className="cp-empty-icon">🔍</div>
                <h3>No listings found</h3>
                <p>Try adjusting your search or filters</p>
                <button className="cp-reset-all-btn" onClick={resetAll}>Reset Filters</button>
              </div>
            ) : (
              <div className="grid-listings">
                {listings.map(l => (
                  <CarCard
                    key={l.id} listing={l}
                    saved={savedIds.has(l.id)}
                    onSaveToggle={(id, s) => {
                      setSavedIds(prev => {
                        const n = new Set(prev);
                        if (s) n.add(id); else n.delete(id);
                        return n;
                      });
                    }}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="cp-pagination">
                <button className="cp-page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                <button className="cp-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const p = Math.max(1, Math.min(pages - 4, page - 2)) + i;
                  return (
                    <button key={p} className={`cp-page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                      {p}
                    </button>
                  );
                })}
                <button className="cp-page-btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}>›</button>
                <button className="cp-page-btn" disabled={page === pages} onClick={() => setPage(pages)}>»</button>
              </div>
            )}
          </main>
        </div>
      </div>

      <style jsx>{`
        /* ── Page ── */
        .cp-page { min-height: 100vh; background: #f0f4f8; }

        /* ── Topbar ── */
        .cp-topbar {
          background: #fff; border-bottom: 1px solid #e2e8f0;
          position: sticky; top: 0; z-index: 40;
          box-shadow: 0 1px 8px rgba(0,0,0,0.06);
        }
        .cp-topbar-inner {
          display: flex; align-items: center; gap: 16px;
          padding-top: 14px; padding-bottom: 14px; flex-wrap: wrap;
        }
        .cp-topbar-left { flex-shrink: 0; }
        .cp-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;
        }
        .cp-count { font-size: 12px; color: #94a3b8; font-weight: 500; }

        /* Search */
        .cp-search-form { display: flex; gap: 8px; flex: 1; min-width: 240px; max-width: 480px; }
        .cp-search-box {
          flex: 1; display: flex; align-items: center; gap: 8px;
          background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px;
          padding: 0 12px; transition: border-color 0.15s;
        }
        .cp-search-box:focus-within { border-color: #ae050a; background: #fff; }
        .cp-search-icon { color: #94a3b8; flex-shrink: 0; }
        .cp-search-input {
          flex: 1; border: none; outline: none; background: transparent;
          font-size: 14px; color: #1e293b; padding: 9px 0;
          font-family: 'Inter', sans-serif;
        }
        .cp-search-input::placeholder { color: #cbd5e1; }
        .cp-search-clear {
          background: none; border: none; color: #94a3b8; cursor: pointer;
          display: flex; align-items: center; padding: 2px;
          border-radius: 4px; transition: color 0.15s;
        }
        .cp-search-clear:hover { color: #ae050a; }
        .cp-search-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 18px; background: #ae050a; color: #fff;
          border: none; border-radius: 8px; font-size: 14px; font-weight: 700;
          cursor: pointer; white-space: nowrap; transition: background 0.15s;
          font-family: 'Inter', sans-serif;
        }
        .cp-search-btn:hover { background: #c4060c; }

        /* Topbar right */
        .cp-topbar-right { display: flex; align-items: center; gap: 10px; margin-left: auto; flex-shrink: 0; }

        /* Sort */
        .cp-sort-wrap { position: relative; display: flex; align-items: center; }
        .cp-sort {
          appearance: none; padding: 8px 32px 8px 12px;
          background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px;
          font-size: 13px; font-weight: 600; color: #475569; cursor: pointer;
          font-family: 'Inter', sans-serif; outline: none;
          transition: border-color 0.15s;
        }
        .cp-sort:hover, .cp-sort:focus { border-color: #ae050a; }
        .cp-sort-icon { position: absolute; right: 10px; color: #94a3b8; pointer-events: none; }

        /* Filter button */
        .cp-filter-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 8px;
          background: #f8fafc; border: 1.5px solid #e2e8f0;
          font-size: 13px; font-weight: 700; color: #475569; cursor: pointer;
          transition: all 0.15s; font-family: 'Inter', sans-serif;
        }
        .cp-filter-btn:hover { border-color: #ae050a; color: #ae050a; background: #fef2f2; }
        .cp-filter-btn.open { background: #ae050a; border-color: #ae050a; color: #fff; }
        .cp-filter-badge {
          background: #fff; color: #ae050a;
          width: 18px; height: 18px; border-radius: 50%;
          font-size: 10px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }
        .cp-filter-btn:not(.open) .cp-filter-badge { background: #ae050a; color: #fff; }

        /* ── Body ── */
        .cp-body { padding: 24px 0 64px; }
        .cp-layout { display: flex; gap: 22px; align-items: flex-start; }
        .cp-layout.no-sidebar .cp-results { width: 100%; }

        /* ── Sidebar ── */
        .cp-sidebar {
          width: 256px; flex-shrink: 0;
          background: #fff; border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          position: sticky; top: 70px;
          max-height: calc(100vh - 90px); overflow-y: auto;
          animation: slideDown 0.2s ease;
        }
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .cp-sidebar::-webkit-scrollbar { width: 3px; }
        .cp-sidebar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

        .cp-sidebar-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid #f1f5f9;
          position: sticky; top: 0; background: #fff; z-index: 1;
        }
        .cp-sidebar-title {
          display: flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.8px; color: #334155;
        }
        .cp-sidebar-badge {
          background: #ae050a; color: #fff;
          width: 18px; height: 18px; border-radius: 50%;
          font-size: 10px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }
        .cp-reset-btn {
          display: flex; align-items: center; gap: 4px;
          font-size: 12px; font-weight: 600; color: #ae050a;
          background: none; border: none; cursor: pointer;
          padding: 4px 8px; border-radius: 6px;
          transition: background 0.15s;
        }
        .cp-reset-btn:hover { background: #fef2f2; }

        /* Filter section (rendered by FilterSection component inline) */
        :global(.cp-fsec) { border-bottom: 1px solid #f1f5f9; }
        :global(.cp-fsec-title) {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; font-size: 12px; font-weight: 700;
          color: #475569; text-transform: uppercase; letter-spacing: 0.5px;
          cursor: pointer; user-select: none;
        }
        :global(.cp-fsec-body) { padding: 4px 16px 14px; }

        /* Filter inputs */
        .cp-select, .cp-input {
          width: 100%; padding: 8px 10px;
          border: 1.5px solid #e2e8f0; border-radius: 7px;
          font-size: 13px; color: #334155; background: #f8fafc;
          outline: none; font-family: 'Inter', sans-serif;
          transition: border-color 0.15s; box-sizing: border-box;
        }
        .cp-select { appearance: none; cursor: pointer; }
        .cp-select:focus, .cp-input:focus { border-color: #ae050a; background: #fff; }

        .cp-range { display: flex; align-items: center; gap: 6px; }
        .cp-range .cp-select, .cp-range .cp-input { flex: 1; }
        .cp-range-sep { font-size: 13px; color: #94a3b8; flex-shrink: 0; }

        /* Pills */
        .cp-pills { display: flex; flex-wrap: wrap; gap: 6px; }
        .cp-pill {
          padding: 5px 10px; border-radius: 6px;
          border: 1.5px solid #e2e8f0; background: #f8fafc;
          font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;
          transition: all 0.15s;
        }
        .cp-pill:hover { border-color: #ae050a; color: #ae050a; }
        .cp-pill.active { background: #ae050a; border-color: #ae050a; color: #fff; }

        /* Color pills */
        .cp-color-grid { display: flex; flex-wrap: wrap; gap: 5px; }
        .cp-color-pill {
          padding: 4px 9px; border-radius: 5px;
          border: 1.5px solid #e2e8f0; background: #f8fafc;
          font-size: 11px; font-weight: 600; color: #64748b; cursor: pointer;
          transition: all 0.15s;
        }
        .cp-color-pill:hover { border-color: #ae050a; }
        .cp-color-pill.active { border-color: #ae050a; background: #fef2f2; color: #ae050a; }

        /* ── Results ── */
        .cp-results { flex: 1; min-width: 0; }

        /* Active filter chips */
        .cp-active-filters {
          display: flex; flex-wrap: wrap; gap: 8px;
          margin-bottom: 16px; align-items: center;
        }
        .cp-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 99px; font-size: 12px; font-weight: 600; color: #ae050a;
        }
        .cp-chip button {
          background: none; border: none; color: #ae050a; cursor: pointer;
          display: flex; align-items: center; padding: 0;
          opacity: 0.7; transition: opacity 0.15s;
        }
        .cp-chip button:hover { opacity: 1; }
        .cp-chip-clear {
          font-size: 12px; font-weight: 700; color: #64748b;
          background: none; border: 1px solid #e2e8f0; border-radius: 99px;
          padding: 5px 12px; cursor: pointer; transition: all 0.15s;
        }
        .cp-chip-clear:hover { border-color: #ae050a; color: #ae050a; }

        /* Skeleton */
        .cp-skeleton {
          height: 280px; border-radius: 10px;
          background: linear-gradient(90deg, #f0f4f8 25%, #e8edf2 50%, #f0f4f8 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

        /* Empty */
        .cp-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 72px 20px; text-align: center;
          background: #fff; border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .cp-empty-icon { font-size: 48px; }
        .cp-empty h3 { font-size: 18px; font-weight: 700; color: #334155; margin: 0; }
        .cp-empty p  { font-size: 14px; color: #94a3b8; margin: 0; }
        .cp-reset-all-btn {
          padding: 9px 22px; background: #ae050a; color: #fff;
          border: none; border-radius: 8px; font-size: 14px; font-weight: 700;
          cursor: pointer; transition: background 0.15s;
        }
        .cp-reset-all-btn:hover { background: #c4060c; }

        /* Pagination */
        .cp-pagination { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 32px; }
        .cp-page-btn {
          width: 36px; height: 36px; border-radius: 8px;
          border: 1.5px solid #e2e8f0; background: #fff;
          font-size: 13px; font-weight: 600; color: #475569; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .cp-page-btn:hover:not(:disabled) { border-color: #ae050a; color: #ae050a; }
        .cp-page-btn.active { background: #ae050a; border-color: #ae050a; color: #fff; }
        .cp-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        @media (max-width: 900px) {
          .cp-sidebar { width: 220px; }
          .cp-topbar-inner { gap: 10px; }
        }
        @media (max-width: 720px) {
          .cp-layout { flex-direction: column; }
          .cp-sidebar { width: 100%; position: static; max-height: none; }
          .cp-search-form { max-width: 100%; min-width: 0; }
          .cp-topbar-inner { flex-wrap: wrap; gap: 8px; }
          .cp-topbar-right { width: 100%; justify-content: flex-end; }
          .cp-page-btn { width: 34px; height: 34px; font-size: 13px; }
        }
        @media (max-width: 480px) {
          .cp-topbar { padding: 10px 0; }
          .cp-topbar-inner { gap: 6px; }
          .cp-search-form { font-size: 14px; }
          .cp-filter-btn { font-size: 12px; padding: 7px 10px; }
          .cp-sort-wrap select { font-size: 12px; padding: 7px 8px; }
          .cp-results { font-size: 12px; }
          .cp-pagination { gap: 4px; flex-wrap: wrap; justify-content: center; }
        }
      `}</style>
    </div>
  );
}

/* ── Collapsible filter section ── */
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="cp-fsec">
      <div className="cp-fsec-title" onClick={() => setOpen(v => !v)}>
        {title}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </div>
      {open && <div className="cp-fsec-body">{children}</div>}
    </div>
  );
}


// useSearchParams() requires a Suspense boundary in the App Router —
// without this, `next build` fails while prerendering this page.
export default function CarsPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>}>
      <CarsPageInner />
    </Suspense>
  );
}
