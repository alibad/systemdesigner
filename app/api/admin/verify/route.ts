import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isEmailAdmin } from '@/lib/admin-security';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userSnap.data();

    return NextResponse.json({
      userId,
      email: userData.email,
      isAdminField: userData.isAdmin,
      isEmailAdmin: isEmailAdmin(userData.email),
      finalIsAdmin: userData.isAdmin === true || isEmailAdmin(userData.email),
      rawUserData: {
        email: userData.email,
        displayName: userData.displayName,
        isAdmin: userData.isAdmin,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
