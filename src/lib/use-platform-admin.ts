import { useEffect, useState } from "react";
import { checkPlatformAdmin } from "@/lib/platform.functions";

/** Whether the signed-in user is a platform (product) owner. */
export function usePlatformAdmin() {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    checkPlatformAdmin()
      .then((r) => {
        if (alive) setIsPlatformAdmin(r.isPlatformAdmin);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { isPlatformAdmin, loading };
}
