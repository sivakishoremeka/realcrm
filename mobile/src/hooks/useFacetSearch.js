import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';

const SEARCH_DEBOUNCE_MS = 300;
const EMPTY = { items: [], facets: {}, total: 0 };

/**
 * List state for a facet-search endpoint returning `{ items, facets, total }`.
 * Reloads on screen focus, on filter change and (debounced) while typing.
 * @param {string} url
 * @param {string} errorMessage shown when the request fails without a server message
 */
export default function useFacetSearch(url, errorMessage) {
  const [result, setResult] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  // facet key → selected value; missing/'' means "Any"
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const latest = useRef({});

  const activeCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const reload = async () => {
    // Only the newest request may update the list (typing fires several).
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      // Read from the ref so a reload() called from an older render (after an
      // await in a screen) still uses the current search and filters.
      const params = Object.fromEntries(Object.entries(latest.current).filter(([, v]) => v));
      const { data } = await api.get(url, { params });
      if (id !== requestId.current) return;
      setResult({ items: data.items || [], facets: data.facets || {}, total: data.total || 0 });
    } catch (err) {
      if (id !== requestId.current) return;
      Alert.alert('Error', err.response?.data?.message || errorMessage);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      latest.current = { ...filters, q: query };
      reload();
    }, [filters, query])
  );

  const toggleFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }));

  const clearFilters = () => {
    setFilters({});
    setSearch('');
  };

  return {
    ...result,
    search,
    setSearch,
    filters,
    toggleFilter,
    clearFilters,
    activeCount,
    isFiltered: activeCount > 0 || !!query,
    loading,
    refreshing,
    reload,
  };
}
