
'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, setDoc, where, addDoc, deleteDoc, orderBy, type Timestamp, limit } from 'firebase/firestore';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LoggedUser } from '@/app/actions';
import { getUsers, type User } from '../usuarios/actions';
import { getDepartments } from '../setores/actions';
import type { ReviewStatus } from '../avaliacoes/actions';

export interface EmployeeOfTheMonthData {
  name: string;
  role: string;
  reason: string;
  imageUrl: string;
}

const employeeSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório."),
    role: z.string().min(1, "Cargo é obrigatório."),
    reason: z.string().min(1, "Motivo é obrigatório."),
    imageUrl: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
});


export async function getEmployeeOfTheMonth(user: LoggedUser): Promise<EmployeeOfTheMonthData | null> {
  const period = format(new Date(), 'yyyy-MM');

  if (user.role === 'Gerente') {
    const allUsers = await getUsers();
    const allDepartments = await getDepartments();
    const myDepartmentIds = allDepartments.filter(d => d.leaderId === user.id).map(d => d.id);
    const myTeamIds = allUsers.filter(u => u.departmentId && myDepartmentIds.includes(u.departmentId)).map(u => u.id);

    if (myTeamIds.length === 0) return null;

    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('employeeId', 'in', myTeamIds),
      where('period', '==', period),
      where('status', '==', 'Concluída')
    );
    const reviewsSnapshot = await getDocs(reviewsQuery);
    
    if (reviewsSnapshot.empty) {
        return null;
    }

    const completedReviews = reviewsSnapshot.docs.map(doc => doc.data());
    
    if (completedReviews.length === 0) {
        return null; // No completed reviews for the team this month
    }

    // Sort in application code to avoid complex index
    completedReviews.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));

    const topReview = completedReviews[0];
    const topEmployee = allUsers.find(u => u.id === topReview.employeeId);
    
    return {
      name: topEmployee?.name || 'Não encontrado',
      role: topEmployee?.role || 'Não encontrado',
      reason: `Destaque do mês na equipe com nota ${topReview.averageScore.toFixed(1)}.`,
      imageUrl: '',
    };
  }
  
  // Admin and Collaborator view
  try {
    const docRef = doc(db, 'config', 'employeeOfTheMonth');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as EmployeeOfTheMonthData;
    } else {
      return {
        name: 'Funcionário do Mês',
        role: 'Definir no painel',
        reason: 'Aguardando definição do RH.',
        imageUrl: '',
      };
    }
  } catch (error) {
    console.error("Error fetching employee of the month: ", error);
    return null;
  }
}


export async function updateEmployeeOfTheMonth(data: EmployeeOfTheMonthData) {
    const validation = employeeSchema.safeParse(data);

    if (!validation.success) {
        return { success: false, message: "Dados inválidos." };
    }

    try {
        const docRef = doc(db, 'config', 'employeeOfTheMonth');
        await setDoc(docRef, validation.data, { merge: true });
        return { success: true, message: 'Funcionário do Mês atualizado com sucesso!' };
    } catch (error) {
        console.error("Error updating employee of the month: ", error);
        return { success: false, message: 'Erro ao atualizar.' };
    }
}


export interface ObservableUser {
  id: string;
  name: string;
  reviewId?: string;
}

export async function getUsersForObservation(user: LoggedUser): Promise<ObservableUser[]> {
  if (user.role === 'Colaborador') {
    return [];
  }

  const allUsers = await getUsers();
  const allDepartments = await getDepartments();
  let targetUsers: User[] = [];

  if (user.role === 'Administrador') {
    targetUsers = allUsers.filter(u => u.role === 'Colaborador' || u.role === 'Gerente');
  } else if (user.role === 'Gerente') {
    const myDepartmentIds = allDepartments.filter(d => d.leaderId === user.id).map(d => d.id);
    if(myDepartmentIds.length > 0) {
        targetUsers = allUsers.filter(u => u.departmentId && myDepartmentIds.includes(u.departmentId));
    }
  }

  if (targetUsers.length === 0) {
    return [];
  }

  const period = format(new Date(), 'yyyy-MM');
  const reviewsRef = collection(db, 'reviews');
  const observableUsers: ObservableUser[] = [];
  const userIds = targetUsers.map(u => u.id);

  if (userIds.length > 0) {
    const reviewsQuery = query(
      reviewsRef,
      where('employeeId', 'in', userIds),
      where('period', '==', period)
    );
    const reviewsSnapshot = await getDocs(reviewsQuery);
    const reviewsMap = new Map<string, string>(); // Map<employeeId, reviewId>
    reviewsSnapshot.forEach(doc => {
      reviewsMap.set(doc.data().employeeId, doc.id);
    });

    for (const targetUser of targetUsers) {
      const reviewId = reviewsMap.get(targetUser.id);
      observableUsers.push({
        id: targetUser.id,
        name: targetUser.name,
        reviewId: reviewId,
      });
    }
  }

  return observableUsers.sort((a, b) => a.name.localeCompare(b.name));
}


// --- Announcements Actions ---
export interface Announcement {
  id: string;
  message: string;
  type: 'geral' | 'comemorativa';
  createdAt: string; // Using string to be client-component safe
}

const announcementSchema = z.object({
  message: z.string().min(3, "A mensagem deve ter pelo menos 3 caracteres."),
  type: z.enum(['geral', 'comemorativa']),
});

export async function getAnnouncements(): Promise<Announcement[]> {
  try {
    const announcementsRef = collection(db, 'announcements');
    const q = query(announcementsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        message: data.message,
        type: data.type,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      };
    }) as Announcement[];
  } catch (error) {
    console.error("Error fetching announcements: ", error);
    return [];
  }
}

export async function addAnnouncement(data: { message: string, type: 'geral' | 'comemorativa' }) {
  const validation = announcementSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: validation.error.flatten().fieldErrors.message?.[0] || 'Dados inválidos.' };
  }
  try {
    await addDoc(collection(db, 'announcements'), {
      ...validation.data,
      createdAt: new Date(),
    });
    return { success: true, message: 'Aviso adicionado com sucesso!' };
  } catch (error) {
    console.error("Error adding announcement: ", error);
    return { success: false, message: 'Erro ao adicionar aviso.' };
  }
}

export async function deleteAnnouncement(id: string) {
  if (!id) {
    return { success: false, message: 'ID do aviso não fornecido.' };
  }
  try {
    await deleteDoc(doc(db, 'announcements', id));
    return { success: true, message: 'Aviso excluído com sucesso!' };
  } catch (error) {
    console.error("Error deleting announcement: ", error);
    return { success: false, message: 'Erro ao excluir aviso.' };
  }
}

// --- Birthday Actions ---
export interface BirthdayPerson {
  name: string;
  date: string;
  initials: string;
}

export async function getBirthdaysOfTheMonth(): Promise<BirthdayPerson[]> {
  try {
    const allUsers = await getUsers();
    const currentMonth = new Date().getMonth();

    const birthdayUsers = allUsers.filter(user => {
      return user.birthDate && new Date(user.birthDate).getMonth() === currentMonth;
    });

    return birthdayUsers
      .map(user => {
        const birthDate = new Date(user.birthDate!);
        return {
          name: user.name,
          date: format(birthDate, "dd 'de' MMMM", { locale: ptBR }),
          initials: user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(),
        };
      })
      .sort((a, b) => {
        const dayA = parseInt(a.date.split(' ')[0]);
        const dayB = parseInt(b.date.split(' ')[0]);
        return dayA - dayB;
      });
  } catch (error) {
      console.error("Error fetching birthdays of the month: ", error);
      return [];
  }
}

// --- Training Progress Summary ---
export interface TrainingProgressSummary {
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
}

export async function getTrainingProgressSummary(user: LoggedUser): Promise<TrainingProgressSummary | null> {
  try {
    const userTrainingsRef = collection(db, 'user_trainings');
    let q;

    if (user.role === 'Colaborador') {
      q = query(userTrainingsRef, where('userId', '==', user.id));
    } else if (user.role === 'Gerente') {
      const allDepartments = await getDepartments();
      const myDepartmentIds = allDepartments.filter(d => d.leaderId === user.id).map(d => d.id);
      
      if (myDepartmentIds.length === 0) {
        return { totalAssigned: 0, totalCompleted: 0, completionRate: 0 };
      }
      
      const allUsers = await getUsers();
      const userIds = allUsers.filter(u => u.departmentId && myDepartmentIds.includes(u.departmentId)).map(u => u.id);

      if (userIds.length === 0) {
        return { totalAssigned: 0, totalCompleted: 0, completionRate: 0 };
      }
      q = query(userTrainingsRef, where('userId', 'in', userIds));
    } else { // Administrador
      q = query(userTrainingsRef);
    }

    const snapshot = await getDocs(q);
    const totalAssigned = snapshot.docs.length;
    const totalCompleted = snapshot.docs.filter(doc => doc.data().completed === true).length;
    const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

    return { totalAssigned, totalCompleted, completionRate };

  } catch (error) {
    console.error("Error fetching training progress summary: ", error);
    return null;
  }
}


// --- Performance Review Summary (Dashboard) ---
export interface PerformanceReviewSummaryData {
    employeeId: string;
    employeeName: string;
    employeeRole: string;
    status: ReviewStatus;
    averageScore?: number;
    reviewId?: string;
}

export async function getPerformanceReviewSummary(user: LoggedUser): Promise<PerformanceReviewSummaryData[]> {
    if (user.role === 'Colaborador') return [];

    try {
        const [allUsers, allDepartments] = await Promise.all([getUsers(), getDepartments()]);
        let targetUsers: User[] = [];

        if (user.role === 'Administrador') {
            targetUsers = allUsers;
        } else if (user.role === 'Gerente') {
            const myDepartmentIds = allDepartments.filter(d => d.leaderId === user.id).map(d => d.id);
            if (myDepartmentIds.length > 0) {
                targetUsers = allUsers.filter(u => u.departmentId && myDepartmentIds.includes(u.departmentId));
            }
        }

        if (targetUsers.length === 0) return [];

        const period = format(new Date(), 'yyyy-MM');
        const reviewsRef = collection(db, 'reviews');
        const targetUserIds = targetUsers.map(u => u.id);

        if(targetUserIds.length === 0) return [];

        const reviewsQuery = query(
            reviewsRef,
            where('employeeId', 'in', targetUserIds),
            where('period', '==', period)
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviewsMap = new Map(reviewsSnapshot.docs.map(doc => [doc.data().employeeId, {id: doc.id, ...doc.data()}]));

        const summary: PerformanceReviewSummaryData[] = targetUsers.map(u => {
            const review = reviewsMap.get(u.id);
            return {
                employeeId: u.id,
                employeeName: u.name,
                employeeRole: u.role,
                status: review?.status || 'Pendente',
                averageScore: review?.averageScore,
                reviewId: review?.id,
            };
        });
        
        return summary.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    } catch (error) {
        console.error("Error fetching performance review summary:", error);
        return [];
    }
}
