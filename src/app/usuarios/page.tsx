
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { userSchema, type UserFormData } from './schema';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  type User,
} from './actions';
import { getDepartments, type Department } from '../setores/actions';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Edit, Trash2, CalendarIcon } from 'lucide-react';
import type { LoggedUser } from '../actions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function UsersPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'Colaborador',
      birthDate: undefined,
      departmentId: 'none',
    },
  });

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const user: LoggedUser = JSON.parse(userString);
      if (user.role === 'Administrador') {
        setIsAuthorized(true);
        fetchData();
      } else {
        router.push('/dashboard');
      }
    } else {
      router.push('/');
    }
  }, [router]);

  const fetchData = async () => {
    setIsLoading(true);
    const [fetchedUsers, fetchedDepts] = await Promise.all([getUsers(), getDepartments()]);
    setUsers(fetchedUsers);
    setDepartments(fetchedDepts);
    setIsLoading(false);
  };
  
  const handleOpenDialog = (user: User | null = null) => {
    if (user) {
      setIsEditMode(true);
      form.reset({
        id: user.id,
        name: user.name,
        email: user.email,
        password: '', // Never pre-fill password
        role: user.role,
        birthDate: user.birthDate ? new Date(user.birthDate) : undefined,
        departmentId: user.departmentId || 'none',
      });
    } else {
      setIsEditMode(false);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    
    const submissionData = { ...data };
    if (submissionData.departmentId === 'none') {
      submissionData.departmentId = '';
    }

    const result = isEditMode
      ? await updateUser(submissionData)
      : await createUser(submissionData);

    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setIsDialogOpen(false);
      fetchData();
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsSubmitting(false);
  };
  
  const handleDelete = async (id: string) => {
      const result = await deleteUser(id);
      if (result.success) {
          toast({ title: 'Sucesso!', description: result.message });
          fetchData();
      } else {
          toast({ title: 'Erro', description: result.message, variant: 'destructive' });
      }
  };

  if (!isAuthorized || isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciamento de Usuários"
        description="Adicione, edite e gerencie os usuários do sistema."
      >
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Nível</TableHead>
                <TableHead className="hidden lg:table-cell">Setor</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                    <TableCell className="hidden lg:table-cell">{user.role}</TableCell>
                    <TableCell className="hidden lg:table-cell">{user.departmentName || 'Não atribuído'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="h-4 w-4 text-destructive" />
                             </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente o usuário.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(user.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>{isEditMode ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
                <DialogDescription>
                  Preencha os dados para {isEditMode ? 'atualizar o' : 'criar um novo'} acesso.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input placeholder="Ex: João da Silva" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="Ex: joao.silva@empresa.com" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Data de Nascimento</FormLabel><Popover><PopoverTrigger asChild><FormControl>
                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                      {field.value ? (format(field.value, "PPP", { locale: ptBR })) : (<span>Selecione uma data</span>)}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar
                    mode="single" selected={field.value} onSelect={field.onChange}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus captionLayout="dropdown-buttons"
                    fromYear={1900} toYear={new Date().getFullYear()}
                  /></PopoverContent></Popover><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" placeholder={isEditMode ? 'Deixe em branco para não alterar' : ''} {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Nível de Acesso</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione um nível" /></SelectTrigger>
                  </FormControl><SelectContent>
                    <SelectItem value="Administrador">Líder de RH (Admin)</SelectItem>
                    <SelectItem value="Gerente">Gerente</SelectItem>
                    <SelectItem value="Colaborador">Colaborador</SelectItem>
                  </SelectContent></Select><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem><FormLabel>Setor</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione um setor" /></SelectTrigger>
                  </FormControl><SelectContent>
                    <SelectItem value="none">Não atribuído</SelectItem>
                    {departments.map((dept) => (<SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>))}
                  </SelectContent></Select><FormMessage /></FormItem>
                )}/>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
