
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  documentId,
  writeBatch,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { LoggedUser } from '../actions';
import type { User } from '../usuarios/actions';
import { trainingSchema, playlistSchema, type TrainingFormData, type PlaylistFormData } from './schema';

export interface Question {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface Quiz {
  questions: Question[];
}

export interface Training {
  id: string;
  title: string;
  description: string;
  youtubeUrl?: string;
  pdfUrl?: string;
  quiz?: Quiz;
  createdAt?: string;
  category?: string;
  prerequisiteIds?: string[];
}

export interface UserTraining extends Training {
  userTrainingId: string;
  completed: boolean;
  quizScore?: number;
  quizStatus?: 'not_started' | 'passed' | 'failed';
}

export interface AssignedUser extends User {
    userTrainingId: string;
    completed: boolean;
    quizScore?: number;
    quizStatus?: 'not_started' | 'passed' | 'failed';
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trainingIds: string[];
  trainings?: Training[];
  createdAt?: string;
}

export async function createOrUpdateTraining(data: TrainingFormData) {
  const validation = trainingSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.flatten().fieldErrors;
    console.error("Validation errors:", errorMessages);
    return { success: false, message: 'Dados inválidos. Verifique os campos e tente novamente.', errors: errorMessages };
  }
  
  const { id, ...trainingData } = validation.data;
  
  const cleanedData: any = {
      title: trainingData.title,
      description: trainingData.description,
      category: trainingData.category || '',
      prerequisiteIds: trainingData.prerequisiteIds || [],
  };

  if (trainingData.youtubeUrl) {
      cleanedData.youtubeUrl = trainingData.youtubeUrl;
  }
  
  if (trainingData.pdfUrl) {
      cleanedData.pdfUrl = trainingData.pdfUrl;
  }

  if (trainingData.quiz && trainingData.quiz.questions && trainingData.quiz.questions.length > 0) {
    cleanedData.quiz = {
      questions: trainingData.quiz.questions.map(q => ({
        ...q,
        options: q.options.filter(opt => opt && opt.trim() !== '')
      })).filter(q => q.questionText && q.questionText.trim() !== '')
    };
  }


  try {
    if (id) {
      const trainingRef = doc(db, 'trainings', id);
      await updateDoc(trainingRef, cleanedData);
      return { success: true, message: 'Treinamento atualizado com sucesso!' };
    } else {
      cleanedData.createdAt = new Date();
      await addDoc(collection(db, "trainings"), cleanedData);
      return { success: true, message: 'Treinamento criado com sucesso!' };
    }
  } catch (error) {
    console.error("Error saving training: ", error);
    return { success: false, message: 'Erro ao salvar treinamento.' };
  }
}

export async function deleteTraining(id: string) {
  if (!id) return { success: false, message: 'ID do treinamento não fornecido.' };
  try {
    await deleteDoc(doc(db, 'trainings', id));
    return { success: true, message: 'Treinamento excluído com sucesso!' };
  } catch (error) {
    console.error('Error deleting training: ', error);
    return { success: false, message: 'Erro ao excluir treinamento.' };
  }
}

export async function getTrainingById(id: string): Promise<Training | null> {
  if (!id) return null;
  try {
    const trainingRef = doc(db, 'trainings', id);
    const docSnap = await getDoc(trainingRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
      } as Training;
    }
    return null;
  } catch (error) {
    console.error("Error fetching training by ID: ", error);
    return null;
  }
}

export async function getAllTrainings(): Promise<Training[]> {
  try {
    const trainingsSnapshot = await getDocs(query(collection(db, 'trainings')));
    return trainingsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
      } as Training;
    });
  } catch (error) {
    console.error("Error fetching all trainings: ", error);
    return [];
  }
}

export async function assignTrainingsToUsers(data: { trainingId: string; userIds: string[] }) {
  const { trainingId, userIds } = data;
  if (!trainingId || !userIds || userIds.length === 0) {
    return { success: false, message: 'Dados inválidos para atribuição.' };
  }
  try {
    const batch = writeBatch(db);
    userIds.forEach(userId => {
      const assignmentRef = doc(collection(db, 'user_trainings'));
      batch.set(assignmentRef, {
        userId,
        trainingId,
        completed: false,
        assignedAt: new Date(),
        quizStatus: 'not_started',
        quizScore: null,
      });
    });
    await batch.commit();
    return { success: true, message: 'Treinamentos atribuídos com sucesso!' };
  } catch (error) {
    console.error("Error assigning trainings: ", error);
    return { success: false, message: 'Erro ao atribuir treinamentos.' };
  }
}

export async function getMyTrainings(user: LoggedUser): Promise<UserTraining[]> {
  if (!user?.id) return [];
  try {
    const assignmentsQuery = query(collection(db, 'user_trainings'), where('userId', '==', user.id));
    const assignmentsSnapshot = await getDocs(assignmentsQuery);

    if (assignmentsSnapshot.empty) return [];
    
    const trainingIds = assignmentsSnapshot.docs.map(doc => doc.data().trainingId).filter(Boolean);
    if (trainingIds.length === 0) return [];
    
    const trainingsQuery = query(collection(db, 'trainings'), where(documentId(), 'in', trainingIds));
    const trainingsSnapshot = await getDocs(trainingsQuery);
    const trainingsMap = new Map(
      trainingsSnapshot.docs.map(doc => {
        const data = doc.data();
        const trainingDetails = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate().toISOString(),
        } as Training;
        return [doc.id, trainingDetails];
      })
    );

    const userTrainings = assignmentsSnapshot.docs.map(doc => {
      const assignment = doc.data();
      const trainingDetails = trainingsMap.get(assignment.trainingId);
      if (!trainingDetails) return null;
      return {
        ...trainingDetails,
        userTrainingId: doc.id,
        completed: assignment.completed,
        quizScore: assignment.quizScore,
        quizStatus: assignment.quizStatus,
      };
    }).filter(Boolean) as UserTraining[];

    return userTrainings;

  } catch (error) {
    console.error("Error fetching user trainings: ", error);
    return [];
  }
}

export interface QuizPageData {
  training: Training;
  quizStatus?: 'not_started' | 'passed' | 'failed';
  quizScore?: number;
}

export async function getQuizData(userTrainingId: string): Promise<QuizPageData | null> {
    if (!userTrainingId) return null;
    try {
        const userTrainingRef = doc(db, 'user_trainings', userTrainingId);
        const userTrainingSnap = await getDoc(userTrainingRef);

        if (!userTrainingSnap.exists()) {
            console.error("User training document not found:", userTrainingId);
            return null;
        }

        const userTrainingData = userTrainingSnap.data();
        const trainingId = userTrainingData.trainingId;

        if (!trainingId) {
            console.error("User training document is missing trainingId", userTrainingId);
            return null;
        }
        
        const training = await getTrainingById(trainingId);

        if (!training) {
            console.error("Training not found for user training:", userTrainingId);
            return null;
        }

        return {
            training: training,
            quizStatus: userTrainingData.quizStatus,
            quizScore: userTrainingData.quizScore,
        };

    } catch (error) {
        console.error("Error fetching quiz data:", error);
        return null;
    }
}

export async function submitQuizResult(data: { userTrainingId: string; trainingId: string; answers: Record<string, number> }) {
    const { userTrainingId, trainingId, answers } = data;

    try {
        const training = await getTrainingById(trainingId);
        if (!training?.quiz?.questions) {
            return { success: false, message: 'Quiz não encontrado para este treinamento.' };
        }

        let correctAnswers = 0;
        training.quiz.questions.forEach((q, index) => {
            if (q.correctAnswerIndex === Number(answers[index])) {
                correctAnswers++;
            }
        });
        
        const score = Math.round((correctAnswers / training.quiz.questions.length) * 100);
        const passed = score >= 70;
        const quizStatus = passed ? 'passed' : 'failed';
        
        const assignmentRef = doc(db, 'user_trainings', userTrainingId);
        await updateDoc(assignmentRef, {
            quizScore: score,
            quizStatus: quizStatus,
            completed: passed,
        });

        return { success: true, message: 'Quiz enviado com sucesso!', score, passed };

    } catch (error) {
        console.error("Error submitting quiz result: ", error);
        return { success: false, message: 'Erro ao enviar resultado do quiz.' };
    }
}

export async function getAssignedUsersForTraining(trainingId: string): Promise<AssignedUser[]> {
    if (!trainingId) return [];
    try {
        const assignmentsQuery = query(collection(db, 'user_trainings'), where('trainingId', '==', trainingId));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        if (assignmentsSnapshot.empty) return [];

        const userIds = assignmentsSnapshot.docs.map(doc => doc.data().userId).filter(Boolean);
        if (userIds.length === 0) return [];

        const usersQuery = query(collection(db, 'users'), where(documentId(), 'in', userIds));
        const usersSnapshot = await getDocs(usersQuery);
        const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as User]));

        const assignedUsers = assignmentsSnapshot.docs.map(doc => {
            const assignment = doc.data();
            const userDetails = usersMap.get(assignment.userId);
            if (!userDetails) return null;
            return {
                ...userDetails,
                userTrainingId: doc.id,
                completed: assignment.completed,
                quizScore: assignment.quizScore,
                quizStatus: assignment.quizStatus || 'not_started',
            };
        }).filter(Boolean) as AssignedUser[];

        return assignedUsers;
    } catch (error) {
        console.error("Error fetching assigned users: ", error);
        return [];
    }
}

export async function resetQuizAttempt(userTrainingId: string) {
    if (!userTrainingId) return { success: false, message: 'ID da atribuição não fornecido.' };
    try {
        const assignmentRef = doc(db, 'user_trainings', userTrainingId);
        await updateDoc(assignmentRef, {
            completed: false,
            quizStatus: 'not_started',
            quizScore: null,
        });
        return { success: true, message: 'Tentativa do quiz reiniciada com sucesso!' };
    } catch (error) {
        console.error("Error resetting quiz attempt: ", error);
        return { success: false, message: 'Erro ao reiniciar tentativa.' };
    }
}

export async function removeUserFromTraining(userTrainingId: string) {
  if (!userTrainingId) {
    return { success: false, message: 'ID da atribuição de treinamento não fornecido.' };
  }
  try {
    await deleteDoc(doc(db, 'user_trainings', userTrainingId));
    return { success: true, message: 'Usuário removido do treinamento com sucesso!' };
  } catch (error) {
    console.error('Error removing user from training: ', error);
    return { success: false, message: 'Erro ao remover usuário do treinamento.' };
  }
}


export async function updateTrainingStatus(data: { userTrainingId: string; completed: boolean }) {
  try {
    const assignmentRef = doc(db, 'user_trainings', data.userTrainingId);
    await updateDoc(assignmentRef, { completed: data.completed });
    return { success: true, message: 'Status atualizado com sucesso!' };
  } catch (error) {
    console.error("Error updating training status: ", error);
    return { success: false, message: 'Erro ao atualizar status.' };
  }
}

// --- Playlist Actions ---

export async function createOrUpdatePlaylist(data: PlaylistFormData) {
  const validation = playlistSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Dados inválidos.', errors: validation.error.flatten().fieldErrors };
  }
  
  const { id, ...playlistData } = validation.data;

  try {
    if (id) {
      const playlistRef = doc(db, 'training_playlists', id);
      await updateDoc(playlistRef, playlistData as any);
      return { success: true, message: 'Playlist atualizada com sucesso!' };
    } else {
      const dataToSave = { ...playlistData, createdAt: new Date() };
      await addDoc(collection(db, "training_playlists"), dataToSave);
      return { success: true, message: 'Playlist criada com sucesso!' };
    }
  } catch (error) {
    console.error("Error saving playlist: ", error);
    return { success: false, message: 'Erro ao salvar playlist.' };
  }
}

export async function deletePlaylist(id: string) {
  if (!id) return { success: false, message: 'ID da playlist não fornecido.' };
  try {
    await deleteDoc(doc(db, 'training_playlists', id));
    return { success: true, message: 'Playlist excluída com sucesso!' };
  } catch (error) {
    console.error('Error deleting playlist: ', error);
    return { success: false, message: 'Erro ao excluir playlist.' };
  }
}

export async function getPlaylists(): Promise<Playlist[]> {
    try {
        const playlistsSnapshot = await getDocs(query(collection(db, 'training_playlists')));
        const allTrainings = await getAllTrainings();
        const trainingsMap = new Map(allTrainings.map(t => [t.id, t]));

        return playlistsSnapshot.docs.map(doc => {
            const data = doc.data();
            const trainingIds = data.trainingIds || [];
            const trainings = trainingIds.map((id: string) => trainingsMap.get(id)).filter(Boolean) as Training[];
            
            return {
                id: doc.id,
                name: data.name,
                description: data.description || '',
                trainingIds: trainingIds,
                trainings: trainings,
                createdAt: data.createdAt?.toDate().toISOString(),
            } as Playlist;
        });
    } catch (error) {
        console.error("Error fetching playlists: ", error);
        return [];
    }
}


export async function assignPlaylistToUsers(data: { playlistId: string; userIds: string[] }) {
    const { playlistId, userIds } = data;
    if (!playlistId || !userIds || userIds.length === 0) {
        return { success: false, message: 'Dados inválidos para atribuição.' };
    }

    try {
        const playlistDoc = await getDoc(doc(db, 'training_playlists', playlistId));
        if (!playlistDoc.exists()) {
            return { success: false, message: 'Playlist não encontrada.' };
        }
        const trainingIds = playlistDoc.data().trainingIds || [];
        if (trainingIds.length === 0) {
            return { success: true, message: 'A playlist está vazia. Nenhum treinamento atribuído.' };
        }

        const batch = writeBatch(db);
        let assignmentsCount = 0;

        const existingAssignmentsQuery = query(collection(db, 'user_trainings'), where('userId', 'in', userIds));
        const existingAssignmentsSnapshot = await getDocs(existingAssignmentsQuery);
        const existingPairs = new Set(existingAssignmentsSnapshot.docs.map(d => `${d.data().userId}_${d.data().trainingId}`));

        userIds.forEach(userId => {
            trainingIds.forEach((trainingId: string) => {
                if (!existingPairs.has(`${userId}_${trainingId}`)) {
                    const assignmentRef = doc(collection(db, 'user_trainings'));
                    batch.set(assignmentRef, {
                        userId,
                        trainingId,
                        completed: false,
                        assignedAt: new Date(),
                        quizStatus: 'not_started',
                        quizScore: null,
                    });
                    assignmentsCount++;
                }
            });
        });

        if (assignmentsCount > 0) {
            await batch.commit();
        }
        
        return { success: true, message: `${assignmentsCount} novas atribuições de treinamento realizadas com sucesso!` };

    } catch (error) {
        console.error("Error assigning playlist: ", error);
        return { success: false, message: 'Erro ao atribuir a playlist.' };
    }
}
