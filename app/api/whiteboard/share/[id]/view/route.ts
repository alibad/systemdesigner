import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, increment, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { pageId } = await request.json();
    const diagramId = params.id;

    console.log('[View API] Tracking view for:', { diagramId, pageId });

    if (pageId) {
      // Track page view - use setDoc with merge to create field if doesn't exist
      const pageRef = doc(db, 'diagrams', diagramId, 'pages', pageId);
      await setDoc(pageRef, { 
        views: increment(1), 
        updatedAt: Timestamp.now() 
      }, { merge: true });
      console.log('[View API] ✅ Page view tracked');
    } else {
      // Track diagram view
      const diagramRef = doc(db, 'diagrams', diagramId);
      await setDoc(diagramRef, { 
        views: increment(1), 
        updatedAt: Timestamp.now() 
      }, { merge: true });
      console.log('[View API] ✅ Diagram view tracked');
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[View API] ❌ Error tracking view:', error);
    console.error('[View API] Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    
    // Don't fail the request - view tracking is non-critical
    return NextResponse.json(
      { 
        success: false, 
        error: 'View tracking failed',
        details: error?.message || String(error)
      },
      { status: 200 } // Still return 200 so it doesn't break the UI
    );
  }
}