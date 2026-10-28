import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

// Categories, localities, conditions and brands come from the database (admin-editable later).
const MetaCtx = createContext(null);
const EMPTY = { categories: [], localities: [], cities: ['Bengaluru'], conditions: [], units: [], sellerTypes: [], brands: [] };

export function MetaProvider({ children }) {
  const [state, setState] = useState({ ...EMPTY, loading: true, error: null });
  const load = () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    api('/meta').then((d) => setState({ ...EMPTY, ...d, loading: false, error: null })).catch((e) => setState({ ...EMPTY, loading: false, error: e.message }));
  };
  useEffect(load, []);
  const catBySlug = (slug) => state.categories.find((c) => c.slug === slug);
  return <MetaCtx.Provider value={{ ...state, catBySlug, reload: load }}>{children}</MetaCtx.Provider>;
}
export const useMeta = () => useContext(MetaCtx);
