
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getQuizData, submitQuizResult, type QuizPageData } from '../../actions';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function QuizPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const userTrainingId = Array.isArray(params.userTrainingId) ? params.userTrainingId[0] : params.userTrainingId;

    const [quizData, setQuizData] = useState<QuizPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Derived state
    const training = quizData?.training;
    const quizStatus = quizData?.quizStatus;
    const quizScore = quizData?.quizScore;
    
    const quizDisabled = quizStatus === 'passed' || quizStatus === 'failed';
    const showQuizResult = quizDisabled;

    const fetchQuiz = useCallback(async () => {
        setLoading(true);
        if (!userTrainingId) {
            toast({ title: "Erro", description: "ID do quiz inválido.", variant: "destructive" });
            router.push('/treinamentos');
            return;
        }
        
        const data = await getQuizData(userTrainingId);

        if (data) {
            setQuizData(data);
        } else {
            toast({ title: "Erro", description: "Quiz não encontrado ou você não tem permissão.", variant: "destructive" });
            router.push('/treinamentos');
        }
        setLoading(false);
    }, [userTrainingId, router, toast]);

    useEffect(() => {
        fetchQuiz();
    }, [fetchQuiz]);

    const handleAnswerChange = (questionIndex: number, answerIndex: number) => {
        setAnswers(prev => ({...prev, [questionIndex]: answerIndex}));
    };

    const handleSubmitQuiz = async () => {
        if (!training?.quiz?.questions || !userTrainingId) return;

        setIsSubmitting(true);
        const result = await submitQuizResult({
            userTrainingId: userTrainingId,
            trainingId: training.id,
            answers: answers,
        });
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: "Sucesso!", description: "Seu resultado foi registrado." });
            // Refetch to show the results
            fetchQuiz();
        } else {
            toast({ title: "Erro", description: result.message, variant: "destructive" });
        }
    };
    
    if (loading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }
    
    if (!quizData || !training?.quiz?.questions) {
        return (
            <Card className="w-full max-w-2xl">
                 <CardHeader>
                    <CardTitle>Quiz não encontrado</CardTitle>
                    <CardDescription>Não foi possível carregar as questões do quiz.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button asChild><Link href="/treinamentos">Voltar aos Treinamentos</Link></Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-3xl">
            <CardHeader>
                <CardTitle>Quiz: {training.title}</CardTitle>
                <CardDescription>Teste seus conhecimentos sobre o material. A nota mínima para aprovação é 70%.</CardDescription>
            </CardHeader>
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
                {showQuizResult && (
                    <Alert variant={quizStatus === 'passed' ? 'default' : 'destructive'} className="bg-card">
                        {quizStatus === 'passed' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        <AlertTitle>Resultado Final</AlertTitle>
                        <AlertDescription>
                            Sua nota foi {quizScore?.toFixed(0)}%.
                            {quizStatus === 'passed' && " Parabéns, você foi aprovado!"}
                            {quizStatus === 'failed' && " Você não atingiu a nota mínima. Peça ao seu gestor para liberar uma nova tentativa."}
                        </AlertDescription>
                    </Alert>
                )}
            </CardFooter>
        </Card>
    );
}
