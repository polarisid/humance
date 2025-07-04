'use server';
/**
 * @fileOverview Generates constructive feedback for a performance review.
 *
 * - generateReviewFeedback - A function that synthesizes scores and observations into feedback.
 * - GenerateReviewFeedbackInput - The input type for the function.
 * - GenerateReviewFeedbackOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateReviewFeedbackInputSchema = z.object({
  items: z.array(z.object({
      text: z.string().describe("The evaluation criterion or question."),
      score: z.number().describe("The score given by the manager, from 1 to 10."),
  })).describe("The list of items and scores from the evaluation."),
  observations: z.string().optional().describe("The manager's private observations."),
});
export type GenerateReviewFeedbackInput = z.infer<typeof GenerateReviewFeedbackInputSchema>;

const GenerateReviewFeedbackOutputSchema = z.object({
  feedback: z.string().describe('The generated constructive feedback for the employee.'),
});
export type GenerateReviewFeedbackOutput = z.infer<typeof GenerateReviewFeedbackOutputSchema>;

export async function generateReviewFeedback(input: GenerateReviewFeedbackInput): Promise<GenerateReviewFeedbackOutput> {
  return generateReviewFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateReviewFeedbackPrompt',
  input: { schema: GenerateReviewFeedbackInputSchema },
  output: { schema: GenerateReviewFeedbackOutputSchema },
  prompt: `Você é um especialista em Recursos Humanos, mestre em fornecer feedbacks construtivos e motivadores.

Um gestor finalizou uma avaliação de desempenho. Sua tarefa é sintetizar as notas e observações em um feedback bem estruturado para o colaborador.

A avaliação foi baseada nos seguintes itens, com notas de 1 (Muito a melhorar) a 10 (Excelente):
{{#each items}}
- Critério: {{text}} - Nota: {{score}}/10
{{/each}}

{{#if observations}}
O gestor também forneceu as seguintes observações (use-as como contexto, mas não as cite diretamente):
"{{observations}}"
{{/if}}

Com base nessas informações, escreva um parágrafo de feedback para o colaborador. O tom deve ser profissional, empático e focado no desenvolvimento. Comece destacando os pontos fortes (notas altas), depois aborde as áreas de melhoria (notas baixas) com sugestões práticas e acionáveis. Conclua com uma mensagem de encorajamento e foco no futuro. O texto deve ser escrito em português do Brasil.`,
});

const generateReviewFeedbackFlow = ai.defineFlow(
  {
    name: 'generateReviewFeedbackFlow',
    inputSchema: GenerateReviewFeedbackInputSchema,
    outputSchema: GenerateReviewFeedbackOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
