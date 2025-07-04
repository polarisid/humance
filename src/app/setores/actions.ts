'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

export interface Department {
  id: string;
  name: string;
  leaderId: string;
  leaderName?: string;
}

export interface Manager {
  id: string;
  name: string;
}

export async function getManagers(): Promise<Manager[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'Gerente'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
    }));
  } catch (error) {
    console.error('Error fetching managers: ', error);
    return [];
  }
}

export async function getDepartments(): Promise<Department[]> {
  try {
    const departmentsSnapshot = await getDocs(collection(db, 'departments'));
    const departments = departmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Department[];

    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersMap = new Map(
      usersSnapshot.docs.map(doc => [doc.id, doc.data().name])
    );

    const departmentsWithLeaders = departments.map(dep => ({
      ...dep,
      leaderName: usersMap.get(dep.leaderId) || 'Líder não encontrado',
    }));

    return departmentsWithLeaders;
  } catch (error) {
    console.error('Error fetching departments: ', error);
    return [];
  }
}

export async function addDepartment(data: { name: string; leaderId: string }) {
  if (!data.name || !data.leaderId) {
    return { success: false, message: 'Nome do setor e líder são obrigatórios.' };
  }
  try {
    await addDoc(collection(db, 'departments'), {
      name: data.name,
      leaderId: data.leaderId,
    });
    return { success: true, message: 'Setor criado com sucesso!' };
  } catch (error) {
    console.error('Error creating department: ', error);
    return { success: false, message: 'Erro ao criar setor.' };
  }
}

export async function updateDepartment(data: { id: string; name: string; leaderId: string }) {
   if (!data.id || !data.name || !data.leaderId) {
    return { success: false, message: 'Dados inválidos.' };
  }
  try {
    const departmentRef = doc(db, 'departments', data.id);
    await updateDoc(departmentRef, {
      name: data.name,
      leaderId: data.leaderId,
    });
    return { success: true, message: 'Setor atualizado com sucesso!' };
  } catch (error) {
    console.error('Error updating department: ', error);
    return { success: false, message: 'Erro ao atualizar setor.' };
  }
}

export async function deleteDepartment(id: string) {
   if (!id) {
    return { success: false, message: 'ID do setor não fornecido.' };
  }
  try {
    await deleteDoc(doc(db, 'departments', id));
    return { success: true, message: 'Setor excluído com sucesso!' };
  } catch (error) {
    console.error('Error deleting department: ', error);
    return { success: false, message: 'Erro ao excluir setor.' };
  }
}
