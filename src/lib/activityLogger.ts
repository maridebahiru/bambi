import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export type ActivityAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE_SALE'
  | 'EDIT_PRICE'
  | 'ADD_EXPENSE'
  | 'ADD_USER'
  | 'EDIT_USER'
  | 'DELETE_USER'
  | 'ADD_PRODUCT'
  | 'EDIT_PRODUCT'
  | 'DELETE_PRODUCT';

export interface ActivityLogItem {
  id?: string;
  action: ActivityAction;
  details: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
  timestamp: any;
  date: string;
}

export const logActivity = async (
  action: ActivityAction,
  details: string | Record<string, any>,
  user?: { uid?: string; name?: string },
  metadata?: Record<string, any>
) => {
  try {
    const now = new Date();
    let detailsString = '';
    if (typeof details === 'string') {
      detailsString = details;
    } else if (typeof details === 'object' && details !== null) {
      try {
        detailsString = Object.entries(details)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');
      } catch (e) {
        detailsString = JSON.stringify(details);
      }
    } else {
      detailsString = String(details);
    }

    await addDoc(collection(db, 'activity_log'), {
      action,
      details: detailsString,
      userId: user?.uid || 'system',
      userName: user?.name || 'System User',
      metadata: metadata || {},
      timestamp: now,
      date: now.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
