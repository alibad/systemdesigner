import type {
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import { DecoratorNode } from 'lexical';
import * as React from 'react';
import { Suspense } from 'react';

const TLDrawComponent = React.lazy(() => import('./TLDrawComponent'));

export interface TLDrawNodeData {
  whiteboardId: string;
  pageId: string;
}

export type SerializedTLDrawNode = Spread<
  {
    whiteboardId: string;
    pageId: string;
    width: number | 'inherit';
    height: number | 'inherit';
  },
  SerializedLexicalNode
>;

export class TLDrawNode extends DecoratorNode<JSX.Element> {
  __whiteboardId: string;
  __pageId: string;
  __width: number | 'inherit';
  __height: number | 'inherit';

  static getType(): string {
    return 'tldraw';
  }

  static clone(node: TLDrawNode): TLDrawNode {
    return new TLDrawNode(
      node.__whiteboardId,
      node.__pageId,
      node.__width,
      node.__height,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedTLDrawNode): TLDrawNode {
    return $createTLDrawNode(
      serializedNode.whiteboardId,
      serializedNode.pageId,
      serializedNode.width === 'inherit' ? 'inherit' : serializedNode.width,
      serializedNode.height === 'inherit' ? 'inherit' : serializedNode.height,
    );
  }

  exportJSON(): SerializedTLDrawNode {
    return {
      whiteboardId: this.__whiteboardId,
      pageId: this.__pageId,
      width: this.__width === 'inherit' ? 'inherit' : this.__width,
      height: this.__height === 'inherit' ? 'inherit' : this.__height,
      type: 'tldraw',
      version: 1,
    };
  }

  constructor(
    whiteboardId = '',
    pageId = 'page:page',
    width: number | 'inherit' = 'inherit',
    height: number | 'inherit' = 'inherit',
    key?: NodeKey,
  ) {
    super(key);
    this.__whiteboardId = whiteboardId;
    this.__pageId = pageId;
    this.__width = width;
    this.__height = height;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-lexical-tldraw', 'true');
    element.setAttribute('data-whiteboard-id', this.__whiteboardId);
    element.setAttribute('data-page-id', this.__pageId);

    const content = document.createTextNode(
      `[TLDraw: ${this.__whiteboardId}/${this.__pageId}]`
    );
    element.append(content);

    return { element };
  }

  static importDOM() {
    return null;
  }

  updateWhiteboard(whiteboardId: string, pageId: string): void {
    const writable = this.getWritable();
    writable.__whiteboardId = whiteboardId;
    writable.__pageId = pageId;
  }

  setWidth(width: number | 'inherit'): void {
    const writable = this.getWritable();
    writable.__width = width;
  }

  setHeight(height: number | 'inherit'): void {
    const writable = this.getWritable();
    writable.__height = height;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'inline-block';
    div.style.width = this.__width === 'inherit' ? '100%' : `${this.__width}px`;
    div.style.height = this.__height === 'inherit' ? '500px' : `${this.__height}px`;
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <TLDrawComponent
          nodeKey={this.getKey()}
          whiteboardId={this.__whiteboardId}
          pageId={this.__pageId}
          width={this.__width}
          height={this.__height}
        />
      </Suspense>
    );
  }

  isTopLevel(): true {
    return true;
  }
}

export function $createTLDrawNode(
  whiteboardId: string,
  pageId = 'page:page',
  width: number | 'inherit' = 'inherit',
  height: number | 'inherit' = 'inherit',
): TLDrawNode {
  return new TLDrawNode(whiteboardId, pageId, width, height);
}

export function $isTLDrawNode(
  node: TLDrawNode | LexicalNode | null | undefined,
): node is TLDrawNode {
  return node instanceof TLDrawNode;
}
