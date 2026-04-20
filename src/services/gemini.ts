/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Quiz } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function tryParseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON Parse Error:", e, "Raw Text:", text);
    
    // Logic to fix simple truncation (AI hitting token limit)
    let repaired = text.trim();
    
    // Check if it's likely truncated (doesn't end with })
    if (!repaired.endsWith('}')) {
      // Very basic structural repair: count open/close braces
      const countChar = (str: string, char: string) => str.split(char).length - 1;
      const openBrackets = countChar(repaired, '[');
      const closeBrackets = countChar(repaired, ']');
      const openBraces = countChar(repaired, '{');
      const closeBraces = countChar(repaired, '}');
      
      // Close open arrays then objects
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      
      try {
        return JSON.parse(repaired);
      } catch (innerError) {
        // If repair fails, fall through to the final error
      }
    }
    
    throw new Error("The AI response was too large and got cut off, or it generated invalid data. Please try uploading a smaller portion of the PDF or simplified text.");
  }
}

export async function extractQuizFromPdf(pdfBase64: string, fileName: string): Promise<Quiz> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: pdfBase64,
              mimeType: "application/pdf",
            },
          },
          {
            text: `CRITICAL: Extract EVERY SINGLE multiple-choice question found in this PDF. Do not skip any questions. 
            If there are 30 questions, extract all 30. If there are 50, extract all 50.
            
            For each question, provide:
            - The question text
            - A list of exactly 4 options
            - The index of the correct answer (0-3)
            - A VERY SHORT (one sentence max) explanation for why it's the correct answer.
            
            Return the result as a structured JSON object. 
            The PDF filename is: ${fileName}.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 15000,
      responseSchema: {
        type: Type.OBJECT,
        required: ["quiz"],
        properties: {
          quiz: {
            type: Type.OBJECT,
            required: ["title", "questions"],
            properties: {
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["text", "options", "correctAnswerIndex", "explanation"],
                  properties: {
                    text: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctAnswerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  const parsed = tryParseJSON(text);
  
  // Add unique IDs to questions
  const quiz = parsed.quiz as Quiz;
  quiz.questions = quiz.questions.map((q, idx) => ({
    ...q,
    id: `q-${idx}`,
  }));
  
  return quiz;
}

export async function extractQuizFromText(text: string): Promise<Quiz> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `CRITICAL: Extract EVERY SINGLE multiple-choice question found in the following text. Do not skip anything.
    If the text has dozens of questions, extract all of them. Do not summarize or truncate.

    For each question, provide:
    - The question text
    - A list of exactly 4 options
    - The index of the correct answer (0-3)
    - A VERY SHORT (one sentence max) explanation for why it's the correct answer.
    
    Return the result as a structured JSON object.
    
    Text content:
    ${text}`,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 15000,
      responseSchema: {
        type: Type.OBJECT,
        required: ["quiz"],
        properties: {
          quiz: {
            type: Type.OBJECT,
            required: ["title", "questions"],
            properties: {
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["text", "options", "correctAnswerIndex", "explanation"],
                  properties: {
                    text: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctAnswerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const resText = response.text;
  if (!resText) throw new Error("No response from AI");
  
  const parsed = tryParseJSON(resText);
  
  const quiz = parsed.quiz as Quiz;
  quiz.questions = quiz.questions.map((q, idx) => ({
    ...q,
    id: `q-${idx}`,
  }));
  
  return quiz;
}

export async function analyzePerformance(results: any): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this quiz performance and provide constructive feedback for the student.
    
    Results:
    Correct: ${results.correctAnswers}
    Wrong: ${results.wrongAnswers}
    Skipped: ${results.skippedQuestions}
    Time Spent: ${Math.floor(results.timeSpent / 60)}m ${results.timeSpent % 60}s
    Total Questions: ${results.totalQuestions}
    
    Provide a professional, encouraging analysis in 3-4 sentences.`,
  });
  
  return response.text || "No analysis available.";
}
