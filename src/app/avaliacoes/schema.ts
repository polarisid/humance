import { z } from 'zod';

export const evaluationItemSchema = z.object({
  text: z.string().min(3, 'O item deve ter pelo menos 3 caracteres.'),
  description: z.string().optional(),
});

export const reviewTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, 'O nome do modelo deve ter pelo menos 3 caracteres.'),
  items: z.array(evaluationItemSchema).min(1, 'A avaliação deve ter pelo menos um item.'),
});

export type ReviewTemplateFormData = z.infer<typeof reviewTemplateSchema>;

export const reviewSubmissionSchema = z.object({
  reviewId: z.string(),
  scores: z.record(z.string(), z.number().min(0).max(10)),
  managerObservations: z.string().optional(),
  feedbackForEmployee: z.string().min(20, "O feedback para o colaborador deve ter pelo menos 20 caracteres."),
});

export const reviewAdjustmentSchema = z.object({
  reviewId: z.string(),
  feedback: z.string().min(10, 'O feedback para o gestor deve ter pelo menos 10 caracteres.'),
});

// Schema for Performance Bonus Parameters
const bonusRuleSchema = z.object({
  minScore: z.coerce.number(),
  maxScore: z.coerce.number(),
  bonusPercentage: z.coerce.number().min(0, "O percentual não pode ser negativo."),
});

export const bonusParametersSchema = z.object({
    rules: z.array(bonusRuleSchema),
});

export type BonusParametersData = z.infer<typeof bonusParametersSchema>;

// Schema for KPI Bonus Parameters
const kpiBonusRuleSchema = z.object({
  minScore: z.coerce.number(),
  maxScore: z.coerce.number(),
  bonusValueLeader: z.coerce.number().min(0, "O valor do bônus para líder deve ser positivo."),
  bonusValueLed: z.coerce.number().min(0, "O valor do bônus para liderado deve ser positivo."),
});

export const kpiBonusParametersSchema = z.object({
  rules: z.array(kpiBonusRuleSchema),
});

export type KpiBonusParametersData = z.infer<typeof kpiBonusParametersSchema>;


// Schema for KPI Models
export const kpiIndicatorSchema = z.object({
  indicator: z.string().min(3, 'O nome do indicador é obrigatório.'),
  weight: z.coerce.number().gt(0, 'O peso deve ser um número positivo.'),
  goal: z.coerce.number({ required_error: 'A meta é obrigatória.' }),
  type: z.enum(['accelerator', 'detractor', 'neutral'], { required_error: 'Selecione o tipo.' }),
  condition: z.enum(['above', 'below'], { required_error: 'Selecione a condição.' }),
});

export const kpiModelSchema = z.object({
  id: z.string().optional(),
  departmentId: z.string({ required_error: 'Selecione um setor.' }).min(1, 'Selecione um setor.'),
  indicators: z.array(kpiIndicatorSchema).min(1, 'Adicione pelo menos um indicador de KPI.'),
});

export type KpiModelFormData = z.infer<typeof kpiModelSchema>;
