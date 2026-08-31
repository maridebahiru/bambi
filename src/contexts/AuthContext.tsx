
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { logActivity } from '../lib/activityLogger';

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'seller' | 'temporary';
  name: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: (role?: 'admin' | 'seller' | 'temporary') => void;
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
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('shop_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  const [user, setUser] = useState<User | null>(() => {
    if (userProfile?.uid === 'demo-user-id') {
      return {
        uid: 'demo-user-id',
        email: userProfile.email,
        displayName: userProfile.name,
      } as unknown as User;
    }
    return auth.currentUser;
  });

  const [loading, setLoading] = useState(true);

  const setUserProfile = (profile: UserProfile | null) => {
    setUserProfileState(profile);
    if (profile) {
      localStorage.setItem('shop_user_profile', JSON.stringify(profile));
    } else {
      localStorage.removeItem('shop_user_profile');
    }
  };

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
      if (u) {
        setUser(u);
        await fetchUserProfile(u.uid, u);
      } else {
        // If logged in via Demo Mode or saved profile exists, preserve profile!
        const savedProfile = localStorage.getItem('shop_user_profile');
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed?.uid) {
              setUserProfileState(parsed);
              if (parsed.uid === 'demo-user-id' && !user) {
                setUser({
                  uid: 'demo-user-id',
                  email: parsed.email,
                  displayName: parsed.name,
                } as unknown as User);
              }
            }
          } catch (e) {}
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const profile = await fetchUserProfile(result.user.uid, result.user);
      logActivity('LOGIN', `User logged in: ${profile?.name || result.user.email} (${profile?.role || 'user'})`, {
        uid: result.user.uid,
        name: profile?.name || result.user.email || 'User'
      });
    } catch (error: any) {
      console.error('Login error:', error);
      // Auto-provision Super Admin if registering / logging in for the first time
      const normalizedEmail = email.trim().toLowerCase();
      if (
        normalizedEmail === 'maramawitdereje93@gmail.com' &&
        (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/user-mismatch' || error.code === 'auth/invalid-email')
      ) {
        try {
          console.log('Auto-provisioning super admin user account...');
          const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
          const newUid = userCredential.user.uid;
          const adminProfile: UserProfile = {
            uid: newUid,
            name: 'Maramawit Dereje',
            email: email.trim(),
            role: 'admin'
          };
          await setDoc(doc(db, 'users', newUid), {
            ...adminProfile,
            createdAt: new Date()
          });
          setUser(userCredential.user);
          setUserProfile(adminProfile);
          logActivity('LOGIN', `Super Admin account initialized & logged in: Maramawit Dereje (admin)`, {
            uid: newUid,
            name: 'Maramawit Dereje'
          });
          return;
        } catch (signupErr: any) {
          console.error('Auto admin provision error:', signupErr);
          if (signupErr.code === 'auth/email-already-in-use') {
            throw new Error('Email exists in Firebase Auth with a different password. Please check your password.');
          }
        }
      }
      throw error;
    }
  };

  const demoLogin = (role: 'admin' | 'seller' | 'temporary' = 'admin') => {
    let email = 'admin@demo.com';
    let name = 'Demo Admin';

    if (role === 'seller') {
      email = 'seller@demo.com';
      name = 'Demo Seller';
    } else if (role === 'temporary') {
      email = 'temp@demo.com';
      name = 'Temporary Staff';
    }

    const demoUser = {
      uid: 'demo-user-id',
      email: email,
      displayName: name,
      emailVerified: true,
      isAnonymous: false,
    } as unknown as User;

    const demoProfile: UserProfile = {
      uid: 'demo-user-id',
      email: email,
      role: role,
      name: name,
    };

    setUser(demoUser);
    setUserProfile(demoProfile);
    setLoading(false);

    logActivity('LOGIN', `Demo user signed in as ${demoProfile.name} (${role})`, {
      uid: demoProfile.uid,
      name: demoProfile.name
    });
  };

  const logout = async () => {
    if (userProfile) {
      logActivity('LOGOUT', `User signed out: ${userProfile.name} (${userProfile.role})`, {
        uid: userProfile.uid,
        name: userProfile.name
      });
    }
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
