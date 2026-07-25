/**
 * Renders a server-transformed Markdoc tree. Interactive tags remain isolated client
 * components, while prose and structural tags render on the server.
 */

import React from 'react';
import Markdoc, { type RenderableTreeNode } from '@markdoc/markdoc';
import { markdocComponents } from '@/markdoc/components';

export default function MarkdocLesson({ tree }: { tree: RenderableTreeNode }) {
  return <>{Markdoc.renderers.react(tree, React, { components: markdocComponents })}</>;
}
