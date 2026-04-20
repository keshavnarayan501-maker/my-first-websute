/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Quiz {
  title: string;
  questions: Question[];
}

export interface QuizAttempt {
  quizId: string;
  startTime: number;
  endTime?: number;
  answers: Record<number, number>; // questionIndex -> selectedOptionIndex
  skipped: number[]; // indices of skipped questions
}

export interface QuizResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  skippedQuestions: number;
  timeSpent: number; // in seconds
  analysis: string;
}
