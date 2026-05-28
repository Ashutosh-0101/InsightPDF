import Link from 'next/link'
import {
  Upload,
  MessageCircle,
  Zap,
  Bot,
  Gift,
  Shield,
  History,
  GraduationCap,
  Briefcase,
  FlaskConical,
  Users,
  ArrowRight,
  FileText,
  Sparkles,
  CheckCircle,
  ChevronDown,
  Clock,
  Target,
  Lock,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 font-bold text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          InsightPDF AI
        </div>

        {/* Nav links — hidden on mobile */}
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#use-cases" className="transition-colors hover:text-foreground">
            Use cases
          </a>
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/auth/login" />}
            nativeButton={false}
          >
            Sign in
          </Button>
          <Button size="sm" render={<Link href="/auth/signup" />} nativeButton={false}>
            Get started free
          </Button>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-background to-background dark:from-indigo-950/20 dark:via-background dark:to-background">
      {/* Background glow blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-900/20" />
        <div className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-violet-200/20 blur-3xl dark:bg-violet-900/10" />
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-28 pt-24 text-center">
        {/* Eyebrow badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
          <Sparkles className="h-3 w-3" />
          Powered by Google Gemini AI — 100% Free
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl">
          Chat with Any{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">
            PDF
          </span>{' '}
          Instantly
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Upload your document, ask questions in plain English, get accurate answers — powered
          by Google Gemini AI.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            className="gap-2 px-8 text-base"
            render={<Link href="/auth/signup" />}
            nativeButton={false}
          >
            Start for Free
            <ArrowRight className="h-4 w-4" />
          </Button>
          <a
            href="#how-it-works"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'gap-2 px-8 text-base'
            )}
          >
            See How It Works
            <ChevronDown className="h-4 w-4" />
          </a>
        </div>

        {/* Trust line */}
        <p className="mt-8 text-xs text-muted-foreground">
          No credit card required · Secure · Private
        </p>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      num: '01',
      icon: <Upload className="h-6 w-6" />,
      title: 'Upload your PDF',
      desc: 'Drag and drop any PDF up to 10 MB. Your document is processed and indexed automatically in seconds.',
    },
    {
      num: '02',
      icon: <MessageCircle className="h-6 w-6" />,
      title: 'Ask any question',
      desc: 'Type your question in plain English — no special syntax needed. Ask about specific sections, summaries, or details.',
    },
    {
      num: '03',
      icon: <Zap className="h-6 w-6" />,
      title: 'Get instant answers',
      desc: 'Gemini AI finds the most relevant passages and gives you accurate, grounded answers with direct quotes.',
    },
  ]

  return (
    <section id="how-it-works" className="border-t border-border bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="mb-16 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            How it works
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From PDF to answers in three steps
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.num} className="relative flex flex-col items-center text-center">
              {/* Connector line between steps */}
              {i < steps.length - 1 && (
                <div className="absolute left-[calc(50%+3rem)] top-8 hidden h-px w-[calc(100%-3rem)] border-t border-dashed border-border md:block" />
              )}

              {/* Icon circle */}
              <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-600 shadow-sm dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                {step.icon}
                {/* Step number badge */}
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
              </div>

              <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  const features = [
    {
      icon: <Bot className="h-5 w-5" />,
      title: 'Powered by Google Gemini',
      desc: 'State-of-the-art language model understands nuance and context for accurate, relevant answers.',
      color: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30',
    },
    {
      icon: <Gift className="h-5 w-5" />,
      title: '100% Free',
      desc: 'No credit card, no subscription, no hidden fees. Completely free powered by Google\'s free API tier.',
      color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30',
    },
    {
      icon: <Target className="h-5 w-5" />,
      title: 'Accurate Answers',
      desc: 'Answers come only from your document — no hallucinations from outside knowledge.',
      color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30',
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Lightning Fast',
      desc: 'Semantic search with vector embeddings finds the right passages instantly. Responses in seconds.',
      color: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30',
    },
    {
      icon: <Lock className="h-5 w-5" />,
      title: 'Secure & Private',
      desc: 'Your documents are stored privately in Supabase with row-level security. Only you can access them.',
      color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30',
    },
    {
      icon: <History className="h-5 w-5" />,
      title: 'Chat History',
      desc: 'All your conversations are automatically saved. Pick up where you left off anytime.',
      color: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30',
    },
  ]

  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Features
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to understand any document
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Built with the best free-tier AI APIs so you never have to pay to get answers from your PDFs.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className={cn('mb-4 w-fit rounded-lg p-2.5', f.color)}>
                {f.icon}
              </div>
              <h3 className="mb-1.5 font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Use Cases ────────────────────────────────────────────────────────────────

function UseCases() {
  const cases = [
    {
      icon: <GraduationCap className="h-6 w-6" />,
      audience: 'Students',
      headline: 'Research papers & textbooks',
      desc: 'Stop scrolling through hundreds of pages. Ask your textbook a question and get the exact answer with the source passage.',
      bullets: ['Summarise chapters instantly', 'Find specific definitions', 'Understand complex concepts'],
      color: 'border-blue-200 dark:border-blue-800',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    },
    {
      icon: <Briefcase className="h-6 w-6" />,
      audience: 'Professionals',
      headline: 'Reports & contracts',
      desc: 'Review lengthy contracts and reports in minutes instead of hours. Extract key clauses and data points instantly.',
      bullets: ['Find contract clauses', 'Summarise executive reports', 'Extract key figures'],
      color: 'border-violet-200 dark:border-violet-800',
      badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
      iconBg: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    },
    {
      icon: <FlaskConical className="h-6 w-6" />,
      audience: 'Researchers',
      headline: 'Academic papers',
      desc: 'Accelerate your literature review. Chat with academic papers to find methodology, results, and conclusions fast.',
      bullets: ['Extract methodology', 'Compare findings', 'Understand citations'],
      color: 'border-emerald-200 dark:border-emerald-800',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    {
      icon: <Users className="h-6 w-6" />,
      audience: 'Anyone',
      headline: 'Any PDF that matters to you',
      desc: 'Instruction manuals, legal documents, financial statements, recipes — if it\'s a PDF, you can chat with it.',
      bullets: ['User manuals & guides', 'Legal & financial docs', 'Any text-based PDF'],
      color: 'border-amber-200 dark:border-amber-800',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    },
  ]

  return (
    <section id="use-cases" className="border-t border-border bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Use cases
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for everyone who reads PDFs
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {cases.map((c) => (
            <div
              key={c.audience}
              className={cn(
                'rounded-xl border bg-card p-6 transition-shadow hover:shadow-md',
                c.color
              )}
            >
              <div className="mb-4 flex items-start gap-4">
                <div className={cn('rounded-lg p-2.5', c.iconBg)}>{c.icon}</div>
                <div>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', c.badge)}>
                    {c.audience}
                  </span>
                  <h3 className="mt-1.5 font-semibold text-foreground">{c.headline}</h3>
                </div>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>

              <ul className="space-y-1.5">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        {/* Decorative gradient blob */}
        <div className="relative mb-8 inline-flex">
          <div className="absolute inset-0 -z-10 rounded-full bg-indigo-300/20 blur-2xl dark:bg-indigo-700/20" />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Bot className="h-8 w-8" />
          </div>
        </div>

        <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Start chatting with your PDFs today
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Get started for free — no credit card needed
        </p>

        <div className="mt-10">
          <Button
            size="lg"
            className="gap-2 px-10 text-base"
            render={<Link href="/auth/signup" />}
            nativeButton={false}
          >
            Upload Your First PDF
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Social proof / reassurance */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground sm:flex-row sm:gap-6">
          {[
            { icon: <Gift className="h-3.5 w-3.5" />, text: 'Always free' },
            { icon: <Zap className="h-3.5 w-3.5" />, text: 'Ready in seconds' },
            { icon: <Lock className="h-3.5 w-3.5" />, text: 'Your files stay private' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-1.5">
              <span className="text-emerald-500">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <FileText className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          InsightPDF AI
        </div>
        <p>© {new Date().getFullYear()} InsightPDF AI. Built with Next.js & Google Gemini.</p>
        <div className="flex gap-4">
          <Link href="/auth/login" className="hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link href="/auth/signup" className="hover:text-foreground transition-colors">
            Sign up
          </Link>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <UseCases />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
