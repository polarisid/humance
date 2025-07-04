
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  type Query,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  type Timestamp,
  documentId,
  getDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { LoggedUser } from '../actions';
import { reviewTemplateSchema, reviewSubmissionSchema, reviewAdjustmentSchema, type ReviewTemplateFormData } from './schema';
import type { User } from '../usuarios/actions';
import { format } from 'date-fns';

export type ReviewStatus = 'Pendente' | 'Em Aprovação' | 'Ajuste Solicitado' | 'Concluída' | 'Atrasada';

export interface Review {
  id: string;
  employee: string;
  date: string;
  role: string;
  department: string;
  status: ReviewStatus;
  employeeId: string;
  managerId?: string;
  period?: string;
  averageScore?: number;
}

export interface WeeklyObservation {
  id: string;
  text: string;
  createdAt: string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeDepartment: string;
  managerId: string;
  templateId: string;
  templateName: string;
  templateItems: EvaluationItem[];
  period: string;
  status: ReviewStatus;
  scores?: Record<string, number>;
  averageScore?: number;
  managerObservations?: string;
  feedbackForEmployee?: string;
  adminFeedbackForManager?: string;
  completedAt?: string;
  weeklyObservations?: WeeklyObservation[];
  previousAverageScore?: number;
  previousScores?: Record<string, number>;
}


export async function getReviews(user: LoggedUser): Promise<Review[]> {
  const reviewsRef = collection(db, 'reviews');
  let q: Query;

  switch (user.role) {
    case 'Colaborador':
      q = query(reviewsRef, where('employeeId', '==', user.id));
      break;
    case 'Gerente':
       q = query(reviewsRef, where('managerId', '==', user.id));
      break;
    case 'Administrador':
      q = query(reviewsRef);
      break;
    default:
      return [];
  }
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    const dateValue = (data.completedAt as Timestamp)?.toDate() || (data.date as Timestamp)?.toDate();
    return {
      id: doc.id,
      employee: data.employee,
      date: dateValue ? dateValue.toISOString() : new Date().toISOString(),
      role: data.role,
      department: data.department,
      status: data.status,
      employeeId: data.employeeId,
      managerId: data.managerId,
      period: data.period,
      averageScore: data.averageScore,
    };
  });
}

// --- New Template Management ---

export interface EvaluationItem {
  text: string;
}

export interface ReviewTemplate {
  id: string;
  name: string;
  items: EvaluationItem[];
  createdAt: string;
}

export async function getReviewTemplates(): Promise<ReviewTemplate[]> {
  try {
    const templatesSnapshot = await getDocs(query(collection(db, 'review_templates')));
    return templatesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
      } as ReviewTemplate;
    });
  } catch (error) {
    console.error("Error fetching review templates: ", error);
    return [];
  }
}

export async function createOrUpdateReviewTemplate(data: ReviewTemplateFormData) {
  const validation = reviewTemplateSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Dados inválidos.', errors: validation.error.flatten().fieldErrors };
  }

  const { id, ...templateData } = validation.data;

  try {
    if (id) {
      const templateRef = doc(db, 'review_templates', id);
      await updateDoc(templateRef, templateData as any);
      return { success: true, message: 'Modelo atualizado com sucesso!' };
    } else {
      const dataToSave = { ...templateData, createdAt: new Date() };
      await addDoc(collection(db, 'review_templates'), dataToSave);
      return { success: true, message: 'Modelo criado com sucesso!' };
    }
  } catch (error) {
    console.error("Error saving review template: ", error);
    return { success: false, message: 'Erro ao salvar modelo.' };
  }
}

export async function deleteReviewTemplate(id: string) {
  if (!id) return { success: false, message: 'ID do modelo não fornecido.' };
  try {
    await deleteDoc(doc(db, 'review_templates', id));
    return { success: true, message: 'Modelo excluído com sucesso!' };
  } catch (error) {
    console.error("Error deleting review template: ", error);
    return { success: false, message: 'Erro ao excluir modelo.' };
  }
}

export async function assignTemplateToManagers(data: { templateId: string, managerIds: string[] }) {
    const { templateId, managerIds } = data;
    if (!templateId || !managerIds || managerIds.length === 0) {
        return { success: false, message: 'Dados de atribuição inválidos.' };
    }
    
    try {
        const batch = writeBatch(db);
        managerIds.forEach(managerId => {
            const assignmentRef = doc(collection(db, 'review_assignments'));
            batch.set(assignmentRef, {
                templateId,
                managerId,
                status: 'Pendente',
                assignedAt: new Date(),
            });
        });
        await batch.commit();
        return { success: true, message: 'Modelo atribuído aos gerentes com sucesso!' };
    } catch (error) {
        console.error("Error assigning template: ", error);
        return { success: false, message: 'Erro ao atribuir modelo.' };
    }
}

export async function getAssignedTemplatesForManager(managerId: string): Promise<ReviewTemplate[]> {
    if (!managerId) return [];
    try {
        const assignmentsQuery = query(collection(db, 'review_assignments'), where('managerId', '==', managerId));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);

        if (assignmentsSnapshot.empty) return [];

        const templateIds = assignmentsSnapshot.docs.map(doc => doc.data().templateId).filter(Boolean);
        if (templateIds.length === 0) return [];
        
        const templatePromises = templateIds.map(id => getDoc(doc(db, 'review_templates', id)));
        const templateSnapshots = await Promise.all(templatePromises);

        return templateSnapshots
            .filter(snap => snap.exists())
            .map(snap => {
                const data = snap.data()!;
                return {
                    id: snap.id,
                    name: data.name,
                    items: data.items,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
                } as ReviewTemplate;
            });

    } catch (error) {
        console.error("Error fetching assigned templates for manager: ", error);
        return [];
    }
}


export async function createReviews(data: {
    template: ReviewTemplate,
    manager: LoggedUser,
    employees: User[],
}) {
    const { template, manager, employees } = data;
    if (!template || !manager || !employees || employees.length === 0) {
        return { success: false, message: 'Dados insuficientes para criar avaliações.', createdCount: 0, skippedCount: 0 };
    }
    
    try {
        const batch = writeBatch(db);
        const reviewsRef = collection(db, 'reviews');
        const period = format(new Date(), 'yyyy-MM');
        
        let createdCount = 0;
        let skippedCount = 0;

        for (const employee of employees) {
            const q = query(reviewsRef, where('employeeId', '==', employee.id), where('period', '==', period));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                const reviewRef = doc(reviewsRef);
                batch.set(reviewRef, {
                    employee: employee.name,
                    employeeId: employee.id,
                    role: employee.role,
                    department: employee.departmentName || 'N/A',
                    date: new Date(),
                    status: 'Pendente',
                    managerId: manager.id,
                    templateId: template.id,
                    templateName: template.name,
                    period: period,
                });
                createdCount++;
            } else {
                skippedCount++;
            }
        }

        await batch.commit();
        
        let message = '';
        if (createdCount > 0) {
            message += `${createdCount} avaliação(ões) iniciada(s) com sucesso. `;
        }
        if (skippedCount > 0) {
            message += `${skippedCount} colaborador(es) já possui(am) avaliação para este mês.`;
        }
        if (createdCount === 0 && skippedCount === 0) {
            message = 'Nenhuma avaliação foi iniciada pois todos os selecionados já possuem avaliação para este mês.';
        }

        return { success: true, message: message.trim(), createdCount, skippedCount };

    } catch (error) {
        console.error("Error creating reviews: ", error);
        return { success: false, message: 'Erro ao iniciar as avaliações.', createdCount: 0, skippedCount: 0 };
    }
}

// --- New Review Detail Actions ---

export async function getReviewDetails(reviewId: string): Promise<PerformanceReview | null> {
    if (!reviewId) return null;
    try {
        const reviewRef = doc(db, 'reviews', reviewId);
        const reviewSnap = await getDoc(reviewRef);

        if (!reviewSnap.exists()) {
            console.error("Review document not found:", reviewId);
            return null;
        }
        
        const reviewData = reviewSnap.data();
        
        if (!reviewData.templateId || !reviewData.employeeId) {
            console.error("Review document is missing templateId or employeeId", reviewId);
            return null;
        }

        const observationsQuery = query(collection(db, `reviews/${reviewId}/weekly_observations`), orderBy('createdAt', 'desc'));

        const [templateSnap, employeeSnap, observationsSnap] = await Promise.all([
            getDoc(doc(db, 'review_templates', reviewData.templateId)),
            getDoc(doc(db, 'users', reviewData.employeeId)),
            getDocs(observationsQuery),
        ]);
        
        if (!templateSnap.exists() || !employeeSnap.exists()) {
             console.error(`Template or Employee not found for review ${reviewId}. Template exists: ${templateSnap.exists()}, Employee exists: ${employeeSnap.exists()}`);
             throw new Error("Template or Employee not found for this review");
        }

        const templateData = templateSnap.data();
        const employeeData = employeeSnap.data();

        const weeklyObservations: WeeklyObservation[] = observationsSnap.docs.map(obsDoc => ({
            id: obsDoc.id,
            text: obsDoc.data().text,
            createdAt: (obsDoc.data().createdAt as Timestamp).toDate().toISOString(),
        }));
        
        // Find the previous completed review for this employee
        let previousReviewData: { averageScore?: number; scores?: Record<string, number> } = {};
        const previousReviewQuery = query(
            collection(db, 'reviews'),
            where('employeeId', '==', reviewData.employeeId),
            where('status', '==', 'Concluída')
        );
        const previousReviewSnapshot = await getDocs(previousReviewQuery);
        
        if (!previousReviewSnapshot.empty) {
            const previousReviews = previousReviewSnapshot.docs
                .map(doc => doc.data())
                .filter(data => data.period < reviewData.period)
                .sort((a, b) => b.period.localeCompare(a.period));

            if (previousReviews.length > 0) {
                const prevReview = previousReviews[0];
                previousReviewData = {
                    averageScore: prevReview.averageScore,
                    scores: prevReview.scores,
                };
            }
        }

        const completedAtTimestamp = reviewData.completedAt as Timestamp;

        return {
            id: reviewSnap.id,
            employeeId: employeeSnap.id,
            employeeName: employeeData.name,
            employeeRole: employeeData.role,
            employeeDepartment: reviewData.department,
            managerId: reviewData.managerId,
            templateId: templateSnap.id,
            templateName: templateData.name,
            templateItems: templateData.items || [],
            period: reviewData.period,
            status: reviewData.status,
            scores: reviewData.scores,
            averageScore: reviewData.averageScore,
            managerObservations: reviewData.managerObservations,
            feedbackForEmployee: reviewData.feedbackForEmployee,
            adminFeedbackForManager: reviewData.adminFeedbackForManager,
            completedAt: completedAtTimestamp ? completedAtTimestamp.toDate().toISOString() : undefined,
            weeklyObservations: weeklyObservations,
            previousAverageScore: previousReviewData.averageScore,
            previousScores: previousReviewData.scores,
        };

    } catch (error) {
        console.error("Error fetching review details: ", error);
        return null;
    }
}

export async function submitReview(data: { 
    reviewId: string, 
    scores: Record<string, number>, 
    managerObservations: string,
    feedbackForEmployee: string
}) {
    const validation = reviewSubmissionSchema.safeParse(data);
    if (!validation.success) {
        const firstErrorMessage = validation.error.errors[0]?.message || 'Dados inválidos. Verifique os campos e tente novamente.';
        return { success: false, message: firstErrorMessage };
    }

    try {
        const scoreValues = Object.values(validation.data.scores);
        const averageScore = scoreValues.length > 0
            ? scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length
            : 0;
        
        const reviewRef = doc(db, 'reviews', validation.data.reviewId);
        await updateDoc(reviewRef, {
            scores: validation.data.scores,
            averageScore: averageScore,
            managerObservations: validation.data.managerObservations,
            feedbackForEmployee: validation.data.feedbackForEmployee,
            status: 'Em Aprovação',
            adminFeedbackForManager: '', // Clear previous feedback on resubmission
        });
        return { success: true, message: 'Avaliação enviada para aprovação!' };
    } catch (error) {
        console.error("Error submitting review: ", error);
        return { success: false, message: 'Erro ao submeter avaliação.' };
    }
}

export async function approveReview(data: { reviewId: string }) {
  if (!data.reviewId) {
    return { success: false, message: 'ID da avaliação não fornecido.' };
  }
  try {
    const reviewRef = doc(db, 'reviews', data.reviewId);
    await updateDoc(reviewRef, {
      status: 'Concluída',
      completedAt: new Date(),
    });
    return { success: true, message: 'Avaliação aprovada com sucesso!' };
  } catch (error) {
    console.error("Error approving review: ", error);
    return { success: false, message: 'Erro ao aprovar avaliação.' };
  }
}

export async function requestReviewAdjustment(data: { reviewId: string; feedback: string }) {
  const validation = reviewAdjustmentSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Dados inválidos.' };
  }
  try {
    const reviewRef = doc(db, 'reviews', validation.data.reviewId);
    await updateDoc(reviewRef, {
      status: 'Ajuste Solicitado',
      adminFeedbackForManager: validation.data.feedback,
    });
    return { success: true, message: 'Solicitação de ajuste enviada ao gestor.' };
  } catch (error) {
    console.error("Error requesting adjustment: ", error);
    return { success: false, message: 'Erro ao solicitar ajuste.' };
  }
}

export async function deleteReview(reviewId: string) {
    if (!reviewId) {
        return { success: false, message: 'ID da avaliação não fornecido.' };
    }
    try {
        const batch = writeBatch(db);
        const reviewRef = doc(db, 'reviews', reviewId);

        // Delete weekly observations subcollection
        const observationsQuery = query(collection(db, `reviews/${reviewId}/weekly_observations`));
        const observationsSnapshot = await getDocs(observationsQuery);
        observationsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete the review document itself
        batch.delete(reviewRef);

        await batch.commit();
        return { success: true, message: 'Avaliação excluída com sucesso!' };
    } catch (error) {
        console.error("Error deleting review: ", error);
        return { success: false, message: 'Erro ao excluir avaliação.' };
    }
}

export async function addObservationForUser(data: { managerId: string; employeeId: string; text: string }) {
  const { managerId, employeeId, text } = data;
  if (!managerId || !employeeId || !text.trim()) {
    return { success: false, message: 'Dados inválidos.' };
  }

  try {
    const period = format(new Date(), 'yyyy-MM');
    const reviewsRef = collection(db, 'reviews');

    const q = query(reviewsRef, 
      where('employeeId', '==', employeeId), 
      where('period', '==', period)
    );
    const querySnapshot = await getDocs(q);

    let reviewId: string;

    if (!querySnapshot.empty) {
      reviewId = querySnapshot.docs[0].id;
    } else {
      const employeeSnap = await getDoc(doc(db, 'users', employeeId));

      if (!employeeSnap.exists()) {
          return { success: false, message: 'Colaborador não encontrado.' };
      }
      const employeeData = employeeSnap.data();

      let departmentName = 'N/A';
      if (employeeData.departmentId) {
        const deptSnap = await getDoc(doc(db, 'departments', employeeData.departmentId));
        if (deptSnap.exists()) {
            departmentName = deptSnap.data().name;
        }
      }

      const assignedTemplates = await getAssignedTemplatesForManager(managerId);
      if (assignedTemplates.length === 0) {
        return { success: false, message: 'Nenhum modelo de avaliação foi atribuído a você. Peça ao RH para atribuir um modelo antes de adicionar observações.' };
      }
      const template = assignedTemplates[0];

      const newReviewData = {
          employee: employeeData.name,
          employeeId: employeeId,
          role: employeeData.role,
          department: departmentName,
          date: new Date(),
          status: 'Pendente',
          managerId: managerId,
          templateId: template.id,
          templateName: template.name,
          period: period,
      };
      const newReviewRef = await addDoc(reviewsRef, newReviewData);
      reviewId = newReviewRef.id;
    }

    const obsRef = collection(db, 'reviews', reviewId, 'weekly_observations');
    await addDoc(obsRef, {
      text,
      createdAt: new Date(),
    });

    return { success: true, message: 'Observação adicionada com sucesso.' };
  } catch (error) {
    console.error("Error adding observation for user:", error);
    return { success: false, message: 'Erro ao adicionar observação.' };
  }
}


export async function addWeeklyObservation(data: { reviewId: string; text: string }) {
  const { reviewId, text } = data;
  if (!reviewId || !text.trim()) {
    return { success: false, message: 'Dados inválidos.' };
  }
  try {
    const obsRef = collection(db, 'reviews', reviewId, 'weekly_observations');
    await addDoc(obsRef, {
      text,
      createdAt: new Date(),
    });
    return { success: true, message: 'Observação adicionada com sucesso.' };
  } catch (error) {
    console.error("Error adding weekly observation:", error);
    return { success: false, message: 'Erro ao adicionar observação.' };
  }
}

export async function deleteWeeklyObservation(data: { reviewId: string; observationId: string }) {
  const { reviewId, observationId } = data;
  if (!reviewId || !observationId) {
    return { success: false, message: 'Dados inválidos.' };
  }
  try {
    const obsRef = doc(db, 'reviews', reviewId, 'weekly_observations', observationId);
    await deleteDoc(obsRef);
    return { success: true, message: 'Observação excluída com sucesso.' };
  } catch (error) {
    console.error("Error deleting weekly observation:", error);
    return { success: false, message: 'Erro ao excluir observação.' };
  }
}

    
