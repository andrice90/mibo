import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useEffect, useState } from 'react';

// The web build is for checking Mibo on a desktop; public/canvaskit.wasm comes
// from `npx setup-skia-web public` (npm run web:setup).
let loading: Promise<void> | null = null;

export function useSkiaReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loading ??= LoadSkiaWeb({ locateFile: () => '/canvaskit.wasm' });
    loading.then(() => setReady(true));
  }, []);
  return ready;
}
