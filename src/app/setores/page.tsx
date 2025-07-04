'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import type { LoggedUser } from '../actions';
import {
  getDepartments,
  getManagers,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  type Department,
  type Manager,
} from './actions';

export default function DepartmentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentDepartment, setCurrentDepartment] = useState<Partial<Department>>({});

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
    setLoading(true);
    const [depts, mgrs] = await Promise.all([getDepartments(), getManagers()]);
    setDepartments(depts);
    setManagers(mgrs);
    setLoading(false);
  };
  
  const handleOpenDialog = (department: Department | null = null) => {
    if (department) {
      setIsEditMode(true);
      setCurrentDepartment(department);
    } else {
      setIsEditMode(false);
      setCurrentDepartment({});
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentDepartment.name || !currentDepartment.leaderId) {
      toast({ title: 'Erro', description: 'Preencha todos os campos.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    
    const result = isEditMode
      ? await updateDepartment({ id: currentDepartment.id!, name: currentDepartment.name, leaderId: currentDepartment.leaderId })
      : await addDepartment({ name: currentDepartment.name, leaderId: currentDepartment.leaderId });

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
      const result = await deleteDepartment(id);
      if (result.success) {
          toast({ title: 'Sucesso!', description: result.message });
          fetchData();
      } else {
          toast({ title: 'Erro', description: result.message, variant: 'destructive' });
      }
  };

  if (!isAuthorized) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciamento de Setores"
        description="Adicione, edite e gerencie os setores e seus líderes."
      >
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Setor
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Setor</TableHead>
                <TableHead>Líder</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : departments.length > 0 ? (
                departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.leaderName}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(dept)}>
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
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente o setor.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(dept.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Nenhum setor encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Editar Setor' : 'Adicionar Novo Setor'}</DialogTitle>
              <DialogDescription>
                Preencha os dados do setor e selecione o líder responsável.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Setor</Label>
                <Input 
                  id="name" 
                  value={currentDepartment.name || ''}
                  onChange={(e) => setCurrentDepartment(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Tecnologia" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leader">Líder do Setor</Label>
                 <Select
                  value={currentDepartment.leaderId}
                  onValueChange={(value) => setCurrentDepartment(prev => ({ ...prev, leaderId: value }))}
                  required
                >
                  <SelectTrigger id="leader">
                    <SelectValue placeholder="Selecione um líder" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map(manager => (
                      <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
