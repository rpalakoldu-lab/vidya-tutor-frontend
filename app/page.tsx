import TutorInterface from '@/components/TutorInterface';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-slate-950">
      <div className="absolute top-8 left-8 text-xs font-mono text-slate-600 tracking-widest uppercase">
        Project: Vidya Engine Alpha
      </div>
      <TutorInterface />
    </main>
  );
}
