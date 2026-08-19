
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'seller';
  name: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: (role?: 'admin' | 'seller') => void;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const createFallbackProfile = (u: User): UserProfile => {
    const fallbackName = u.displayName || u.email?.split('@')[0] || 'User';
    return {
      uid: u.uid,
      email: u.email || 'user@example.com',
      role: 'admin',
      name: fallbackName,
    };
  };

  const fetchUserProfile = async (userId: string, currentUser?: User) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const profileData = userDoc.data() as UserProfile;
        setUserProfile(profileData);
        return profileData;
      }
    } catch (error) {
      console.error('Error fetching user profile from Firestore:', error);
    }
    // Fallback profile if Firestore document does not exist or fetch fails
    const activeUser = currentUser || auth.currentUser;
    if (activeUser) {
      const fallback = createFallbackProfile(activeUser);
      setUserProfile(fallback);
      return fallback;
    }
    return null;
  };

  const refreshUserProfile = async () => {
    if (user) {
      await fetchUserProfile(user.uid, user);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log('Auth state changed:', u);
      setUser(u);
      
      if (u) {
        await fetchUserProfile(u.uid, u);
      } else {
        // Only clear profile if not in demo mode
        if (user?.uid !== 'demo-user-id') {
          setUserProfile(null);
        }
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', result.user.email);
      await fetchUserProfile(result.user.uid, result.user);
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const demoLogin = (role: 'admin' | 'seller' = 'admin') => {
    const demoUser = {
      uid: 'demo-user-id',
      email: role === 'admin' ? 'admin@demo.com' : 'seller@demo.com',
      displayName: role === 'admin' ? 'Demo Admin' : 'Demo Seller',
      emailVerified: true,
      isAnonymous: false,
    } as unknown as User;

    const demoProfile: UserProfile = {
      uid: 'demo-user-id',
      email: role === 'admin' ? 'admin@demo.com' : 'seller@demo.com',
      role: role,
      name: role === 'admin' ? 'Demo Admin' : 'Demo Seller',
    };

    setUser(demoUser);
    setUserProfile(demoProfile);
    setLoading(false);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.log('Signout notice:', e);
    }
    setUser(null);
    setUserProfile(null);
  };

  const value = {
    user,
    userProfile,
    loading,
    login,
    demoLogin,
    logout,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
