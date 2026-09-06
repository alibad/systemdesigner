import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ADMIN_USER_IDS = ['0Dhfj8riMoUSLqV14GNPx3sA3hE3']; // Your admin user ID

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const pageId = searchParams.get('pageId');
    const diagramId = params.id;

    // Verify admin access
    if (!userId || !ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get the diagram (whiteboard) - unauthenticated read allowed by Firestore rules
    const diagramRef = doc(db, 'diagrams', diagramId);
    const diagramSnap = await getDoc(diagramRef);

    if (!diagramSnap.exists()) {
      return NextResponse.json(
        { error: 'Whiteboard not found' },
        { status: 404 }
      );
    }

    const diagramData = diagramSnap.data();

    // Get the owner's user document to show owner info
    let ownerEmail = 'Unknown';
    let ownerName = 'Unknown';
    try {
      const ownerRef = doc(db, 'users', diagramData.createdBy);
      const ownerSnap = await getDoc(ownerRef);
      if (ownerSnap.exists()) {
        const ownerData = ownerSnap.data();
        ownerEmail = ownerData.email || 'Unknown';
        ownerName = ownerData.displayName || ownerData.email || 'Unknown';
      }
    } catch (err) {
      console.error('Error fetching owner info:', err);
      // Continue anyway - owner info is nice to have but not critical
    }

    // Get all pages for this whiteboard
    const pagesRef = collection(db, 'diagrams', diagramId, 'pages');
    const pagesSnap = await getDocs(pagesRef);
    const pages = pagesSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data().pageName || 'Untitled Page',
    }));

    // Get the specific page data if pageId is provided, otherwise get first page
    let pageRecords: any[] = [];
    let currentPageId = pageId;

    if (!currentPageId && pages.length > 0) {
      // Use first page if no pageId specified
      currentPageId = pages[0].id;
    }

    if (currentPageId) {
      const pageRef = doc(db, 'diagrams', diagramId, 'pages', currentPageId);
      const pageSnap = await getDoc(pageRef);
      if (pageSnap.exists()) {
        pageRecords = pageSnap.data().records || [];
      }
    }

    return NextResponse.json({
      id: diagramId,
      title: diagramData.title || 'Untitled',
      records: pageRecords,
      currentPageId,
      pages,
      ownerId: diagramData.createdBy,
      ownerEmail,
      ownerName,
      visibility: diagramData.visibility || 'private',
      createdAt: diagramData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: diagramData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading admin whiteboard:', error);
    return NextResponse.json(
      { error: 'Server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
