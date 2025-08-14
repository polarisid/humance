
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  type Timestamp,
  orderBy,
  type QueryConstraint,
} from 'firebase/firestore';
import type { LoggedUser } from '../actions';
import { format, parse, startOfMonth, endOfMonth } from 'date-fns';

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
    const startDate = startOfMonth(parse(period, 'yyyy-MM', new Date()));
    const endDate = endOfMonth(startDate);

    const queryConstraints: QueryConstraint[] = [
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
    ];
    
    // Always filter by employee if provided
    if (employeeId) {
        queryConstraints.push(where('employeeId', '==', employeeId));
    }
    
    // If user is a Manager, further constrain the query to their own entries
    if (user.role === 'Gerente') {
        queryConstraints.push(where('authorId', '==', user.id));
    }

    const observationsQuery = query(
        collection(db, 'weekly_observations_diary'),
        ...queryConstraints
    );

    const snapshot = await getDocs(observationsQuery);

    return snapshot.docs.map(doc => {
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
}
