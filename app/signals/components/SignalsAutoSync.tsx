'use client';

import AutoSync from '@/app/components/AutoSync';

export default function SignalsAutoSync() {
  return (
    <AutoSync
      endpoint="/api/trends/sync"
      method="POST"
      cooldownMs={10 * 60 * 1000}
      refreshOnSuccess={true}
    />
  );
}

