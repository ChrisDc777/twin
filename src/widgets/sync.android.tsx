import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { TwinAndroidWidget } from '@/widgets/twin-android-widget';
import { readWidgetSnapshot } from '@/widgets/widget-snapshot';

export async function syncWidget(): Promise<void> {
  try {
    await requestWidgetUpdate({
      widgetName: 'Twin',
      renderWidget: (info) => (
        <TwinAndroidWidget
          snapshot={readWidgetSnapshot()}
          width={info.width}
          height={info.height}
        />
      ),
      widgetNotFound: () => {
        // User hasn't placed the widget yet — nothing to do.
      },
    });
  } catch {
    // Widget refresh is best-effort; we never want it to break the app.
  }
}
