import {
  DecoratorNode,
  DOMConversionMap,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

export type SerializedHorizontalRuleNode = Spread<
  {
    type: 'horizontal-rule';
  },
  SerializedLexicalNode
>;

export class HorizontalRuleNode extends DecoratorNode<JSX.Element> {
  static getType(): string {
    return 'horizontal-rule';
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  static importJSON(serializedNode: SerializedHorizontalRuleNode): HorizontalRuleNode {
    return $createHorizontalRuleNode();
  }

  exportJSON(): SerializedHorizontalRuleNode {
    return {
      type: 'horizontal-rule',
      version: 1,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      hr: () => ({
        conversion: () => ({ node: $createHorizontalRuleNode() }),
        priority: 0,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement('hr') };
  }

  createDOM(): HTMLElement {
    return document.createElement('hr');
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <hr className="my-4 border-t-2 border-gray-300 dark:border-gray-700" />;
  }
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return new HorizontalRuleNode();
}

export function $isHorizontalRuleNode(
  node: LexicalNode | null | undefined,
): node is HorizontalRuleNode {
  return node instanceof HorizontalRuleNode;
}
