'use client';

import { Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function QuoteOfTheDay() {
  const quote = "A única maneira de fazer um excelente trabalho é amar o que você faz.";

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-headline text-lg">Frase do Dia</CardTitle>
        <Lightbulb className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="flex-grow flex items-center">
        <blockquote className="border-l-2 border-accent pl-4 italic text-muted-foreground">
          {`"${quote}"`}
        </blockquote>
      </CardContent>
    </Card>
  );
}
