'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import ListItem from '@tiptap/extension-list-item';
import { Button } from './button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Heading4,
  CheckSquare,
  Code,
  Quote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import TurndownService from 'turndown';
import { marked } from 'marked';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  className
}: RichTextEditorProps) {
  // Configure turndown service for better markdown conversion
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  // Add custom rules for task lists
  turndownService.addRule('taskList', {
    filter: function (node) {
      return !!(node.nodeName === 'LI' &&
                node.parentNode &&
                (node.parentNode as HTMLElement).getAttribute &&
                (node.parentNode as HTMLElement).getAttribute('data-type') === 'taskList');
    },
    replacement: function (content, node) {
      const isChecked = (node as HTMLElement).getAttribute('data-checked') === 'true';
      return (isChecked ? '- [x] ' : '- [ ] ') + content + '\n';
    }
  });

  // Convert markdown content to HTML for editor initialization
  const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    try {
      const result = marked(markdown);
      // marked can return string or Promise<string>, handle both
      if (result instanceof Promise) {
        return ''; // Can't await in sync function, return empty
      }
      return result;
    } catch (error) {
      console.warn('Error parsing markdown:', error);
      return markdown;
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      ListItem,
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
    ],
    content: markdownToHtml(content),
    immediatelyRender: false, // Fix SSR hydration issues
    onUpdate: ({ editor }) => {
      // Convert HTML to clean markdown using turndown
      const html = editor.getHTML();
      const markdown = turndownService.turndown(html);
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[100px] p-3',
      },
    },
  });

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== editor.getText()) {
      const html = markdownToHtml(content);
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("border rounded-lg bg-background", className)}>
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-2 flex items-center gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn("h-8 px-2", editor.isActive('heading', { level: 2 }) && "bg-muted")}
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn("h-8 px-2", editor.isActive('heading', { level: 3 }) && "bg-muted")}
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          className={cn("h-8 px-2", editor.isActive('heading', { level: 4 }) && "bg-muted")}
        >
          <Heading4 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-8 px-2", editor.isActive('bold') && "bg-muted")}
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-8 px-2", editor.isActive('italic') && "bg-muted")}
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={cn("h-8 px-2", editor.isActive('code') && "bg-muted")}
        >
          <Code className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("h-8 px-2", editor.isActive('bulletList') && "bg-muted")}
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("h-8 px-2", editor.isActive('orderedList') && "bg-muted")}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={cn("h-8 px-2", editor.isActive('taskList') && "bg-muted")}
        >
          <CheckSquare className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn("h-8 px-2", editor.isActive('blockquote') && "bg-muted")}
        >
          <Quote className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="min-h-[120px]"
        placeholder={placeholder}
      />
    </div>
  );
}