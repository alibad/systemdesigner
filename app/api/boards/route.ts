import { NextResponse } from 'next/server';
import { createDiagram, getUserDiagrams } from '@/lib/firebase';

export async function GET() {
  try {
    const diagrams = await getUserDiagrams();
    return NextResponse.json(diagrams);
  } catch (error) {
    console.error('Error fetching diagrams:', error);
    return NextResponse.json({ error: 'Failed to fetch diagrams' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Handle both 'json' (from whiteboard) and 'canvas' (legacy) formats
    const canvasData = body.json || body.canvas || {};
    
    const diagramId = await createDiagram({ 
      title: body.title ?? 'Untitled Whiteboard', 
      canvas: canvasData,
      visibility: body.visibility ?? 'private'
    });
    return NextResponse.json({ id: diagramId }, { status: 201 });
  } catch (error) {
    console.error('Error creating diagram:', error);
    return NextResponse.json({ error: 'Failed to create diagram' }, { status: 500 });
  }
}
