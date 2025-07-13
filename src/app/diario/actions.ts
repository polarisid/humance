'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  type Timestamp,
  orderBy,
} from 'firebase/firestore';
import type { LoggedUser } from '../actions';
import { format, parse } from 'date-fns';

export interface DiaryEntry {
  id: string;
  text: string;
  employeeName: string;
  employeeId: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  reviewId: string;
}

export async function getDiaryEntries(user: LoggedUser, filters: { period: string, employeeId?: string }): Promise<DiaryEntry[]> {
    if (user.role === 'Colaborador') return [];

    const { period, employeeId } = filters;
    
    // Convert 'yyyy-MM' period to a date range
    const startDate = parse(period, 'yyyy-MM', new Date());
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

    const observationsQuery = query(
        collection(db, 'weekly_observations_diary'),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(observationsQuery);

    let entries = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            text: data.text,
            employeeName: data.employeeName,
            employeeId: data.employeeId,
            authorName: data.authorName,
            authorId: data.authorId,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            reviewId: data.reviewId,
        } as DiaryEntry
    });
    
    if (user.role === 'Gerente') {
        // Filter entries where the author is the current manager
        entries = entries.filter(entry => entry.authorId === user.id);
    }
    
    if (employeeId) {
        entries = entries.filter(entry => entry.employeeId === employeeId);
    }

    return entries;
}
