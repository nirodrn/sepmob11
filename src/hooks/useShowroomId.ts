import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

export function useShowroomId() {
  const { userData } = useAuth();
  const [showroomId, setShowroomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShowroomId = async () => {
      if (!userData) {
        setShowroomId(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const showroomsRef = ref(database, 'direct_showrooms');
        const showroomsSnapshot = await get(showroomsRef);

        if (showroomsSnapshot.exists()) {
          const showrooms = showroomsSnapshot.val();
          let foundShowroomId = null;

          for (const [id, showroom] of Object.entries(showrooms)) {
            if ((showroom as any).manager_id === userData.id) {
              foundShowroomId = id;
              break;
            }
          }

          setShowroomId(foundShowroomId);
          if (!foundShowroomId) {
            setError('No showroom found for this manager');
          }
        } else {
          setError('No showrooms exist in the database');
        }
      } catch (err) {
        console.error('Error fetching showroom ID:', err);
        setError('Failed to fetch showroom information');
      } finally {
        setLoading(false);
      }
    };

    fetchShowroomId();
  }, [userData]);

  return { showroomId, loading, error };
}
