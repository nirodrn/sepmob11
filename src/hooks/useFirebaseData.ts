import { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, onValue, push, set, update, remove } from 'firebase/database';
import app from '../config/firebase';

const database = getDatabase(app);

// Hook for reading data from Firebase Realtime Database
export function useFirebaseData<T>(path: string, refreshKey: number = 0): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Reset state on path or refreshKey change
    setLoading(true);
    setError(null);

    const dbRef = ref(database, path);
    const unsubscribe = onValue(dbRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          setData(snapshot.val());
        } else {
          setData(null);
        }
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [path, refreshKey]); // Add refreshKey to dependency array

  return { data, loading, error };
}

// Hook for performing actions on Firebase Realtime Database
export function useFirebaseActions(basePath: string = '') {
  const getFullPath = (path: string) => {
    return [basePath, path].filter(Boolean).join('/');
  };

  const addData = useCallback(async (path: string, data: any) => {
    const fullPath = getFullPath(path);
    const dbRef = ref(database, fullPath);
    const newRef = push(dbRef);
    await set(newRef, { ...data, createdAt: new Date().toISOString(), id: newRef.key });
    return newRef.key;
  }, [basePath]);

  const setData = useCallback(async (path: string, data: any) => {
    const fullPath = getFullPath(path);
    const dbRef = ref(database, fullPath);
    await set(dbRef, data);
  }, [basePath]);

  const updateData = useCallback(async (path: string, data: any) => {
    const fullPath = getFullPath(path);
    const dbRef = ref(database, fullPath);
    await update(dbRef, data);
  }, [basePath]);

  const deleteData = useCallback(async (path: string) => {
    const fullPath = getFullPath(path);
    const dbRef = ref(database, fullPath);
    await remove(dbRef);
  }, [basePath]);

  return { addData, setData, updateData, deleteData };
}
