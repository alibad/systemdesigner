import { NextResponse } from 'next/server';
import { createProject, getUserProjects, getPublicProjects } from '@/lib/firebase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope'); // 'public' or 'user' (default)
    
    let projects;
    if (scope === 'public') {
      projects = await getPublicProjects();
    } else {
      projects = await getUserProjects();
    }
    
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = await createProject({
      title: body.title ?? 'Untitled Project',
      description: body.description ?? '',
      status: body.status ?? 'planning',
      visibility: body.visibility ?? 'private',
      requirements: body.requirements || [],
      diagrams: body.diagrams || []
    });
    
    return NextResponse.json({ id: projectId }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}