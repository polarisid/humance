
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getReviewDetails, submitReview, type PerformanceReview, approveReview, requestReviewAdjustment, getDiaryEntriesForReview } from '../actions';
import type { LoggedUser } from '@/app/actions';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, Building, Calendar, Star, ArrowUp, ArrowDown, Minus, AlertCircle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ReviewRadarChart } from '@/components/review-radar-chart';
import type { DiaryEntry } from '@/app/diario/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';


const generatePeriodOptions = () => {
    const options = new Set<string>();
    let date = new Date();

    // Add past 12 months
    for (let i = 0; i < 12; i++) {
        options.add(format(date, 'yyyy-MM'));
        date.setMonth(date.getMonth() - 1);
    }
    
    return Array.from(options)
        .sort()
        .reverse()
        .map(periodValue => {
            const periodDate = new Date(`${periodValue}-02`); // Use day 02 to avoid timezone issues
            const periodLabel = format(periodDate, "MMMM' de 'yyyy", { locale: ptBR });
            return { value: periodValue, label: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1) };
        });
}


export default function ReviewDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const reviewId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [user, setUser] = useState<LoggedUser | null>(null);
    const [review, setReview] = useState<PerformanceReview | null>(null);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [feedbackForEmployee, setFeedbackForEmployee] = useState('');
    
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New states for approval flow
    const [isApproving, setIsApproving] = useState(false);
    const [isRequestingAdjustment, setIsRequestingAdjustment] = useState(false);
    const [adjustmentFeedback, setAdjustmentFeedback] = useState('');
    const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
    
    // Diary entries state
    const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
    const [diaryPeriod, setDiaryPeriod] = useState(format(new Date(), 'yyyy-MM'));
    const [loadingDiary, setLoadingDiary] = useState(false);
    const periodOptions = useMemo(generatePeriodOptions, []);
    
    // Roles
    const isManager = user?.role === 'Gerente';
    const isAdmin = user?.role === 'Administrador';
    const isCollaborator = user?.role === 'Colaborador';
    
    // Status checks
    const reviewIsPending = review?.status === 'Pendente';
    const reviewNeedsAdjustment = review?.status === 'Ajuste Solicitado';
    const reviewInApproval = review?.status === 'Em Aprovação';
    const reviewIsCompleted = review?.status === 'Concluída';

    const isFormEditable = isManager && (reviewIsPending || reviewNeedsAdjustment);

    const averageScore = useMemo(() => {
        const currentScores = Object.values(scores);
        if (currentScores.length > 0) {
            const total = currentScores.reduce((sum, score) => sum + score, 0);
            return total / currentScores.length;
        }
        if (review?.averageScore) {
            return review.averageScore;
        }
        return null;
    }, [scores, review?.averageScore]);

    const fetchDiaryEntriesForPeriod = useCallback(async (employeeId: string, period: string) => {
        setLoadingDiary(true);
        try {
            const newEntries = await getDiaryEntriesForReview(employeeId, period);
            setDiaryEntries(newEntries);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Não foi possível carregar as observações do diário.", variant: "destructive" });
        } finally {
            setLoadingDiary(false);
        }
    }, [toast]);
    
    const handleDiaryPeriodChange = (newPeriod: string) => {
        if (!review) return;
        setDiaryPeriod(newPeriod);
        fetchDiaryEntriesForPeriod(review.employeeId, newPeriod);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const reviewData = await getReviewDetails(reviewId);
            if (reviewData) {
                setReview(reviewData);
                const initialScores: Record<string, number> = {};
                if (reviewData.scores && Object.keys(reviewData.scores).length > 0) {
                     Object.entries(reviewData.scores).forEach(([key, value]) => {
                        initialScores[key] = value;
                    });
                } else {
                    reviewData.templateItems.forEach((_, index) => {
                        initialScores[String(index)] = 5;
                    });
                }
                setScores(initialScores);
                setFeedbackForEmployee(reviewData.feedbackForEmployee || '');
                
                // Set initial diary entries and period from review data
                if (reviewData.period) {
                    setDiaryPeriod(reviewData.period);
                    // Initial fetch for diary entries for the review's period
                    await fetchDiaryEntriesForPeriod(reviewData.employeeId, reviewData.period);
                } else {
                    // Fallback if review has no period
                    setDiaryEntries([]);
                }
                

            } else {
                toast({ title: "Erro", description: "Avaliação não encontrada.", variant: "destructive" });
                router.push('/avaliacoes');
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Não foi possível carregar os dados da avaliação.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [reviewId, router, toast, fetchDiaryEntriesForPeriod]);

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (!userString) {
            router.push('/');
            return;
        }
        const loggedUser: LoggedUser = JSON.parse(userString);
        setUser(loggedUser);
        fetchData();
    }, [fetchData, router]);

    const handleSubmitReview = async () => {
        if (!review || !feedbackForEmployee) {
            toast({ title: "Atenção", description: "O campo de feedback para o colaborador é obrigatório.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await submitReview({
                reviewId,
                scores,
                feedbackForEmployee,
            });

            if (result.success) {
                toast({ title: "Sucesso!", description: result.message });
                router.push('/avaliacoes');
            } else {
                toast({ title: "Erro", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Ocorreu um erro ao enviar a avaliação.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleApprove = async () => {
        if (!review) return;
        setIsApproving(true);
        try {
            const result = await approveReview({ reviewId: review.id });
            if (result.success) {
                toast({ title: "Sucesso!", description: result.message });
                router.push('/avaliacoes');
            } else {
                toast({ title: "Erro", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Não foi possível aprovar a avaliação.", variant: "destructive" });
        } finally {
            setIsApproving(false);
        }
    };

    const handleRequestAdjustment = async () => {
        if (!review || !adjustmentFeedback.trim()) {
            toast({ title: "Atenção", description: "O feedback para ajuste é obrigatório.", variant: "destructive" });
            return;
        }
        setIsRequestingAdjustment(true);
        try {
            const result = await requestReviewAdjustment({ reviewId: review.id, feedback: adjustmentFeedback });
            if (result.success) {
                toast({ title: "Sucesso!", description: result.message });
                setAdjustmentDialogOpen(false);
                setAdjustmentFeedback('');
                router.push('/avaliacoes');
            } else {
                toast({ title: "Erro", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Não foi possível solicitar o ajuste.", variant: "destructive" });
        } finally {
            setIsRequestingAdjustment(false);
        }
    };


    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!review) {
        return <div>Avaliação não encontrada.</div>
    }

    if (isCollaborator && !reviewIsCompleted) {
        return (
            <div className="flex justify-center items-center h-full">
                <Alert className="max-w-lg">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Avaliação em Andamento</AlertTitle>
                    <AlertDescription>
                        Sua avaliação de desempenho para o período de {review.period} ainda não foi finalizada. Você será notificado quando o feedback estiver disponível.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }


    return (
        <div className="space-y-6">
            <PageHeader
                title="Detalhes da Avaliação"
                description={`Visualizando os detalhes da avaliação para ${review.employeeName}`}
            />
            
             {isManager && reviewNeedsAdjustment && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Ajustes Solicitados pelo RH</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap">
                        {review.adminFeedbackForManager || "O RH solicitou ajustes. Por favor, revise a avaliação e submeta novamente."}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{review.templateName}</CardTitle>
                            <CardDescription>Avalie cada item de 0 a 10, sendo 0 "Muito a melhorar" e 10 "Excelente".</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {review.templateItems.map((item, index) => {
                                const previousScore = review.previousScores?.[String(index)];
                                const hasPreviousScore = previousScore !== undefined && previousScore !== null;
                                const previousScorePosition = hasPreviousScore ? `${previousScore * 10}%` : '0%';

                                return (
                                <div key={index} className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <Label htmlFor={`item-${index}`} className="text-base">{item.text}</Label>
                                            {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                                        </div>
                                        <div className="flex items-center gap-2 text-right">
                                            {isCollaborator && reviewIsCompleted && previousScore !== undefined && (
                                                (() => {
                                                    const currentScore = scores[String(index)];
                                                    const scoreDiff = currentScore - previousScore;
                                                    if (scoreDiff > 0) {
                                                        return <span className="text-sm font-semibold text-green-600">(+{scoreDiff})</span>
                                                    }
                                                    if (scoreDiff < 0) {
                                                        return <span className="text-sm font-semibold text-red-600">({scoreDiff})</span>
                                                    }
                                                    return <span className="text-sm font-semibold text-muted-foreground">(&#8211;)</span>;
                                                })()
                                            )}
                                            <span className="font-bold text-lg text-primary w-6 text-center">{scores[String(index)]}</span>
                                        </div>
                                    </div>
                                    <div className="relative pt-2">
                                        <Slider
                                            id={`item-${index}`}
                                            min={0}
                                            max={10}
                                            step={1}
                                            value={[scores[String(index)]]}
                                            onValueChange={(value) => setScores(prev => ({...prev, [String(index)]: value[0]}))}
                                            disabled={!isFormEditable}
                                            className="w-full"
                                        />
                                        {hasPreviousScore && (
                                            <div
                                                className={cn(
                                                    "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-muted-foreground/50 pointer-events-none",
                                                    "transform -translate-x-1/2" // center the marker
                                                )}
                                                style={{ left: previousScorePosition }}
                                                title={`Nota Anterior: ${previousScore}`}
                                            />
                                        )}
                                    </div>
                                </div>
                            )})}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Feedback Final para o Colaborador</CardTitle>
                            <CardDescription>
                                {isFormEditable ? "Escreva o feedback diretamente. Este texto será visível para o colaborador após aprovação do RH." : "Este é o feedback que foi/será compartilhado com o colaborador."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="Descreva os pontos fortes, áreas a desenvolver e próximos passos..."
                                rows={10}
                                value={feedbackForEmployee}
                                onChange={(e) => setFeedbackForEmployee(e.target.value)}
                                disabled={!isFormEditable && !reviewIsCompleted}
                                readOnly={reviewIsCompleted}
                            />
                        </CardContent>
                        {isFormEditable && (
                             <CardFooter className="justify-end">
                                 <Button onClick={handleSubmitReview} disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {reviewNeedsAdjustment ? 'Reenviar para Aprovação' : 'Enviar para Aprovação'}
                                 </Button>
                            </CardFooter>
                        )}
                        {isAdmin && reviewInApproval && (
                            <CardFooter className="justify-end gap-2">
                                <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" disabled={isApproving}>Solicitar Ajuste</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Solicitar Ajuste na Avaliação</DialogTitle>
                                            <DialogDescription>
                                                Descreva os pontos que o gestor precisa ajustar nesta avaliação antes da aprovação final. Esta mensagem será visível para o gestor.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <Textarea
                                            placeholder="Ex: Por favor, adicione exemplos específicos no feedback sobre proatividade..."
                                            rows={5}
                                            value={adjustmentFeedback}
                                            onChange={(e) => setAdjustmentFeedback(e.target.value)}
                                        />
                                        <DialogFooter>
                                            <Button onClick={handleRequestAdjustment} disabled={isRequestingAdjustment}>
                                                {isRequestingAdjustment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Enviar Solicitação de Ajuste
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                <Button onClick={handleApprove} disabled={isApproving}>
                                    {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Aprovar e Finalizar
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                     <Card>
                        <CardHeader>
                            <CardTitle>Informações</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{review.employeeName}</span></div>
                            <div className="flex items-center gap-3"><Building className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{review.employeeDepartment}</span></div>
                            <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Período: {review.period}</span></div>
                        </CardContent>
                    </Card>
                    
                    {averageScore !== null && (
                        <Card>
                            <CardHeader className="flex-row items-center justify-between pb-2">
                                <CardTitle className="text-base font-medium">Nota Final</CardTitle>
                                <Star className="h-4 w-4 text-yellow-400" />
                            </CardHeader>
                            <CardContent>
                                {(() => {
                                    const avgDiff = review.previousAverageScore !== undefined ? averageScore - review.previousAverageScore : null;
                                    return (
                                        <>
                                            <div className="flex items-baseline gap-2">
                                                <div className="text-4xl font-bold text-primary">{averageScore.toFixed(1)}</div>
                                                {isCollaborator && reviewIsCompleted && avgDiff !== null && (
                                                    <div className={`flex items-center gap-1 font-bold ${avgDiff > 0 ? 'text-green-600' : avgDiff < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                                        {avgDiff > 0 ? <ArrowUp className="h-4 w-4" /> : avgDiff < 0 ? <ArrowDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                                        <span>{Math.abs(avgDiff).toFixed(1)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Média dos indicadores avaliados.
                                                {isCollaborator && reviewIsCompleted && review.previousAverageScore !== undefined && (
                                                    ` Comparado com ${review.previousAverageScore.toFixed(1)} da avaliação anterior.`
                                                )}
                                            </p>
                                        </>
                                    )
                                })()}
                            </CardContent>
                        </Card>
                    )}

                    {(reviewIsCompleted || reviewInApproval || isManager || reviewNeedsAdjustment) && review.templateItems.length > 0 && Object.keys(scores).length > 0 && (
                        <ReviewRadarChart items={review.templateItems} scores={scores} />
                    )}

                    {!isCollaborator && (
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div>
                                        <CardTitle>Histórico de Observações</CardTitle>
                                        <CardDescription>Filtre e visualize os registros do diário.</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-full sm:w-48">
                                            <Select value={diaryPeriod} onValueChange={handleDiaryPeriodChange}>
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
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-48">
                                    {loadingDiary ? (
                                         <div className="flex justify-center items-center h-full">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    ) : (
                                        <div className="space-y-4 pr-4">
                                            {diaryEntries.length > 0 ? (
                                                diaryEntries.map(entry => (
                                                    <div key={entry.id}>
                                                        <p className="text-sm text-foreground whitespace-pre-wrap">{entry.text}</p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                          <span>{entry.authorName}</span>
                                                          <span>-</span>
                                                          <span>{format(parseISO(entry.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro encontrado no diário para este período.</p>
                                            )}
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                    
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Status Atual: {review.status}</AlertTitle>
                        <AlertDescription>
                            {reviewInApproval && "A avaliação está aguardando aprovação do RH."}
                            {reviewIsCompleted && "Esta avaliação foi finalizada e não pode mais ser editada."}
                            {isFormEditable && "Preencha todos os campos e envie para aprovação do RH."}
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        </div>
    );
}
