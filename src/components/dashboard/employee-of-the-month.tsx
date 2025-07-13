
'use client';

import { useState, useEffect } from 'react';
import { Award, Edit, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getEmployeeOfTheMonth, updateEmployeeOfTheMonth, type EmployeeOfTheMonthData } from '@/app/dashboard/actions';
import type { LoggedUser } from '@/app/actions';

const defaultEmployee: EmployeeOfTheMonthData = {
  name: 'Aguardando dados...',
  role: '...',
  reason: '...',
  imageUrl: '',
};

export function EmployeeOfTheMonth() {
  const { toast } = useToast();
  const [employee, setEmployee] = useState<EmployeeOfTheMonthData | null>(defaultEmployee);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<LoggedUser | null>(null);
  
  // Dialog state for admin edit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState<EmployeeOfTheMonthData>(defaultEmployee);
  
  const fetchData = async (loggedUser: LoggedUser) => {
      setLoading(true);
      const data = await getEmployeeOfTheMonth(loggedUser);
      if (data) {
        setEmployee(data);
        if (loggedUser.role === 'Administrador') {
            setFormData(data);
        }
      } else {
        setEmployee(null);
      }
      setLoading(false);
    };

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const loggedUser: LoggedUser = JSON.parse(userString);
      setUser(loggedUser);
      fetchData(loggedUser);
    } else {
        setLoading(false);
    }
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({...prev, [id]: value}));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    
    const dataToSave = {
        ...formData,
        imageUrl: formData.imageUrl || 'https://placehold.co/100x100.png'
    };

    const result = await updateEmployeeOfTheMonth(dataToSave);
    
    if (result.success) {
      toast({ title: "Sucesso!", description: result.message });
      setEmployee(dataToSave);
      setDialogOpen(false);
    } else {
      toast({ title: "Erro", description: result.message, variant: 'destructive' });
    }
    setIsUpdating(false);
  };

  const getInitials = (name: string) => {
    if (!name || name === 'Aguardando dados...') return '';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('');
  };

  const getCardTitle = () => {
      if (user?.role === 'Gerente') {
          return "Destaque da Equipe";
      }
      return "Funcionário do Mês";
  }

  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader>
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!employee) {
    if (user?.role === 'Gerente') {
        return (
            <Card className="relative overflow-hidden bg-primary text-primary-foreground flex flex-col items-center justify-center text-center h-full min-h-[220px]">
                <CardHeader>
                    <CardTitle className="font-headline text-lg">Destaque da Equipe</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-primary-foreground/80">Nenhum destaque para o mês atual, pois não há avaliações concluídas na equipe.</p>
                </CardContent>
            </Card>
        )
    }
    return null; // Don't render for other roles if no employee is set.
  }

  return (
    <Card className="relative overflow-hidden bg-primary text-primary-foreground min-h-[220px]">
      <div className="absolute -right-8 -top-8 h-24 w-24 text-white/10">
        <Award className="h-full w-full" />
      </div>

      {user?.role === 'Administrador' && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground">
              <Edit className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Editar Funcionário do Mês</DialogTitle>
                <DialogDescription>
                  Atualize os dados do funcionário em destaque.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role">Cargo</Label>
                    <Input id="role" value={formData.role} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reason">Motivo/Descrição</Label>
                    <Input id="reason" value={formData.reason} onChange={handleInputChange} required />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="imageUrl">URL da Imagem</Label>
                    <Input id="imageUrl" placeholder="https://exemplo.com/foto.png" value={formData.imageUrl} onChange={handleInputChange} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <CardHeader>
        <CardTitle className="font-headline text-lg">{getCardTitle()}</CardTitle>
        <CardDescription className="text-primary-foreground/80">{employee.reason}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-primary-foreground/50">
          <AvatarImage data-ai-hint="professional person" src={employee.imageUrl} alt={employee.name} />
          <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-xl font-bold">{employee.name}</h3>
          <p className="text-primary-foreground/90">{employee.role}</p>
        </div>
      </CardContent>
    </Card>
  );
}
