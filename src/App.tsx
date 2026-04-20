/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Timer, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  BarChart2,
  BrainCircuit,
  Loader2,
  SkipForward
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Quiz, Question, QuizResult } from './types';
import { extractQuizFromPdf, analyzePerformance, extractQuizFromText } from './services/gemini';

type AppMode = 'idle' | 'loading' | 'quiz' | 'results';

export default function App() {
  const [mode, setMode] = useState<AppMode>('idle');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [skipped, setSkipped] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [results, setResults] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Processing PDF...');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (mode === 'quiz' && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, timeRemaining]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }

    setMode('loading');
    setLoadingMessage('AI is scanning your PDF questions...');
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const extractedQuiz = await extractQuizFromPdf(base64, file.name);
          startQuiz(extractedQuiz);
        } catch (err) {
          console.error(err);
          setError('Failed to extract questions. Please try another PDF.');
          setMode('idle');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Error reading file.');
      setMode('idle');
    }
  };

  const handleTextSubmit = async () => {
    if (!pastedText.trim()) return;
    
    setMode('loading');
    setLoadingMessage('AI is generating questions from your text...');
    setError(null);

    try {
      const extractedQuiz = await extractQuizFromText(pastedText);
      startQuiz(extractedQuiz);
    } catch (err) {
      console.error(err);
      setError('Failed to generate quiz. Please try simpler text.');
      setMode('idle');
    }
  };

  const startQuiz = (extractedQuiz: Quiz) => {
    setQuiz(extractedQuiz);
    // Set timer as 2 mins per question
    const duration = extractedQuiz.questions.length * 120;
    setTimeRemaining(duration);
    setTotalTime(duration);
    setMode('quiz');
  };

  const handleOptionSelect = (optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [currentQuestionIndex]: optionIndex }));
    // Auto move to next or let user click? User click is better for reviewing.
  };

  const handleSkip = () => {
    if (!skipped.includes(currentQuestionIndex)) {
      setSkipped(prev => [...prev, currentQuestionIndex]);
    }
    if (currentQuestionIndex < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleComplete = async () => {
    if (!quiz) return;
    setMode('loading');
    setLoadingMessage('Analyzing your performance...');

    const correctAnswers = quiz.questions.reduce((acc, q, idx) => {
      return acc + (answers[idx] === q.correctAnswerIndex ? 1 : 0);
    }, 0);

    const wrongAnswers = Object.keys(answers).length - correctAnswers;
    const skippedQuestions = quiz.questions.length - Object.keys(answers).length;
    const timeSpent = totalTime - timeRemaining;
    const score = Math.round((correctAnswers / quiz.questions.length) * 100);

    const resultData = {
      score,
      totalQuestions: quiz.questions.length,
      correctAnswers,
      wrongAnswers,
      skippedQuestions,
      timeSpent,
    };

    try {
      const analysis = await analyzePerformance(resultData);
      setResults({ ...resultData, analysis });
      setMode('results');
    } catch (err) {
      setResults({ ...resultData, analysis: "Could not generate analysis at this time." });
      setMode('results');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const restart = () => {
    setMode('idle');
    setQuiz(null);
    setAnswers({});
    setSkipped([]);
    setCurrentQuestionIndex(0);
    setResults(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-indigo-100">
      <nav className="relative z-10 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto border border-slate-200 rounded-2xl shadow-sm bg-white mt-6 mx-6">
        <div className="flex items-center gap-3 cursor-pointer" onClick={restart}>
          <div className="bg-indigo-600 p-2 rounded-xl flex items-center justify-center">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">AI Quiz Master</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Advanced PDF Test Generator</p>
          </div>
        </div>
        {mode === 'quiz' && quiz && (
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Remaining Time</span>
              <span className={`text-2xl font-mono font-bold tracking-tighter ${timeRemaining < 60 ? 'text-red-500' : 'text-indigo-600'}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
            <button 
              onClick={handleComplete}
              className="hidden md:block px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors"
            >
              Finish Session
            </button>
          </div>
        )}
      </nav>

      <main className={`relative z-10 mx-auto px-6 py-12 ${mode === 'quiz' ? 'max-w-7xl' : 'max-w-4xl'}`}>
        <AnimatePresence mode="wait">
          {mode === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12 text-center"
            >
              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                  Turn your PDFs into <br />
                  <span className="text-[#007AFF]">Interactive Quizzes</span>
                </h1>
                <p className="text-xl text-[#86868B] max-w-2xl mx-auto">
                  Upload your study material, question papers, or notes. Our AI scans everything and creates a custom test series for your practice.
                </p>
              </div>

              <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex p-1 bg-[#F2F2F7] rounded-2xl w-fit mx-auto">
                  <button
                    onClick={() => setActiveTab('upload')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                      activeTab === 'upload' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Upload PDF
                  </button>
                  <button
                    onClick={() => setActiveTab('paste')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                      activeTab === 'paste' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Paste Questions
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === 'upload' ? (
                    <motion.div
                      key="upload-tab"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                    >
                      <label className="relative group cursor-pointer block">
                        <div className="border-2 border-dashed border-slate-200 group-hover:border-indigo-500 transition-all bg-white rounded-3xl p-12 space-y-4 group-hover:shadow-xl group-hover:shadow-indigo-500/5">
                          <div className="w-16 h-16 bg-slate-50 group-hover:bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto transition-colors">
                            <Upload className="w-8 h-8 text-slate-800 group-hover:text-indigo-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Drop your PDF here</h3>
                            <p className="text-slate-500 font-medium">Click to browse or drag and drop</p>
                          </div>
                        </div>
                        <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                      </label>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="paste-tab"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="space-y-4"
                    >
                      <div className="relative">
                        <textarea
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          placeholder="Paste your questions or study material here..."
                          className="w-full h-48 p-6 bg-white border-2 border-slate-200 focus:border-indigo-500 rounded-3xl resize-none focus:outline-none transition-all text-lg text-slate-800"
                        />
                      </div>
                      <button
                        onClick={handleTextSubmit}
                        disabled={!pastedText.trim()}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                      >
                        Generate Quiz from Text
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 justify-center text-red-600 font-medium">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mt-8">
                {[
                  { icon: FileText, title: "Smart Extraction", desc: "AI automatically identifies questions, options, and answers." },
                  { icon: Timer, title: "Timed Practice", desc: "Realistic exam environment with countdown timers." },
                  { icon: BarChart2, title: "Deep Analysis", desc: "Get detailed feedback on your strengths and weaknesses." }
                ].map((feature, i) => (
                  <div key={i} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <feature.icon className="w-6 h-6 mb-4 text-indigo-600" />
                    <h4 className="font-bold text-slate-900 mb-2">{feature.title}</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {mode === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-6"
            >
              <div className="relative">
                <div className="w-20 h-20 border-4 border-slate-100 rounded-full" />
                <motion.div 
                  className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <p className="text-xl font-bold text-slate-900 animate-pulse">{loadingMessage}</p>
            </motion.div>
          )}

          {mode === 'quiz' && quiz && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-12 gap-6"
            >
              <aside className="col-span-12 lg:col-span-3 flex flex-col gap-6 order-2 lg:order-1">
                <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Question Navigator</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {quiz.questions.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentQuestionIndex(i)}
                        className={`h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all border ${
                          currentQuestionIndex === i 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' 
                            : answers[i] !== undefined 
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 pt-4 border-t border-slate-100 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Progress</span>
                      <span className="text-slate-900 uppercase tracking-tighter">
                        {Object.keys(answers).length} / {quiz.questions.length}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        className="bg-indigo-500 h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(Object.keys(answers).length / quiz.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </section>

                <section className="bg-indigo-900 p-6 rounded-2xl text-white shadow-lg flex-1 hidden lg:flex flex-col">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-6">Quiz Focus</h3>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full border-4 border-indigo-400/30 flex items-center justify-center text-lg font-black tracking-tighter">
                        {Math.round((Object.keys(answers).length / quiz.questions.length) * 100)}%
                      </div>
                      <div className="text-xs">
                        <p className="font-bold uppercase tracking-wider text-indigo-100">Pace</p>
                        <p className="opacity-60 font-medium">Completion rate</p>
                      </div>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl border border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-2">Subject</p>
                      <p className="text-sm font-bold text-white line-clamp-2">{quiz.title}</p>
                    </div>
                  </div>
                </section>
              </aside>

              <section className="col-span-12 lg:col-span-9 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden order-1 lg:order-2">
                <div className="p-8 flex-1 flex flex-col gap-8 min-h-[400px]">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em]">
                        Question {(currentQuestionIndex + 1).toString().padStart(2, '0')}
                      </span>
                      <h2 className="text-2xl font-black text-slate-900 leading-tight">
                        {quiz.questions[currentQuestionIndex].text}
                      </h2>
                    </div>
                    <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-full uppercase tracking-widest border border-indigo-100 shrink-0 self-start">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {quiz.questions[currentQuestionIndex].options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(idx)}
                        className={`group flex items-center p-5 border-2 rounded-2xl transition-all text-left ${
                          answers[currentQuestionIndex] === idx
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                            : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm mr-5 transition-all ${
                          answers[currentQuestionIndex] === idx
                            ? 'bg-indigo-600 text-white rotate-6'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className={`text-lg transition-colors ${
                          answers[currentQuestionIndex] === idx
                            ? 'font-bold text-slate-900'
                            : 'font-medium text-slate-700'
                        }`}>
                          {option}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <button
                    onClick={handleBack}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[3]" />
                    Previous
                  </button>

                  <div className="flex gap-4 w-full sm:w-auto">
                    <button
                      onClick={handleSkip}
                      className="flex-1 sm:flex-none px-6 py-3 bg-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-300 transition-colors uppercase tracking-widest"
                    >
                      Skip
                    </button>
                    
                    {currentQuestionIndex === quiz.questions.length - 1 ? (
                      <button
                        onClick={handleComplete}
                        className="flex-1 sm:flex-none px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all uppercase tracking-widest"
                      >
                        Submit
                      </button>
                    ) : (
                      <button
                        onClick={handleNext}
                        className="flex-1 sm:flex-none px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 stroke-[3]" />
                      </button>
                    )}
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {mode === 'results' && results && quiz && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="space-y-12 pb-20"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex p-6 bg-green-50 text-green-600 rounded-3xl border border-green-100 mb-4 shadow-sm">
                  <CheckCircle2 className="w-16 h-16 stroke-[1.5]" />
                </div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tight">Quiz Complete</h1>
                <p className="text-xl text-slate-500 font-medium max-w-xl mx-auto">
                  Excellent work during this session. Here's a detailed breakdown of your performance on <span className="text-indigo-600 font-bold">{quiz.title}</span>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { value: `${results.score}%`, label: 'Total Score', color: 'bg-indigo-600 text-white' },
                  { value: results.correctAnswers, label: 'Correct', color: 'bg-white text-indigo-600 border border-slate-200' },
                  { value: results.wrongAnswers, label: 'Incorrect', color: 'bg-white text-red-500 border border-slate-200' },
                  { value: results.skippedQuestions, label: 'Skipped', color: 'bg-white text-slate-400 border border-slate-200' }
                ].map((stat, i) => (
                  <div key={i} className={`p-8 rounded-3xl text-center space-y-2 shadow-sm ${stat.color}`}>
                    <div className="text-4xl font-black tracking-tighter">{stat.value}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Review Session</h3>
                  <div className="space-y-6">
                    {quiz.questions.map((q, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                          <div className="space-y-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Question {(idx + 1).toString().padStart(2, '0')}</span>
                            <p className="font-bold text-xl text-slate-900 leading-snug">{q.text}</p>
                          </div>
                          <div className="shrink-0">
                            {answers[idx] === q.correctAnswerIndex ? (
                              <span className="flex items-center gap-2 text-green-600 font-black text-[10px] bg-green-50 px-4 py-2 rounded-full uppercase tracking-widest border border-green-100">
                                <CheckCircle2 className="w-4 h-4" /> Correct
                              </span>
                            ) : (
                              <span className="flex items-center gap-2 text-red-500 font-black text-[10px] bg-red-50 px-4 py-2 rounded-full uppercase tracking-widest border border-red-100">
                                <X className="w-4 h-4" /> {answers[idx] === undefined ? 'Skipped' : 'Wrong'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt, oIdx) => (
                            <div 
                              key={oIdx}
                              className={`p-4 rounded-2xl text-sm border-2 transition-all ${
                                oIdx === q.correctAnswerIndex 
                                  ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-lg shadow-indigo-100'
                                  : oIdx === answers[idx]
                                    ? 'bg-red-50 border-red-200 text-red-700 font-bold'
                                    : 'border-slate-100 text-slate-500 font-medium'
                              }`}
                            >
                              <span className="inline-block w-8 opacity-60">{String.fromCharCode(65 + oIdx)}.</span>
                              {opt}
                            </div>
                          ))}
                        </div>

                        <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-6">
                          <div className="flex items-center gap-2 mb-3">
                            <BrainCircuit className="w-4 h-4 text-indigo-600" />
                            <span className="font-black text-slate-900 uppercase tracking-widest text-[10px]">AI Insight</span>
                          </div>
                          <p className="text-slate-600 font-medium leading-relaxed italic">{q.explanation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="lg:col-span-4 space-y-8">
                  <div className="bg-indigo-900 text-white rounded-3xl p-8 space-y-8 shadow-xl sticky top-8">
                    <div className="space-y-2">
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-300">Detailed Feedback</h3>
                      <p className="text-xl font-bold leading-relaxed">
                        &ldquo;{results.analysis}&rdquo;
                      </p>
                    </div>

                    <div className="pt-8 border-t border-white/10 space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Time Spent</span>
                        <span className="font-mono text-xl font-black bg-white/10 px-3 py-1 rounded-lg">
                          {Math.floor(results.timeSpent / 60)}m {results.timeSpent % 60}s
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Avg. Time / Question</span>
                        <span className="font-mono text-xl font-black bg-white/10 px-3 py-1 rounded-lg">
                          {Math.round(results.timeSpent / quiz.questions.length)}s
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={restart}
                      className="w-full bg-white text-indigo-900 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-50 transition-colors shadow-lg mt-4"
                    >
                      New Session
                    </button>
                  </div>
                </aside>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 text-center flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
          &copy; {new Date().getFullYear()} AI Quiz Master &bull; Powered by Gemini AI
        </p>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex gap-6">
          <span>SECURE SYSTEM</span>
          <span>ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
        </div>
      </footer>
    </div>
  );
}

