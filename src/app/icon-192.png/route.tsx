import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d6efd',
          color: '#ffffff',
          fontSize: 96,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        FH
      </div>
    ),
    { width: 192, height: 192 },
  );
}
