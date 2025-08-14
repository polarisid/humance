
'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { LoggedUser } from '@/app/actions';
import { getUsersForObservation, type ObservableUser } from '@/app/dashboard/actions';
import { addObservationForUser } from '@/app/avaliacoes/actions';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export function WeeklyObservations() {
  const { toast } = useToast();
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [observableUsers, setObservableUsers] = useState<ObservableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [observationText, setObservationText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const loggedUser: LoggedUser = JSON.parse(userString);
      setUser(loggedUser);

      if (loggedUser.role === 'Administrador' || loggedUser.role === 'Gerente') {
        fetchUsers(loggedUser);
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUsers = async (currentUser: LoggedUser) => {
    setLoading(true);
    try {
      const users = await getUsersForObservation(currentUser);
      setObservableUsers(users);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro", description: "Não foi possível carregar os colaboradores.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !observationText.trim() || !user) {
      toast({ title: "Atenção", description: "Selecione um colaborador e escreva uma observação.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addObservationForUser({
        managerId: user.id,
        employeeId: selectedUserId,
        text: observationText,
      });

      if (result.success) {
        toast({ title: "Sucesso!", description: "Observação adicionada." });
        setObservationText('');
        setSelectedUserId('');
        // No need to refetch here as it's a quick-add form
      } else {
        toast({ title: "Erro", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Erro", description: "Não foi possível salvar a observação.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role !== 'Administrador' && user?.role !== 'Gerente') {
    return null;
  }

  if (loading) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Adicionar Pontos da Semana</CardTitle>
                  <CardDescription>Registre observações para as avaliações deste mês.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center items-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </CardContent>
          </Card>
      )
  }

  if (observableUsers.length === 0) {
      return null; // Don't show if there are no users to observe
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar Observação Rápida</CardTitle>
        <CardDescription>Registre observações para as avaliações deste mês. Se não houver uma avaliação iniciada para o colaborador, uma será criada.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="collaborator-select">Colaborador</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="collaborator-select">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {observableUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="observation-text">Observação</Label>
            <Textarea 
                id="observation-text"
                placeholder="Descreva um fato ou ponto de atenção..."
                rows={2}
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isSubmitting || !selectedUserId || !observationText.trim()}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar Observação
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
