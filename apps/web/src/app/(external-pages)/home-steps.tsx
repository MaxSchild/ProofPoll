import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface HomeStep {
  title: string;
  description: string;
}

interface HomeStepsProps {
  steps: HomeStep[];
}

export function HomeSteps({ steps }: HomeStepsProps) {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Researchers can already register their study plan in advance. AllCounted
            also records the answers as they come in.
          </p>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full shadow-none">
                <CardHeader className="space-y-4">
                  <span className="flex size-8 items-center justify-center rounded-full border font-mono text-sm">
                    {index + 1}
                  </span>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="leading-6">{step.description}</CardDescription>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
