import { z } from 'zod';

export const evaluationItemSchema = z.object({
  text: z.string().min(3, 'O item deve ter pelo menos 3 caracteres.'),
});

export const reviewTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, 'O nome do modelo deve ter pelo menos 3 caracteres.'),
  items: z.array(evaluationItemSchema).min(1, 'A avaliação deve ter pelo menos um item.'),
});

export type ReviewTemplateFormData = z.infer<typeof reviewTemplateSchema>;

export const reviewSubmissionSchema = z.object({
  reviewId: z.string(),
  scores: z.record(z.string(), z.number().min(1).max(10)),
  managerObservations: z.string().optional(),
  feedbackForEmployee: z.string().min(20, "O feedback para o colaborador deve ter pelo menos 20 caracteres."),
});

export const reviewAdjustmentSchema = z.object({
  reviewId: z.string(),
  feedback: z.string().min(10, 'O feedback para o gestor deve ter pelo menos 10 caracteres.'),
});
