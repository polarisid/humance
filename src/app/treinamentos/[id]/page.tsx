
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTrainingById, getMyTrainings, updateTrainingStatus, getAssignedUsersForTraining, resetQuizAttempt, submitQuizResult, type Training, type UserTraining, type AssignedUser } from '../actions';
import type { LoggedUser } from '@/app/actions';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, RefreshCw, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';


function getYoutubeEmbedUrl(url: string | undefined): string | null {
    if (!url) return null;
    let videoId;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
            videoId = urlObj.searchParams.get('v');
        } else {
            return null;
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } catch (error) {
        return null;
    }
}

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

function AssignedUsersTable({ trainingId }: { trainingId: string }) {
    const { toast } = useToast();
    const [users, setUsers] = useState<AssignedUser[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const fetchedUsers = await getAssignedUsersForTraining(trainingId);
        setUsers(fetchedUsers);
        setLoading(false);
    }, [trainingId]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleReset = async (userTrainingId: string) => {
        const result = await resetQuizAttempt(userTrainingId);
        if (result.success) {
            toast({ title: 'Sucesso!', description: result.message });
            fetchUsers();
        } else {
            toast({ title: 'Erro', description: result.message, variant: 'destructive' });
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Alunos Atribuídos</CardTitle>
                <CardDescription>Gerencie o progresso dos alunos neste treinamento.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Nota</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                        ) : users.length > 0 ? (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant[user.quizStatus || 'default'] || 'outline'}>{statusText[user.quizStatus || 'default']}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">{user.quizScore !== null && user.quizScore !== undefined ? `${user.quizScore}%` : '-'}</TableCell>
                                    <TableCell className="text-right">
                                        {user.quizStatus === 'failed' && (
                                            <Button size="sm" variant="outline" onClick={() => handleReset(user.userTrainingId)}>
                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                Resetar
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum aluno atribuído.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

export default function TrainingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const trainingId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [training, setTraining] = useState<Training | null>(null);
    const [userTraining, setUserTraining] = useState<UserTraining | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [embedUrl, setEmbedUrl] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchTrainingData = useCallback(async (user: LoggedUser) => {
        const [trainingData, myTrainings] = await Promise.all([
            getTrainingById(trainingId),
            getMyTrainings(user)
        ]);
        
        if (trainingData) {
            setTraining(trainingData);
            setEmbedUrl(getYoutubeEmbedUrl(trainingData.youtubeUrl));

            const assignedTraining = myTrainings.find(t => t.id === trainingId);
            if (assignedTraining) {
                setUserTraining(assignedTraining);
            } else if (user.role !== 'Administrador') {
                toast({ title: "Acesso Negado", description: "Você não tem permissão para ver este treinamento.", variant: "destructive" });
                router.push('/treinamentos');
                return;
            }
        } else {
             toast({ title: "Erro", description: "Treinamento não encontrado.", variant: "destructive" });
             router.push('/treinamentos');
             return;
        }
        setLoading(false);
    }, [trainingId, router, toast]);

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (!userString) {
            router.push('/');
            return;
        }
        const user: LoggedUser = JSON.parse(userString);
        setIsAdmin(user.role === 'Administrador');
        setLoading(true);
        fetchTrainingData(user);
    }, [trainingId, router, toast, fetchTrainingData]);

    const handleMarkAsComplete = async () => {
        if (!userTraining) return;
        const result = await updateTrainingStatus({ userTrainingId: userTraining.userTrainingId, completed: true });
        if (result.success) {
            toast({ title: "Parabéns!", description: "Treinamento concluído com sucesso!" });
            setUserTraining(prev => prev ? {...prev, completed: true} : null);
        } else {
            toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
        }
    };

    const handleAnswerChange = (questionIndex: number, answerIndex: number) => {
        setAnswers(prev => ({...prev, [questionIndex]: answerIndex}));
    };

    const handleSubmitQuiz = async () => {
        if (!training?.quiz?.questions || !userTraining) return;

        setIsSubmitting(true);
        const result = await submitQuizResult({
            userTrainingId: userTraining.userTrainingId,
            trainingId: training.id,
            answers: answers,
        });
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: "Sucesso!", description: "Seu resultado foi registrado." });
            // Refetch to show the results
            const userString = localStorage.getItem('user');
            if(userString) {
                const user: LoggedUser = JSON.parse(userString);
                fetchTrainingData(user);
            }
        } else {
            toast({ title: "Erro", description: result.message, variant: "destructive" });
        }
    };


    if (loading) {
        return <div className="flex h-full w-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!training) {
        return <div>Treinamento não encontrado.</div>;
    }

    const hasQuiz = training.quiz && training.quiz.questions.length > 0;
    const quizDisabled = userTraining?.quizStatus === 'passed' || userTraining?.quizStatus === 'failed';
    const showQuizResult = quizDisabled;

    return (
        <div className="space-y-8">
            <PageHeader title={training.title} />

             <Tabs defaultValue="content" className="w-full">
                <TabsList className="max-w-sm">
                    <TabsTrigger value="content">Conteúdo</TabsTrigger>
                    {!isAdmin && hasQuiz && userTraining && (
                        <TabsTrigger value="quiz" disabled={!userTraining}>Prova</TabsTrigger>
                    )}
                    {isAdmin && <TabsTrigger value="students">Alunos</TabsTrigger>}
                </TabsList>

                <TabsContent value="content" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            {embedUrl && (
                                <Card>
                                    <CardHeader><CardTitle>Vídeo de Apoio</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="aspect-video">
                                            <iframe
                                                className="w-full h-full rounded-md"
                                                src={embedUrl}
                                                title="YouTube video player"
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                allowFullScreen
                                            ></iframe>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <Card>
                                <CardHeader><CardTitle>Descrição do Treinamento</CardTitle></CardHeader>
                                <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                                   <p>{training.description}</p>
                                </CardContent>
                            </Card>

                            {training.pdfUrl && (
                                <Card>
                                    <CardHeader><CardTitle>Recursos Adicionais</CardTitle></CardHeader>
                                    <CardContent>
                                        <Button asChild>
                                            <a href={training.pdfUrl} target="_blank" rel="noopener noreferrer">
                                                <FileText className="mr-2 h-4 w-4" />
                                                Visualizar PDF de Apoio
                                            </a>
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                        
                        <div className="space-y-8">
                            {userTraining && (
                                <Card>
                                    <CardHeader><CardTitle>Status do Treinamento</CardTitle></CardHeader>
                                    <CardContent>
                                        {userTraining.completed ? (
                                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                                <CheckCircle className="h-5 w-5" />
                                                <p className="font-medium">Treinamento concluído!</p>
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground">Este treinamento está pendente.</p>
                                        )}
                                    </CardContent>
                                    {!userTraining.completed && !hasQuiz && (
                                        <CardFooter>
                                            <Button onClick={handleMarkAsComplete} className="w-full">
                                                Marcar como Concluído
                                            </Button>
                                        </CardFooter>
                                    )}
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>
                
                {!isAdmin && hasQuiz && userTraining && (
                    <TabsContent value="quiz" className="mt-6">
                        <Card>
                             <CardHeader>
                                <CardTitle>Prova: {training.title}</CardTitle>
                                <CardDescription>Teste seus conhecimentos sobre o material. A nota mínima para aprovação é 70%.</CardDescription>
                            </CardHeader>
                            {training.quiz && (
                                <>
                                <CardContent className="space-y-6">
                                    {training.quiz.questions.map((q, qIndex) => (
                                        <div key={qIndex} className={`p-4 rounded-md border ${showQuizResult ? (answers[qIndex] === q.correctAnswerIndex ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-500/30' : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-500/30') : 'bg-background'}`}>
                                            <p className="font-medium mb-3">{qIndex + 1}. {q.questionText}</p>
                                            <RadioGroup onValueChange={(val) => handleAnswerChange(qIndex, Number(val))} disabled={quizDisabled} value={answers[qIndex]?.toString()}>
                                                {q.options.map((opt, oIndex) => (
                                                    <div key={oIndex} className="flex items-center space-x-2">
                                                        <RadioGroupItem value={String(oIndex)} id={`q${qIndex}o${oIndex}`} />
                                                        <Label htmlFor={`q${qIndex}o${oIndex}`} className="font-normal cursor-pointer">{opt}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                            {showQuizResult && answers[qIndex] !== q.correctAnswerIndex && (
                                                <p className="text-sm text-red-600 dark:text-red-400 mt-2 font-medium">
                                                    Resposta correta: {q.options[q.correctAnswerIndex]}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                                <CardFooter className="flex-col items-stretch gap-4">
                                    {!quizDisabled && (
                                        <Button onClick={handleSubmitQuiz} disabled={isSubmitting || Object.keys(answers).length !== training.quiz.questions.length}>
                                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Enviar Respostas
                                        </Button>
                                    )}
                                    {showQuizResult && userTraining.quizStatus && userTraining.quizScore !== undefined && (
                                        <Alert variant={userTraining.quizStatus === 'passed' ? 'default' : 'destructive'} className="bg-card">
                                            {userTraining.quizStatus === 'passed' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                            <AlertTitle>Resultado Final</AlertTitle>
                                            <AlertDescription>
                                                Sua nota foi {userTraining.quizScore.toFixed(0)}%.
                                                {userTraining.quizStatus === 'passed' && " Parabéns, você foi aprovado!"}
                                                {userTraining.quizStatus === 'failed' && " Você não atingiu a nota mínima. Peça ao seu gestor para liberar uma nova tentativa."}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </CardFooter>
                                </>
                            )}
                        </Card>
                    </TabsContent>
                )}
                
                {isAdmin && (
                    <TabsContent value="students" className="mt-6">
                        <AssignedUsersTable trainingId={trainingId} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
