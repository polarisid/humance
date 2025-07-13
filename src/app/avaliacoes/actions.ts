
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
  setDoc,
} from 'firebase/firestore';
import type { LoggedUser } from '../actions';
import { reviewTemplateSchema, reviewSubmissionSchema, reviewAdjustmentSchema, bonusParametersSchema, kpiModelSchema, kpiBonusParametersSchema, type ReviewTemplateFormData, type BonusParametersData, type KpiModelFormData, type KpiBonusParametersData } from './schema';
import type { User } from '../usuarios/actions';
import { format } from 'date-fns';
import { getManagers, getDepartments } from '../setores/actions';
import { getUsers } from '../usuarios/actions';

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
  kpiScore?: number;
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
  kpiScore?: number;
  managerObservations?: string;
  feedbackForEmployee?: string;
  adminFeedbackForManager?: string;
  completedAt?: string;
  weeklyObservations?: WeeklyObservation[];
  previousAverageScore?: number;
  previousScores?: Record<string, number>;
}


export async function getReviews(user: LoggedUser, filters?: { departmentId?: string; period?: string }): Promise<Review[]> {
  const reviewsRef = collection(db, 'reviews');
  let conditions = [];

  switch (user.role) {
    case 'Colaborador':
      conditions.push(where('employeeId', '==', user.id));
      break;
    case 'Gerente':
      conditions.push(where('managerId', '==', user.id));
      break;
    case 'Administrador':
      // No initial role-based condition for Admin
      break;
    default:
      return [];
  }
  
  if (user.role === 'Administrador' && filters?.departmentId) {
    const departmentDoc = await getDoc(doc(db, 'departments', filters.departmentId));
    if (departmentDoc.exists()) {
        const departmentName = departmentDoc.data().name;
        conditions.push(where('department', '==', departmentName));
    }
  }

  if (filters?.period) {
    conditions.push(where('period', '==', filters.period));
  }


  const q = conditions.length > 0 ? query(reviewsRef, ...conditions) : query(reviewsRef);
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
      kpiScore: data.kpiScore,
    };
  });
}

// --- New Leaderboard Action ---

export interface LeaderboardData {
    leaderId: string;
    leaderName: string;
    averageScore: number;
    kpiScore: number;
    kpiBonus: number;
    totalReviews: number;
    teamSize: number;
}

export async function getLeaderboard(period: string): Promise<LeaderboardData[]> {
    if (!period) return [];

    try {
        const [managers, allUsers, departments, kpiBonusParams] = await Promise.all([
            getManagers(),
            getUsers(),
            getDepartments(),
            getKpiBonusParameters()
        ]);
        
        const leaderboardData: LeaderboardData[] = [];

        for (const manager of managers) {
            const myDepartmentIds = departments.filter(d => d.leaderId === manager.id).map(d => d.id);
            const myTeam = allUsers.filter(u => u.departmentId && myDepartmentIds.includes(u.departmentId));
            const myTeamIds = myTeam.map(u => u.id);

            if (myTeamIds.length === 0) continue;

            const reviewsQuery = query(
                collection(db, 'reviews'),
                where('employeeId', 'in', myTeamIds),
                where('period', '==', period),
                where('status', '==', 'Concluída')
            );
            const reviewsSnapshot = await getDocs(reviewsQuery);

            if (reviewsSnapshot.empty) continue;

            let totalScore = 0;
            const reviews = reviewsSnapshot.docs.map(doc => doc.data());

            reviews.forEach(review => {
                if (review.averageScore) {
                    totalScore += review.averageScore;
                }
            });
            
            const firstReviewWithKpi = reviews.find(r => r.kpiScore !== undefined && r.kpiScore !== null);
            const kpiScore = firstReviewWithKpi ? firstReviewWithKpi.kpiScore : 0;
            
            let kpiBonus = 0;
            const applicableKpiRule = kpiBonusParams.rules.find(rule => kpiScore >= rule.minScore && kpiScore <= rule.maxScore);
            if (applicableKpiRule) {
                kpiBonus = applicableKpiRule.bonusValueLeader;
            }


            const averageScore = reviews.length > 0 ? totalScore / reviews.length : 0;
            
            leaderboardData.push({
                leaderId: manager.id,
                leaderName: manager.name,
                averageScore: averageScore,
                kpiScore: kpiScore,
                kpiBonus: kpiBonus,
                totalReviews: reviews.length,
                teamSize: myTeam.length
            });
        }
        
        return leaderboardData.sort((a, b) => b.averageScore - a.averageScore);

    } catch (error) {
        console.error("Error getting leaderboard data: ", error);
        return [];
    }
}


// --- Template Management ---

export interface EvaluationItem {
  text: string;
  description?: string;
}

export interface ReviewTemplate {
  id: string;
  name: string;
  items: EvaluationItem[];
  createdAt: string;
  assignedManagers?: { id: string; name: string; }[];
}

export async function getReviewTemplates(): Promise<ReviewTemplate[]> {
  try {
    const [templatesSnapshot, assignmentsSnapshot, managers] = await Promise.all([
      getDocs(query(collection(db, 'review_templates'))),
      getDocs(query(collection(db, 'review_assignments'))),
      getManagers()
    ]);
    
    const managersMap = new Map(managers.map(m => [m.id, m.name]));
    
    const assignmentsByTemplate = new Map<string, { id: string; name: string; }[]>();
    assignmentsSnapshot.forEach(doc => {
        const data = doc.data();
        const managerId = data.managerId;
        const managerName = managersMap.get(managerId);

        if (managerName) {
            const managerInfo = { id: managerId, name: managerName };
            const existing = assignmentsByTemplate.get(data.templateId) || [];
            assignmentsByTemplate.set(data.templateId, [...existing, managerInfo]);
        }
    });

    return templatesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
        assignedManagers: assignmentsByTemplate.get(doc.id) || [],
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

// --- Review Detail Actions ---

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
            kpiScore: reviewData.kpiScore,
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
    
    const employeeSnap = await getDoc(doc(db, 'users', employeeId));
    if (!employeeSnap.exists()) {
        return { success: false, message: 'Colaborador não encontrado.' };
    }
    const employeeData = employeeSnap.data();
    
    const managerSnap = await getDoc(doc(db, 'users', managerId));
     if (!managerSnap.exists()) {
        return { success: false, message: 'Gestor não encontrado.' };
    }
    const managerData = managerSnap.data();

    let reviewId: string;

    if (!querySnapshot.empty) {
      reviewId = querySnapshot.docs[0].id;
    } else {
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

    const obsRef = collection(db, 'weekly_observations_diary');
    await addDoc(obsRef, {
      text,
      createdAt: new Date(),
      reviewId,
      employeeId,
      employeeName: employeeData.name,
      authorId: managerId,
      authorName: managerData.name,
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


// --- Bonus Parameters Actions ---
const defaultBonusParameters = {
    rules: [
        { minScore: 0, maxScore: 3.99, bonusPercentage: 0 },
        { minScore: 4, maxScore: 6.99, bonusPercentage: 50 },
        { minScore: 7, maxScore: 10, bonusPercentage: 100 }
    ]
};


export async function getBonusParameters(): Promise<BonusParametersData> {
  try {
    const docRef = doc(db, 'config', 'bonusParameters');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as BonusParametersData;
    } else {
      // If it doesn't exist, create it with default values and return them
      await setDoc(docRef, defaultBonusParameters);
      return defaultBonusParameters;
    }
  } catch (error) {
    console.error("Error fetching bonus parameters: ", error);
    return defaultBonusParameters; // Return default on error
  }
}

export async function updateBonusParameters(data: BonusParametersData) {
    const validation = bonusParametersSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, message: "Dados inválidos." };
    }
    try {
        const docRef = doc(db, 'config', 'bonusParameters');
        await setDoc(docRef, validation.data);
        return { success: true, message: 'Parâmetros de bonificação atualizados com sucesso!' };
    } catch (error) {
        console.error("Error updating bonus parameters: ", error);
        return { success: false, message: 'Erro ao atualizar parâmetros.' };
    }
}

// --- KPI Bonus Parameters Actions ---
const defaultKpiBonusParameters = {
    rules: [
        { minScore: 0, maxScore: 4.99, bonusValueLeader: 0, bonusValueLed: 0 },
        { minScore: 5, maxScore: 7.99, bonusValueLeader: 250, bonusValueLed: 150 },
        { minScore: 8, maxScore: 10, bonusValueLeader: 500, bonusValueLed: 300 }
    ]
};

export async function getKpiBonusParameters(): Promise<KpiBonusParametersData> {
  try {
    const docRef = doc(db, 'config', 'kpiBonusParameters');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as KpiBonusParametersData;
    } else {
      await setDoc(docRef, defaultKpiBonusParameters);
      return defaultKpiBonusParameters;
    }
  } catch (error) {
    console.error("Error fetching KPI bonus parameters: ", error);
    return defaultKpiBonusParameters;
  }
}

export async function updateKpiBonusParameters(data: KpiBonusParametersData) {
    const validation = kpiBonusParametersSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, message: "Dados inválidos." };
    }
    try {
        const docRef = doc(db, 'config', 'kpiBonusParameters');
        await setDoc(docRef, validation.data);
        return { success: true, message: 'Parâmetros de bonificação de KPI atualizados!' };
    } catch (error) {
        console.error("Error updating KPI bonus parameters: ", error);
        return { success: false, message: 'Erro ao atualizar parâmetros de KPI.' };
    }
}


// --- KPI Model Actions ---
export interface KpiIndicator {
    indicator: string;
    weight: number;
    goal: number;
    type: 'accelerator' | 'detractor' | 'neutral';
    condition: 'above' | 'below';
}

export interface KpiModel {
    id: string;
    departmentId: string;
    departmentName?: string;
    indicators: KpiIndicator[];
}

export async function getKpiModels(): Promise<KpiModel[]> {
    try {
        const [modelsSnapshot, departments] = await Promise.all([
            getDocs(collection(db, 'kpi_models')),
            getDepartments(),
        ]);
        const departmentsMap = new Map(departments.map(d => [d.id, d.name]));

        return modelsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                departmentId: data.departmentId,
                departmentName: departmentsMap.get(data.departmentId) || 'Setor não encontrado',
                indicators: data.indicators || [],
            } as KpiModel;
        });
    } catch (error) {
        console.error("Error fetching KPI models: ", error);
        return [];
    }
}


export async function createOrUpdateKpiModel(data: KpiModelFormData) {
    const validation = kpiModelSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, message: 'Dados inválidos.', errors: validation.error.flatten().fieldErrors };
    }

    const { id, ...kpiData } = validation.data;

    try {
        if (id) {
            const modelRef = doc(db, 'kpi_models', id);
            await updateDoc(modelRef, kpiData as any);
            return { success: true, message: 'Modelo de KPI atualizado com sucesso!' };
        } else {
            await addDoc(collection(db, 'kpi_models'), kpiData);
            return { success: true, message: 'Modelo de KPI criado com sucesso!' };
        }
    } catch (error) {
        console.error("Error saving KPI model: ", error);
        return { success: false, message: 'Erro ao salvar modelo de KPI.' };
    }
}


// --- KPI Assessment Actions ---

export interface KpiAssessmentRecord {
    id: string;
    departmentId: string;
    departmentName: string;
    period: string;
    kpiScore: number;
    assessedAt: string;
    results: Record<string, number>;
    indicators: KpiIndicator[];
}

export async function getKpiAssessments(filters: { period: string; departmentId?: string }): Promise<KpiAssessmentRecord[]> {
  try {
    let conditions: any[] = [where('period', '==', filters.period)];
    if (filters.departmentId && filters.departmentId !== 'all' && filters.departmentId !== '') {
      conditions.push(where('departmentId', '==', filters.departmentId));
    }
    
    const q = query(
      collection(db, 'kpi_assessments'),
      ...conditions
    );
    
    const snapshot = await getDocs(q);
    
    const data = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        departmentId: data.departmentId,
        departmentName: data.departmentName,
        period: data.period,
        kpiScore: data.kpiScore,
        assessedAt: (data.assessedAt as Timestamp).toDate().toISOString(),
        results: data.results || {},
        indicators: data.indicators || [],
      } as KpiAssessmentRecord;
    });

    // Sort in code to avoid composite index requirement
    return data.sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());
    
  } catch (error) {
    console.error("Error fetching KPI assessments history: ", error);
    return [];
  }
}

export async function deleteKpiAssessment(assessmentId: string) {
  if (!assessmentId) {
    return { success: false, message: 'ID da apuração não fornecido.' };
  }
  
  const batch = writeBatch(db);
  const assessmentRef = doc(db, 'kpi_assessments', assessmentId);

  try {
    const assessmentSnap = await getDoc(assessmentRef);
    if (!assessmentSnap.exists()) {
        return { success: false, message: 'Apuração não encontrada.' };
    }
    
    const { departmentName, period } = assessmentSnap.data();

    // 1. Find all reviews for that department and period
    if (departmentName && period) {
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('department', '==', departmentName),
            where('period', '==', period)
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);

        // 2. Update them to remove the kpiScore
        reviewsSnapshot.forEach(reviewDoc => {
            const reviewRef = doc(db, 'reviews', reviewDoc.id);
            batch.update(reviewRef, { kpiScore: null }); // or FieldValue.delete()
        });
    }
    
    // 3. Delete the assessment itself
    batch.delete(assessmentRef);
    
    // 4. Commit all changes
    await batch.commit();

    return { success: true, message: 'Apuração de KPI e notas correspondentes foram excluídas com sucesso!' };
  } catch (error) {
    console.error("Error deleting KPI assessment and updating reviews: ", error);
    return { success: false, message: 'Erro ao excluir apuração de KPI.' };
  }
}

function calculateKpiScore(model: KpiModel, results: Record<string, number>): number {
    let totalPoints = 0;

    model.indicators.forEach((indicator, index) => {
        const resultValue = results[index];
        if (resultValue === undefined || resultValue === null) return;

        const goal = indicator.goal;
        const points = indicator.weight;

        let conditionMet = false;
        if (indicator.condition === 'above') {
            conditionMet = resultValue >= goal;
        } else { // 'below'
            conditionMet = resultValue <= goal;
        }

        if (indicator.type === 'accelerator' || indicator.type === 'neutral') {
            if (conditionMet) {
                totalPoints += points;
            }
        } else if (indicator.type === 'detractor') {
             // Penalize if condition is NOT met
            if (!conditionMet) {
                totalPoints -= points;
            }
        }
    });
    
    return totalPoints;
}

export async function processKpiResultsForDepartment(data: {
    model: KpiModel;
    results: Record<string, number>;
    period: string;
}) {
    const { model, results, period } = data;
    if (!model || !results || !period || !model.departmentName) {
        return { success: false, message: "Dados inválidos para apuração." };
    }
    
    try {
        const kpiScore = calculateKpiScore(model, results);
        
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('department', '==', model.departmentName),
            where('period', '==', period)
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);
        
        if (reviewsSnapshot.empty) {
            return { success: true, message: `Nenhuma avaliação encontrada para o período ${period} neste setor. A nota de KPI (${kpiScore.toFixed(2)}) foi calculada mas não foi salva.` };
        }

        const batch = writeBatch(db);
        reviewsSnapshot.forEach(reviewDoc => {
            const reviewRef = doc(db, 'reviews', reviewDoc.id);
            const reviewData = reviewDoc.data();
            const updatePayload: {kpiScore: number, status?: ReviewStatus, completedAt?: Date} = {
                kpiScore: kpiScore,
            };

            // Only mark as "Completed" if the manager has already done their part (status is "Em Aprovação")
            if (reviewData.status === 'Em Aprovação') {
                updatePayload.status = 'Concluída';
                updatePayload.completedAt = new Date();
            }

            batch.update(reviewRef, updatePayload);
        });
        
        // Save the assessment to history
        const assessmentHistoryRef = doc(collection(db, 'kpi_assessments'));
        batch.set(assessmentHistoryRef, {
            departmentId: model.departmentId,
            departmentName: model.departmentName,
            period: period,
            kpiScore: kpiScore,
            results: results,
            indicators: model.indicators, // Store a snapshot of the indicators
            assessedAt: new Date(),
        });


        await batch.commit();

        return { success: true, message: `Nota de KPI (${kpiScore.toFixed(2)}) apurada e salva para ${reviewsSnapshot.size} avaliaçõe(s) do setor ${model.departmentName}!` };

    } catch (error) {
        console.error("Error processing KPI results: ", error);
        return { success: false, message: 'Erro ao processar e salvar resultados de KPI.' };
    }
}

// --- Bonus Report Actions ---
export interface BonusReportData {
    employeeName: string;
    departmentName: string;
    role: string;
    averageScore: number;
    kpiScore: number;
    performanceBonusPercentage: number;
    kpiBonusValue: number;
}

export async function getBonusReport(filters: { period: string; departmentId?: string }): Promise<BonusReportData[]> {
    const { period, departmentId } = filters;
    if (!period) return [];

    try {
        const reviewsRef = collection(db, 'reviews');
        const conditions = [
            where('period', '==', period),
            where('status', '==', 'Concluída')
        ];

        if (departmentId) {
            const departmentDoc = await getDoc(doc(db, 'departments', departmentId));
            if (departmentDoc.exists()) {
                const departmentName = departmentDoc.data().name;
                conditions.push(where('department', '==', departmentName));
            } else {
                 return []; // No department found, no results
            }
        }
        
        const [reviewsSnapshot, performanceParams, kpiParams, allUsers] = await Promise.all([
            getDocs(query(reviewsRef, ...conditions)),
            getBonusParameters(),
            getKpiBonusParameters(),
            getUsers()
        ]);

        if (reviewsSnapshot.empty) return [];

        const usersMap = new Map(allUsers.map(u => [u.id, u]));

        return reviewsSnapshot.docs.map(doc => {
            const review = doc.data();
            const user = usersMap.get(review.employeeId);
            
            const avgScore = review.averageScore ?? 0;
            const kpiScore = review.kpiScore ?? 0;

            const perfRule = performanceParams.rules.find(r => avgScore >= r.minScore && avgScore <= r.maxScore);
            const kpiRule = kpiParams.rules.find(r => kpiScore >= r.minScore && kpiScore <= r.maxScore);
            
            let baseKpiBonus = 0;
            if (kpiRule && user) {
                baseKpiBonus = user.role === 'Gerente' ? kpiRule.bonusValueLeader : kpiRule.bonusValueLed;
            }
            
            const perfBonusPercentage = perfRule?.bonusPercentage ?? 0;
            const finalKpiBonus = baseKpiBonus * (perfBonusPercentage / 100);

            return {
                employeeName: review.employee,
                departmentName: review.department,
                role: review.role,
                averageScore: avgScore,
                kpiScore: kpiScore,
                performanceBonusPercentage: perfBonusPercentage,
                kpiBonusValue: finalKpiBonus,
            };
        }).sort((a,b) => a.employeeName.localeCompare(b.employeeName));

    } catch (error) {
        console.error("Error getting bonus report data:", error);
        return [];
    }
}

// --- Individual Performance History ---
export interface PerformanceHistoryData {
    period: string;
    averageScore: number;
}

export async function getIndividualPerformanceHistory(employeeId: string): Promise<PerformanceHistoryData[]> {
    if (!employeeId) return [];

    try {
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('employeeId', '==', employeeId),
            where('status', '==', 'Concluída'),
            orderBy('period', 'desc')
        );

        const snapshot = await getDocs(reviewsQuery);

        if (snapshot.empty) return [];

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                period: data.period,
                averageScore: data.averageScore,
            };
        });
    } catch (error) {
        console.error("Error fetching individual performance history:", error);
        return [];
    }
}
    

