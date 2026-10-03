import { HomeCTA } from './home-cta';
import { HomeSteps, type HomeStep } from './home-steps';
import { HomeHero } from './home-hero';

const steps: HomeStep[] = [
  {
    title: 'Register',
    description:
      'Write down your questions, planned sample size and the rules for excluding answers. They are fixed the moment you open the poll.',
  },
  {
    title: 'Record',
    description:
      'Every answer gets a number and a timestamp as it arrives. Nobody, including you and us, can change or delete it afterwards.',
  },
  {
    title: 'Check',
    description:
      'Reviewers compare the published dataset with the record and see at once whether any answers are missing.',
  },
];

export default function HomePage() {
  return (
    <div>
      <HomeHero />
      <HomeSteps steps={steps} />
      <HomeCTA />
    </div>
  );
}
