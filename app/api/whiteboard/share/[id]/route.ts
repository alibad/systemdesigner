import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Cache for 1 day (86400 seconds)
const CACHE_DURATION = 86400;

interface WhiteboardData {
  id: string;
  title: string;
  records: any[];
  visibility: string;
  pageId?: string;
  pageName?: string;
  updatedAt: string;
}

async function getDiagramPublic(diagramId: string): Promise<any> {
  // Server-side public read. Firestore rules only allow this when the diagram is public.
  const docRef = doc(db, 'diagrams', diagramId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  
  return null;
}

async function getDiagramPageByIdPublic(diagramId: string, pageId: string): Promise<any> {
  // Server-side public read. Firestore rules only allow this when the page is public.
  const pageRef = doc(db, 'diagrams', diagramId, 'pages', pageId);
  const pageSnap = await getDoc(pageRef);
  
  if (pageSnap.exists()) {
    return { id: pageSnap.id, diagramId, ...pageSnap.data() };
  }
  
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page'); // Now expects pageId, not index
    const diagramId = params.id;

    let whiteboardData: WhiteboardData;

    // If specific page requested, load page directly by ID
    if (pageParam) {
      const pageDoc = await getDiagramPageByIdPublic(diagramId, pageParam);
      
      if (!pageDoc) {
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        );
      }

      if (pageDoc.visibility !== 'public') {
        return NextResponse.json(
          { error: 'Page not public' },
          { status: 403 }
        );
      }

      whiteboardData = {
        id: diagramId,
        title: pageDoc.pageName || 'Shared Page',
        records: pageDoc.records || [],
        visibility: pageDoc.visibility,
        pageId: pageDoc.pageId,
        pageName: pageDoc.pageName,
        updatedAt: pageDoc.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      };
    } else {
      // Fallback: load full canvas from main diagram
      const diagram = await getDiagramPublic(diagramId);
      
      if (!diagram) {
        return NextResponse.json(
          { error: 'Diagram not found' },
          { status: 404 }
        );
      }

      if (diagram.visibility !== 'public') {
        return NextResponse.json(
          { error: 'Diagram not public' },
          { status: 403 }
        );
      }

      whiteboardData = {
        id: diagramId,
        title: diagram.title || 'Shared Whiteboard',
        records: diagram.canvas?.records || [],
        visibility: diagram.visibility,
        updatedAt: diagram.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      };
    }

    // Create response with cache headers
    const response = NextResponse.json({
      success: true,
      data: whiteboardData
    });

    // Set cache headers for CDN caching
    response.headers.set('Cache-Control', `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}, stale-while-revalidate=86400`);
    response.headers.set('CDN-Cache-Control', `public, max-age=${CACHE_DURATION}`);
    response.headers.set('Vercel-CDN-Cache-Control', `public, max-age=${CACHE_DURATION}`);
    
    // Add ETag for better caching
    const etag = `"${diagramId}-${whiteboardData.updatedAt}"`;
    response.headers.set('ETag', etag);
    
    // Check if client has cached version
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return response;

  } catch (error) {
    console.error('Error fetching shared whiteboard:', error);
    
    return NextResponse.json(
      { error: 'Failed to load whiteboard' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  }
}
