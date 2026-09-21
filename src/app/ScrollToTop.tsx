import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Cuộn lên đầu trang mỗi khi đổi route (trừ khi điều hướng bằng nút back). */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, search]);

  return null;
}
