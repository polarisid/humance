
'use client';

import { useState, useEffect } from 'react';
import type { LoggedUser } from '@/app/actions';
import { getTrainingProgressPerUser, type UserTrainingProgress } from '@/app/dashboard/actions';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function UserTrainingProgress() {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [progressData, setProgressData] = useState<UserTrainingProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const loggedUser: LoggedUser = JSON.parse(userString);
      setUser(loggedUser);
      if (loggedUser.role === 'Administrador' || loggedUser.role === 'Gerente') {
        fetchData(loggedUser);
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchData = async (currentUser: LoggedUser) => {
    setLoading(true);
    const data = await getTrainingProgressPerUser(currentUser);
    setProgressData(data);
    setLoading(false);
  };

  if (user?.role !== 'Administrador' && user?.role !== 'Gerente') {
    return null;
  }
  
  const getCardTitle = () => {
    return user?.role === 'Gerente' ? "Progresso da Equipe" : "Progresso por Colaborador";
  }

  const getCardDescription = () => {
      return user?.role === 'Gerente' 
        ? "Acompanhe o andamento dos treinamentos da sua equipe." 
        : "Acompanhe o andamento dos treinamentos individualmente.";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getCardTitle()}</CardTitle>
        <CardDescription>{getCardDescription()}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        ) : (
          <ScrollArea className="h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="hidden sm:table-cell">Cargo</TableHead>
                  <TableHead className="text-center">Progresso</TableHead>
                  <TableHead className="w-[150px]">Taxa de Conclusão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progressData.length > 0 ? (
                  progressData.map((p) => (
                    <TableRow key={p.userId}>
                      <TableCell className="font-medium">{p.userName}</TableCell>
                      <TableCell className="hidden sm:table-cell">{p.userRole}</TableCell>
                      <TableCell className="text-center">{p.completedCount}/{p.totalCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <Progress value={p.completionRate} className="h-2" />
                           <span className="text-xs text-muted-foreground w-10 text-right">{p.completionRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      {user?.role === 'Gerente' 
                        ? "Nenhum treinamento atribuído à sua equipe." 
                        : "Nenhum progresso de treinamento para exibir."
                      }
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
