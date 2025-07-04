import { z } from 'zod';

const questionSchema = z.object({
  questionText: z.string().min(1, 'A pergunta é obrigatória.'),
  // Expect an array of 4 options, can be empty strings if not used
  options: z.array(z.string().optional()).min(2, 'Deve haver pelo menos duas opções.'),
  correctAnswerIndex: z.coerce.number().min(0, 'Selecione uma resposta correta.'),
});

export const trainingSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, 'O título deve ter pelo menos 3 caracteres.'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
  category: z.string().optional(),
  youtubeUrl: z.string().url('Por favor, insira uma URL do YouTube válida.').optional().or(z.literal('')),
  pdfUrl: z.string().url('Por favor, insira uma URL válida para o PDF.').optional().or(z.literal('')),
  quiz: z.object({
    questions: z.array(questionSchema).optional(),
  }).optional(),
  prerequisiteIds: z.array(z.string()).optional(),
});

export type TrainingFormData = z.infer<typeof trainingSchema>;


export const playlistSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(3, 'O nome da playlist deve ter pelo menos 3 caracteres.'),
    description: z.string().optional(),
    trainingIds: z.array(z.string()).min(1, 'A playlist deve conter pelo menos um treinamento.'),
});

export type PlaylistFormData = z.infer<typeof playlistSchema>;
