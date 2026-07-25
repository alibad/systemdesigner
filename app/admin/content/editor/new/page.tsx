'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';

type ContentSection =
  | 'fundamentals'
  | 'genai'
  | 'ml-systems'
  | 'technology'
  | 'case-studies'
  | 'practice'
  | 'reference'
  | 'tools';
type Level = 'beginner' | 'intermediate' | 'advanced';

interface NewLessonOptions {
  version: string;
  sections: Array<{
    key: ContentSection;
    title: string;
    categories: Array<{ key: string; title: string }>;
  }>;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface CreateLessonResult {
  entry: { id: string; title: string; path: string; section: ContentSection };
  version: string;
  persistence: 'filesystem' | 'github';
  commitUrl?: string;
  changedPaths: string[];
}

interface ApiErrorPayload {
  error?: string;
  issues?: string[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function listFromInput(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function emptyQuestion(index: number): QuizQuestion {
  return {
    question: '',
    options: ['', '', '', ''],
    correctAnswer: index % 4,
    explanation: '',
  };
}

async function readApiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (payload?.issues?.length) return payload.issues.join('\n');
  return payload?.error || `Request failed with status ${response.status}.`;
}

export default function AdminNewLessonPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [options, setOptions] = useState<NewLessonOptions | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [section, setSection] = useState<ContentSection>('fundamentals');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState<Level>('beginner');
  const [duration, setDuration] = useState('20 min');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [keywords, setKeywords] = useState('');
  const [prerequisites, setPrerequisites] = useState('');
  const [related, setRelated] = useState('');
  const [nextInSequence, setNextInSequence] = useState('');
  const [priority, setPriority] = useState(0.7);
  const [changeFreq, setChangeFreq] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [hasScenarios, setHasScenarios] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDuration, setQuizDuration] = useState('8 min');
  const [quizFileName, setQuizFileName] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    emptyQuestion(0),
    emptyQuestion(1),
    emptyQuestion(2),
    emptyQuestion(3),
  ]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateLessonResult | null>(null);

  useEffect(() => {
    if (!slugEdited) {
      const nextSlug = slugify(title);
      setSlug(nextSlug);
      setQuizFileName(nextSlug ? `${nextSlug}-check.json` : '');
    }
    if (!quizTitle || quizTitle.endsWith(' Check')) {
      setQuizTitle(title ? `${title} Check` : '');
    }
  }, [quizTitle, slugEdited, title]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/');
      return;
    }
    let cancelled = false;
    const loadOptions = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/content/new', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = (await response.json()) as NewLessonOptions;
        if (!cancelled) {
          setOptions(payload);
          const defaultSection = payload.sections[0];
          if (defaultSection) {
            setSection(defaultSection.key);
            setCategory(defaultSection.categories[0]?.key ?? '');
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Unable to start a new lesson.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, router, user]);

  const selectedSection = useMemo(
    () => options?.sections.find((candidate) => candidate.key === section),
    [options, section],
  );

  const updateQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    );
  };

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions((current) =>
      current.map((question, currentQuestionIndex) =>
        currentQuestionIndex === questionIndex
          ? {
              ...question,
              options: question.options.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex ? value : option,
              ),
            }
          : question,
      ),
    );
  };

  const createLesson = async () => {
    if (!options || !user) return;
    if (
      !window.confirm(
        'Create this lesson as a hidden draft? The registry entry, lesson body, and quiz will be committed together and deployed.',
      )
    ) {
      return;
    }
    setCreating(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const metadata = {
        id: slug,
        title,
        path: `/${section}/${slug}`,
        section,
        level,
        duration,
        hasQuiz: true,
        hasScenarios,
        hasCalculator: false,
        renderMode: 'mdoc',
        prerequisites: listFromInput(prerequisites),
        related: listFromInput(related),
        nextInSequence: nextInSequence.trim() || undefined,
        tags: listFromInput(tags),
        category: category || undefined,
        seo: {
          metaDescription: description,
          keywords: listFromInput(keywords),
          priority,
          changeFreq,
          lastModified: new Date().toISOString(),
        },
        status: 'draft',
      };
      const response = await fetch('/api/admin/content/new', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug,
          metadata,
          quizFileName,
          quiz: {
            title: quizTitle,
            section,
            difficulty: level,
            duration: quizDuration,
            questions,
          },
          assets: [],
          expectedVersion: options.version,
          message: message.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setResult((await response.json()) as CreateLessonResult);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the lesson.');
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100">
          <CheckCircle2 className="h-10 w-10" />
          <h1 className="mt-4 text-3xl font-bold">Draft lesson created</h1>
          <p className="mt-3">
            “{result.entry.title}” now has a registry entry, starter lesson body, and required
            quiz. It remains hidden until its metadata status is changed from draft to active.
          </p>
          <div className="mt-5 rounded-xl bg-white/70 p-4 text-sm dark:bg-black/20">
            <p className="font-mono">{result.entry.path}</p>
            <p className="mt-2 text-xs opacity-75">
              The editor will list the new lesson after the deployment finishes.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin/content/editor">Return to Content Studio</Link>
            </Button>
            {result.commitUrl && (
              <Button variant="outline" asChild>
                <a href={result.commitUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View publication commit
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <header>
        <Link
          href="/admin/content/editor"
          className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Content Studio
        </Link>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <FilePlus2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          Create a new lesson
        </h1>
        <p className="mt-2 max-w-3xl text-neutral-600 dark:text-neutral-400">
          Start with validated metadata, a beginner-friendly Markdoc structure, and a complete
          quiz. New lessons remain hidden drafts until an admin reviews and activates them.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="whitespace-pre-wrap text-sm">{error}</p>
        </div>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-xl font-semibold">Lesson identity</h2>
        <p className="mt-1 text-sm text-neutral-500">
          The slug becomes both the registry ID and the permanent URL.
        </p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">Lesson title</span>
            <Input
              value={title}
              maxLength={140}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What is Consistent Hashing?"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Section</span>
            <select
              value={section}
              onChange={(event) => {
                const nextSection = event.target.value as ContentSection;
                setSection(nextSection);
                const next = options?.sections.find((candidate) => candidate.key === nextSection);
                setCategory(next?.categories[0]?.key ?? '');
              }}
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              {options?.sections.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Slug and registry ID</span>
            <Input
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                const nextSlug = slugify(event.target.value);
                setSlug(nextSlug);
                setQuizFileName(nextSlug ? `${nextSlug}-check.json` : '');
              }}
              placeholder="consistent-hashing"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="">Uncategorized</option>
              {selectedSection?.categories.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Level</span>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value as Level)}
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Estimated duration</span>
            <Input value={duration} onChange={(event) => setDuration(event.target.value)} />
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <input
              type="checkbox"
              checked={hasScenarios}
              onChange={(event) => setHasScenarios(event.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">Includes scenario exploration</span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-xl font-semibold">Discovery and learning path</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1.5 flex justify-between text-sm font-medium">
              Plain-language description
              <span className="font-normal text-neutral-400">{description.length}/160</span>
            </span>
            <Textarea
              value={description}
              minLength={20}
              maxLength={160}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24"
              placeholder="Explain what the concept is and why it matters in one clear sentence."
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">Tags</span>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="consistent-hashing, sharding, distributed-systems"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">SEO keywords</span>
            <Input
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              placeholder="consistent hashing, hash ring, data distribution"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Prerequisite lesson IDs</span>
            <Textarea
              value={prerequisites}
              onChange={(event) => setPrerequisites(event.target.value)}
              className="min-h-28"
              placeholder="one-id-per-line"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Related lesson IDs</span>
            <Textarea
              value={related}
              onChange={(event) => setRelated(event.target.value)}
              className="min-h-28"
              placeholder="one-id-per-line"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Next lesson ID</span>
            <Input
              value={nextInSequence}
              onChange={(event) => setNextInSequence(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Sitemap priority</span>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Expected change frequency</span>
            <select
              value={changeFreq}
              onChange={(event) =>
                setChangeFreq(event.target.value as 'weekly' | 'monthly' | 'yearly')
              }
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-xl font-semibold">Required quiz</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Every lesson begins with at least four review questions. Each explanation should teach,
          not merely reveal the correct option.
        </p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-sm font-medium">Quiz title</span>
            <Input value={quizTitle} onChange={(event) => setQuizTitle(event.target.value)} />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Quiz duration</span>
            <Input
              value={quizDuration}
              onChange={(event) => setQuizDuration(event.target.value)}
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">Quiz filename</span>
            <Input
              value={quizFileName}
              onChange={(event) => setQuizFileName(slugify(event.target.value.replace(/\.json$/, '')) + '.json')}
            />
          </label>
        </div>

        <div className="mt-6 space-y-5">
          {questions.map((question, questionIndex) => (
            <div
              key={questionIndex}
              className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Question {questionIndex + 1}</h3>
                {questions.length > 4 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setQuestions((current) =>
                        current.filter((_, index) => index !== questionIndex),
                      )
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                    Remove
                  </Button>
                )}
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium">Question</span>
                <Textarea
                  value={question.question}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { question: event.target.value })
                  }
                  className="min-h-20"
                />
              </label>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {question.options.map((option, optionIndex) => (
                  <label key={optionIndex}>
                    <span className="mb-1.5 block text-xs font-medium text-neutral-500">
                      Option {optionIndex + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${questionIndex}`}
                        checked={question.correctAnswer === optionIndex}
                        onChange={() =>
                          updateQuestion(questionIndex, { correctAnswer: optionIndex })
                        }
                        aria-label={`Mark option ${optionIndex + 1} as correct for question ${
                          questionIndex + 1
                        }`}
                      />
                      <Input
                        value={option}
                        onChange={(event) =>
                          updateQuestionOption(questionIndex, optionIndex, event.target.value)
                        }
                      />
                    </div>
                  </label>
                ))}
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium">Explanation</span>
                <Textarea
                  value={question.explanation}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { explanation: event.target.value })
                  }
                  className="min-h-24"
                />
              </label>
            </div>
          ))}
        </div>
        {questions.length < 12 && (
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={() =>
              setQuestions((current) => [...current, emptyQuestion(current.length)])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add question
          </Button>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold">Create the draft lesson</h2>
        <p className="mt-1 text-sm text-neutral-500">
          The generated starter body follows the shared lesson shell and can be expanded in the
          block editor after deployment.
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium">Publication note</span>
          <Input
            value={message}
            maxLength={160}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={slug ? `Create ${slug} lesson draft` : 'Create lesson draft'}
          />
        </label>
        <div className="mt-5 flex justify-end">
          <Button
            onClick={() => void createLesson()}
            disabled={
              creating ||
              !title.trim() ||
              !slug ||
              description.length < 20 ||
              !tags.trim() ||
              !keywords.trim() ||
              !quizFileName ||
              questions.some(
                (question) =>
                  question.question.trim().length < 10 ||
                  question.explanation.trim().length < 10 ||
                  question.options.some((option) => !option.trim()),
              )
            }
          >
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FilePlus2 className="mr-2 h-4 w-4" />
            )}
            Create hidden draft
          </Button>
        </div>
      </section>
    </div>
  );
}
