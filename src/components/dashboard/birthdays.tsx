'use client';

import { useEffect, useState } from 'react';
import { Cake, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBirthdaysOfTheMonth } from '@/app/dashboard/actions';

interface BirthdayPerson {
  name: string;
  date: string;
  initials: string;
}

export function Birthdays() {
  const [birthdayFolks, setBirthdayFolks] = useState<BirthdayPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await getBirthdaysOfTheMonth();
      setBirthdayFolks(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-headline text-lg">Aniversariantes do Mês</CardTitle>
        <Cake className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center">
        {loading ? (
          <div className="flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : birthdayFolks.length > 0 ? (
          <div className="space-y-4">
            {birthdayFolks.map((person) => (
              <div key={person.name} className="flex items-center gap-4">
                <Avatar className="h-9 w-9">
                  <AvatarImage data-ai-hint="person" src={`https://placehold.co/40x40.png`} alt={person.name} />
                  <AvatarFallback>{person.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-none">{person.name}</p>
                  <p className="text-sm text-muted-foreground">{person.date}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex justify-center items-center">
            <p className="text-sm text-muted-foreground text-center">
              Nenhum aniversariante este mês.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
