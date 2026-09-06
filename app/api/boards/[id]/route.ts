import { NextResponse } from 'next/server';
import { getDiagram, updateDiagram, deleteDiagram } from '@/lib/firebase';

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const diagram = await getDiagram(params.id);
    if (!diagram) return NextResponse.json({ error: 'Diagram not found' }, { status: 404 });
    return NextResponse.json(diagram);
  } catch (error) {
    console.error('Error fetching diagram:', error);
    return NextResponse.json({ error: 'Failed to fetch diagram' }, { status: 500 });
  }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await req.json();
    // Handle both 'json' (from whiteboard) and 'canvas' (legacy) formats
    const updates: any = {};
    
    if (body.title !== undefined) updates.title = body.title;
    if (body.visibility !== undefined) updates.visibility = body.visibility;
    if (body.json !== undefined) updates.canvas = body.json;
    if (body.canvas !== undefined) updates.canvas = body.canvas;
    
    await updateDiagram(params.id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating diagram:', error);
    return NextResponse.json({ error: 'Failed to update diagram' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await deleteDiagram(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting diagram:', error);
    return NextResponse.json({ error: 'Failed to delete diagram' }, { status: 500 });
  }
}
