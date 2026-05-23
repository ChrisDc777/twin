import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { TwinAndroidWidget } from '@/widgets/twin-android-widget';
import { readWidgetSnapshot } from '@/widgets/widget-snapshot';

// Single widget for MVP. As we add variants (medium, lockscreen, etc.)
// we'll dispatch on `widgetInfo.widgetName` here.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, widgetAction, renderWidget } = props;
  if (widgetInfo.widgetName !== 'Twin') return;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      renderWidget(
        <TwinAndroidWidget
          snapshot={readWidgetSnapshot()}
          width={widgetInfo.width}
          height={widgetInfo.height}
        />,
      );
      break;
    case 'WIDGET_CLICK':
    case 'WIDGET_DELETED':
      // No-op for MVP. Phase 4 wires WIDGET_CLICK to "send pulse".
      break;
  }
}
