
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Loader2, Plus, Trash2, Edit, Send } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

import { 
  getReviews, 
  getReviewTemplates, 
  createOrUpdateReviewTemplate, 
  deleteReviewTemplate, 
  assignTemplateToManagers, 
  getAssignedTemplatesForManager,
  createReviews,
  deleteReview,
  type Review, 
  type ReviewTemplate 
} from './actions';
import { getManagers, getDepartments, type Manager, type Department } from '../setores/actions';
import { getUsers, type User } from '../usuarios/actions';
import type { LoggedUser } from '../actions';
import { reviewTemplateSchema, type ReviewTemplateFormData } from './schema';

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  'Concluída': 'default',
  'Pendente': 'secondary',
  'Atrasada': 'destructive',
  'Em Aprovação': 'outline',
  'Ajuste Solicitado': 'destructive',
};

function ReviewsList({ reviews, loading, isAdmin, onDelete }: { reviews: Review[], loading: boolean, isAdmin: boolean, onDelete: (id: string) => void }) {
  const router = useRouter();

  const handleViewReview = (id: string) => {
    router.push(`/avaliacoes/${id}`);
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead className="hidden md:table-cell">Cargo</TableHead>
              <TableHead className="hidden lg:table-cell">Setor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Nota Final</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
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
                <TableCell colSpan={7} className="h-24 text-center">
                  Nenhuma avaliação encontrada.
                </TableCell>
              </TableRow>
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
  const [loading, setLoading] = useState(true);

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

  const fetchPageData = async (loggedUser: LoggedUser) => {
      setLoading(true);
      const fetchedReviews = await getReviews(loggedUser);
      setReviews(fetchedReviews);

      if (loggedUser.role === 'Administrador') {
        const [fetchedTemplates, fetchedManagers] = await Promise.all([getReviewTemplates(), getManagers()]);
        setTemplates(fetchedTemplates);
        setManagers(fetchedManagers);
      }
      
      if (loggedUser.role === 'Gerente') {
          const [fetchedAssignedTemplates, allUsers, allDepartments] = await Promise.all([
              getAssignedTemplatesForManager(loggedUser.id),
              getUsers(),
              getDepartments(),
          ]);
          setAssignedTemplates(fetchedAssignedTemplates);
          
          const myDepartmentIds = allDepartments.filter(d => d.leaderId === loggedUser.id).map(d => d.id);
          const myCollaborators = allUsers.filter(u => u.departmentId && myDepartmentIds.includes(u.departmentId) && u.role === 'Colaborador');
          setCollaborators(myCollaborators);
      }

      setLoading(false);
    };

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.push('/');
      return;
    }
    const loggedUser: LoggedUser = JSON.parse(userString);
    setUser(loggedUser);
    fetchPageData(loggedUser);
  }, [router]);

  const handleOpenFormDialog = (template: ReviewTemplate | null) => {
    if (template) {
      setIsEditMode(true);
      form.reset({ id: template.id, name: template.name, items: template.items });
    } else {
      setIsEditMode(false);
      form.reset({ name: '', items: [{ text: '' }] });
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
        fetchPageData(user);
      }
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  const handleOpenAssignDialog = (template: ReviewTemplate) => {
    setSelectedTemplateForAssign(template);
    setSelectedManagerIds([]);
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
      if (user) fetchPageData(user);
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsInitiating(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avaliações de Desempenho"
        description="Gerencie e visualize as avaliações dos colaboradores."
      >
        {isManager && <Button onClick={handleOpenInitiateDialog}>Iniciar Nova Avaliação</Button>}
        {isAdmin && <Button onClick={() => handleOpenFormDialog(null)}>Novo Modelo de Avaliação</Button>}
      </PageHeader>
      
      <Tabs defaultValue="reviews" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 sm:w-auto">
            <TabsTrigger value="reviews">Avaliações</TabsTrigger>
            {isAdmin && <TabsTrigger value="templates">Modelos</TabsTrigger>}
        </TabsList>
        <TabsContent value="reviews" className="mt-4">
            <ReviewsList reviews={reviews} loading={loading} isAdmin={isAdmin} onDelete={handleDeleteReview} />
        </TabsContent>
        {isAdmin && (
            <TabsContent value="templates" className="mt-4">
                <div className="text-right mb-4">
                    <Button onClick={() => handleOpenFormDialog(null)}>
                        <Plus className="mr-2 h-4 w-4" /> Novo Modelo
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Modelos de Avaliação</CardTitle>
                        <CardDescription>Crie e gerencie os modelos para as avaliações de desempenho.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Nome do Modelo</TableHead><TableHead>Itens</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                                ) : templates.length > 0 ? (
                                    templates.map(template => (
                                        <TableRow key={template.id}>
                                            <TableCell className="font-medium">{template.name}</TableCell>
                                            <TableCell>{template.items.length}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenAssignDialog(template)}><Send className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenFormDialog(template)}><Edit className="h-4 w-4" /></Button>
                                                <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Deseja realmente excluir o modelo "{template.name}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTemplate(template.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={3} className="h-24 text-center">Nenhum modelo criado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
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
                            
                            <div className="space-y-2">
                                <Label>Itens de Avaliação</Label>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex items-center gap-2">
                                        <FormField control={form.control} name={`items.${index}.text`} render={({ field }) => (
                                            <FormItem className="flex-1"><FormControl><Textarea placeholder={`Item de avaliação ${index + 1}`} {...field} rows={1} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })}>
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
                  <Checkbox id={`manager-${m.id}`} onCheckedChange={(checked) => handleManagerSelection(m.id, !!checked)} />
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
