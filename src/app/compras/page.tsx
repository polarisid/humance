
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
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, MoreHorizontal, Link2 } from 'lucide-react';
import type { LoggedUser } from '../actions';
import {
  getShoppingItems,
  addShoppingItem,
  updateShoppingItemStatus,
  deleteShoppingItem,
  type ShoppingItem,
} from './actions';
import { format } from 'date-fns';


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
  'Comprado': 'default',
  'Entregue': 'default',
  'Pendente': 'secondary',
  'Em falta': 'destructive',
};


export default function ShoppingListPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: '', quantity: 1, links: '', comments: '' });

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const loggedUser: LoggedUser = JSON.parse(userString);
      setUser(loggedUser);
      if (loggedUser.role === 'Administrador' || loggedUser.role === 'Gerente') {
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
    const fetchedItems = await getShoppingItems();
    setItems(fetchedItems);
    setLoading(false);
  };
  
  const handleAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newItem.name || !newItem.category || newItem.quantity < 1 || !user) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    
    const result = await addShoppingItem({
      ...newItem,
      requesterId: user.id,
      requesterName: user.name,
      quantity: Number(newItem.quantity)
    });
    
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setIsDialogOpen(false);
      setNewItem({ name: '', category: '', quantity: 1, links: '', comments: '' });
      fetchData();
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsSubmitting(false);
  };
  
  const handleUpdateStatus = async (id: string, status: ShoppingItem['status']) => {
    const result = await updateShoppingItemStatus({ id, status });
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      fetchData();
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteShoppingItem(id);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      fetchData();
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  const isAdmin = user?.role === 'Administrador';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lista de Compras"
        description="Gerencie ou solicite os itens necessários para o escritório."
      >
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Solicitar Item</Button>
      </PageHeader>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead className="hidden md:table-cell">Solicitante</TableHead>
                <TableHead className="hidden lg:table-cell">Data</TableHead>
                <TableHead className="text-center">Qtd.</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Detalhes</TableHead>
                {isAdmin && <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : items.length > 0 ? (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{item.category}</TableCell>
                    <TableCell className="hidden md:table-cell">{item.requesterName}</TableCell>
                    <TableCell className="hidden lg:table-cell">{format(new Date(item.createdAt), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-center">
                       <Badge variant={statusVariant[item.status] || 'default'}>{item.status}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {(item.links || item.comments) && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto">
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80">
                            <div className="grid gap-4">
                              <div className="space-y-2">
                                <h4 className="font-medium leading-none">Detalhes da Solicitação</h4>
                                <p className="text-sm text-muted-foreground">
                                  Informações adicionais fornecidas.
                                </p>
                              </div>
                              <div className="grid gap-2">
                                {item.links && (
                                  <div className="grid grid-cols-3 items-start gap-4">
                                    <Label>Links</Label>
                                    <div className="col-span-2 text-sm break-words">
                                      {item.links.split(/[\s\n,]+/).map((link, i) => link.trim() && (
                                        <a key={i} href={link.trim()} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline block truncate">{link.trim()}</a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {item.comments && (
                                  <div className="grid grid-cols-3 items-start gap-4">
                                    <Label>Comentários</Label>
                                    <p className="col-span-2 text-sm whitespace-pre-wrap">{item.comments}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Alterar Status</DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(item.id, 'Pendente')}>Pendente</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(item.id, 'Comprado')}>Comprado</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(item.id, 'Em falta')}>Em falta</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(item.id, 'Entregue')}>Entregue</DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                 <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Excluir</DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Essa ação não pode ser desfeita. Isso excluirá permanentemente a solicitação do item.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(item.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="h-24 text-center">
                    Nenhuma solicitação de compra encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleAddItem}>
            <DialogHeader>
              <DialogTitle>Solicitar Novo Item</DialogTitle>
              <DialogDescription>
                Preencha os dados do item que você precisa solicitar para o escritório.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Nome do Item</Label>
                  <Input 
                    id="name" 
                    value={newItem.name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Café em grãos 1kg" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantidade</Label>
                  <Input 
                    id="quantity" 
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    placeholder="1"
                    min="1"
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input 
                  id="category" 
                  value={newItem.category}
                  onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Ex: Alimentação" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="links">Sugestão de Links (Opcional)</Label>
                <Textarea 
                  id="links" 
                  value={newItem.links}
                  onChange={(e) => setNewItem(prev => ({ ...prev, links: e.target.value }))}
                  placeholder="Cole um ou mais links aqui, um por linha"
                  rows={3}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="comments">Comentários (Opcional)</Label>
                <Textarea 
                  id="comments" 
                  value={newItem.comments}
                  onChange={(e) => setNewItem(prev => ({ ...prev, comments: e.target.value }))}
                  placeholder="Ex: Precisa ser compatível com a máquina de café atual."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Solicitando...' : 'Solicitar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
