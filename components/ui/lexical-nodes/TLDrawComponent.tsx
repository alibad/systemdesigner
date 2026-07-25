'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  NodeKey,
} from 'lexical';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { $isTLDrawNode } from './TLDrawNode';
import { TLDrawEmbed } from '@/components/project/TLDrawEmbed';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Trash2 } from 'lucide-react';

interface TLDrawComponentProps {
  nodeKey: NodeKey;
  whiteboardId: string;
  pageId: string;
  width: number | 'inherit';
  height: number | 'inherit';
}

export default function TLDrawComponent({
  nodeKey,
  whiteboardId,
  pageId,
  width: initialWidth,
  height: initialHeight,
}: TLDrawComponentProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const width = useMemo(
    () => (initialWidth === 'inherit' ? '100%' : `${initialWidth}px`),
    [initialWidth]
  );

  const height = useMemo(
    () => (initialHeight === 'inherit' ? '400px' : `${initialHeight}px`),
    [initialHeight]
  );

  const expandedHeight = useMemo(
    () => (initialHeight === 'inherit' ? '600px' : `${initialHeight}px`),
    [initialHeight]
  );

  const deleteNode = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isTLDrawNode(node)) {
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (isSelected && $isNodeSelection($getSelection())) {
        deleteNode();
        return true;
      }
      return false;
    },
    [deleteNode, isSelected]
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          if (containerRef.current && containerRef.current.contains(target)) {
            if (!event.shiftKey) {
              clearSelection();
            }
            setSelected(true);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, isSelected, clearSelection, setSelected, onDelete]);

  return (
    <div
      ref={containerRef}
      className={`relative my-4 rounded-lg border-2 ${
        isSelected
          ? 'border-blue-500 dark:border-blue-400'
          : 'border-gray-200 dark:border-gray-700'
      }`}
      style={{
        width,
        height: isExpanded ? expandedHeight : height,
      }}
    >
      {/* Control Bar */}
      <div className="absolute top-2 right-2 z-10 flex gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-lg border border-gray-200 dark:border-gray-700">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 px-2"
        >
          {isExpanded ? (
            <>
              <Minimize2 className="w-4 h-4 mr-1" />
              <span className="text-xs">Collapse</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4 mr-1" />
              <span className="text-xs">Expand</span>
            </>
          )}
        </Button>
        {isSelected && (
          <Button
            size="sm"
            variant="ghost"
            onClick={deleteNode}
            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            <span className="text-xs">Delete</span>
          </Button>
        )}
      </div>

      {/* TLDraw Embed */}
      <div className="w-full h-full overflow-hidden rounded-lg">
        <TLDrawEmbed
          whiteboardId={whiteboardId}
          pageId={pageId}
          isEditable={true}
          height="100%"
        />
      </div>
    </div>
  );
}
