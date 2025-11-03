import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, database } from '../config/firebase';
import { User } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signIn = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle the rest
    } catch (error) {
      console.error('Sign in failed', error);
      setLoading(false); // Ensure loading is false on failure
      throw error; // Re-throw to be caught in the UI
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
        await firebaseSignOut(auth);
        // onAuthStateChanged will clear user data
    } catch (error) {
        console.error('Sign out failed', error);
        // Still need to turn off loading state
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setCurrentUser(user);
      if (user) {
        try {
          const userRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const data = snapshot.val();

            // --- Data Validation ---
            if (!data.email || !data.name || !data.role || !data.status) {
                console.error('Critical Auth Error: User data from database is incomplete.', { uid: user.uid, fetchedData: data });
                setUserData(null); // Force logout/redirect by nullifying user data
            } else {
                setUserData({
                    id: user.uid,
                    email: data.email,
                    name: data.name,
                    role: data.role,
                    department: data.department || 'N/A', // Provide default for optional field
                    status: data.status,
                    createdAt: data.createdAt,
                    distributorId: data.distributorId,
                    showroom_id: data.showroom_id,
                    showroom_name: data.showroom_name,
                    showroom_code: data.showroom_code
                });
            }
            
          } else {
            console.error('Authentication error: User data not found in database.', { uid: user.uid });
            setUserData(null);
          }
        } catch (error) {
          console.error('Firebase error: Could not fetch user data.', error);
          setUserData(null);
        } 
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    userData,
    loading,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
