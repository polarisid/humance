
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { userSchema, type UserFormData } from './schema';
import type { LoggedUser } from '../actions';

export interface User extends Omit<LoggedUser, 'password'> {
  departmentName?: string;
}

export async function createUser(data: UserFormData) {
  // On creation, password is required.
  if (!data.password || data.password.length < 6) {
    return {
      success: false,
      message: 'A senha é obrigatória e deve ter pelo menos 6 caracteres.',
    };
  }
  
  const validation = userSchema.safeParse(data);

  if (!validation.success) {
    return {
      success: false,
      message: 'Dados inválidos. Verifique os campos e tente novamente.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  try {
    const { id, ...userDataToSave } = validation.data;
    const finalUserData: any = { ...userDataToSave, createdAt: new Date() };
    
    if (finalUserData.departmentId === '') {
      delete finalUserData.departmentId;
    }

    await addDoc(collection(db, "users"), finalUserData);
    
    return { success: true, message: 'Usuário criado com sucesso!' };
  } catch (error) {
    console.error("Error creating user: ", error);
    return { success: false, message: 'Ocorreu um erro ao criar o usuário. Tente novamente.' };
  }
}

export async function updateUser(data: UserFormData) {
  const validation = userSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Dados inválidos.' };
  }

  try {
    const { id, password, ...userDataToUpdate } = validation.data;
    if (!id) {
        return { success: false, message: 'ID do usuário não fornecido.' };
    }

    const userRef = doc(db, 'users', id);
    const updateData: any = userDataToUpdate;
    
    // Only update password if a new one is provided
    if (password && password.length >= 6) {
      updateData.password = password;
    }
    
    if (updateData.departmentId === '' || updateData.departmentId === null) {
        // In Firestore, to remove a field, you might need a specific delete sentinel,
        // but for this structure, we'll just ensure it's not set or handle it on read.
        // For simplicity, we can just not include it if it's empty.
        delete updateData.departmentId;
    }

    await updateDoc(userRef, updateData);
    return { success: true, message: 'Usuário atualizado com sucesso!' };
  } catch (error) {
    console.error('Error updating user: ', error);
    return { success: false, message: 'Erro ao atualizar usuário.' };
  }
}

export async function deleteUser(id: string) {
  if (!id) {
    return { success: false, message: 'ID do usuário não fornecido.' };
  }
  try {
    await deleteDoc(doc(db, 'users', id));
    return { success: true, message: 'Usuário excluído com sucesso!' };
  } catch (error) {
    console.error('Error deleting user: ', error);
    return { success: false, message: 'Erro ao excluir usuário.' };
  }
}


export async function getUsers(): Promise<User[]> {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const departmentsSnapshot = await getDocs(collection(db, "departments"));
    
    const departmentsMap = new Map<string, string>(
      departmentsSnapshot.docs.map(doc => [doc.id, doc.data().name])
    );

    const users = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        role: data.role,
        birthDate: data.birthDate?.toDate(),
        departmentId: data.departmentId,
        departmentName: data.departmentId ? departmentsMap.get(data.departmentId) : undefined,
      }
    });
    return users;
  } catch (error) {
    console.error("Error fetching users: ", error);
    return [];
  }
}
