
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore';
import { z } from 'zod';

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  status: 'Pendente' | 'Comprado' | 'Em falta' | 'Entregue';
  requesterId: string;
  requesterName: string;
  createdAt: string;
  links?: string;
  comments?: string;
}

// Schema for adding a new item
const addItemSchema = z.object({
  name: z.string().min(1, 'O nome do item é obrigatório.'),
  category: z.string().min(1, 'A categoria é obrigatória.'),
  quantity: z.number().min(1, 'A quantidade deve ser pelo menos 1.'),
  requesterId: z.string(),
  requesterName: z.string(),
  links: z.string().optional(),
  comments: z.string().optional(),
});

// Schema for updating status
const updateStatusSchema = z.object({
    id: z.string(),
    status: z.enum(['Pendente', 'Comprado', 'Em falta', 'Entregue']),
});


export async function getShoppingItems(): Promise<ShoppingItem[]> {
  try {
    const itemsRef = collection(db, 'shopping_items');
    const q = query(itemsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        } as ShoppingItem;
    });
  } catch (error) {
    console.error("Error fetching shopping items: ", error);
    return [];
  }
}

export async function addShoppingItem(data: z.infer<typeof addItemSchema>) {
  const validation = addItemSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Dados inválidos.' };
  }
  try {
    await addDoc(collection(db, 'shopping_items'), {
      ...validation.data,
      status: 'Pendente',
      createdAt: new Date(),
    });
    return { success: true, message: 'Item adicionado com sucesso!' };
  } catch (error) {
    console.error('Error adding shopping item: ', error);
    return { success: false, message: 'Erro ao adicionar item.' };
  }
}

export async function updateShoppingItemStatus(data: z.infer<typeof updateStatusSchema>) {
    const validation = updateStatusSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, message: 'Dados inválidos.' };
    }
    try {
        const itemRef = doc(db, 'shopping_items', validation.data.id);
        await updateDoc(itemRef, { status: validation.data.status });
        return { success: true, message: 'Status do item atualizado!' };
    } catch (error) {
        console.error('Error updating item status: ', error);
        return { success: false, message: 'Erro ao atualizar status.' };
    }
}

export async function deleteShoppingItem(id: string) {
  if (!id) {
    return { success: false, message: 'ID do item não fornecido.' };
  }
  try {
    await deleteDoc(doc(db, 'shopping_items', id));
    return { success: true, message: 'Item excluído com sucesso!' };
  } catch (error) {
    console.error('Error deleting item: ', error);
    return { success: false, message: 'Erro ao excluir item.' };
  }
}
