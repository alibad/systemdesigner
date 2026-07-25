'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useState, useCallback } from 'react';
import { $getSelection, $isRangeSelection } from 'lexical';
import { Mic } from 'lucide-react';

const VOICE_COMMANDS = {
  '\n': ['new line', 'newline'],
  '.': ['period', 'dot'],
  ',': ['comma'],
  '?': ['question mark'],
  '!': ['exclamation point', 'exclamation mark'],
};

export function SpeechToTextPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if browser supports speech recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    let finalTranscript = '';

    recognitionInstance.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update preview with interim text
      setInterimText(interimTranscript);

      // Process voice commands
      let processedText = finalTranscript;
      for (const [symbol, commands] of Object.entries(VOICE_COMMANDS)) {
        for (const command of commands) {
          const regex = new RegExp(command, 'gi');
          processedText = processedText.replace(regex, symbol);
        }
      }

      if (finalTranscript) {
        setFinalText(processedText);

        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertText(processedText + ' ');
          }
        });

        finalTranscript = '';
        // Clear interim after inserting final
        setTimeout(() => {
          setFinalText('');
          setInterimText('');
        }, 100);
      }
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setIsListening(false);
        setInterimText('');
        setFinalText('');
      }
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
      setInterimText('');
      setFinalText('');
    };

    setRecognition(recognitionInstance);

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, [editor]);

  const toggleListening = useCallback(() => {
    if (!recognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      setInterimText('');
      setFinalText('');
    } else {
      recognition.start();
      setIsListening(true);
    }
  }, [recognition, isListening]);

  // Expose toggle function for toolbar to use
  useEffect(() => {
    (window as any).__lexicalSpeechToText = toggleListening;
    return () => {
      delete (window as any).__lexicalSpeechToText;
    };
  }, [toggleListening]);

  // Show floating preview when listening
  if (!isListening && !interimText && !finalText) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-8 bg-white dark:bg-gray-800 border-2 border-indigo-500 rounded-lg shadow-2xl p-4 max-w-md z-50 animate-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="relative">
            <Mic className="w-6 h-6 text-red-500 animate-pulse" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
            Listening...
          </div>
          {finalText && (
            <div className="text-sm text-gray-900 dark:text-gray-100 mb-1">
              {finalText}
            </div>
          )}
          {interimText && (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              {interimText}
            </div>
          )}
          {!interimText && !finalText && (
            <div className="text-sm text-gray-400 dark:text-gray-500 italic">
              Start speaking...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
