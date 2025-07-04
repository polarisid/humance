
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Send, Loader2, Edit, Trash2, Users, Layers } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from "@/components/page-header";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


import type { LoggedUser } from '../actions';
import { getUsers } from '../usuarios/actions';
import { trainingSchema, playlistSchema, type TrainingFormData, type PlaylistFormData } from './schema';
import { 
  createOrUpdateTraining,
  deleteTraining,
  getAllTrainings,
  getMyTrainings,
  assignTrainingsToUsers,
  getAssignedUsersForTraining,
  createOrUpdatePlaylist,
  deletePlaylist,
  getPlaylists,
  assignPlaylistToUsers,
  type Training, 
  type UserTraining,
  type AssignedUser,
  type Playlist,
} from './actions';

type User = Omit<LoggedUser, 'password'>;

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  passed: 'default',
  not_started: 'secondary',
  failed: 'destructive',
  default: 'outline',
};

const statusText: { [key: string]: string } = {
    passed: 'Aprovado',
    not_started: 'Pendente',
    failed: 'Reprovado',
    default: 'N/A',
}

export default function TrainingPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userTrainings, setUserTrainings] = useState<UserTraining[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Admin - Trainings state
  const [allTrainings, setAllTrainings] = useState<Training[]>([]);
  const [trainingFormOpen, setTrainingFormOpen] = useState(false);
  const [isTrainingEditMode, setIsTrainingEditMode] = useState(false);
  const [assignTrainingDialogOpen, setAssignTrainingDialogOpen] = useState(false);
  const [selectedTrainingForAssign, setSelectedTrainingForAssign] = useState<Training | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [viewUsersDialogOpen, setViewUsersDialogOpen] = useState(false);
  const [selectedTrainingForView, setSelectedTrainingForView] = useState<Training | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [loadingAssignedUsers, setLoadingAssignedUsers] = useState(false);
  
  // Admin - Playlists state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistFormOpen, setPlaylistFormOpen] = useState(false);
  const [isPlaylistEditMode, setIsPlaylistEditMode] = useState(false);
  const [assignPlaylistDialogOpen, setAssignPlaylistDialogOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  

  const trainingForm = useForm<TrainingFormData>({
    resolver: zodResolver(trainingSchema),
    defaultValues: { title: '', description: '', category: '', youtubeUrl: '', pdfUrl: '', quiz: { questions: [] }, prerequisiteIds: [] },
  });

  const { fields, append, remove } = useFieldArray({
    control: trainingForm.control, name: "quiz.questions",
  });

  const playlistForm = useForm<PlaylistFormData>({
    resolver: zodResolver(playlistSchema),
    defaultValues: { name: '', description: '', trainingIds: [] },
  });


  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.push('/');
      return;
    }
    const loggedUser: LoggedUser = JSON.parse(userString);
    const isAdminUser = loggedUser.role === 'Administrador';
    setIsAdmin(isAdminUser);
    fetchData(isAdminUser, loggedUser);
  }, [router]);
  
  useEffect(() => {
    if ((assignTrainingDialogOpen || assignPlaylistDialogOpen) && isAdmin) {
      getUsers().then(setUsers);
    }
  }, [assignTrainingDialogOpen, assignPlaylistDialogOpen, isAdmin]);

  const fetchData = async (isAdminUser: boolean, user: LoggedUser) => {
    setLoading(true);
    if (isAdminUser) {
      const [fetchedTrainings, fetchedPlaylists] = await Promise.all([
          getAllTrainings(),
          getPlaylists()
      ]);
      setAllTrainings(fetchedTrainings);
      setPlaylists(fetchedPlaylists);
    } else {
      const fetchedTrainings = await getMyTrainings(user);
      setUserTrainings(fetchedTrainings);
    }
    setLoading(false);
  };

  const handleOpenTrainingForm = (training: Training | null) => {
    if (training) {
      setIsTrainingEditMode(true);
      trainingForm.reset({
        id: training.id, title: training.title, description: training.description, category: training.category || '',
        youtubeUrl: training.youtubeUrl || '', pdfUrl: training.pdfUrl || '', prerequisiteIds: training.prerequisiteIds || [],
        quiz: training.quiz ? { questions: training.quiz.questions.map(q => ({...q, options: [...q.options, '', '', '', ''].slice(0, 4)})) } : { questions: [] },
      });
    } else {
      setIsTrainingEditMode(false);
      trainingForm.reset({ title: '', description: '', category: '', youtubeUrl: '', pdfUrl: '', quiz: { questions: [] }, prerequisiteIds: [] });
    }
    setTrainingFormOpen(true);
  };

  const onTrainingSubmit = async (data: TrainingFormData) => {
    const result = await createOrUpdateTraining(data);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setTrainingFormOpen(false);
      const userString = localStorage.getItem('user');
      fetchData(isAdmin, JSON.parse(userString!));
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  const handleDeleteTraining = async (id: string) => {
    const result = await deleteTraining(id);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setAllTrainings(prev => prev.filter(t => t.id !== id));
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  }

  const handleOpenAssignTrainingDialog = (training: Training) => {
    setSelectedTrainingForAssign(training);
    setSelectedUserIds([]);
    setAssignTrainingDialogOpen(true);
  };

  const handleAssignTraining = async () => {
    if (!selectedTrainingForAssign || selectedUserIds.length === 0) return;
    setIsAssigning(true);
    const result = await assignTrainingsToUsers({ trainingId: selectedTrainingForAssign.id, userIds: selectedUserIds });
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setAssignTrainingDialogOpen(false);
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsAssigning(false);
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    setSelectedUserIds(prev => checked ? [...prev, userId] : prev.filter(id => id !== userId));
  };
  
  const handleOpenViewUsersDialog = async (training: Training) => {
    setSelectedTrainingForView(training);
    setViewUsersDialogOpen(true);
    setLoadingAssignedUsers(true);
    try {
        const users = await getAssignedUsersForTraining(training.id);
        setAssignedUsers(users);
    } catch (error) {
        toast({ title: 'Erro', description: 'Não foi possível buscar os alunos.', variant: 'destructive' });
        setAssignedUsers([]);
    } finally {
        setLoadingAssignedUsers(false);
    }
  };

  const handleOpenPlaylistFormDialog = (playlist: Playlist | null) => {
    if (playlist) {
      setIsPlaylistEditMode(true);
      playlistForm.reset({ id: playlist.id, name: playlist.name, description: playlist.description, trainingIds: playlist.trainingIds });
    } else {
      setIsPlaylistEditMode(false);
      playlistForm.reset({ name: '', description: '', trainingIds: [] });
    }
    setPlaylistFormOpen(true);
  };
  
  const onPlaylistSubmit = async (data: PlaylistFormData) => {
    const result = await createOrUpdatePlaylist(data);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setPlaylistFormOpen(false);
      const userString = localStorage.getItem('user');
      fetchData(isAdmin, JSON.parse(userString!));
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    const result = await deletePlaylist(id);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setPlaylists(prev => prev.filter(p => p.id !== id));
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  const handleOpenAssignPlaylistDialog = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setSelectedUserIds([]);
    setAssignPlaylistDialogOpen(true);
  };

  const handleAssignPlaylist = async () => {
    if (!selectedPlaylist || selectedUserIds.length === 0) return;
    setIsAssigning(true);
    const result = await assignPlaylistToUsers({ playlistId: selectedPlaylist.id, userIds: selectedUserIds });
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setAssignPlaylistDialogOpen(false);
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsAssigning(false);
  };


  const trainingsToDisplay = isAdmin ? allTrainings : userTrainings;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treinamentos"
        description={isAdmin ? "Gerencie e atribua treinamentos para a equipe." : "Acesse os treinamentos designados para seu cargo."}
      />
      
       <Tabs defaultValue="trainings" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 sm:w-auto">
            <TabsTrigger value="trainings">Treinamentos</TabsTrigger>
            {isAdmin && <TabsTrigger value="playlists">Playlists</TabsTrigger>}
        </TabsList>

        <TabsContent value="trainings" className="mt-4">
            {isAdmin && (
                <div className="text-right mb-4">
                    <Button onClick={() => handleOpenTrainingForm(null)}>
                        <Plus className="mr-2 h-4 w-4" /> Novo Treinamento
                    </Button>
                </div>
            )}
            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {trainingsToDisplay.length > 0 ? trainingsToDisplay.map((training) => (
                    <Card key={training.id} className="flex flex-col">
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
                        <CardTitle className="font-headline">{training.title}</CardTitle>
                        {training.category && <Badge variant="outline" className="shrink-0">{training.category}</Badge>}
                        </div>
                        <CardDescription className="line-clamp-3 h-[60px]">{training.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow" />
                    <CardFooter className="flex justify-between items-center bg-muted/50 p-4 rounded-b-lg">
                        <Button asChild variant="outline" size="sm">
                        <Link href={`/treinamentos/${training.id}`}>Ver Material</Link>
                        </Button>
                        {isAdmin && (
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenViewUsersDialog(training)}>
                            <Users className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenAssignTrainingDialog(training)}>
                            <Send className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenTrainingForm(training)}>
                            <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tem certeza que deseja excluir o treinamento "{training.title}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTraining(training.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                            </AlertDialog>
                        </div>
                        )}
                    </CardFooter>
                    </Card>
                )) : (
                    <div className="col-span-full text-center py-12"><p className="text-muted-foreground">Nenhum treinamento encontrado.</p></div>
                )}
                </div>
            )}
        </TabsContent>

        {isAdmin && (
            <TabsContent value="playlists" className="mt-4">
                <div className="text-right mb-4">
                    <Button onClick={() => handleOpenPlaylistFormDialog(null)}>
                        <Plus className="mr-2 h-4 w-4" /> Nova Playlist
                    </Button>
                </div>
                 {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {playlists.length > 0 ? playlists.map((playlist) => (
                        <Card key={playlist.id} className="flex flex-col">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Layers className="h-5 w-5" />
                                </div>
                                <CardTitle className="font-headline">{playlist.name}</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2 h-[40px] pt-1">{playlist.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground">{playlist.trainings?.length || 0} treinamento(s)</p>
                            </CardContent>
                            <CardFooter className="flex justify-end items-center bg-muted/50 p-4 rounded-b-lg">
                                <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenAssignPlaylistDialog(playlist)}>
                                    <Send className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenPlaylistFormDialog(playlist)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        Tem certeza que deseja excluir a playlist "{playlist.name}"? As atribuições existentes não serão afetadas.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeletePlaylist(playlist.id)}>Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                </div>
                            </CardFooter>
                        </Card>
                        )) : (
                           <div className="col-span-full text-center py-12"><p className="text-muted-foreground">Nenhuma playlist criada.</p></div>
                        )}
                    </div>
                )}
            </TabsContent>
        )}
      </Tabs>

      {/* Create/Edit Training Dialog */}
      <Dialog open={trainingFormOpen} onOpenChange={setTrainingFormOpen}>
        <DialogContent className="max-w-3xl flex flex-col h-[90vh]">
           <DialogHeader className="p-6 pb-4 shrink-0 border-b">
            <DialogTitle>{isTrainingEditMode ? 'Editar Treinamento' : 'Criar Novo Treinamento'}</DialogTitle>
            <DialogDescription>Preencha os detalhes do módulo de treinamento, incluindo vídeo e quiz se necessário.</DialogDescription>
          </DialogHeader>
          <Form {...trainingForm}>
            <form onSubmit={trainingForm.handleSubmit(onTrainingSubmit)} className="flex flex-col flex-1 overflow-y-hidden">
               <ScrollArea className="flex-1 px-6">
                 <div className="space-y-6 py-6">
                    <FormField control={trainingForm.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Título</FormLabel><FormControl><Input placeholder="Ex: Comunicação Efetiva" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={trainingForm.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea placeholder="Descreva o objetivo e o conteúdo do treinamento." {...field} rows={5} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={trainingForm.control} name="category" render={({ field }) => (
                      <FormItem><FormLabel>Categoria (Opcional)</FormLabel><FormControl><Input placeholder="Ex: Onboarding, Liderança" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={trainingForm.control} name="youtubeUrl" render={({ field }) => (
                      <FormItem><FormLabel>URL do Vídeo do YouTube (Opcional)</FormLabel><FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={trainingForm.control} name="pdfUrl" render={({ field }) => (
                      <FormItem><FormLabel>URL do PDF Adicional (Opcional)</FormLabel><FormControl><Input placeholder="https://exemplo.com/material.pdf" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={trainingForm.control} name="prerequisiteIds" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Pré-requisitos (Opcional)</FormLabel>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <FormControl>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                  {field.value && field.value.length > 0 
                                    ? `${field.value.length} selecionado(s)`
                                    : "Selecionar pré-requisitos"
                                  }
                                </Button>
                              </FormControl>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-full" align="start">
                               <ScrollArea className="h-48">
                                {allTrainings.filter(t => t.id !== trainingForm.getValues('id')).map(t => (
                                  <DropdownMenuCheckboxItem
                                    key={t.id}
                                    checked={field.value?.includes(t.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), t.id])
                                        : field.onChange(field.value?.filter(id => id !== t.id));
                                    }}
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    {t.title}
                                  </DropdownMenuCheckboxItem>
                                ))}
                               </ScrollArea>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Quiz (Opcional)</h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ questionText: '', options: ['', '', '', ''], correctAnswerIndex: 0 })}>
                          <Plus className="mr-2 h-4 w-4" /> Adicionar Pergunta
                        </Button>
                      </div>
                      {fields.map((field, index) => (
                        <div key={field.id} className="space-y-3 rounded-md border bg-muted/50 p-4 relative">
                          <FormField control={trainingForm.control} name={`quiz.questions.${index}.questionText`} render={({ field }) => (
                            <FormItem><FormLabel>Pergunta {index + 1}</FormLabel><FormControl><Textarea placeholder="Qual é a pergunta?" {...field} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[0, 1, 2, 3].map(optIndex => (
                              <FormField key={optIndex} control={trainingForm.control} name={`quiz.questions.${index}.options.${optIndex}`} render={({ field }) => (
                                <FormItem><FormLabel>Opção {optIndex + 1}</FormLabel><FormControl><Input placeholder={`Opção ${optIndex + 1}`} {...field} /></FormControl></FormItem>
                              )}/>
                            ))}
                          </div>
                          <FormField control={trainingForm.control} name={`quiz.questions.${index}.correctAnswerIndex`} render={({ field }) => (
                            <FormItem><FormLabel>Resposta Correta</FormLabel><FormControl><RadioGroup onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)} className="flex items-center gap-x-4">
                              {[0, 1, 2, 3].map(optIndex => (
                                <FormItem key={optIndex} className="flex items-center space-x-2"><FormControl><RadioGroupItem value={String(optIndex)} /></FormControl><FormLabel className="font-normal">Opção {optIndex + 1}</FormLabel></FormItem>
                              ))}
                            </RadioGroup></FormControl><FormMessage /></FormItem>
                          )}/>
                          <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
              </ScrollArea>
              <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button type="submit" disabled={trainingForm.formState.isSubmitting}>
                  {trainingForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isTrainingEditMode ? 'Salvar Alterações' : 'Criar Treinamento'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Create/Edit Playlist Dialog */}
      <Dialog open={playlistFormOpen} onOpenChange={setPlaylistFormOpen}>
        <DialogContent className="max-w-2xl flex flex-col h-[90vh]">
           <DialogHeader className="p-6 pb-4 shrink-0 border-b">
            <DialogTitle>{isPlaylistEditMode ? 'Editar Playlist' : 'Criar Nova Playlist'}</DialogTitle>
            <DialogDescription>Preencha o nome, descrição e selecione os treinamentos para a playlist.</DialogDescription>
          </DialogHeader>
          <Form {...playlistForm}>
            <form onSubmit={playlistForm.handleSubmit(onPlaylistSubmit)} className="flex flex-col flex-1 overflow-y-hidden">
               <ScrollArea className="flex-1 px-6">
                 <div className="space-y-6 py-6">
                    <FormField control={playlistForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Nome da Playlist</FormLabel><FormControl><Input placeholder="Ex: Onboarding de Vendas" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={playlistForm.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Descrição (Opcional)</FormLabel><FormControl><Textarea placeholder="Descreva o objetivo desta playlist de treinamentos." {...field} rows={3} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={playlistForm.control} name="trainingIds" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Treinamentos</FormLabel>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <FormControl>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                  {field.value && field.value.length > 0 
                                    ? `${field.value.length} treinamento(s) selecionado(s)`
                                    : "Selecionar treinamentos"
                                  }
                                </Button>
                              </FormControl>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                               <ScrollArea className="h-64">
                                {allTrainings.map(t => (
                                  <DropdownMenuCheckboxItem
                                    key={t.id}
                                    checked={field.value?.includes(t.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), t.id])
                                        : field.onChange(field.value?.filter(id => id !== t.id));
                                    }}
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    {t.title}
                                  </DropdownMenuCheckboxItem>
                                ))}
                               </ScrollArea>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                 </div>
              </ScrollArea>
              <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button type="submit" disabled={playlistForm.formState.isSubmitting}>
                  {playlistForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isPlaylistEditMode ? 'Salvar Alterações' : 'Criar Playlist'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assign Training Dialog */}
      <Dialog open={assignTrainingDialogOpen} onOpenChange={setAssignTrainingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Treinamento</DialogTitle>
            <DialogDescription>Selecione os usuários para o treinamento: <span className="font-semibold">{selectedTrainingForAssign?.title}</span></DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-72 w-full"><div className="space-y-4 pr-6">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between">
                  <div><Label htmlFor={`user-train-${u.id}`}>{u.name}</Label><p className="text-xs text-muted-foreground">{u.email}</p></div>
                  <Checkbox id={`user-train-${u.id}`} onCheckedChange={(checked) => handleUserSelection(u.id, !!checked)} />
                </div>
              ))}
            </div></ScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={handleAssignTraining} disabled={isAssigning || selectedUserIds.length === 0}>
              {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isAssigning ? 'Atribuindo...' : `Atribuir a ${selectedUserIds.length} usuário(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Assign Playlist Dialog */}
      <Dialog open={assignPlaylistDialogOpen} onOpenChange={setAssignPlaylistDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Playlist</DialogTitle>
            <DialogDescription>Selecione os usuários para a playlist: <span className="font-semibold">{selectedPlaylist?.name}</span></DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-72 w-full"><div className="space-y-4 pr-6">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between">
                  <div><Label htmlFor={`user-playlist-${u.id}`}>{u.name}</Label><p className="text-xs text-muted-foreground">{u.email}</p></div>
                  <Checkbox id={`user-playlist-${u.id}`} onCheckedChange={(checked) => handleUserSelection(u.id, !!checked)} />
                </div>
              ))}
            </div></ScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={handleAssignPlaylist} disabled={isAssigning || selectedUserIds.length === 0}>
              {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isAssigning ? 'Atribuindo...' : `Atribuir a ${selectedUserIds.length} usuário(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* View Assigned Users Dialog */}
      <Dialog open={viewUsersDialogOpen} onOpenChange={setViewUsersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alunos Atribuídos</DialogTitle>
            <DialogDescription>
              Status dos alunos para o treinamento: <span className="font-semibold">{selectedTrainingForView?.title}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Card>
              <CardContent className="p-0 max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAssignedUsers ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                        </TableCell>
                      </TableRow>
                    ) : assignedUsers.length > 0 ? (
                      assignedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant[user.quizStatus || 'default'] || 'outline'}>{statusText[user.quizStatus || 'default']}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {user.quizScore !== null && user.quizScore !== undefined ? `${user.quizScore}%` : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                          Nenhum aluno atribuído a este treinamento.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUsersDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
