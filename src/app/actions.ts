'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  role: z.enum(['Administrador', 'Gerente', 'Colaborador']),
});

export interface LoggedUser {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Gerente' | 'Colaborador';
  password?: string;
  birthDate?: Date;
  departmentId?: string;
}


export async function loginUser(data: z.infer<typeof loginSchema>): Promise<{ success: boolean; message: string; user?: LoggedUser }> {
  const validation = loginSchema.safeParse(data);

  if (!validation.success) {
    return {
      success: false,
      message: 'Dados de login inválidos.',
    };
  }
  
  const { email, password, role } = validation.data;

  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, 
      where("email", "==", email.toLowerCase()), 
      where("password", "==", password), // Unsafe, but following existing pattern
      where("role", "==", role)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, message: 'Credenciais inválidas. Verifique seus dados e tente novamente.' };
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    return { 
      success: true, 
      message: 'Login bem-sucedido!',
      user: {
        id: userDoc.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        password: userData.password,
        birthDate: userData.birthDate?.toDate(), // Convert timestamp to Date if it exists
        departmentId: userData.departmentId,
      }
    };

  } catch (error) {
    console.error("Error during login: ", error);
    return { success: false, message: 'Ocorreu um erro no servidor. Tente novamente mais tarde.' };
  }
}
