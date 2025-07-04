'use server';
/**
 * @fileOverview Generates a quote of the day for display on the dashboard.
 *
 * - generateQuoteOfTheDay - A function that generates a quote of the day.
 * - GenerateQuoteOfTheDayInput - The input type for the generateQuoteOfTheDay function.
 * - GenerateQuoteOfTheDayOutput - The return type for the generateQuoteOfTheDay function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuoteOfTheDayInputSchema = z.object({
  topic: z.string().optional().describe('Optional topic for the quote.'),
});
export type GenerateQuoteOfTheDayInput = z.infer<typeof GenerateQuoteOfTheDayInputSchema>;

const GenerateQuoteOfTheDayOutputSchema = z.object({
  quote: z.string().describe('The quote of the day.'),
});
export type GenerateQuoteOfTheDayOutput = z.infer<typeof GenerateQuoteOfTheDayOutputSchema>;

export async function generateQuoteOfTheDay(input: GenerateQuoteOfTheDayInput): Promise<GenerateQuoteOfTheDayOutput> {
  return generateQuoteOfTheDayFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuoteOfTheDayPrompt',
  input: {schema: GenerateQuoteOfTheDayInputSchema},
  output: {schema: GenerateQuoteOfTheDayOutputSchema},
  prompt: `You are a quote generator. Generate a thought-provoking quote of the day. The quote should be motivational and suitable for display on a company dashboard.

  {{#if topic}}
  The quote should be about the following topic: {{topic}}
  {{/if}}
  `,
});

const generateQuoteOfTheDayFlow = ai.defineFlow(
  {
    name: 'generateQuoteOfTheDayFlow',
    inputSchema: GenerateQuoteOfTheDayInputSchema,
    outputSchema: GenerateQuoteOfTheDayOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
