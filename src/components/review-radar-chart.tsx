'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface ReviewRadarChartProps {
  items: { text: string }[];
  scores: Record<string, number>;
}

export function ReviewRadarChart({ items, scores }: ReviewRadarChartProps) {
  const chartData = items.map((item, index) => ({
    subject: item.text,
    score: scores[String(index)] || 0,
    fullMark: 10,
  }));

  const chartConfig = {
    score: {
      label: "Nota",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const tickFormatter = (value: string) => {
      if (value.length > 15) {
          return `${value.substring(0, 12)}...`;
      }
      return value;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapa de Competências</CardTitle>
        <CardDescription>
          Visualização das notas por indicador de avaliação.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <RadarChart data={chartData}>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tickFormatter={tickFormatter} tick={{ fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tickCount={6} />
            <Radar
              dataKey="score"
              fill="var(--color-score)"
              fillOpacity={0.6}
              stroke="var(--color-score)"
              name="Nota"
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
