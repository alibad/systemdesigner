'use client';

import {
  DecoratorNode,
  DOMConversionMap,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type SerializedCollapsibleNode = Spread<
  {
    title: string;
    content: string;
    isOpen: boolean;
    type: 'collapsible';
  },
  SerializedLexicalNode
>;

export class CollapsibleNode extends DecoratorNode<JSX.Element> {
  __title: string;
  __content: string;
  __isOpen: boolean;

  static getType(): string {
    return 'collapsible';
  }

  static clone(node: CollapsibleNode): CollapsibleNode {
    return new CollapsibleNode(node.__title, node.__content, node.__isOpen, node.__key);
  }

  constructor(title: string, content: string, isOpen: boolean = false, key?: NodeKey) {
    super(key);
    this.__title = title;
    this.__content = content;
    this.__isOpen = isOpen;
  }

  static importJSON(serializedNode: SerializedCollapsibleNode): CollapsibleNode {
    const { title, content, isOpen } = serializedNode;
    return $createCollapsibleNode({ title, content, isOpen });
  }

  exportJSON(): SerializedCollapsibleNode {
    return {
      title: this.__title,
      content: this.__content,
      isOpen: this.__isOpen,
      type: 'collapsible',
      version: 1,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('details');
    if (this.__isOpen) element.setAttribute('open', '');

    const summary = document.createElement('summary');
    summary.textContent = this.__title;
    element.appendChild(summary);

    const content = document.createElement('div');
    content.textContent = this.__content;
    element.appendChild(content);

    return { element };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'collapsible-node-container';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <CollapsibleComponent title={this.__title} content={this.__content} initiallyOpen={this.__isOpen} />;
  }
}

function CollapsibleComponent({
  title,
  content,
  initiallyOpen = false,
}: {
  title: string;
  content: string;
  initiallyOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    <div className="my-4 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <span className="font-medium">{title}</span>
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-white dark:bg-gray-900">
          <p className="text-gray-700 dark:text-gray-300">{content}</p>
        </div>
      )}
    </div>
  );
}

export function $createCollapsibleNode({
  title,
  content,
  isOpen = false,
}: {
  title: string;
  content: string;
  isOpen?: boolean;
}): CollapsibleNode {
  return new CollapsibleNode(title, content, isOpen);
}

export function $isCollapsibleNode(
  node: LexicalNode | null | undefined,
): node is CollapsibleNode {
  return node instanceof CollapsibleNode;
}
