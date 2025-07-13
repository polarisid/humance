'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { LoggedUser } from '@/app/actions';
import { getPerformanceReviewSummary, type PerformanceReviewSummaryData } from '@/app/dashboard/actions';
import type { ReviewStatus } from '@/app/avaliacoes/actions';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const statusVariant: { [key in ReviewStatus]: "default" | "secondary" | "destructive" | "outline" } = {
  'Concluída': 'default',
  'Pendente': 'secondary',
  'Atrasada': 'destructive',
  'Em Aprovação': 'outline',
  'Ajuste Solicitado': 'destructive',
};


export function PerformanceReviewSummary() {
  const router = useRouter();
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [summaryData, setSummaryData] = useState<PerformanceReviewSummaryData[]>([]);
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
    const data = await getPerformanceReviewSummary(currentUser);
    setSummaryData(data);
    setLoading(false);
  };

  const handleViewReview = (reviewId?: string) => {
    if (reviewId) {
        router.push(`/avaliacoes/${reviewId}`);
    }
  };

  if (user?.role !== 'Administrador' && user?.role !== 'Gerente') {
    return null;
  }
  
  const getCardTitle = () => {
    return user?.role === 'Gerente' ? "Progresso da Equipe" : "Progresso das Avaliações";
  }

  const getCardDescription = () => {
      return user?.role === 'Gerente' 
        ? "Acompanhe o andamento das avaliações da sua equipe no mês atual." 
        : "Acompanhe o andamento das avaliações individualmente no mês atual.";
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
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Nota Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.length > 0 ? (
                  summaryData.map((item) => (
                    <TableRow key={item.employeeId} className={item.reviewId ? "cursor-pointer" : ""} onClick={() => handleViewReview(item.reviewId)}>
                      <TableCell className="font-medium">{item.employeeName}</TableCell>
                      <TableCell className="hidden sm:table-cell">{item.employeeRole}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusVariant[item.status] || 'secondary'}>{item.status}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {item.status === 'Concluída' && item.averageScore != null ? item.averageScore.toFixed(1) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      {user?.role === 'Gerente' 
                        ? "Nenhum colaborador na sua equipe." 
                        : "Nenhum usuário para exibir."
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
