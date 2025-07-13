
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { LoggedUser } from '@/app/actions';
import { useRouter } from 'next/navigation';

import { getDiaryEntries, type DiaryEntry } from './actions';
import { getUsersForObservation, type ObservableUser } from '@/app/dashboard/actions';
import { addObservationForUser } from '@/app/avaliacoes/actions';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const generatePeriodOptions = () => {
    const options = [];
    let date = new Date();
    for (let i=0; i < 12; i++) {
        const periodValue = format(date, 'yyyy-MM');
        const periodLabel = format(date, "MMMM' de 'yyyy", { locale: ptBR });
        options.push({ value: periodValue, label: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1) });
        date.setMonth(date.getMonth() - 1);
    }
    return options;
}

export default function DiaryPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [user, setUser] = useState<LoggedUser | null>(null);

    // Form state
    const [observableUsers, setObservableUsers] = useState<ObservableUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [observationText, setObservationText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // List state
    const [entries, setEntries] = useState<DiaryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ 
        period: format(new Date(), 'yyyy-MM'), 
        employeeId: '' 
    });
    const periodOptions = useMemo(generatePeriodOptions, []);


    const fetchUsers = useCallback(async (currentUser: LoggedUser) => {
        const users = await getUsersForObservation(currentUser);
        setObservableUsers(users);
    }, []);
    
    const fetchEntries = useCallback(async (currentUser: LoggedUser) => {
        setLoading(true);
        const data = await getDiaryEntries(currentUser, filters);
        setEntries(data);
        setLoading(false);
    }, [filters]);

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (userString) {
            const loggedUser: LoggedUser = JSON.parse(userString);
            if (loggedUser.role === 'Gerente' || loggedUser.role === 'Administrador') {
                setUser(loggedUser);
                fetchUsers(loggedUser);
                fetchEntries(loggedUser);
            } else {
                router.push('/dashboard');
            }
        } else {
            router.push('/');
        }
    }, [router, fetchUsers, fetchEntries]);
    

    const handleSubmit = async () => {
        if (!selectedUserId || !observationText.trim() || !user) {
            toast({ title: "Atenção", description: "Selecione um colaborador e escreva uma observação.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const result = await addObservationForUser({
            managerId: user.id,
            employeeId: selectedUserId,
            text: observationText,
        });

        if (result.success) {
            toast({ title: "Sucesso!", description: "Observação adicionada ao diário." });
            setObservationText('');
            setSelectedUserId('');
            fetchEntries(user); // Refresh the list
        } else {
            toast({ title: "Erro", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    const handleFilterChange = (key: 'period' | 'employeeId', value: string) => {
        const actualValue = value === 'all' ? '' : value;
        setFilters(prev => ({ ...prev, [key]: actualValue }));
    };


    return (
        <div className="space-y-6">
            <PageHeader
                title="Diário de Bordo"
                description="Registre e consulte observações contínuas sobre os colaboradores para apoiar as avaliações de desempenho."
            />

            <Card>
                <CardHeader>
                    <CardTitle>Adicionar Observação</CardTitle>
                    <CardDescription>
                        Registre um fato relevante. Se não houver uma avaliação para o colaborador neste mês, uma será criada automaticamente.
                    </CardDescription>
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
                                placeholder="Descreva um fato, ponto de atenção, elogio ou feedback..."
                                rows={3}
                                value={observationText}
                                onChange={(e) => setObservationText(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSubmit} disabled={isSubmitting || !selectedUserId || !observationText.trim()}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Adicionar ao Diário
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Histórico de Observações</CardTitle>
                            <CardDescription>Filtre e visualize os registros do diário.</CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Select value={filters.period} onValueChange={(v) => handleFilterChange('period', v)}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Filtrar por período..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {periodOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={filters.employeeId || 'all'} onValueChange={(v) => handleFilterChange('employeeId', v)}>
                                <SelectTrigger className="w-full sm:w-[220px]">
                                    <SelectValue placeholder="Filtrar por colaborador..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os colaboradores</SelectItem>
                                    {observableUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                         <div className="flex justify-center items-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : entries.length > 0 ? (
                        <div className="space-y-6 max-h-[60vh] overflow-y-auto p-1">
                            {entries.map(entry => (
                                <div key={entry.id} className="flex items-start gap-4">
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm text-foreground whitespace-pre-wrap">{entry.text}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{entry.employeeName}</span>
                                            <span>&middot;</span>
                                            <span>{format(parseISO(entry.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                                            {user?.role === 'Administrador' && <span>&middot;</span>}
                                            {user?.role === 'Administrador' && <span>Por: {entry.authorName}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">Nenhuma observação encontrada para os filtros selecionados.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
