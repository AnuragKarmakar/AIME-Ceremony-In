import { useEffect, useState } from "react";

/**
 * Whether this browser will actually keep what the ceremony saves locally.
 * localStorage can be missing or throw (some privacy settings, a full disk),
 * and the "you can leave and come back" guidance should not promise saving
 * that cannot happen. Starts true so the first render matches the server's.
 */
export function useStorageAvailable(): boolean {
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    try {
      const probe = "aime-ceremony-in:probe";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
    } catch {
      setAvailable(false);
    }
  }, []);

  return available;
}
