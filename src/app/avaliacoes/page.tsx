

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Loader2, Plus, Trash2, Edit, Send, Crown, Info, ChevronsUpDown, Shield, TrendingUp, Calculator, FileDown, LineChart } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart as RechartsLineChart } from 'recharts';

import { 
  getReviews, 
  getReviewTemplates, 
  createOrUpdateReviewTemplate, 
  deleteReviewTemplate, 
  assignTemplateToManagers, 
  getAssignedTemplatesForManager,
  createReviews,
  deleteReview,
  getLeaderboard,
  getBonusParameters,
  updateBonusParameters,
  getKpiBonusParameters,
  updateKpiBonusParameters,
  getKpiModels,
  createOrUpdateKpiModel,
  processKpiResultsForDepartment,
  getKpiAssessments,
  deleteKpiAssessment,
  getBonusReport,
  getIndividualPerformanceHistory,
  type Review, 
  type ReviewTemplate,
  type LeaderboardData,
  type KpiModel,
  type KpiIndicator,
  type KpiAssessmentRecord,
  type BonusReportData,
  type PerformanceHistoryData,
} from './actions';
import { getManagers, getDepartments, type Manager, type Department } from '../setores/actions';
import { getUsers, type User } from '../usuarios/actions';
import type { LoggedUser } from '../actions';
import { reviewTemplateSchema, bonusParametersSchema, kpiModelSchema, kpiBonusParametersSchema, type ReviewTemplateFormData, type BonusParametersData, type KpiModelFormData, type KpiBonusParametersData } from './schema';
import * as XLSX from 'xlsx';

import { PageHeader } from "@/components/page-header";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { VariantProps } from 'class-variance-authority';

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  'Concluída': 'default',
  'Pendente': 'secondary',
  'Atrasada': 'destructive',
  'Em Aprovação': 'outline',
  'Ajuste Solicitado': 'destructive',
};

const generatePeriodOptions = () => {
    const options = [];
    let date = new Date();
    // Generate past 12 months
    for (let i = 0; i < 12; i++) {
        const periodValue = format(date, 'yyyy-MM');
        const periodLabel = format(date, "MMMM' de 'yyyy", { locale: ptBR });
        options.push({ value: periodValue, label: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1) });
        date.setMonth(date.getMonth() - 1);
    }
    return options.sort((a,b) => b.value.localeCompare(a.value));
}

function ReviewsList({ reviews, loading, isAdmin, isManager, onDelete, onFilterChange, departments }: { reviews: Review[], loading: boolean, isAdmin: boolean, isManager: boolean, onDelete: (id: string) => void, onFilterChange: (filters: { departmentId?: string; period?: string }) => void, departments: Department[] }) {
  const router = useRouter();
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState(format(new Date(), 'yyyy-MM'));
  const periodOptions = useMemo(generatePeriodOptions, []);


  const handleViewReview = (id: string) => {
    router.push(`/avaliacoes/${id}`);
  };

  const handleDepartmentChange = (departmentId: string) => {
    const newDepartmentId = departmentId === 'all' ? '' : departmentId;
    setDepartmentFilter(newDepartmentId);
    onFilterChange({ departmentId: newDepartmentId, period: periodFilter });
  }

  const handlePeriodChange = (period: string) => {
    setPeriodFilter(period);
    onFilterChange({ departmentId: departmentFilter, period: period });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Lista de Avaliações</CardTitle>
            <CardDescription>Acompanhe o andamento das avaliações.</CardDescription>
          </div>
          {(isAdmin || isManager) && (
             <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="w-full sm:w-56">
                    <Select value={periodFilter} onValueChange={handlePeriodChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por período..." />
                        </SelectTrigger>
                        <SelectContent>
                            {periodOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {isAdmin && (
                  <div className="w-full sm:w-56">
                      <Select onValueChange={handleDepartmentChange}>
                      <SelectTrigger>
                          <SelectValue placeholder="Filtrar por setor..." />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todos os setores</SelectItem>
                          {departments.map(dep => (
                          <SelectItem key={dep.id} value={dep.id}>{dep.name}</SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                  </div>
                )}
             </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead className="hidden md:table-cell">Cargo</TableHead>
              <TableHead className="hidden lg:table-cell">Setor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Nota KPI</TableHead>
              <TableHead className="text-center">Nota Comp.</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : reviews.length > 0 ? (
              reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="font-medium">{review.employee}</TableCell>
                  <TableCell className="hidden md:table-cell">{review.role}</TableCell>
                  <TableCell className="hidden lg:table-cell">{review.department}</TableCell>
                  <TableCell>{review.period}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={statusVariant[review.status] || 'default'}>{review.status}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-bold text-primary">
                    {review.kpiScore != null ? review.kpiScore.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell className="text-center font-bold text-primary">
                    {review.status === 'Concluída' && review.averageScore != null ? review.averageScore.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewReview(review.id)}>
                          Ver / Responder
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Isso excluirá permanentemente a avaliação de {review.employee}. Deseja continuar?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDelete(review.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  Nenhuma avaliação encontrada para os filtros selecionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function IndividualPerformanceHistory({ user, users, departments }: { user: LoggedUser, users: User[], departments: Department[] }) {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [history, setHistory] = useState<PerformanceHistoryData[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const teamMembers = useMemo(() => {
        if (user.role === 'Administrador') {
            return users.filter(u => u.role === 'Colaborador');
        }
        if (user.role === 'Gerente') {
            const myDepartmentIds = departments.filter(d => d.leaderId === user.id).map(d => d.id);
            return users.filter(u => u.departmentId && myDepartmentIds.includes(u.departmentId));
        }
        return [];
    }, [user, users, departments]);

    const handleEmployeeChange = async (employeeId: string) => {
        setSelectedEmployeeId(employeeId);
        if (!employeeId) {
            setHistory([]);
            return;
        }
        setLoadingHistory(true);
        const data = await getIndividualPerformanceHistory(employeeId);
        setHistory(data);
        setLoadingHistory(false);
    };

    const chartData = history.map(h => ({ name: h.period, Nota: h.averageScore })).reverse();

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>Histórico de Desempenho Individual</CardTitle>
                        <CardDescription>Acompanhe a evolução das notas de desempenho dos colaboradores.</CardDescription>
                    </div>
                    <div className="w-full sm:w-64">
                         <Select onValueChange={handleEmployeeChange} value={selectedEmployeeId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um colaborador..." />
                            </SelectTrigger>
                            <SelectContent>
                                {teamMembers.map(member => (
                                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loadingHistory ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : selectedEmployeeId && history.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                             <div className="h-[350px] w-full">
                                <ResponsiveContainer>
                                    <RechartsLineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                        <Line type="monotone" dataKey="Nota" stroke="hsl(var(--primary))" strokeWidth={2} />
                                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                                        <XAxis dataKey="name" fontSize={12} />
                                        <YAxis domain={[0, 10]} fontSize={12} />
                                        <Tooltip contentStyle={{
                                            backgroundColor: 'hsl(var(--background))',
                                            borderColor: 'hsl(var(--border))',
                                            borderRadius: 'var(--radius)',
                                        }} />
                                    </RechartsLineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="lg:col-span-1">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Período</TableHead>
                                        <TableHead className="text-right">Nota</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map(item => (
                                        <TableRow key={item.period}>
                                            <TableCell>{item.period}</TableCell>
                                            <TableCell className="text-right font-bold text-primary">{item.averageScore.toFixed(1)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : selectedEmployeeId ? (
                     <div className="text-center py-16 text-muted-foreground">Nenhum histórico encontrado para este colaborador.</div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground">Selecione um colaborador para ver seu histórico.</div>
                )}
            </CardContent>
        </Card>
    )
}

function Leaderboard() {
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardData[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'));

    const fetchLeaderboard = useCallback(async (currentPeriod: string) => {
        setLoading(true);
        const data = await getLeaderboard(currentPeriod);
        setLeaderboardData(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchLeaderboard(period);
    }, [period, fetchLeaderboard]);
    
    const periodOptions = useMemo(generatePeriodOptions, []);
    
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    return (
         <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Média por Líder</CardTitle>
                    <CardDescription>Performance das equipes por período.</CardDescription>
                  </div>
                  <div className="w-full max-w-xs">
                      <Select value={period} onValueChange={setPeriod}>
                          <SelectTrigger>
                              <SelectValue placeholder="Selecione um período..." />
                          </SelectTrigger>
                          <SelectContent>
                              {periodOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className='w-12'>#</TableHead>
                            <TableHead>Líder</TableHead>
                            <TableHead className="text-center">Avaliações Feitas</TableHead>
                            <TableHead className="text-center">Média Comp.</TableHead>
                            <TableHead className="text-center">Nota KPI</TableHead>
                            <TableHead className="text-center">Bônus (R$)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                        ) : leaderboardData.length > 0 ? (
                            leaderboardData.map((leader, index) => (
                                <TableRow key={leader.leaderId}>
                                    <TableCell className="font-bold text-lg text-muted-foreground">
                                        <div className='flex items-center gap-2'>
                                            {index === 0 && <Crown className="h-5 w-5 text-yellow-500" />}
                                            {index !== 0 && <span>{index + 1}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{leader.leaderName}</TableCell>
                                    <TableCell className="text-center">{leader.totalReviews}/{leader.teamSize}</TableCell>
                                    <TableCell className="text-center font-bold text-xl text-primary">{leader.averageScore.toFixed(2)}</TableCell>
                                    <TableCell className="text-center font-bold text-xl text-primary">{leader.kpiScore.toFixed(2)}</TableCell>
                                    <TableCell className="text-center font-bold text-xl text-green-600">{formatCurrency(leader.kpiBonus)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhum dado encontrado para este período.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function KpiModels({ departments }: { departments: Department[] }) {
    const { toast } = useToast();
    const [kpiModels, setKpiModels] = useState<KpiModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const form = useForm<KpiModelFormData>({
        resolver: zodResolver(kpiModelSchema),
        defaultValues: { departmentId: '', indicators: [] },
    });
    
    const { watch } = form;

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "indicators",
    });
    
    const watchedIndicators = watch("indicators");

    const fetchKpiModels = useCallback(async () => {
        setLoading(true);
        const data = await getKpiModels();
        setKpiModels(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchKpiModels();
    }, [fetchKpiModels]);

    const handleOpenForm = (model: KpiModel | null) => {
        if (model) {
            setIsEditMode(true);
            form.reset({ id: model.id, departmentId: model.departmentId, indicators: model.indicators });
        } else {
            setIsEditMode(false);
            form.reset({ departmentId: '', indicators: [{ indicator: '', weight: 1, goal: 100, type: 'neutral', condition: 'above' }] });
        }
        setIsFormOpen(true);
    };

    const onSubmit = async (data: KpiModelFormData) => {
        const result = await createOrUpdateKpiModel(data);
        if (result.success) {
            toast({ title: 'Sucesso!', description: result.message });
            setIsFormOpen(false);
            fetchKpiModels();
        } else {
            toast({ title: 'Erro', description: result.message, variant: 'destructive' });
        }
    };
    
    const getBadgeVariant = (type: string): VariantProps<typeof badgeVariants>['variant'] => {
      switch(type) {
        case 'accelerator': return 'success';
        case 'detractor': return 'destructive';
        default: return 'secondary';
      }
    }
    
    return (
      <>
        <div className="text-right mb-4">
            <Button onClick={() => handleOpenForm(null)}>
                <Plus className="mr-2 h-4 w-4" /> Novo Modelo de KPI
            </Button>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Modelos de KPI por Setor</CardTitle>
                <CardDescription>Configure os indicadores de performance para cada setor.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Setor</TableHead>
                            <TableHead>Indicadores</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                        ) : kpiModels.length > 0 ? (
                            kpiModels.map(model => (
                                <TableRow key={model.id}>
                                    <TableCell className="font-medium">{model.departmentName}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-2">
                                            {model.indicators.map((ind, index) => (
                                                <Badge key={index} variant={getBadgeVariant(ind.type)} className="font-normal">
                                                    {ind.indicator}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenForm(model)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={3} className="h-24 text-center">Nenhum modelo de KPI cadastrado.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
        {/* KPI Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Editar Modelo de KPI' : 'Novo Modelo de KPI'}</DialogTitle>
                    <DialogDescription>Defina os indicadores, pontos e regras para um setor específico.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
                        <ScrollArea className="flex-1 p-1">
                            <div className="px-6 py-4 space-y-6">
                                <FormField
                                    control={form.control}
                                    name="departmentId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Setor</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isEditMode}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione um setor" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {departments.map(dep => (
                                                        <SelectItem key={dep.id} value={dep.id}>{dep.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-4">
                                    <Label>Indicadores de Performance (KPIs)</Label>
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 p-4 border rounded-lg relative">
                                            <FormField control={form.control} name={`indicators.${index}.indicator`} render={({ field }) => (
                                                <FormItem className="md:col-span-4"><FormLabel>Indicador</FormLabel><FormControl><Input placeholder="Ex: Taxa de Conversão" {...field} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                            <FormField control={form.control} name={`indicators.${index}.weight`} render={({ field }) => (
                                                <FormItem className="md:col-span-2"><FormLabel>Pontos</FormLabel><FormControl><Input type="number" step="0.1" placeholder="Ex: 2" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                            <FormField control={form.control} name={`indicators.${index}.goal`} render={({ field }) => (
                                                <FormItem className="md:col-span-2"><FormLabel>Meta</FormLabel><FormControl><Input type="number" placeholder="Ex: 85" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                            <FormField control={form.control} name={`indicators.${index}.type`} render={({ field }) => (
                                                <FormItem className="md:col-span-2"><FormLabel>Tipo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="neutral">Neutro</SelectItem><SelectItem value="accelerator">Acelerador</SelectItem><SelectItem value="detractor">Detrator</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                            )}/>
                                            <FormField control={form.control} name={`indicators.${index}.condition`} render={({ field }) => (
                                                <FormItem className="md:col-span-2"><FormLabel>Condição</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="above">Acima de</SelectItem><SelectItem value="below">Abaixo de</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                            )}/>
                                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                </div>
                                 <Button type="button" variant="outline" size="sm" onClick={() => append({ indicator: '', weight: 1, goal: 100, type: 'neutral', condition: 'above' })}>
                                    <Plus className="mr-2 h-4 w-4" /> Adicionar KPI
                                </Button>
                            </div>
                        </ScrollArea>
                        <DialogFooter className="p-6 border-t mt-auto">
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Modelo de KPI
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </>
    );
}

function KpiAssessment({ kpiModels, departments, onAssessmentSubmit }: { kpiModels: KpiModel[], departments: Department[], onAssessmentSubmit: () => void }) {
    const { toast } = useToast();
    const [selectedModel, setSelectedModel] = useState<KpiModel | null>(null);
    const [results, setResults] = useState<Record<string, number | string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'));
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    const [assessmentsHistory, setAssessmentsHistory] = useState<KpiAssessmentRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [selectedAssessment, setSelectedAssessment] = useState<KpiAssessmentRecord | null>(null);

    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        const data = await getKpiAssessments({ period, departmentId: departmentFilter });
        setAssessmentsHistory(data);
        setLoadingHistory(false);
    }, [period, departmentFilter]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleDeleteAssessment = async (assessmentId: string) => {
        const result = await deleteKpiAssessment(assessmentId);
        if (result.success) {
            toast({ title: "Sucesso!", description: result.message });
            fetchHistory();
        } else {
            toast({ title: "Erro", description: result.message, variant: "destructive" });
        }
    };
    

    const handleModelChange = (modelId: string) => {
        const model = kpiModels.find(m => m.id === modelId) || null;
        setSelectedModel(model);
        setResults({});
    };

    const handleResultChange = (indicatorIndex: number, value: string) => {
        setResults(prev => ({...prev, [indicatorIndex]: value }));
    }

    const handleSubmit = async () => {
        if(!selectedModel) return;
        
        setIsSubmitting(true);
        const numericResults: Record<string, number> = {};
        for(const key in results) {
            numericResults[key] = Number(results[key]);
        }

        const result = await processKpiResultsForDepartment({
            model: selectedModel,
            results: numericResults,
            period: period
        });

        if (result.success) {
            toast({
                title: "Sucesso!",
                description: result.message,
            });
            setSelectedModel(null);
            setResults({});
            fetchHistory();
            onAssessmentSubmit();
        } else {
             toast({
                title: "Erro",
                description: result.message,
                variant: 'destructive',
            });
        }
        setIsSubmitting(false);
    }
    
    const periodOptions = useMemo(generatePeriodOptions, []);
    
    const getPointChange = (indicator: KpiIndicator, result: number): string => {
        if (result === undefined || result === null) return '±0';

        let conditionMet = false;
        if (indicator.condition === 'above') {
            conditionMet = result >= indicator.goal;
        } else { // 'below'
            conditionMet = result <= indicator.goal;
        }

        if (indicator.type === 'accelerator' || indicator.type === 'neutral') {
            return conditionMet ? `+${indicator.weight.toFixed(2)}` : '±0';
        } else if (indicator.type === 'detractor') {
             // Penalize if condition is NOT met
            return !conditionMet ? `-${indicator.weight.toFixed(2)}` : '±0';
        }
        
        return '±0';
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Apuração de Resultados de KPI</CardTitle>
                    <CardDescription>
                        Selecione um setor e um período para preencher os resultados dos indicadores.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Selecione o Setor</Label>
                            <Select onValueChange={handleModelChange} value={selectedModel?.id || ''}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um setor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {kpiModels.map(model => (
                                        <SelectItem key={model.id} value={model.id}>{model.departmentName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Selecione o Período</Label>
                            <Select value={period} onValueChange={setPeriod}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um período..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {periodOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {selectedModel && (
                        <div className='space-y-4 pt-4 border-t'>
                            <h4 className='font-medium'>Preencha os resultados para {selectedModel.departmentName}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                {selectedModel.indicators.map((indicator, index) => {
                                    const resultValue = results[index] !== undefined && results[index] !== '' ? Number(results[index]) : null;
                                    let className = 'border-gray-300';
                                    
                                    if (resultValue !== null) {
                                        let conditionMet = false;
                                        if (indicator.condition === 'above') {
                                            conditionMet = resultValue >= indicator.goal;
                                        } else { // 'below'
                                            conditionMet = resultValue <= indicator.goal;
                                        }
                                        
                                        if (indicator.type === 'detractor') {
                                            // Detrator é vermelho se a condição NÃO for cumprida
                                            className = !conditionMet ? 'border-red-500 focus-visible:ring-red-500' : 'border-green-500 focus-visible:ring-green-500';
                                        } else {
                                            className = conditionMet ? 'border-green-500 focus-visible:ring-green-500' : 'border-red-500 focus-visible:ring-red-500';
                                        }
                                    }

                                    return (
                                    <div key={index} className='space-y-2'>
                                        <Label htmlFor={`indicator-result-${index}`}>{indicator.indicator}</Label>
                                        <Input 
                                            id={`indicator-result-${index}`}
                                            type="number"
                                            placeholder={`Meta: ${indicator.goal}`}
                                            value={results[index] || ''}
                                            onChange={e => handleResultChange(index, e.target.value)}
                                            className={cn(className)}
                                        />
                                    </div>
                                )})}
                            </div>
                        </div>
                    )}
                </CardContent>
                {selectedModel && (
                    <CardFooter className='justify-end'>
                        <Button onClick={handleSubmit} disabled={isSubmitting || Object.values(results).some(v => v === '') || Object.keys(results).length !== selectedModel.indicators.length}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Calculator className='mr-2 h-4 w-4' />
                            {isSubmitting ? 'Apurando...' : 'Salvar e Apurar Resultados'}
                        </Button>
                    </CardFooter>
                )}
            </Card>

            <Dialog open={!!selectedAssessment} onOpenChange={(isOpen) => !isOpen && setSelectedAssessment(null)}>
                <Card>
                    <CardHeader>
                        <div className='flex justify-between items-start gap-4'>
                            <div className="grid gap-1">
                                <CardTitle>Últimas Apurações</CardTitle>
                                <CardDescription>Histórico de resultados de KPI para os filtros selecionados.</CardDescription>
                            </div>
                            <div className="w-full max-w-xs">
                            <Select onValueChange={(value) => setDepartmentFilter(value === 'all' ? '' : value)} defaultValue='all'>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filtrar por setor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os setores</SelectItem>
                                        {departments.map(dep => (
                                        <SelectItem key={dep.id} value={dep.id}>{dep.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Setor</TableHead>
                                    <TableHead className="text-center">Nota KPI</TableHead>
                                    <TableHead className="text-center">Data</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingHistory ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                                ) : assessmentsHistory.length > 0 ? (
                                    assessmentsHistory.map(item => (
                                      <TableRow key={item.id}>
                                          <TableCell className="font-medium cursor-pointer" onClick={() => setSelectedAssessment(item)}>{item.departmentName}</TableCell>
                                          <TableCell className="text-center font-bold text-primary cursor-pointer" onClick={() => setSelectedAssessment(item)}>{item.kpiScore.toFixed(2)}</TableCell>
                                          <TableCell className="text-center cursor-pointer" onClick={() => setSelectedAssessment(item)}>{format(parseISO(item.assessedAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                                          <TableCell className="text-right">
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                        <AlertDialogDescription>Deseja excluir esta apuração de KPI? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteAssessment(item.id)}>Excluir</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                          </TableCell>
                                      </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhuma apuração encontrada para este período.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {selectedAssessment && (
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Detalhes da Apuração de KPI</DialogTitle>
                            <DialogDescription>
                                Extrato de pontos para {selectedAssessment.departmentName} - Período: {selectedAssessment.period}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                             <p className="mb-4">Nota Final: <span className="font-bold text-primary text-lg">{selectedAssessment.kpiScore.toFixed(2)}</span></p>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Indicador</TableHead>
                                        <TableHead className="text-center">Meta</TableHead>
                                        <TableHead className="text-center">Resultado</TableHead>
                                        <TableHead className="text-center">Pontos</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedAssessment.indicators.map((indicator, index) => {
                                        const result = selectedAssessment.results[index];
                                        const pointChange = getPointChange(indicator, result);
                                        const pointClass = pointChange.startsWith('+') ? 'text-green-600' : pointChange.startsWith('-') ? 'text-red-600' : '';
                                        return (
                                            <TableRow key={index}>
                                                <TableCell>{indicator.indicator}</TableCell>
                                                <TableCell className="text-center">{indicator.goal}</TableCell>
                                                <TableCell className="text-center">{result}</TableCell>
                                                <TableCell className={cn("text-center font-bold", pointClass)}>{pointChange}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedAssessment(null)}>Fechar</Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}

function PerformanceBonusForm() {
    const { toast } = useToast();
    const form = useForm<BonusParametersData>({
        resolver: zodResolver(bonusParametersSchema),
        defaultValues: { rules: [] },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "rules",
    });

    useEffect(() => {
        getBonusParameters().then(data => {
            if (data) form.reset(data);
        });
    }, [form]);

    const onSubmit = async (data: BonusParametersData) => {
        const result = await updateBonusParameters(data);
        if (result.success) {
            toast({ title: "Sucesso!", description: result.message });
        } else {
            toast({ title: "Erro", description: result.message, variant: "destructive" });
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Parâmetros por Desempenho</CardTitle>
                        <CardDescription>Regras para a bonificação baseada na média da avaliação de desempenho (competências).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">Nota Mínima</TableHead>
                                    <TableHead className="w-[120px]">Nota Máxima</TableHead>
                                    <TableHead>Percentual de Ganho (%)</TableHead>
                                    <TableHead className="w-[50px]"><span className="sr-only">Ações</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <FormField control={form.control} name={`rules.${index}.minScore`} render={({ field }) => (<Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />)} />
                                        </TableCell>
                                        <TableCell>
                                            <FormField control={form.control} name={`rules.${index}.maxScore`} render={({ field }) => (<Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />)} />
                                        </TableCell>
                                        <TableCell>
                                            <FormField control={form.control} name={`rules.${index}.bonusPercentage`} render={({ field }) => (<Input type="number" step="1" placeholder="Ex: 50" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />)} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         <Button type="button" variant="outline" size="sm" onClick={() => append({ minScore: 0, maxScore: 0, bonusPercentage: 0 })}>
                            <Plus className="mr-2 h-4 w-4" /> Adicionar Regra
                        </Button>
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}

function KpiBonusForm() {
    const { toast } = useToast();
    const form = useForm<KpiBonusParametersData>({
        resolver: zodResolver(kpiBonusParametersSchema),
        defaultValues: { rules: [] },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "rules",
    });

    useEffect(() => {
        getKpiBonusParameters().then(data => {
            if (data) form.reset(data);
        });
    }, [form]);

    const onSubmit = async (data: KpiBonusParametersData) => {
        const result = await updateKpiBonusParameters(data);
        if (result.success) {
            toast({ title: "Sucesso!", description: result.message });
        } else {
            toast({ title: "Erro", description: result.message, variant: "destructive" });
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Parâmetros por KPI</CardTitle>
                        <CardDescription>Regras para o valor da bonificação baseada na nota final de KPI do setor.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">Nota Mínima</TableHead>
                                    <TableHead className="w-[120px]">Nota Máxima</TableHead>
                                    <TableHead>Valor Bonificação (Líder) (R$)</TableHead>
                                    <TableHead>Valor Bonificação (Liderado) (R$)</TableHead>
                                    <TableHead className="w-[50px]"><span className="sr-only">Ações</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <FormField control={form.control} name={`rules.${index}.minScore`} render={({ field }) => (<Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />)} />
                                        </TableCell>
                                        <TableCell>
                                            <FormField control={form.control} name={`rules.${index}.maxScore`} render={({ field }) => (<Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />)} />
                                        </TableCell>
                                        <TableCell>
                                            <FormField control={form.control} name={`rules.${index}.bonusValueLeader`} render={({ field }) => (<Input type="number" step="0.01" placeholder="Ex: 500.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />)} />
                                        </TableCell>
                                         <TableCell>
                                            <FormField control={form.control} name={`rules.${index}.bonusValueLed`} render={({ field }) => (<Input type="number" step="0.01" placeholder="Ex: 250.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />)} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         <Button type="button" variant="outline" size="sm" onClick={() => append({ minScore: 0, maxScore: 0, bonusValueLeader: 0, bonusValueLed: 0 })}>
                            <Plus className="mr-2 h-4 w-4" /> Adicionar Regra
                        </Button>
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}

function BonusReport({ departments }: { departments: Department[] }) {
    const [reportData, setReportData] = useState<BonusReportData[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ 
      period: format(new Date(), 'yyyy-MM'), 
      departmentId: '' 
    });

    const fetchReport = useCallback(async (currentFilters: { period: string; departmentId?: string }) => {
        setLoading(true);
        const data = await getBonusReport(currentFilters);
        setReportData(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchReport(filters);
    }, [filters, fetchReport]);
    
    const periodOptions = useMemo(generatePeriodOptions, []);
    
    const handleFilterChange = (key: 'period' | 'departmentId', value: string) => {
      const newValue = value === 'all' ? '' : value;
      setFilters(prev => ({ ...prev, [key]: newValue }));
    }

    const handleExport = () => {
        const dataToExport = reportData.map(item => ({
            'Colaborador': item.employeeName,
            'Setor': item.departmentName,
            'Cargo': item.role,
            'Nota Desempenho': item.averageScore.toFixed(2),
            'Nota KPI': item.kpiScore.toFixed(2),
            'Bônus Desempenho (%)': item.performanceBonusPercentage,
            'Bônus KPI (R$)': item.kpiBonusValue,
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Extrato de Bônus');
        XLSX.writeFile(workbook, `Extrato_Bonus_${filters.period}.xlsx`);
    };

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    return (
         <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Extrato de Bônus por Colaborador</CardTitle>
                    <CardDescription>Visualize a composição da bonificação para cada colaborador no período.</CardDescription>
                  </div>
                  <div className="flex w-full sm:w-auto items-center gap-2">
                      <div className="w-full sm:w-48">
                          <Select value={filters.period} onValueChange={(v) => handleFilterChange('period', v)}>
                              <SelectTrigger>
                                  <SelectValue placeholder="Selecione um período..." />
                              </SelectTrigger>
                              <SelectContent>
                                  {periodOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="w-full sm:w-48">
                         <Select onValueChange={(v) => handleFilterChange('departmentId', v)}>
                          <SelectTrigger>
                              <SelectValue placeholder="Filtrar por setor..." />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Todos os setores</SelectItem>
                              {departments.map(dep => (
                              <SelectItem key={dep.id} value={dep.id}>{dep.name}</SelectItem>
                              ))}
                          </SelectContent>
                          </Select>
                      </div>
                      <Button onClick={handleExport} disabled={reportData.length === 0}>
                         <FileDown className="mr-2 h-4 w-4" />
                         Exportar
                      </Button>
                  </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Colaborador</TableHead>
                            <TableHead className="hidden md:table-cell">Setor</TableHead>
                            <TableHead className="text-center">Nota Desempenho</TableHead>
                            <TableHead className="text-center">Bônus Desempenho</TableHead>
                            <TableHead className="text-center">Nota KPI</TableHead>
                            <TableHead className="text-center">Bônus KPI</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                        ) : reportData.length > 0 ? (
                            reportData.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{item.employeeName}</TableCell>
                                    <TableCell className="hidden md:table-cell">{item.departmentName}</TableCell>
                                    <TableCell className="text-center font-bold text-primary">{item.averageScore.toFixed(2)}</TableCell>
                                    <TableCell className="text-center font-semibold">{item.performanceBonusPercentage}%</TableCell>
                                    <TableCell className="text-center font-bold text-primary">{item.kpiScore.toFixed(2)}</TableCell>
                                    <TableCell className="text-center font-semibold text-green-600">{formatCurrency(item.kpiBonusValue)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma avaliação concluída para os filtros selecionados.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export default function ReviewsPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [user, setUser] = useState<LoggedUser | null>(null);
  const isAdmin = useMemo(() => user?.role === 'Administrador', [user]);
  const isManager = useMemo(() => user?.role === 'Gerente', [user]);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [kpiModels, setKpiModels] = useState<KpiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ 
    departmentId: '', 
    period: format(new Date(), 'yyyy-MM') 
  });


  // Admin states
  const [formOpen, setFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTemplateForAssign, setSelectedTemplateForAssign] = useState<ReviewTemplate | null>(null);
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Manager states
  const [initiateDialogOpen, setInitiateDialogOpen] = useState(false);
  const [assignedTemplates, setAssignedTemplates] = useState<ReviewTemplate[]>([]);
  const [collaborators, setCollaborators] = useState<User[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isInitiating, setIsInitiating] = useState(false);

  const form = useForm<ReviewTemplateFormData>({
    resolver: zodResolver(reviewTemplateSchema),
    defaultValues: { name: '', items: [] },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  const fetchPageData = useCallback(async (loggedUser: LoggedUser, currentFilters: { departmentId?: string, period?: string }) => {
      setLoading(true);
      const [fetchedReviews, allDepartments, allFetchedUsers] = await Promise.all([
          getReviews(loggedUser, currentFilters),
          getDepartments(),
          getUsers(),
      ]);
      setReviews(fetchedReviews);
      setDepartments(allDepartments);
      setAllUsers(allFetchedUsers);

      if (loggedUser.role === 'Administrador') {
        const [fetchedTemplates, fetchedManagers, fetchedKpiModels] = await Promise.all([
            getReviewTemplates(), 
            getManagers(),
            getKpiModels(),
        ]);
        setTemplates(fetchedTemplates);
        setManagers(fetchedManagers);
        setKpiModels(fetchedKpiModels);
      }
      
      if (loggedUser.role === 'Gerente') {
          const [fetchedAssignedTemplates] = await Promise.all([
              getAssignedTemplatesForManager(loggedUser.id),
          ]);
          setAssignedTemplates(fetchedAssignedTemplates);
          
          const myDepartmentIds = allDepartments.filter(d => d.leaderId === loggedUser.id).map(d => d.id);
          const myCollaborators = allFetchedUsers.filter(u => u.departmentId && myDepartmentIds.includes(u.departmentId) && u.role === 'Colaborador');
          setCollaborators(myCollaborators);
      }

      setLoading(false);
    }, []);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.push('/');
      return;
    }
    const loggedUser: LoggedUser = JSON.parse(userString);
    setUser(loggedUser);
    fetchPageData(loggedUser, filters);
  }, [router, fetchPageData, filters]);

  const handleOpenFormDialog = (template: ReviewTemplate | null) => {
    if (template) {
      setIsEditMode(true);
      form.reset({ id: template.id, name: template.name, items: template.items });
    } else {
      setIsEditMode(false);
      form.reset({ name: '', items: [{ text: '', description: '' }] });
    }
    setFormOpen(true);
  };
  
  const handleTemplateSubmit = async (data: ReviewTemplateFormData) => {
    const result = await createOrUpdateReviewTemplate(data);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setFormOpen(false);
      const fetchedTemplates = await getReviewTemplates();
      setTemplates(fetchedTemplates);
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const result = await deleteReviewTemplate(id);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  const handleDeleteReview = async (id: string) => {
    const result = await deleteReview(id);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      if (user) {
        fetchPageData(user, filters);
      }
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  const handleOpenAssignDialog = (template: ReviewTemplate) => {
    setSelectedTemplateForAssign(template);
    setSelectedManagerIds(template.assignedManagers?.map(m => m.id) || []);
    setAssignDialogOpen(true);
  };
  
  const handleManagerSelection = (managerId: string, checked: boolean) => {
    setSelectedManagerIds(prev => checked ? [...prev, managerId] : prev.filter(id => id !== managerId));
  };
  
  const handleAssignTemplate = async () => {
    if (!selectedTemplateForAssign || selectedManagerIds.length === 0) return;
    setIsAssigning(true);
    const result = await assignTemplateToManagers({ templateId: selectedTemplateForAssign.id, managerIds: selectedManagerIds });
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setAssignDialogOpen(false);
      if(user) fetchPageData(user, filters);
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsAssigning(false);
  };

  const handleOpenInitiateDialog = () => {
    setSelectedTemplateId('');
    setSelectedEmployeeIds([]);
    setInitiateDialogOpen(true);
  };

  const handleEmployeeSelection = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds(prev => checked ? [...prev, employeeId] : prev.filter(id => id !== employeeId));
  };
  
  const handleInitiateReviews = async () => {
    if (!selectedTemplateId || selectedEmployeeIds.length === 0 || !user) return;
    setIsInitiating(true);
    
    const template = assignedTemplates.find(t => t.id === selectedTemplateId);
    const employees = collaborators.filter(c => selectedEmployeeIds.includes(c.id));
    
    if (!template || employees.length === 0) {
      toast({ title: 'Erro', description: 'Modelo ou colaboradores inválidos.', variant: 'destructive' });
      setIsInitiating(false);
      return;
    }

    const result = await createReviews({ template, manager: user, employees });
    
    if (result.success) {
      toast({ title: 'Operação Concluída', description: result.message });
      setInitiateDialogOpen(false);
      if (user) fetchPageData(user, filters);
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsInitiating(false);
  };
  
  const handleFilterChange = (newFilters: { departmentId?: string, period?: string }) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avaliações de Desempenho"
        description="Gerencie e visualize as avaliações dos colaboradores."
      >
        {isManager && <Button onClick={handleOpenInitiateDialog}>Iniciar Nova Avaliação</Button>}
      </PageHeader>
      
      <Tabs defaultValue="reviews" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 sm:w-auto">
            <TabsTrigger value="reviews">Avaliações</TabsTrigger>
            {(isAdmin || isManager) && <TabsTrigger value="individual_performance">Desempenho Individual</TabsTrigger>}
            {isAdmin && <TabsTrigger value="leaderboard">Média por Líder</TabsTrigger>}
            {isAdmin && <TabsTrigger value="bonus_report">Extrato de Bônus</TabsTrigger>}
            {isAdmin && <TabsTrigger value="templates">Modelos</TabsTrigger>}
            {isAdmin && <TabsTrigger value="kpi_models">KPIs por Setor</TabsTrigger>}
            {isAdmin && <TabsTrigger value="kpi_assessment">Apuração de KPIs</TabsTrigger>}
            {isAdmin && <TabsTrigger value="parameters">Parâmetros</TabsTrigger>}
        </TabsList>
        <TabsContent value="reviews" className="mt-4">
            <ReviewsList 
                reviews={reviews} 
                loading={loading} 
                isAdmin={isAdmin} 
                isManager={isManager}
                onDelete={handleDeleteReview} 
                onFilterChange={handleFilterChange}
                departments={departments}
            />
        </TabsContent>
         {(isAdmin || isManager) && (
            <TabsContent value="individual_performance" className="mt-4">
                {user && <IndividualPerformanceHistory user={user} users={allUsers} departments={departments} />}
            </TabsContent>
        )}
        {isAdmin && (
            <TabsContent value="leaderboard" className="mt-4">
               <Leaderboard />
            </TabsContent>
        )}
        {isAdmin && (
            <TabsContent value="bonus_report" className="mt-4">
               <BonusReport departments={departments} />
            </TabsContent>
        )}
        {isAdmin && (
            <TabsContent value="templates" className="mt-4">
                <div className="text-right mb-4">
                    <Button onClick={() => handleOpenFormDialog(null)}>
                        <Plus className="mr-2 h-4 w-4" /> Novo Modelo
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Modelos de Avaliação (Subjetivos)</CardTitle>
                        <CardDescription>Crie e gerencie os modelos baseados em perguntas para as avaliações.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Nome do Modelo</TableHead><TableHead>Itens</TableHead><TableHead>Atribuído a</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                                ) : templates.length > 0 ? (
                                    templates.map(template => (
                                        <TableRow key={template.id}>
                                            <TableCell className="font-medium">{template.name}</TableCell>
                                            <TableCell>{template.items.length}</TableCell>
                                            <TableCell>
                                                {template.assignedManagers && template.assignedManagers.length > 0 ? (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="link" className="p-0 h-auto">{`${template.assignedManagers.length} líder(es)`}</Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-2">
                                                            <ul className="space-y-1">
                                                                {template.assignedManagers.map(m => <li key={m.id} className="text-sm">{m.name}</li>)}
                                                            </ul>
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Nenhum</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenAssignDialog(template)}><Send className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenFormDialog(template)}><Edit className="h-4 w-4" /></Button>
                                                <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Deseja realmente excluir o modelo "{template.name}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTemplate(template.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum modelo criado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        )}
         {isAdmin && (
            <TabsContent value="kpi_models" className="mt-4">
                <KpiModels departments={departments} />
            </TabsContent>
        )}
        {isAdmin && (
            <TabsContent value="kpi_assessment" className="mt-4">
                <KpiAssessment 
                    kpiModels={kpiModels} 
                    departments={departments}
                    onAssessmentSubmit={() => user && fetchPageData(user, filters)} 
                />
            </TabsContent>
        )}
        {isAdmin && (
             <TabsContent value="parameters" className="mt-4">
                <Tabs defaultValue="performance" className="w-full">
                    <TabsList>
                        <TabsTrigger value="performance">Parâmetros de Desempenho</TabsTrigger>
                        <TabsTrigger value="kpi">Parâmetros de KPI</TabsTrigger>
                    </TabsList>
                    <TabsContent value="performance" className="mt-4">
                        <PerformanceBonusForm />
                    </TabsContent>
                    <TabsContent value="kpi" className="mt-4">
                        <KpiBonusForm />
                    </TabsContent>
                </Tabs>
            </TabsContent>
        )}
      </Tabs>

      {/* Template Form Dialog (Admin) */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{isEditMode ? 'Editar Modelo' : 'Criar Novo Modelo'}</DialogTitle>
                <DialogDescription>Defina o nome e os itens de avaliação para este modelo.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleTemplateSubmit)} className="flex-1 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1 p-1">
                        <div className="px-6 py-4 space-y-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Nome do Modelo</FormLabel><FormControl><Input placeholder="Ex: Avaliação Trimestral de TI" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            
                            <div className="space-y-4">
                                <Label>Itens de Avaliação</Label>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="space-y-3 rounded-md border p-4 relative">
                                        <FormField control={form.control} name={`items.${index}.text`} render={({ field }) => (
                                            <FormItem><FormLabel>Item {index + 1}</FormLabel><FormControl><Input placeholder={`Título do item de avaliação ${index + 1}`} {...field} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs text-muted-foreground">Descrição (Opcional)</FormLabel><FormControl><Textarea placeholder="Descreva o que se espera para este item..." {...field} rows={2} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '', description: '' })}>
                                <Plus className="mr-2 h-4 w-4" /> Adicionar Item
                            </Button>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-6 border-t mt-auto">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      {/* Assign Template Dialog (Admin) */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Modelo</DialogTitle>
            <DialogDescription>Selecione os líderes para aplicar o modelo: <span className="font-semibold">{selectedTemplateForAssign?.name}</span></DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-60 w-full"><div className="space-y-3 pr-6">
              {managers.map(m => (
                <div key={m.id} className="flex items-center justify-between">
                  <Label htmlFor={`manager-${m.id}`} className="font-normal">{m.name}</Label>
                  <Checkbox 
                    id={`manager-${m.id}`} 
                    checked={selectedManagerIds.includes(m.id)}
                    onCheckedChange={(checked) => handleManagerSelection(m.id, !!checked)} 
                   />
                </div>
              ))}
            </div></ScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={handleAssignTemplate} disabled={isAssigning || selectedManagerIds.length === 0}>
              {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isAssigning ? 'Atribuindo...' : `Atribuir a ${selectedManagerIds.length} líder(es)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Initiate Review Dialog (Manager) */}
      <Dialog open={initiateDialogOpen} onOpenChange={setInitiateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Iniciar Nova Avaliação de Desempenho</DialogTitle>
            <DialogDescription>Selecione o modelo e os colaboradores que serão avaliados.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="space-y-2">
                <Label>1. Selecione o Modelo de Avaliação</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Escolha um modelo..." />
                    </SelectTrigger>
                    <SelectContent>
                        {assignedTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-2">
                <Label>2. Selecione os Colaboradores</Label>
                <ScrollArea className="h-60 w-full border rounded-md p-4">
                    <div className="space-y-3">
                        {collaborators.length > 0 ? collaborators.map(c => (
                            <div key={c.id} className="flex items-center justify-between">
                                <Label htmlFor={`collab-${c.id}`} className="font-normal">{c.name}</Label>
                                <Checkbox id={`collab-${c.id}`} onCheckedChange={(checked) => handleEmployeeSelection(c.id, !!checked)} />
                            </div>
                        )) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhum colaborador encontrado em seu setor.</p>
                        )}
                    </div>
                </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleInitiateReviews} disabled={isInitiating || !selectedTemplateId || selectedEmployeeIds.length === 0}>
              {isInitiating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isInitiating ? 'Iniciando...' : `Iniciar ${selectedEmployeeIds.length} Avaliaç${selectedEmployeeIds.length > 1 ? 'ões' : 'ão'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    
