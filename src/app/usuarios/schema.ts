import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, insira um e-mail válido." }),
  // Password is optional. If provided, it must be at least 6 chars. Empty string means not provided.
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }).optional().or(z.literal('')),
  role: z.enum(['Administrador', 'Gerente', 'Colaborador']),
  birthDate: z.date({
    required_error: "A data de nascimento é obrigatória.",
  }),
  departmentId: z.string().optional(),
});

export type UserFormData = z.infer<typeof userSchema>;
