import { NextRequest, NextResponse } from 'next/server';
import {
  ContentAssetNotFoundError,
  getContentAssetCacheControl,
  getContentAssetMimeType,
  InvalidContentAssetPathError,
  readContentAsset,
} from '@/lib/content-assets';

export async function GET(_request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const asset = await readContentAsset(params.path);

    return new NextResponse(asset.content, {
      headers: {
        'Content-Type': getContentAssetMimeType(asset.filePath),
        'Cache-Control': getContentAssetCacheControl(),
      },
    });
  } catch (error) {
    if (error instanceof InvalidContentAssetPathError) {
      return new NextResponse('Invalid content asset path', { status: 400 });
    }

    if (!(error instanceof ContentAssetNotFoundError)) {
      console.error('Failed to read content asset:', error);
    }
    return new NextResponse('File not found or inaccessible', { status: 404 });
  }
}
