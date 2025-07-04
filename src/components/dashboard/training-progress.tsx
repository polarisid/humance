'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getTrainingProgressSummary, type TrainingProgressSummary } from '@/app/dashboard/actions';
import type { LoggedUser } from '@/app/actions';
import { GraduationCap } from 'lucide-react';

export function TrainingProgress() {
  const [summary, setSummary] = useState<TrainingProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'Administrador' | 'Gerente' | 'Colaborador' | null>(null);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const loggedUser: LoggedUser = JSON.parse(userString);
      setUserRole(loggedUser.role);
      fetchData(loggedUser);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchData = async (user: LoggedUser) => {
    setLoading(true);
    const data = await getTrainingProgressSummary(user);
    setSummary(data);
    setLoading(false);
  };
  
  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-4/5 mt-1" />
        </CardHeader>
        <CardContent className="flex flex-col justify-end h-full pt-0">
          <div className="space-y-2">
             <div className="flex justify-between">
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-5 w-1/4" />
             </div>
             <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }
  
  const getDescription = () => {
    switch (userRole) {
      case 'Administrador':
        return 'Visão geral da empresa';
      case 'Gerente':
        return 'Progresso da sua equipe';
      case 'Colaborador':
        return 'Seu progresso pessoal';
      default:
        return '';
    }
  };
  
  const getEmptyMessage = () => {
    switch (userRole) {
      case 'Administrador':
      case 'Gerente':
        return 'Nenhum treinamento atribuído à equipe ainda.';
      case 'Colaborador':
        return 'Nenhum treinamento atribuído a você ainda.';
      default:
        return 'Nenhum treinamento atribuído ainda.';
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
            <div className="grid gap-1">
                <CardTitle className="font-headline text-lg">Progresso dos Treinamentos</CardTitle>
                <CardDescription>
                  {getDescription()}
                </CardDescription>
            </div>
            <GraduationCap className="h-5 w-5 text-primary shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center">
        {summary.totalAssigned > 0 ? (
          <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                  <span>{summary.completionRate}% Concluído</span>
                  <span className="text-muted-foreground">{summary.totalCompleted} de {summary.totalAssigned}</span>
              </div>
              <Progress value={summary.completionRate} aria-label={`${summary.completionRate}% dos treinamentos concluídos`} />
          </div>
        ) : (
           <p className="text-sm text-muted-foreground text-center">{getEmptyMessage()}</p>
        )}
      </CardContent>
    </Card>
  );
}
