import { useEffect, useState } from 'react';
import { fetchAreas } from '../api/areas';

export default function useAreaCatalog(accessToken) {
  const [catalog, setCatalog] = useState({ areas: [], loading: false, error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setCatalog({ areas: [], loading: true, error: '' });
    fetchAreas({ accessToken, signal: controller.signal })
      .then(areas => {
        if (!controller.signal.aborted) setCatalog({ areas, loading: false, error: '' });
      })
      .catch(error => {
        if (!controller.signal.aborted) setCatalog({ areas: [], loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [accessToken, retry]);
  return { ...catalog, reload: () => setRetry(current => current + 1) };
}
