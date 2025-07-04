'use client';

import { useState, useEffect } from 'react';
import { Megaphone, CalendarHeart, Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '../ui/separator';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { getAnnouncements, addAnnouncement, deleteAnnouncement, type Announcement } from '@/app/dashboard/actions';
import type { LoggedUser } from '@/app/actions';


export function Announcements() {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState<{ message: string; type: 'geral' | 'comemorativa' }>({
    message: '',
    type: 'geral',
  });

  const fetchData = async () => {
    setLoading(true);
    const data = await getAnnouncements();
    setAnnouncements(data);
    setLoading(false);
  };

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const loggedUser: LoggedUser = JSON.parse(userString);
      setIsAdmin(loggedUser.role === 'Administrador');
    }
    fetchData();
  }, []);

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.message.trim()) {
      toast({ title: "Erro", description: "A mensagem não pode estar vazia.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await addAnnouncement(newAnnouncement);
    if (result.success) {
      toast({ title: "Sucesso!", description: result.message });
      setDialogOpen(false);
      setNewAnnouncement({ message: '', type: 'geral' });
      fetchData();
    } else {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteAnnouncement = async (id: string) => {
    const result = await deleteAnnouncement(id);
     if (result.success) {
      toast({ title: "Sucesso!", description: result.message });
      fetchData();
    } else {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-headline text-lg">Quadro de Avisos</CardTitle>
        {isAdmin && (
           <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" /> Adicionar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Aviso</DialogTitle>
                <DialogDescription>
                  Escreva o aviso que será exibido para todos no dashboard.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                 <div className="space-y-2">
                   <Label htmlFor="message">Mensagem do Aviso</Label>
                   <Textarea 
                     id="message"
                     placeholder="Escreva sua mensagem aqui..."
                     rows={4}
                     value={newAnnouncement.message}
                     onChange={(e) => setNewAnnouncement(prev => ({...prev, message: e.target.value}))}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Tipo de Aviso</Label>
                   <RadioGroup 
                     defaultValue="geral"
                     value={newAnnouncement.type}
                     onValueChange={(value: 'geral' | 'comemorativa') => setNewAnnouncement(prev => ({...prev, type: value}))}
                     className="flex items-center gap-4"
                   >
                     <div className="flex items-center space-x-2">
                       <RadioGroupItem value="geral" id="r-geral" />
                       <Label htmlFor="r-geral" className="font-normal">Geral</Label>
                     </div>
                     <div className="flex items-center space-x-2">
                       <RadioGroupItem value="comemorativa" id="r-comemorativa" />
                       <Label htmlFor="r-comemorativa" className="font-normal">Comemorativo</Label>
                     </div>
                   </RadioGroup>
                 </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddAnnouncement} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Adicionando..." : "Adicionar Aviso"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
           <div className="flex justify-center items-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
           </div>
        ) : announcements.length > 0 ? (
          <ul className="space-y-4">
            {announcements.map((item, index) => (
              <li key={item.id}>
                <div className="flex items-start gap-4 group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    {item.type === 'geral' ? <Megaphone className="h-5 w-5" /> : <CalendarHeart className="h-5 w-5" />}
                  </div>
                  <p className="flex-1 text-sm pt-1.5 text-muted-foreground">{item.message}</p>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja realmente excluir este aviso? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteAnnouncement(item.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                {index < announcements.length - 1 && <Separator className="mt-4" />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhum aviso no momento.</p>
        )}
      </CardContent>
    </Card>
  );
}
