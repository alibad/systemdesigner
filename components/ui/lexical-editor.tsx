'use client';

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { TLDrawNode } from './lexical-nodes/TLDrawNode';
import { HorizontalRuleNode } from './lexical-nodes/HorizontalRuleNode';
import { ImageNode } from './lexical-nodes/ImageNode';
import { CollapsibleNode } from './lexical-nodes/CollapsibleNode';

import type { EditorState } from 'lexical';
import { useEffect } from 'react';
import { LexicalToolbar } from './lexical-toolbar';
import { SpeechToTextPlugin } from './lexical-plugins/SpeechToTextPlugin';

interface LexicalEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  isEditable?: boolean;
  projectWhiteboardId?: string;
}

// Plugin to set initial state from JSON string
function InitialStatePlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!content) return;

    try {
      const editorState = editor.parseEditorState(content);
      editor.setEditorState(editorState);
    } catch (error) {
      console.error('Error loading editor state:', error);
    }
  }, [content, editor]);

  return null;
}

// Plugin to control editable state
function EditablePlugin({ isEditable }: { isEditable: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(isEditable);
  }, [isEditable, editor]);

  return null;
}

export function LexicalEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  className = '',
  isEditable = true,
  projectWhiteboardId
}: LexicalEditorProps) {
  const initialConfig = {
    namespace: 'RichDocumentEditor',
    theme: {
      paragraph: 'mb-2',
      quote: 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-4',
      heading: {
        h1: 'text-3xl font-bold my-4',
        h2: 'text-2xl font-bold my-3',
        h3: 'text-xl font-bold my-2',
      },
      list: {
        ul: 'list-disc ml-6 my-2',
        ol: 'list-decimal ml-6 my-2',
        listitem: 'ml-2',
      },
      link: 'text-blue-600 dark:text-blue-400 hover:underline',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        code: 'bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 font-mono text-sm',
      },
      code: 'bg-gray-100 dark:bg-gray-900 rounded p-4 font-mono text-sm my-4 overflow-x-auto',
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      TLDrawNode,
      HorizontalRuleNode,
      ImageNode,
      CollapsibleNode,
    ],
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    },
  };

  const handleChange = (editorState: EditorState) => {
    const json = JSON.stringify(editorState.toJSON());
    onChange(json);
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={`relative border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
        {isEditable && <LexicalToolbar projectWhiteboardId={projectWhiteboardId} />}
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="min-h-[400px] p-4 outline-none prose prose-neutral dark:prose-invert max-w-none" />
          }
          placeholder={
            <div className="absolute top-16 left-4 text-gray-400 pointer-events-none">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <TablePlugin />
        <SpeechToTextPlugin />
        <OnChangePlugin onChange={handleChange} />
        <InitialStatePlugin content={content} />
        <EditablePlugin isEditable={isEditable} />
      </div>
    </LexicalComposer>
  );
}
