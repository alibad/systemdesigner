'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Code,
  Quote,
  Presentation,
  Table as TableIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  ChevronDown,
  Mic,
} from 'lucide-react';
import { $createParagraphNode, $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, UNDO_COMMAND, REDO_COMMAND } from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { $createTLDrawNode } from './lexical-nodes/TLDrawNode';
import { $createHorizontalRuleNode } from './lexical-nodes/HorizontalRuleNode';
import { $createImageNode } from './lexical-nodes/ImageNode';
import { $createCollapsibleNode } from './lexical-nodes/CollapsibleNode';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ToolbarProps {
  projectWhiteboardId?: string;
}

export function LexicalToolbar({ projectWhiteboardId }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showCollapsibleDialog, setShowCollapsibleDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [collapsibleTitle, setCollapsibleTitle] = useState('Click to expand');
  const [collapsibleContent, setCollapsibleContent] = useState('');
  const [isListening, setIsListening] = useState(false);

  const insertTLDraw = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Use project's whiteboard if available, otherwise create a new one
        const whiteboardId = projectWhiteboardId || `wb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const tldrawNode = $createTLDrawNode(whiteboardId, 'page:page', 'inherit', 500);
        selection.insertNodes([tldrawNode]);
      }
    });
  };

  const formatBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  const formatItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  const formatCode = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
  };

  const insertHeading = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const heading = $createHeadingNode('h2');
        selection.insertNodes([heading]);
      }
    });
  };

  const insertQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const quote = $createQuoteNode();
        selection.insertNodes([quote]);
      }
    });
  };

  const insertCodeBlock = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const code = $createCodeNode();
        selection.insertNodes([code]);
      }
    });
  };

  const insertBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };

  const insertNumberedList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  const insertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '3', columns: '3' });
  };

  const insertHorizontalRule = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const hrNode = $createHorizontalRuleNode();
        selection.insertNodes([hrNode]);
      }
    });
  };

  const insertImage = () => {
    setShowImageDialog(true);
  };

  const handleInsertImage = () => {
    if (imageUrl) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const imageNode = $createImageNode({
            src: imageUrl,
            altText: 'Inserted image',
          });
          selection.insertNodes([imageNode]);
        }
      });
      setImageUrl('');
      setShowImageDialog(false);
    }
  };

  const insertCollapsible = () => {
    setShowCollapsibleDialog(true);
  };

  const handleInsertCollapsible = () => {
    if (collapsibleTitle && collapsibleContent) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const collapsibleNode = $createCollapsibleNode({
            title: collapsibleTitle,
            content: collapsibleContent,
            isOpen: false,
          });
          selection.insertNodes([collapsibleNode]);
        }
      });
      setCollapsibleTitle('Click to expand');
      setCollapsibleContent('');
      setShowCollapsibleDialog(false);
    }
  };

  const toggleSpeechToText = () => {
    const toggle = (window as any).__lexicalSpeechToText;
    if (toggle) {
      toggle();
      setIsListening(!isListening);
    }
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
      {/* Text Formatting */}
      <Button
        size="sm"
        variant="ghost"
        onClick={formatBold}
        className="h-8 w-8 p-0"
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={formatItalic}
        className="h-8 w-8 p-0"
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={formatCode}
        className="h-8 w-8 p-0"
        title="Inline Code"
      >
        <Code className="w-4 h-4" />
      </Button>

      <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Block Elements */}
      <Button
        size="sm"
        variant="ghost"
        onClick={insertHeading}
        className="h-8 w-8 p-0"
        title="Heading"
      >
        <Heading2 className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={insertQuote}
        className="h-8 w-8 p-0"
        title="Quote"
      >
        <Quote className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={insertCodeBlock}
        className="h-8 w-8 p-0"
        title="Code Block"
      >
        <Code className="w-4 h-4" />
      </Button>

      <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Lists */}
      <Button
        size="sm"
        variant="ghost"
        onClick={insertBulletList}
        className="h-8 w-8 p-0"
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={insertNumberedList}
        className="h-8 w-8 p-0"
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </Button>

      <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Rich Content */}
      <Button
        size="sm"
        variant="ghost"
        onClick={insertImage}
        className="h-8 w-8 p-0"
        title="Insert Image"
      >
        <ImageIcon className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={insertHorizontalRule}
        className="h-8 w-8 p-0"
        title="Horizontal Rule"
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={insertTable}
        className="h-8 w-8 p-0"
        title="Insert Table"
      >
        <TableIcon className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={insertCollapsible}
        className="h-8 px-3"
        title="Collapsible Container"
      >
        <ChevronDown className="w-4 h-4 mr-1" />
        <span className="text-xs">Collapsible</span>
      </Button>
      <Button
        size="sm"
        variant={isListening ? "default" : "ghost"}
        onClick={toggleSpeechToText}
        className={`h-8 w-8 p-0 ${isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : ''}`}
        title={isListening ? "Stop Recording" : "Voice to Text"}
      >
        <Mic className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="default"
        onClick={insertTLDraw}
        className="h-8 px-3"
        title="Insert Diagram"
      >
        <Presentation className="w-4 h-4 mr-1" />
        <span className="text-xs">Diagram</span>
      </Button>

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>
              Enter the URL of the image you want to insert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowImageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertImage} disabled={!imageUrl}>
              Insert Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collapsible Dialog */}
      <Dialog open={showCollapsibleDialog} onOpenChange={setShowCollapsibleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Collapsible Container</DialogTitle>
            <DialogDescription>
              Create a collapsible section with a title and content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="collapsible-title">Title</Label>
              <Input
                id="collapsible-title"
                value={collapsibleTitle}
                onChange={(e) => setCollapsibleTitle(e.target.value)}
                placeholder="Click to expand"
              />
            </div>
            <div>
              <Label htmlFor="collapsible-content">Content</Label>
              <Textarea
                id="collapsible-content"
                value={collapsibleContent}
                onChange={(e) => setCollapsibleContent(e.target.value)}
                placeholder="Content goes here..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCollapsibleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertCollapsible} disabled={!collapsibleTitle || !collapsibleContent}>
              Insert Collapsible
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
